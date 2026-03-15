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

            token = creds.token_from_code(code_response["device_code"])

            if token:
                # Save the OAuth token
                os.makedirs(decky.DECKY_PLUGIN_SETTINGS_DIR, exist_ok=True)
                token_data = token.as_dict() if hasattr(token, 'as_dict') else token
                with open(OAUTH_FILE, "w") as f:
                    json.dump(token_data, f)

                # Initialize ytmusicapi
                self._try_init_ytmusic()
                self.oauth_pending = None

                if self.authenticated:
                    await decky.emit("auth_complete")
                    return {"status": "authenticated"}
                else:
                    return {"status": "error", "message": "Token saved but initialization failed"}
            else:
                return {"status": "pending"}
        except Exception as e:
            error_msg = str(e)
            # "authorization_pending" is expected while user hasn't completed flow
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
