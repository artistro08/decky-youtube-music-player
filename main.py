import decky
import json
import os
import asyncio
import random

SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
OAUTH_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "oauth.json")

class Plugin:
    client_id = ""
    client_secret = ""
    authenticated = False
    ytmusic = None
    oauth_pending = None  # holds pending OAuth state

    # Queue / playback state
    queue = []              # list of dicts: { videoId, title, artist, album, albumArt, duration }
    queue_position = 0
    is_playing = False
    shuffle = False
    shuffle_order = []
    repeat = "NONE"         # NONE | ALL | ONE
    volume = 1.0

    def _load_settings(self):
        """Load saved credentials from disk."""
        if os.path.exists(SETTINGS_FILE):
            try:
                with open(SETTINGS_FILE, "r") as f:
                    data = json.load(f)
                self.client_id = data.get("client_id", "")
                self.client_secret = data.get("client_secret", "")
            except Exception as e:
                decky.logger.error(f"Failed to load settings: {e}")

    def _save_settings(self):
        """Save credentials to disk."""
        os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
        with open(SETTINGS_FILE, "w") as f:
            json.dump({
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            }, f)

    def _try_init_ytmusic(self):
        """Try to initialize ytmusicapi with saved OAuth credentials."""
        if os.path.exists(OAUTH_FILE) and self.client_id and self.client_secret:
            try:
                from ytmusicapi import YTMusic, OAuthCredentials
                creds = OAuthCredentials(
                    client_id=self.client_id,
                    client_secret=self.client_secret,
                )
                self.ytmusic = YTMusic(OAUTH_FILE, oauth_credentials=creds)
                self.authenticated = True
                decky.logger.info("ytmusicapi initialized successfully")
            except Exception as e:
                decky.logger.error(f"Failed to init ytmusicapi: {e}")
                self.authenticated = False
                self.ytmusic = None

    async def _main(self):
        decky.logger.info("YouTube Music plugin loaded")
        self._load_settings()
        self._try_init_ytmusic()

    async def _unload(self):
        decky.logger.info("YouTube Music plugin unloaded")

    async def save_credentials(self, client_id: str, client_secret: str):
        """Save OAuth client credentials. Called from frontend."""
        self.client_id = client_id
        self.client_secret = client_secret
        self._save_settings()
        decky.logger.info("Credentials saved")
        return {"success": True}

    async def get_auth_state(self):
        """Return current auth status. Called from frontend."""
        return {
            "has_credentials": bool(self.client_id and self.client_secret),
            "authenticated": self.authenticated,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }

    async def start_oauth(self):
        """Begin the OAuth device auth flow. Returns URL and code for user."""
        if not self.client_id or not self.client_secret:
            return {"error": "No credentials saved"}

        try:
            from ytmusicapi import OAuthCredentials

            creds = OAuthCredentials(
                client_id=self.client_id,
                client_secret=self.client_secret,
            )

            # Request device code from Google
            code_response = creds.get_code()
            self.oauth_pending = {
                "credentials": creds,
                "code_response": code_response,
                "start_time": asyncio.get_event_loop().time(),
            }

            decky.logger.info(f"OAuth device flow started. URL: {code_response['verification_url']}, Code: {code_response['user_code']}")

            return {
                "url": code_response.get("verification_url", ""),
                "code": code_response.get("user_code", ""),
            }
        except Exception as e:
            decky.logger.error(f"Failed to start OAuth: {e}")
            return {"error": str(e)}

    async def check_oauth_status(self):
        """Poll whether the user has completed the OAuth flow."""
        if not self.oauth_pending:
            return {"status": "no_pending"}

        elapsed = asyncio.get_event_loop().time() - self.oauth_pending["start_time"]
        if elapsed > 300:  # 5-minute timeout
            self.oauth_pending = None
            return {"status": "timeout"}

        try:
            creds = self.oauth_pending["credentials"]
            code_response = self.oauth_pending["code_response"]

            # token_from_code() returns a plain dict (response.json()).
            # If user hasn't authorized yet, Google returns {"error": "authorization_pending"}.
            # If authorized, returns {"access_token": "...", "refresh_token": "...", ...}.
            raw_token = creds.token_from_code(code_response["device_code"])

            # Check if Google returned an error (user hasn't completed auth yet)
            if "error" in raw_token:
                error_type = raw_token["error"]
                if error_type in ("authorization_pending", "slow_down"):
                    return {"status": "pending"}
                else:
                    decky.logger.error(f"OAuth token error: {error_type}")
                    self.oauth_pending = None
                    return {"status": "error", "message": raw_token.get("error_description", error_type)}

            # Valid token received — build a RefreshingToken the same way
            # ytmusicapi's own prompt_for_token() does it
            if "access_token" not in raw_token:
                return {"status": "pending"}

            from ytmusicapi.auth.oauth import RefreshingToken
            ref_token = RefreshingToken(credentials=creds, **raw_token)
            ref_token.update(ref_token.as_dict())  # compute expires_at

            # Save using ytmusicapi's own store_token method
            from pathlib import Path
            os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
            ref_token.store_token(Path(OAUTH_FILE))

            # Initialize ytmusicapi
            self._try_init_ytmusic()
            self.oauth_pending = None

            if self.authenticated:
                await decky.emit("auth_complete")
                return {"status": "authenticated"}
            else:
                return {"status": "error", "message": "Token saved but initialization failed"}
        except Exception as e:
            error_msg = str(e)
            # Catch any remaining authorization_pending exceptions
            if "authorization_pending" in error_msg.lower():
                return {"status": "pending"}
            decky.logger.error(f"OAuth check error: {e}")
            return {"status": "error", "message": error_msg}

    async def sign_out(self):
        """Sign out — delete oauth.json and reset state."""
        self.authenticated = False
        self.ytmusic = None
        self.oauth_pending = None
        if os.path.exists(OAUTH_FILE):
            os.remove(OAUTH_FILE)
        decky.logger.info("Signed out")
        return {"success": True}

    # ── Streaming URL ──────────────────────────────────────────────

    def _get_streaming_url(self, video_id):
        """Fetch the best audio streaming URL for a video."""
        if not self.ytmusic:
            return None
        try:
            song_data = self.ytmusic.get_song(video_id)
            streaming_data = song_data.get("streamingData", {})
            adaptive_formats = streaming_data.get("adaptiveFormats", [])

            # Filter audio-only formats
            audio_formats = [f for f in adaptive_formats if f.get("mimeType", "").startswith("audio/")]

            if not audio_formats:
                decky.logger.warning(f"No audio formats found for {video_id}")
                return None

            # Prefer audio/mp4, then audio/webm, highest bitrate first
            mp4_formats = [f for f in audio_formats if "mp4" in f.get("mimeType", "")]
            webm_formats = [f for f in audio_formats if "webm" in f.get("mimeType", "")]

            candidates = mp4_formats or webm_formats or audio_formats
            candidates.sort(key=lambda f: f.get("bitrate", 0), reverse=True)

            url = candidates[0].get("url")
            if not url:
                decky.logger.warning(f"No URL in format for {video_id}")
                return None

            return url
        except Exception as e:
            decky.logger.error(f"Failed to get streaming URL for {video_id}: {e}")
            return None

    def _current_track_with_url(self):
        """Return current track metadata + fresh streaming URL."""
        if not self.queue or self.queue_position >= len(self.queue):
            return None

        track = self.queue[self.queue_position]
        url = self._get_streaming_url(track["videoId"])

        return {
            "videoId": track["videoId"],
            "title": track.get("title", ""),
            "artist": track.get("artist", ""),
            "album": track.get("album", ""),
            "albumArt": track.get("albumArt", ""),
            "duration": track.get("duration", 0),
            "url": url,
            "queuePosition": self.queue_position,
            "queueLength": len(self.queue),
        }

    # ── Playback controls ──────────────────────────────────────────

    async def get_current_track(self):
        """Return current track with fresh streaming URL."""
        result = self._current_track_with_url()
        if result is None:
            return {"error": "No track in queue"}
        if result["url"] is None:
            return {"error": "Failed to get streaming URL"}
        return result

    async def resume(self):
        """Update internal playing state."""
        self.is_playing = True
        return {"success": True}

    async def pause(self):
        """Update internal paused state."""
        self.is_playing = False
        return {"success": True}

    def _advance_queue(self, direction=1):
        """Advance queue position. direction: 1=next, -1=previous.
        Returns track with URL, or None if playback should stop."""
        if not self.queue:
            return None

        if self.repeat == "ONE":
            return self._current_track_with_url()

        if self.shuffle and self.shuffle_order:
            try:
                shuffle_idx = self.shuffle_order.index(self.queue_position)
            except ValueError:
                shuffle_idx = 0
            shuffle_idx += direction

            if shuffle_idx >= len(self.shuffle_order):
                if self.repeat == "ALL":
                    shuffle_idx = 0
                else:
                    self.is_playing = False
                    return None
            elif shuffle_idx < 0:
                if self.repeat == "ALL":
                    shuffle_idx = len(self.shuffle_order) - 1
                else:
                    shuffle_idx = 0

            self.queue_position = self.shuffle_order[shuffle_idx]
        else:
            self.queue_position += direction

            if self.queue_position >= len(self.queue):
                if self.repeat == "ALL":
                    self.queue_position = 0
                else:
                    self.queue_position = len(self.queue) - 1
                    self.is_playing = False
                    return None
            elif self.queue_position < 0:
                if self.repeat == "ALL":
                    self.queue_position = len(self.queue) - 1
                else:
                    self.queue_position = 0

        self.is_playing = True
        return self._current_track_with_url()

    async def next_track(self):
        """Advance to next track in queue."""
        result = self._advance_queue(1)
        if result is None:
            return {"stopped": True}
        if result.get("url") is None:
            return {"error": "Failed to get streaming URL"}
        return result

    async def previous_track(self):
        """Go to previous track in queue."""
        result = self._advance_queue(-1)
        if result is None:
            return {"stopped": True}
        if result.get("url") is None:
            return {"error": "Failed to get streaming URL"}
        return result

    async def track_ended(self):
        """Called by frontend when <audio> fires 'ended'. Same as next_track."""
        return await self.next_track()

    async def get_playback_state(self):
        """Return full playback state for frontend sync on panel open."""
        track = None
        if self.queue and self.queue_position < len(self.queue):
            track = self.queue[self.queue_position]
        return {
            "is_playing": self.is_playing,
            "shuffle": self.shuffle,
            "repeat": self.repeat,
            "volume": self.volume,
            "queue_position": self.queue_position,
            "queue_length": len(self.queue),
            "current_track": track,
        }

    # ── Shuffle / Repeat ───────────────────────────────────────────

    async def toggle_shuffle(self):
        """Toggle shuffle mode. Regenerate shuffle order if enabling."""
        self.shuffle = not self.shuffle
        if self.shuffle and self.queue:
            self.shuffle_order = list(range(len(self.queue)))
            random.shuffle(self.shuffle_order)
            if self.queue_position in self.shuffle_order:
                self.shuffle_order.remove(self.queue_position)
                self.shuffle_order.insert(0, self.queue_position)
        else:
            self.shuffle_order = []
        return {"shuffle": self.shuffle}

    async def toggle_repeat(self):
        """Cycle repeat mode: NONE -> ALL -> ONE -> NONE."""
        cycle = {"NONE": "ALL", "ALL": "ONE", "ONE": "NONE"}
        self.repeat = cycle.get(self.repeat, "NONE")
        return {"repeat": self.repeat}

    # ── Diagnostic: test which ytmusicapi methods work ──

    async def test_api(self):
        """Test various ytmusicapi methods and capture detailed diagnostics."""
        if not self.ytmusic:
            return {"error": "Not authenticated"}

        results = {}

        # Diagnostic info
        results["auth_type"] = str(self.ytmusic.auth_type)
        results["has_token"] = hasattr(self.ytmusic, '_token')
        if hasattr(self.ytmusic, '_token'):
            token = self.ytmusic._token
            results["token_type"] = getattr(token, 'token_type', 'unknown')
            results["token_scope"] = getattr(token, 'scope', 'unknown')
            results["token_expires_at"] = getattr(token, 'expires_at', 0)
            results["token_is_expiring"] = getattr(token, 'is_expiring', 'unknown')
            import time
            results["current_time"] = int(time.time())
            results["token_access_preview"] = getattr(token, 'access_token', '')[:20] + "..."

        # Capture raw request details by making a manual request
        try:
            import requests as req
            headers = dict(self.ytmusic.headers)
            # Remove potentially sensitive full tokens but keep structure
            if 'authorization' in headers:
                results["auth_header"] = headers['authorization'][:30] + "..."
            results["request_headers_keys"] = list(headers.keys())

            context = self.ytmusic.context
            results["client_name"] = context.get("context", {}).get("client", {}).get("clientName", "")
            results["client_version"] = context.get("context", {}).get("client", {}).get("clientVersion", "")

            # Make a raw search request manually to capture full response
            url = "https://music.youtube.com/youtubei/v1/search" + self.ytmusic.params
            body = {"query": "test"}
            body.update(context)
            resp = self.ytmusic._session.post(
                url,
                json=body,
                headers=headers,
                proxies=self.ytmusic.proxies,
                cookies=self.ytmusic.cookies,
            )
            results["raw_status"] = resp.status_code
            results["raw_reason"] = resp.reason
            if resp.status_code >= 400:
                try:
                    resp_json = resp.json()
                    results["raw_error"] = resp_json.get("error", {})
                except Exception:
                    results["raw_error_text"] = resp.text[:500]
            else:
                results["raw_response_keys"] = list(resp.json().keys())
                results["search"] = "OK"
        except Exception as e:
            results["raw_request_error"] = str(e)

        decky.logger.info(f"API test results: {json.dumps(results, indent=2, default=str)}")
        return results

    # ── Temporary: load playlist for testing (will be replaced by Library tab) ──

    async def load_playlist(self, playlist_id):
        """Load a playlist into the queue and return the first track."""
        if not self.ytmusic:
            return {"error": "Not authenticated"}

        try:
            if playlist_id == "LM":
                playlist_data = self.ytmusic.get_liked_songs(limit=50)
            else:
                playlist_data = self.ytmusic.get_playlist(playlist_id, limit=50)

            tracks = playlist_data.get("tracks", [])
            if not tracks:
                return {"error": "Playlist is empty"}

            self.queue = []
            for t in tracks:
                thumbnails = t.get("thumbnails", [])
                album_art = thumbnails[-1]["url"] if thumbnails else ""

                artists = t.get("artists", [])
                artist_name = ", ".join(a.get("name", "") for a in artists) if artists else ""

                album = t.get("album")
                album_name = album.get("name", "") if album else ""

                duration_seconds = t.get("duration_seconds", 0)
                if not duration_seconds:
                    duration_str = t.get("duration", "0:00")
                    parts = duration_str.split(":")
                    try:
                        if len(parts) == 2:
                            duration_seconds = int(parts[0]) * 60 + int(parts[1])
                        elif len(parts) == 3:
                            duration_seconds = int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
                    except ValueError:
                        duration_seconds = 0

                self.queue.append({
                    "videoId": t.get("videoId", ""),
                    "title": t.get("title", "Unknown"),
                    "artist": artist_name,
                    "album": album_name,
                    "albumArt": album_art,
                    "duration": duration_seconds,
                })

            self.queue = [t for t in self.queue if t["videoId"]]

            if not self.queue:
                return {"error": "No playable tracks in playlist"}

            self.queue_position = 0

            if self.shuffle:
                self.shuffle_order = list(range(len(self.queue)))
                random.shuffle(self.shuffle_order)
                self.shuffle_order.remove(0)
                self.shuffle_order.insert(0, 0)
            else:
                self.shuffle_order = []

            result = self._current_track_with_url()
            if result is None or result.get("url") is None:
                return {"error": "Failed to get streaming URL for first track"}

            self.is_playing = True
            return result
        except Exception as e:
            decky.logger.error(f"Failed to load playlist {playlist_id}: {e}")
            return {"error": str(e)}
