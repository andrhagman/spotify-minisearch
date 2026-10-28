# Validation — v0.1.0

## Live Windows / Microsoft Store verification

Tested 2026-10-28 with **Spotify 1.3.6.1921** (Store package 1.306.1921.0), **Spicetify 2.46.4**, and the existing signed-in Spotify account.

- Prepared UI assets inside the Store package's `LocalState\MiniSearchApps` folder.
- Launched the **installed Store Spotify executable** with `--app-directory` pointing to those assets. No Store executable or package files changed.
- MiniSearch loaded and opened a real always-on-top Document Picture-in-Picture window.
- Searched the live catalog for “voodoo people”; 17 song results returned.
- Clicked a result in MiniSearch; **Voodoo People - Pendulum Mix** played in Spotify and the mini player updated.
- Clicked **+**; confirmed the song appeared in Spotify's priority queue, then removed that specific test entry.
- Restored the original track and its playback position after the test.

The live test revealed that the client exposes `searchModalResults`, not `searchDesktop`, and needs `includeAuthors`. The extension now supports that definition and its `topResultsV2.itemsV2` response. It prefers native search because the REST API rejected the desktop session's request. Modal search does not provide durations, so those are omitted instead of displayed as zero.

## Automated verification

- Unit tests: parsing REST/GraphQL responses, provider fallback, unavailable tracks, encoding, image protocols and duration formatting.
- Browser UI tests in isolated Microsoft Edge with simulated Spotify APIs: search, play, queue, controls, keyboard navigation, stale requests, clear while searching, failure states, safe metadata rendering, responsive layout and cleanup.
- Real Chromium PiP open, close and reopen with simulated Spotify APIs.
- Windows installer tests against an isolated fake installation; other extensions preserved.
- PowerShell syntax validation.
- Preview inspected at 360×580 and tested at 280×400.

## Limits

Regular desktop Spotify and other operating systems have not been tested live. Future Store updates may require a new compatible Spicetify version. Automatic rebuilding after a real Store update has not yet been observed. This initial preview has the Store search/play/queue path verified as described above.
