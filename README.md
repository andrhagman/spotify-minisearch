# MiniSearch

**Find your next song without leaving your mini player.**

A lightweight [Spicetify](https://spicetify.app/) extension for Spotify desktop: an always-on-top player with **song search, Play now, and Add to queue**.

**Works with the Microsoft Store edition on Windows.** Tested with Spotify **1.3.6.1921** and Spicetify **2.46.4**, including real catalog search, playback, and queueing. The Windows installer creates a separate **Spotify MiniSearch** shortcut; your Store installation stays installed.

<img src="docs/compact.png" width="320" alt="Compact MiniSearch player with artwork, playback controls and search">

<details><summary>With search results</summary><img src="docs/preview.png" width="320" alt="Search results dropdown below the compact player"></details>

*Illustrative preview uses fictional music and simulated responses.*

## Download and install

**[Download the release ZIP](https://github.com/andrhagman/spotify-minisearch/releases)** and extract it.

1. Install [Spicetify](https://spicetify.app/docs/getting-started) if you do not already have it. Both regular Spotify desktop and Microsoft Store Spotify are supported by this installer. Open Spotify, sign in, and play a song once first.
2. Open a normal, non-administrator PowerShell in the extracted folder:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
   ```

3. **Microsoft Store:** launch from the new **Spotify MiniSearch** desktop shortcut. **Regular desktop:** open Spotify normally.
4. Click the **MiniSearch magnifying glass** in Spotify's top bar or near the playback controls.

No Spotify developer account, API key, separate login, or subscription to this extension is needed. Your Spotify account's normal playback restrictions still apply.

### Microsoft Store: how it works

Spicetify supports the Store edition through `--app-directory`, but launching its default writable folder did not work on the tested machine. MiniSearch copies the prepared UI assets into **the Store package's own `LocalState\MiniSearchApps` folder** and launches the installed Store app with that directory. This was verified with live search, playback, and queueing.

The Store executable, installed package, account and original shortcut remain in place. MiniSearch does not modify files in `WindowsApps` or install a second Spotify client. Use the **Spotify MiniSearch** shortcut for the extension; the original shortcut opens ordinary Spotify.

The shortcut uses a small hidden PowerShell launcher, with no background polling process or scheduled task. If Spotify updates, the launcher detects the package version change and rebuilds the prepared assets using Spicetify. Future Spotify versions may require a compatible Spicetify update first. Starting the modified client while ordinary Spotify is already running restarts Spotify once so the app-directory argument takes effect.

### Manual install (regular desktop)

Copy [`minisearch.js`](https://github.com/andrhagman/spotify-minisearch/releases/download/v0.2.2/minisearch.js) into Spicetify's **Extensions** folder, alongside the configuration located by `spicetify -c`. On Windows this is usually `%APPDATA%\spicetify\Extensions\`.

```powershell
spicetify config extensions minisearch.js
spicetify backup apply
```

For the Store edition, use the release ZIP installer so the writable asset directory and launcher are set up as well.

## Use

- Type a **song title or artist**. Search starts after a short pause; **Enter** searches immediately.
- Click a result to **play it now**. Click **+** to **add it to your queue**.
- The player opens at **320×164**. Results appear in a dropdown only when songs are found; clearing search collapses the window.
- Playback controls, a volume popover, shuffle, repeat, Liked Songs, and copy-song-link stay above search.
- Drag the MiniSearch header to move the window. Resize using the native frame; results scroll inside it.

| Shortcut | Action |
| --- | --- |
| **Ctrl+Shift+K** | Open/close MiniSearch while Spotify is focused, including search fields |
| **Ctrl+F** | Focus the mini player's search field |
| **Down / Up** | Navigate result Play buttons |
| **Tab / Shift+Tab** | Navigate all controls, including queue buttons |
| **Esc** | Clear the query, or close if already empty |

Spotify's original mini player stays available. MiniSearch has its **own magnifying-glass button**. Only one Document Picture-in-Picture window can be open at a time. Spotify must stay running. Borderless/windowed games work better with always-on-top windows than exclusive fullscreen.

## Troubleshooting

- **Store app opens without MiniSearch:** use the **Spotify MiniSearch** desktop shortcut. If needed, rerun the installer after updating Spicetify.
- **No button:** check `spicetify config extensions`, apply again, and reopen from the appropriate shortcut.
- **PiP unavailable:** update Spotify and Spicetify to compatible versions. The extension reports missing picture-in-picture support explicitly.
- **Search unavailable:** check your connection/login and retry with Enter. MiniSearch uses the client's native search definition (`searchDesktop` or `searchModalResults`) and falls back to authenticated REST search. No private query hashes are hardcoded. Current modal search returns mixed top matches; MiniSearch displays the song matches and omits durations when Spotify does not supply them.
- **Store launcher error:** inspect `%LOCALAPPDATA%\SpotifyMiniSearch\launcher.log`. The launcher also shows a message if rebuilding after an update fails.
- **After Spotify updates:** a compatible [Spicetify update](https://spicetify.app/docs/faq) may be needed. Older and future Spotify releases have not all been tested.

## Remove

From the extracted release folder:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -Uninstall
```

Then close Spotify and reopen it using the original shortcut. The script unregisters MiniSearch, removes its extension file and its desktop shortcut, and preserves other extensions. Prepared UI files and launcher files may remain in their dedicated folders; they are inactive when you use the original shortcut.

## Privacy

No telemetry, analytics, external music services, persistent search history, or extension update checks. Searches go to Spotify through Spicetify's authenticated API wrapper; artwork loads from URLs returned by Spotify. MiniSearch does not read or store your access token. Queries and results stay in memory and are discarded on close. The Store launcher checks the **local** installed package version; it does not use remote debugging or open a debugging port.

## Develop

The extension is **one JavaScript file** with no runtime dependencies or build step. Tests require Node.js 22+ and pnpm 11.25.0.

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm exec playwright install chromium
pnpm test:ui
pnpm preview
```

The localhost preview uses simulated Spotify responses and does not play audio. Browser tests generate their own illustrative artwork. To test using installed Microsoft Edge on Windows, set `$env:MINISEARCH_BROWSER_CHANNEL = 'msedge'` before `pnpm test:ui`. Run `powershell -NoProfile -File tests/installer.ps1` to test installation against an isolated fake installation.

See [validation details](docs/VALIDATION.md), [installer source](scripts/install.ps1), and [Store launcher source](scripts/launch-store.ps1). This repository includes a Spicetify `manifest.json`; it has not been submitted to the community Marketplace.

## License

[MIT](LICENSE) — Andreas Hagman. Independent and unofficial; not affiliated with Spotify or Spicetify. Uses [Spicetify's extension APIs](https://spicetify.app/docs/development/extensions) and Document Picture-in-Picture. Spotify itself is not included in downloads.
