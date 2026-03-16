import decky
import json
import os
import random

_PY_MODULES = os.path.join(decky.DECKY_PLUGIN_DIR, "py_modules")
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
        """Fetch the best audio streaming URL using yt-dlp as a subprocess.
        Runs in a separate Python process to avoid Decky sandbox import issues."""
        import subprocess
        try:
            env = os.environ.copy()
            # Add our py_modules to PYTHONPATH so the subprocess can find yt-dlp
            env['PYTHONPATH'] = _PY_MODULES + ':' + env.get('PYTHONPATH', '')
            # Strip LD_LIBRARY_PATH to avoid Decky's bundled OpenSSL conflicting
            # with the system Python's ssl module (same fix as Deckify)
            env.pop('LD_LIBRARY_PATH', None)

            result = subprocess.run(
                [
                    'python3', '-m', 'yt_dlp',
                    '--print', 'urls',
                    '-f', 'bestaudio[ext=m4a]/bestaudio',
                    '--no-warnings',
                    '-q',
                    f'https://music.youtube.com/watch?v={video_id}',
                ],
                capture_output=True,
                text=True,
                env=env,
                timeout=30,
            )

            url = result.stdout.strip()
            if url and url.startswith('http'):
                decky.logger.info(f"Got streaming URL for {video_id}")
                return url
            else:
                decky.logger.warning(f"yt-dlp returned no URL for {video_id}. stderr: {result.stderr[-500:]}")
                return None
        except subprocess.TimeoutExpired:
            decky.logger.error(f"yt-dlp timed out for {video_id}")
            return None
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

    # ── Volume ─────────────────────────────────────────────────────

    async def set_volume(self, value):
        """Set volume. value is 0-100 from frontend."""
        import subprocess
        self.volume = max(0, min(100, value)) / 100.0  # store as 0.0-1.0

        # Try to set PulseAudio volume for CEF sink-inputs
        try:
            env = os.environ.copy()
            env.pop('LD_LIBRARY_PATH', None)

            result = subprocess.run(
                ["pactl", "list", "sink-inputs"],
                capture_output=True, text=True, env=env, timeout=5,
            )
            output = result.stdout

            # Parse sink-input indices for steamwebhelper
            current_index = None
            indices = []
            for line in output.split("\n"):
                line = line.strip()
                if line.startswith("Sink Input #"):
                    current_index = line.split("#")[1].strip()
                elif "application.name" in line and "steamwebhelper" in line.lower():
                    if current_index:
                        indices.append(current_index)

            # Set volume on all matching sink-inputs
            percentage = int(value)
            for idx in indices:
                subprocess.run(
                    ["pactl", "set-sink-input-volume", idx, f"{percentage}%"],
                    capture_output=True, env=env, timeout=5,
                )

            if not indices:
                decky.logger.debug("No steamwebhelper sink-inputs found for volume control")
        except Exception as e:
            decky.logger.warning(f"PulseAudio volume control failed (falling back to <audio> only): {e}")

        return {"volume": value}

    async def get_volume(self):
        """Return current volume (0-100 for frontend)."""
        return {"volume": self.volume * 100}

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

    # ── Queue management ─────────────────────────────────────────────

    async def get_queue(self):
        return {
            "tracks": self.queue,
            "position": self.queue_position,
        }

    async def remove_from_queue(self, index):
        if index < 0 or index >= len(self.queue):
            return {"error": "Invalid index"}

        self.queue.pop(index)

        if index < self.queue_position:
            self.queue_position -= 1
        elif index == self.queue_position:
            if self.queue_position >= len(self.queue):
                self.queue_position = max(0, len(self.queue) - 1)

        if self.shuffle and self.queue:
            self.shuffle_order = list(range(len(self.queue)))
            random.shuffle(self.shuffle_order)
            if self.queue_position in self.shuffle_order:
                self.shuffle_order.remove(self.queue_position)
                self.shuffle_order.insert(0, self.queue_position)

        return {"success": True, "queue_length": len(self.queue)}

    async def jump_to_queue(self, index):
        if index < 0 or index >= len(self.queue):
            return {"error": "Invalid index"}

        self.queue_position = index
        result = self._current_track_with_url()
        if result is None or result.get("url") is None:
            return {"error": "Failed to get streaming URL"}
        return result

    # ── Diagnostic ──────────────────────────────────────────────────

    async def test_api(self):
        """Test ytmusicapi methods with browser auth."""
        if not self.ytmusic:
            return {"error": "Not authenticated"}

        results = {}
        results["auth_type"] = str(self.ytmusic.auth_type)

        # Test search
        try:
            sr = self.ytmusic.search("never gonna give you up", filter="songs", limit=1)
            if sr:
                results["search"] = "OK"
                results["search_videoId"] = sr[0].get("videoId", "")
                results["search_title"] = sr[0].get("title", "")
            else:
                results["search"] = "OK but empty"
        except Exception as e:
            results["search"] = f"FAIL: {str(e)[:200]}"

        # Test get_song
        video_id = results.get("search_videoId", "dQw4w9WgXcQ")
        try:
            song = self.ytmusic.get_song(video_id)
            playability = song.get("playabilityStatus", {})
            results["playability_status"] = playability.get("status", "unknown")
            results["playability_reason"] = playability.get("reason", "")

            streaming = song.get("streamingData", {})
            results["has_streamingData"] = bool(streaming)
            results["expiresInSeconds"] = streaming.get("expiresInSeconds", "none")

            adaptive = streaming.get("adaptiveFormats", [])
            results["total_formats"] = len(adaptive)

            audio_fmts = [f for f in adaptive if f.get("mimeType", "").startswith("audio/")]
            results["audio_formats"] = len(audio_fmts)

            if audio_fmts:
                fmt = audio_fmts[0]
                results["first_audio_mimeType"] = fmt.get("mimeType", "")
                results["first_audio_bitrate"] = fmt.get("bitrate", 0)
                results["has_url"] = bool(fmt.get("url"))
                results["has_signatureCipher"] = bool(fmt.get("signatureCipher"))
                if fmt.get("url"):
                    results["url_preview"] = fmt["url"][:100] + "..."
                elif fmt.get("signatureCipher"):
                    results["cipher_preview"] = fmt["signatureCipher"][:100] + "..."
            else:
                results["note"] = "No audio formats found"

            # Show top-level keys
            results["song_keys"] = list(song.keys())
        except Exception as e:
            results["get_song"] = f"FAIL: {str(e)[:200]}"

        # Test get_library_playlists
        try:
            pl = self.ytmusic.get_library_playlists(limit=3)
            results["library_playlists"] = f"OK - {len(pl)} playlists"
        except Exception as e:
            results["library_playlists"] = f"FAIL: {str(e)[:200]}"

        # Test yt-dlp URL extraction via subprocess
        try:
            import subprocess
            env = os.environ.copy()
            env['PYTHONPATH'] = _PY_MODULES + ':' + env.get('PYTHONPATH', '')
            env.pop('LD_LIBRARY_PATH', None)
            proc = subprocess.run(
                [
                    'python3', '-m', 'yt_dlp',
                    '--print', 'urls',
                    '-f', 'bestaudio[ext=m4a]/bestaudio',
                    '--no-warnings', '-q',
                    f'https://music.youtube.com/watch?v={video_id}',
                ],
                capture_output=True, text=True, env=env, timeout=30,
            )
            url = proc.stdout.strip()
            if url and url.startswith('http'):
                results["ytdlp_url"] = url[:100] + "..."
            else:
                results["ytdlp_stdout"] = proc.stdout[:200]
                results["ytdlp_stderr"] = proc.stderr[-500:]
        except Exception as e:
            results["ytdlp_error"] = str(e)[:300]

        decky.logger.info(f"API test results: {json.dumps(results, indent=2, default=str)}")
        return results

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
