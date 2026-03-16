import decky
import json
import os
import random

BROWSER_AUTH_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "browser.json")

class Plugin:
    authenticated = False
    ytmusic = None

    # Queue / playback state
    queue = []
    queue_position = 0
    is_playing = False
    shuffle = False
    shuffle_order = []
    repeat = "NONE"         # NONE | ALL | ONE
    volume = 1.0

    # ── Authentication (browser cookies) ───────────────────────────

    def _try_init_ytmusic(self):
        """Try to initialize ytmusicapi with saved browser credentials."""
        if os.path.exists(BROWSER_AUTH_FILE):
            try:
                from ytmusicapi import YTMusic
                self.ytmusic = YTMusic(BROWSER_AUTH_FILE)
                self.authenticated = True
                decky.logger.info("ytmusicapi initialized with browser auth")
            except Exception as e:
                decky.logger.error(f"Failed to init ytmusicapi: {e}")
                self.authenticated = False
                self.ytmusic = None

    async def _main(self):
        decky.logger.info("YouTube Music plugin loaded")
        self._try_init_ytmusic()

    async def _unload(self):
        decky.logger.info("YouTube Music plugin unloaded")

    async def get_auth_state(self):
        """Return current auth status."""
        return {
            "authenticated": self.authenticated,
        }

    async def load_headers_from_file(self, file_path: str):
        """Read browser request headers from a text file on the Deck.
        Uses ytmusicapi.setup() to parse raw headers into browser.json."""
        try:
            if not os.path.exists(file_path):
                return {"error": f"File not found: {file_path}"}

            with open(file_path, "r") as f:
                headers_raw = f.read()

            if not headers_raw.strip():
                return {"error": "File is empty"}

            from ytmusicapi import setup
            os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
            setup(filepath=BROWSER_AUTH_FILE, headers_raw=headers_raw)
            decky.logger.info(f"Browser headers loaded from {file_path}")

            # Re-initialize ytmusicapi
            self._try_init_ytmusic()

            if self.authenticated:
                return {"success": True}
            else:
                return {"error": "Headers saved but initialization failed. Check that the headers are correct."}
        except Exception as e:
            decky.logger.error(f"Failed to load headers from file: {e}")
            return {"error": str(e)}

    async def sign_out(self):
        """Sign out — delete browser.json and reset state."""
        self.authenticated = False
        self.ytmusic = None
        if os.path.exists(BROWSER_AUTH_FILE):
            os.remove(BROWSER_AUTH_FILE)
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

            audio_formats = [f for f in adaptive_formats if f.get("mimeType", "").startswith("audio/")]

            if not audio_formats:
                decky.logger.warning(f"No audio formats found for {video_id}")
                return None

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
        self.is_playing = True
        return {"success": True}

    async def pause(self):
        self.is_playing = False
        return {"success": True}

    def _advance_queue(self, direction=1):
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
        result = self._advance_queue(1)
        if result is None:
            return {"stopped": True}
        if result.get("url") is None:
            return {"error": "Failed to get streaming URL"}
        return result

    async def previous_track(self):
        result = self._advance_queue(-1)
        if result is None:
            return {"stopped": True}
        if result.get("url") is None:
            return {"error": "Failed to get streaming URL"}
        return result

    async def track_ended(self):
        return await self.next_track()

    async def get_playback_state(self):
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
        cycle = {"NONE": "ALL", "ALL": "ONE", "ONE": "NONE"}
        self.repeat = cycle.get(self.repeat, "NONE")
        return {"repeat": self.repeat}

    # ── Playlist loading (temporary test — replaced by Library tab in Phase 6) ──

    async def load_playlist(self, playlist_id):
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
