# Validation — v0.3.12

## Live Windows startup regression

On 2026-10-28 the native Spotify client was traced through window creation and its delayed frame update. It temporarily reported the opener's outer dimensions, added frame margins, then enlarged the client after about four seconds without a JavaScript resize call. The repair identifies those startup frame changes, restores the saved client bounds, and does not impose a general resize constraint.

Live verification held a 312×148 client through startup, toggled playback using MiniSearch, changed the native frame through three sizes to 300×144, then closed and reopened it and checked that the saved size and position remained stable. Temporary local diagnostics were used for this verification; the extension does not enable a debugging port.

## Regular Windows desktop and resize verification

Regular Spotify 1.3.6.1921 was patched with Spicetify 2.46.4 and launched through the ordinary Spotify icon. The user confirmed MiniSearch works from this launch.

Automated Edge tests cover remembered dimensions below the former 164px minimum after reloading the extension, successive manual frame sizes without opposing resize calls, compact playback controls and status messages preserving height, and failed replacement searches collapsing the empty results area. They also cover an attempted delayed resize and replacement of the resize guard, volume dismissal without header dragging, and Escape keeping the player open. These regression cases use simulated Spotify APIs; they do not establish compatibility with every Spotify version or native desktop environment.

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

The current compact layout, dropdown visibility, controls, resizing and shortcut capture were tested in an isolated browser with simulated Spotify APIs. Live Windows feedback also covered moving the window and opening it from regular Spotify.

- Unit tests: parsing REST/GraphQL responses, provider fallback, unavailable tracks, encoding, image protocols and duration formatting.
- Browser UI tests in isolated Microsoft Edge with simulated Spotify APIs: search, play, queue, controls, keyboard navigation, stale requests, clear while searching, failure states, safe metadata rendering, responsive layout and cleanup.
- Real Chromium PiP open, expand for search results, collapse after clearing, close and reopen with simulated Spotify APIs.
- Windows installer tests against an isolated fake installation; other extensions preserved.
- PowerShell syntax validation.
- Preview inspected at 360×580 and tested at 280×400.

## Limits

Other operating systems have not been tested live. Future Store updates may require a new compatible Spicetify version. Automatic rebuilding after a real Store update has not yet been observed. The Store search/play/queue path was verified as described above.
