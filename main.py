import decky
import json
import os
import asyncio

SETTINGS_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "settings.json")
OAUTH_FILE = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "oauth.json")

class Plugin:
    client_id = ""
    client_secret = ""
    authenticated = False
    ytmusic = None
    oauth_pending = None  # holds pending OAuth state

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
