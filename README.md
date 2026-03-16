# YouTube Music Player for Decky

Play YouTube Music directly on your Steam Deck — no external app required. Built for [Decky Loader](https://decky.xyz/).

![Player View](screenshots/player.jpeg)
![Queue View](screenshots/queue.jpeg)
![Library View](screenshots/library.jpeg)

## Features

- **Standalone playback** — plays YouTube Music directly on your Steam Deck, no desktop app needed
- **Player controls** — play, pause, skip, previous
- **Album art & track info** — see what's playing at a glance
- **Like / Dislike** — rate songs directly from the player
- **Volume slider** — adjust volume with PulseAudio system integration
- **Shuffle & Repeat** — toggle shuffle and cycle repeat modes (Off / All / One)
- **Queue management** — view your queue, jump to tracks, or remove them
- **Library** — browse and play your playlists and Liked Songs
- **Search** — find songs and start a radio based on your selection
- **L1/R1 tabs** — quickly switch between Player, Queue, and Library
- **Background playback** — music continues when the Quick Access panel is closed

## Requirements

- [Decky Loader](https://decky.xyz/) installed on your Steam Deck

## Installation

1. Download the latest `youtube-music-player.zip` from the [Releases](https://github.com/artistro08/decky-youtube-music-player/releases) page
2. Open Decky on your Steam Deck
3. Go to the Decky settings (gear icon)
4. Enable Developer Options
5. Go to the Developer Section
6. Select **Install from ZIP**
7. Choose the downloaded `youtube-music-player.zip`

## Setup

This plugin uses browser cookie authentication with YouTube Music. You'll need to copy request headers from a browser session.

### Step 1: Get your browser headers

1. On your PC, open a browser and go to [music.youtube.com](https://music.youtube.com)
2. Log in to your Google account
3. Open Developer Tools (F12) and go to the **Network** tab
4. Click around in YouTube Music (e.g. click Library)
5. Find a POST request to `/browse` with status 200
6. Copy the request headers:
   - **Firefox**: Right-click the request > Copy > Copy Request Headers
   - **Chrome**: Click the request, scroll to "Request Headers", copy from `accept: */*` onward
7. Paste the headers into a text file and save it (e.g. `headers.txt`)

### Step 2: Transfer to your Steam Deck

Transfer the `headers.txt` file to your Steam Deck. You can use:
- USB drive
- SSH/SCP (`scp headers.txt deck@steamdeck:/home/deck/headers.txt`)
- Any file sharing method

### Step 3: Connect the plugin

1. Open the YouTube Music Player plugin in Decky
2. Click the gear icon to open Settings
3. Enter the file path to your headers file (default: `/home/deck/headers.txt`)
4. Click **Load & Connect**
5. You should see "Authenticated" — you're ready to go!

### Step 4: Play music

1. Go to the **Library** tab and select a playlist, or use **Search** to find a song
2. Music will start playing through your Steam Deck's speakers/headphones
3. Use the Player tab to control playback

> **Note:** Browser credentials typically last around 2 years. If authentication expires, repeat the setup process.

## How It Works

- **ytmusicapi** handles authentication, library browsing, playlists, search, and song ratings
- **yt-dlp** extracts streaming URLs (handles YouTube's signature deciphering)
- **HTML5 `<audio>`** element plays audio through Steam's CEF browser
- **PulseAudio** integration for system-level volume control
- All state is managed by the Python backend, so music continues playing even when the Quick Access panel is closed

## License

BSD-3-Clause
