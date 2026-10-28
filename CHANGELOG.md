# Changelog

## 0.3.5 — 2026-10-28

- Remove the 164px height and 280px width floors when saving a manual window size.
- Limit compact height to the player and search field, keeping results height separate.
- Prevent later scripts from replacing the MiniSearch resize guard.
- Reduce the text-only header height and verify restoring a sub-164px PiP window after reload.

## 0.3.4 — 2026-10-28

- Display song and band names without artwork in the now-playing header.

## 0.3.3 — 2026-10-28

- Dismiss volume on outside presses, focus changes and switching windows.
- Protect the full outside press and release from starting a native header drag.
- Keep the volume slider interactive above the dismissal layer.

## 0.3.2 — 2026-10-28

- Prevent Spotify's native mini player from applying its saved dimensions to MiniSearch after opening.
- Keep native frame resizing and MiniSearch result expansion available.
- Add a delayed-resize regression check in a real browser PiP window.

## 0.3.1 — 2026-10-28

- Remove the Save to Liked Songs button from the mini player.

## 0.3.0 — 2026-10-28

- Keep manual compact sizes when clicking playback controls or showing status messages.
- Collapse the results area while replacing a search, including failed searches.
- Remember window size and position across closing and restarting Spotify.
- Preserve separate compact and results heights after manual resizing.
- Recover saved positions onto the screen when only one display is available.
- Document regular desktop Spotify as the option for opening with the usual Spotify icon.

## 0.2.3 — 2026-10-28

- Escape clears search and dismisses popovers without closing the mini player, including when search is already empty.

## 0.2.2 — 2026-10-28

- Exclude the volume popup and slider from the native header drag region they overlap.
- Clear manual drag state when clicking controls, releasing the pointer, or losing focus.
- Match Spotify's client-coordinate window movement calculation.
- Launch the Store helper directly from PowerShell, removing the shortcut's VBScript dependency.

## 0.2.1 — 2026-10-28

- Ctrl+Shift+K works while Spotify's search or another text field has focus.
- Register the shortcut on window capture before Spotify's document handlers.
- Toolbar initialization failures no longer prevent the shortcut from registering.
- The same shortcut closes MiniSearch when its own search field has focus.
- Wait for playback state rather than closing the mini player if playback APIs are still initializing.

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
