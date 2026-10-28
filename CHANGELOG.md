# Changelog

## 0.2.0 — 2026-10-28

- Compact 320×164 player with artwork and song details above a single row of controls.
- Search results dropdown opens only when songs are found; clearing search collapses it.
- Window grows for results and shrinks back to the compact player.
- Volume popover, shuffle, repeat, Liked Songs and copy-song-link buttons.
- Capture Ctrl+Shift+K before Spotify's built-in shortcut handler.
- Header movement fallback and versioned extension loading for Store assets.

## 0.1.1 — 2026-10-28

- Make the MiniSearch header a native window drag area so the floating player can be moved.
- Keep the close button, search field and playback controls interactive.

## 0.1.0 — 2026-10-28 (preview)

- Floating, always-on-top Spotify mini player using Document Picture-in-Picture.
- Debounced song/artist search, Play now, and Add to queue.
- Playback controls, seeking, volume and keyboard navigation.
- Safe text rendering, stale-request protection and window-close cleanup.
- Windows installation script, manual installation, and removal instructions.
- Unit tests and browser tests with simulated Spotify APIs.
- Microsoft Store launcher with writable UI assets inside the package's LocalState folder.
- Live Store search, playback and queueing verified on Spotify 1.3.6.1921 / Spicetify 2.46.4.
- Supports current searchModalResults responses as well as older searchDesktop and REST search.
