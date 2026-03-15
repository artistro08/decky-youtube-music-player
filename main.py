import decky

class Plugin:
    async def _main(self):
        decky.logger.info("YouTube Music plugin loaded")
        try:
            import ytmusicapi
            decky.logger.info(f"ytmusicapi version: {ytmusicapi.__version__}")
        except ImportError as e:
            decky.logger.error(f"Failed to import ytmusicapi: {e}")

    async def _unload(self):
        decky.logger.info("YouTube Music plugin unloaded")
