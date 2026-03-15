# decky-youtube-music

A Decky Loader plugin for the Steam Deck that lets you control the [th-ch/youtube-music](https://github.com/th-ch/youtube-music) desktop app from the Steam Deck sidebar.

## Project Structure

```
src/
  index.tsx              - Plugin entry point; defines the plugin and TabsContainer (L1/R1 tabs)
  components/
    PlayerView.tsx       - Player tab: album art, track info, seek bar, playback controls, volume, shuffle/repeat
    QueueView.tsx        - Queue tab: queue list with jump-to and remove buttons
    NotConnectedView.tsx - Shown when the backend is not reachable
    AuthTokenView.tsx    - Shown when YouTube Music requires auth
    Section.tsx          - Simple section wrapper with optional title label
  context/
    PlayerContext.tsx    - React context; holds player state from WebSocket
  services/
    apiClient.ts         - HTTP calls to the youtube-music companion API
    websocketService.ts  - WebSocket connection for real-time player state
    authEvents.ts        - Auth event helpers
  types.ts / types.d.ts  - Shared TypeScript types
dist/
  index.js               - Compiled frontend bundle (built by rollup)
main.py                  - Minimal Decky Python backend (no-op)
plugin.json              - Decky plugin manifest
package.json             - npm manifest; version shown in Decky UI
```

## Tech Stack

- **Frontend**: React (TypeScript), `@decky/ui`, `@decky/api`, `react-icons`
- **Build**: Rollup via `@decky/rollup`
- **Backend**: Minimal Python stub (`main.py`) — all real logic is in the frontend

## Build & Package

### Build only
```bash
npm run build
```

### Build + package as installable zip
```bash
npm run build
mkdir -p /tmp/ym/youtube-music/dist
cp dist/index.js /tmp/ym/youtube-music/dist/
cp plugin.json package.json main.py /tmp/ym/youtube-music/
cd /tmp/ym && powershell.exe -Command "Compress-Archive -Path 'youtube-music' -DestinationPath 'youtube-music.zip'"
cp /tmp/ym/youtube-music.zip ./youtube-music.zip
```

Output: `youtube-music.zip` in the project root.

## IMPORTANT: After Every Code Change

After making any code change, always:
1. Run `npm run build`
2. Recreate `youtube-music.zip` using the packaging steps above

The zip must have this exact internal structure for Decky Loader's "Install from ZIP" to work:
```
youtube-music/
  main.py
  package.json
  plugin.json
  dist/
    index.js
```

A single top-level folder containing `plugin.json` directly inside it is required by the Decky installer.

## Key Implementation Notes

- **Tabs height**: `TabsContainer` in `index.tsx` measures the available panel height at runtime by walking up the DOM to the nearest scrollable ancestor and using its `bottom` edge. This avoids over-sizing the container with `window.innerHeight` (which includes Steam UI chrome below the panel).
- **No horizontal overflow**: The `Section` component is a plain `<div>` with no negative margins. Tab content column padding was removed in earlier fixes.
- **Fallback UI**: If `Tabs` is not available (older Decky versions), a simple `ButtonItem`-based tab switcher is rendered instead.
