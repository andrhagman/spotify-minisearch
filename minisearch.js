/* MiniSearch v0.1.1 | MIT License | https://github.com/andrhagman/spotify-minisearch */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.MiniSearch = api;
    api.start(root);
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const VERSION = "0.1.1";
  const TRACK_URI = /^spotify:track:[A-Za-z0-9]{22}$/;
  const ICONS = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    play: '<path d="m9 5 11 7-11 7Z" fill="currentColor" stroke="none"/>',
    pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
    previous: '<path d="M5 5v14M19 5 8 12l11 7Z"/>',
    next: '<path d="M19 5v14M5 5l11 7-11 7Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    volume: '<path d="M4 9h4l5-4v14l-5-4H4ZM17 8a6 6 0 0 1 0 8"/>',
    music: '<path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="6" cy="18" rx="3" ry="2"/><ellipse cx="18" cy="16" rx="3" ry="2"/>',
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + "</svg>";
  }
  function formatTime(ms) {
    const seconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
    return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
  }
  function imageURL(value) {
    if (typeof value !== "string") return "";
    if (/^spotify:image:[a-f0-9]+$/i.test(value)) return "https://i.scdn.co/image/" + value.split(":")[2];
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : "";
    } catch { return ""; }
  }
  function normalizeTrack(raw) {
    if (!raw || raw.is_playable === false || raw.playability?.playable === false) return null;
    const uri = raw.uri || (raw.id ? "spotify:track:" + raw.id : "");
    if (!TRACK_URI.test(uri)) return null;
    const artists = raw.artists?.items || raw.artists || [];
    const images = raw.album?.images || raw.albumOfTrack?.coverArt?.sources || [];
    return {
      uri, name: String(raw.name || "Untitled track"),
      artist: artists.map(a => a.profile?.name || a.name || "").filter(Boolean).join(", ") || "Unknown artist",
      album: String(raw.album?.name || raw.albumOfTrack?.name || ""),
      image: imageURL(images.find(i => i.width >= 64 && i.width <= 320)?.url || images[0]?.url),
      duration: Number(raw.duration_ms || raw.duration?.totalMilliseconds || 0),
      explicit: Boolean(raw.explicit || raw.contentRating?.label === "EXPLICIT"),
    };
  }
  function parseSearch(response) {
    const rest = response?.tracks?.items;
    const graph = response?.data?.searchV2?.tracksV2?.items || response?.data?.searchV2?.topResultsV2?.itemsV2;
    if (!Array.isArray(rest) && !Array.isArray(graph)) throw new Error("Unsupported search response");
    const seen = new Set();
    return (rest || graph.map(i => i?.item?.data)).map(normalizeTrack).filter(t => {
      if (!t || seen.has(t.uri)) return false;
      seen.add(t.uri);
      return true;
    });
  }
  async function searchTracks(sp, query) {
    const text = String(query).trim();
    if (!text) return [];
    // Prefer the client's own current search API. The REST API may reject desktop tokens.
    // Definitions are discovered by Spicetify; no private query hashes are pinned here.
    const definition = sp.GraphQL?.Definitions?.searchDesktop || sp.GraphQL?.Definitions?.searchModalResults;
    if (definition && sp.GraphQL?.Request) {
      try {
        const response = await sp.GraphQL.Request(definition, {
          searchTerm: text, offset: 0, limit: 20, numberOfTopResults: 20,
          includeAudiobooks: false, includeAuthors: false,
          includeArtistHasConcertsField: false, includePreReleases: false,
        });
        if (response.errors?.length) throw new Error("Spotify search failed");
        return parseSearch(response);
      } catch { /* Try the catalog API on clients where the native search changed. */ }
    }
    const response = await sp.CosmosAsync.get("https://api.spotify.com/v1/search?" + new URLSearchParams({ q: text, type: "track", limit: "20", market: "from_token" }));
    return parseSearch(response);
  }

  const CSS = `
    :root{color-scheme:dark;font-family:Inter,"Segoe UI",system-ui,sans-serif;color:#f4f5f4;background:#121513;font-synthesis:none}
    *{box-sizing:border-box}[hidden]{display:none!important}body{margin:0;min-width:260px;height:100vh;overflow:hidden}
    button,input{font:inherit}button{color:inherit;cursor:pointer}button:disabled{opacity:.4;cursor:default}
    button{border:0;background:none}button:hover{background:#ffffff13}button:focus-visible,input:focus-visible{outline:2px solid #b8f8cb;outline-offset:3px}
    .app{height:100%;display:flex;flex-direction:column;background:radial-gradient(ellipse at 0 0,#29453755,transparent 65%),#121513}
    .bar{display:flex;align-items:center;gap:8px;padding:13px 16px 8px;flex-shrink:0}
    .bar,.bar *{-webkit-app-region:drag;app-region:drag;user-select:none}
    .bar button,.bar button *{-webkit-app-region:no-drag;app-region:no-drag}
    .brand-icon{color:#9be6b1;display:flex}.brand{font-size:12px;font-weight:650;letter-spacing:.04em}.version{font-size:10px;color:#9ca89f;margin-left:auto}
    .icon-button{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;flex-shrink:0}
    .now{display:flex;align-items:center;gap:14px;padding:12px 18px}.art{width:78px;height:78px;flex-shrink:0;border-radius:9px;background:#25352c;object-fit:cover;box-shadow:0 5px 16px #0004}
    .placeholder{display:flex;align-items:center;justify-content:center;color:#a6c7af}.placeholder svg{width:30px;height:30px}
    .track-info{min-width:0;flex:1}.eyebrow{font-size:9px;letter-spacing:.14em;color:#a8c0af;font-weight:650;margin:0 0 5px}
    .title{font-size:16px;font-weight:650;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}
    .artist{font-size:12px;color:#b5beb8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:4px 0 0}
    .controls{display:flex;align-items:center;justify-content:center;gap:18px;padding:2px 16px 8px}
    .primary{background:#c0f3ce;color:#102419;width:38px;height:38px}.primary:hover{background:#d7fce1}
    .timeline{padding:0 19px}.times{display:flex;justify-content:space-between;font-variant-numeric:tabular-nums;color:#a6b3aa;font-size:10px;margin-top:3px}
    input[type=range]{display:block;width:100%;height:4px;margin:6px 0;accent-color:#b5ecc4;cursor:pointer}
    .volume{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:5px 19px 10px;color:#a6b3aa}.volume svg{width:15px;height:15px}.volume input{width:74px}
    .search-area{padding:0 14px 12px;flex-shrink:0}.search-box{display:flex;align-items:center;gap:9px;border:1px solid #4e6858;border-radius:10px;background:#202c24;padding:0 10px;color:#b4ccbd}
    .search-box:focus-within{border-color:#b5ecc4;box-shadow:0 0 0 2px #b5ecc414}.search-box input{min-width:0;flex:1;width:100%;height:41px;border:0;outline:none;background:none;color:#f6fbf7;font-size:13px}
    .search-box input::placeholder{color:#acbcb1}.search-box input:focus-visible{outline:none}.clear{width:25px;height:25px}.clear svg{width:15px}
    .results-head{display:flex;align-items:center;justify-content:space-between;padding:0 18px 9px;border-bottom:1px solid #ffffff0c}
    .results-head h2{font-size:10px;letter-spacing:.12em;font-weight:600;margin:0;color:#a4b5aa}.count{font-size:10px;color:#9aa89f}
    .results{flex:1;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#405548 transparent;padding:5px 8px}
    .result{display:flex;align-items:center;gap:5px;border-radius:8px;margin:2px 0}.result:hover,.result:focus-within{background:#ffffff0a}
    .result-play{display:flex;align-items:center;gap:10px;text-align:left;flex:1;min-width:0;padding:8px;border-radius:8px}
    .result-art{width:42px;height:42px;border-radius:5px;background:#2b3d31;object-fit:cover;flex-shrink:0}.result-copy{min-width:0;flex:1}
    .result-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:550;line-height:1.5}
    .result-artist{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#a6b5ac;line-height:1.5}
    .result-time{font-size:10px;color:#93a299;font-variant-numeric:tabular-nums}.queue{width:30px;height:30px;margin-right:5px;color:#c0d2c5}.queue svg{width:16px}
    .explicit{font-size:9px;background:#b5beb8;color:#142019;border-radius:2px;padding:0 3px;margin-right:4px;font-weight:bold}
    .empty{text-align:center;padding:23px 18px;color:#a4b6aa;font-size:12px;line-height:1.65}.empty strong{display:block;color:#e4eee7;font-weight:550;margin-bottom:4px}
    .status{min-height:25px;flex-shrink:0;margin:0;padding:4px 17px 8px;color:#acc7b5;font-size:10px;line-height:1.4}.status[data-error=true]{color:#ffb8a9}
    .busy{opacity:.65}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
    @media(max-height:460px){.now{padding:5px 16px}.art{width:48px;height:48px}.controls{padding-bottom:3px}.bar{padding-top:5px}.volume{padding-bottom:5px}.search-area{padding-bottom:8px}}
    @media(prefers-reduced-motion:no-preference){button{transition:background .12s ease,opacity .12s ease}}
  `;

  function mount(win, sp) {
    const doc = win.document;
    doc.title = "MiniSearch";
    const style = doc.createElement("style");
    style.textContent = CSS;
    doc.head.appendChild(style);
    const app = doc.createElement("main");
    app.className = "app";
    // This template contains only our static markup. Spotify metadata always uses textContent.
    app.innerHTML = `
      <header class="bar" title="Drag here to move the mini player"><span class="brand-icon">${icon("search")}</span><span class="brand">MiniSearch</span><span class="version">v${VERSION}</span><button class="icon-button" id="close" aria-label="Close mini player" title="Close">${icon("close")}</button></header>
      <section class="now" aria-label="Now playing"><div id="art-placeholder" class="art placeholder">${icon("music")}</div><img id="art" class="art" alt="" hidden><div class="track-info"><p class="eyebrow">NOW PLAYING</p><h1 class="title" id="title">Nothing playing yet</h1><p class="artist" id="artist">Find your next song below</p></div></section>
      <div class="controls" aria-label="Playback controls"><button class="icon-button" id="previous" aria-label="Previous track" title="Previous">${icon("previous")}</button><button class="icon-button primary" id="play-pause" aria-label="Play" title="Play">${icon("play")}</button><button class="icon-button" id="next" aria-label="Next track" title="Next">${icon("next")}</button></div>
      <div class="timeline"><input id="seek" type="range" aria-label="Seek position" min="0" max="1000" value="0" step="1"><div class="times"><span id="elapsed">0:00</span><span id="duration">0:00</span></div></div>
      <label class="volume">${icon("volume")}<span class="sr-only">Volume</span><input id="volume" type="range" aria-label="Volume" min="0" max="100" step="1" value="50"></label>
      <form class="search-area" role="search"><label class="search-box">${icon("search")}<span class="sr-only">Search songs or artists</span><input id="query" type="text" placeholder="Search songs or artists" autocomplete="off" spellcheck="false" maxlength="300"><button id="clear" class="icon-button clear" type="button" aria-label="Clear search" title="Clear search" hidden>${icon("close")}</button></label></form>
      <div class="results-head"><h2>FIND YOUR NEXT TRACK</h2><span class="count" id="count"></span></div>
      <section class="results" id="results" aria-label="Search results" aria-busy="false"></section>
      <p class="status" id="status" role="status" aria-live="polite"></p>`;
    doc.body.replaceChildren(app);
    const $ = id => doc.getElementById(id);
    let disposed = false, requestID = 0, timer = null, seeking = false;
    let actionID = 0;
    const removers = [];
    const on = (target, event, fn, options) => {
      target.addEventListener(event, fn, options);
      removers.push(() => target.removeEventListener(event, fn, options));
    };
    const status = (message, error = false) => {
      if (disposed) return;
      $("status").textContent = message;
      $("status").dataset.error = String(error);
    };
    function empty(title, description) {
      const box = doc.createElement("div"); box.className = "empty";
      const heading = doc.createElement("strong"); heading.textContent = title;
      box.append(heading, doc.createTextNode(description));
      $("results").replaceChildren(box);
    }
    async function action(fn, success) {
      const id = ++actionID;
      try { await fn(); if (id === actionID && success) status(success); return true; }
      catch { if (id === actionID) status("Couldn’t do that. Check Spotify playback and try again.", true); return false; }
    }
    function renderResults(tracks) {
      $("results").replaceChildren();
      $("count").textContent = tracks.length ? tracks.length + " songs" : "";
      if (!tracks.length) { empty("No songs found", "Try a different song title or artist."); return; }
      const fragment = doc.createDocumentFragment();
      for (const track of tracks) {
        const row = doc.createElement("div"); row.className = "result";
        const play = doc.createElement("button"); play.type = "button"; play.className = "result-play";
        play.setAttribute("aria-label", "Play " + track.name + " by " + track.artist);
        const art = doc.createElement("img"); art.className = "result-art"; art.alt = ""; art.loading = "lazy";
        if (track.image) art.src = track.image;
        const copy = doc.createElement("span"); copy.className = "result-copy";
        const name = doc.createElement("span"); name.className = "result-name"; name.textContent = track.name; name.title = track.name;
        const artist = doc.createElement("span"); artist.className = "result-artist"; artist.textContent = track.artist; artist.title = [track.artist, track.album].filter(Boolean).join(" · ");
        if (track.explicit) { const badge = doc.createElement("span"); badge.className = "explicit"; badge.textContent = "E"; artist.prepend(badge); }
        const duration = doc.createElement("span"); duration.className = "result-time"; duration.textContent = track.duration ? formatTime(track.duration) : "";
        copy.append(name, artist); play.append(art, copy, duration);
        const queue = doc.createElement("button"); queue.type = "button"; queue.className = "icon-button queue"; queue.innerHTML = icon("plus");
        queue.setAttribute("aria-label", "Add " + track.name + " to queue"); queue.title = "Add to queue";
        play.onclick = async () => {
          play.disabled = true;
          status("Starting playback…");
          await action(() => sp.Player.playUri(track.uri), "Playing “" + track.name + "”");
          if (!disposed) play.disabled = false;
        };
        queue.onclick = async () => {
          queue.disabled = true;
          const ok = await action(() => sp.addToQueue([{ uri: track.uri }]), "Added “" + track.name + "” to queue");
          if (!disposed) { queue.disabled = false; queue.innerHTML = icon(ok ? "check" : "plus"); }
        };
        row.append(play, queue); fragment.append(row);
      }
      $("results").append(fragment);
    }
    async function runSearch() {
      if (disposed) return;
      win.clearTimeout(timer);
      const id = ++requestID;
      const query = $("query").value.trim();
      $("clear").hidden = !$("query").value;
      $("count").textContent = "";
      $("results").setAttribute("aria-busy", "false");
      if (!query) { empty("A little player. Your whole library of possibilities.", "Search Spotify for a song or artist, then play it or add it to your queue."); status(""); return; }
      empty("Searching Spotify…", "Finding your next track.");
      $("results").setAttribute("aria-busy", "true"); status("");
      try {
        const tracks = await searchTracks(sp, query);
        if (disposed || id !== requestID) return;
        renderResults(tracks);
        status(tracks.length ? "Click a song to play · + adds to queue" : "");
      } catch {
        if (disposed || id !== requestID) return;
        empty("Search is unavailable", "Check your connection and Spotify login, then press Enter to retry. Updating Spotify or Spicetify may help.");
        status("Spotify couldn’t complete this search.", true);
      } finally {
        if (!disposed && id === requestID) $("results").setAttribute("aria-busy", "false");
      }
    }
    function sync() {
      if (disposed) return;
      const player = sp.Player;
      const item = player.data?.item;
      const metadata = item?.metadata || {};
      $("title").textContent = item?.name || metadata.title || "Nothing playing yet";
      $("artist").textContent = item?.artists?.map(a => a.name).filter(Boolean).join(", ") || metadata.artist_name || "Find your next song below";
      $("title").title = $("title").textContent;
      $("artist").title = $("artist").textContent;
      const url = imageURL(metadata.image_url || metadata.image_xlarge_url || item?.album?.images?.[0]?.url || item?.images?.[0]?.url);
      $("art").hidden = !url; $("art-placeholder").hidden = Boolean(url);
      if (url && $("art").getAttribute("src") !== url) $("art").src = url;
      if (!url) $("art").removeAttribute("src");
      const playing = Boolean(player.isPlaying());
      $("play-pause").innerHTML = icon(playing ? "pause" : "play");
      $("play-pause").setAttribute("aria-label", playing ? "Pause" : "Play");
      $("play-pause").title = playing ? "Pause" : "Play";
      const duration = Number(player.getDuration()) || 0;
      const progress = Math.min(duration, Math.max(0, Number(player.getProgress()) || 0));
      if (!seeking) $("seek").value = duration ? String(Math.round(progress / duration * 1000)) : "0";
      $("seek").disabled = !duration;
      $("elapsed").textContent = formatTime(progress); $("duration").textContent = formatTime(duration);
      if (doc.activeElement !== $("volume")) $("volume").value = String(Math.round((Number(player.getVolume()) || 0) * 100));
    }
    on($("close"), "click", () => win.close());
    on($("previous"), "click", () => action(() => sp.Player.back()));
    on($("play-pause"), "click", () => action(() => sp.Player.togglePlay()));
    on($("next"), "click", () => action(() => sp.Player.next()));
    on($("seek"), "input", () => { seeking = true; $("elapsed").textContent = formatTime(Number($("seek").value) / 1000 * sp.Player.getDuration()); });
    on($("seek"), "change", () => { seeking = false; action(() => sp.Player.seek(Math.round(Number($("seek").value) / 1000 * sp.Player.getDuration()))); });
    on($("seek"), "blur", () => { seeking = false; });
    on($("volume"), "input", () => action(() => sp.Player.setVolume(Number($("volume").value) / 100)));
    on($("query"), "input", () => {
      ++requestID; // Invalidate in-flight responses immediately, before the debounce expires.
      win.clearTimeout(timer); $("clear").hidden = !$("query").value;
      if (!$("query").value.trim()) { runSearch(); return; }
      // Remove old results immediately so they cannot be mistaken for the new query.
      empty("Searching Spotify…", "Finding your next track."); $("count").textContent = "";
      $("results").setAttribute("aria-busy", "true"); status("");
      timer = win.setTimeout(runSearch, 300);
    });
    on(app.querySelector("form"), "submit", e => { e.preventDefault(); runSearch(); });
    on($("clear"), "click", () => { $("query").value = ""; runSearch(); $("query").focus(); });
    on(doc, "keydown", e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); $("query").focus(); $("query").select(); }
      if (e.key === "Escape") { e.preventDefault(); if ($("query").value) { $("query").value = ""; runSearch(); $("query").focus(); } else win.close(); }
      if (e.key === "ArrowDown" && doc.activeElement === $("query")) { const first = app.querySelector(".result-play"); if (first) { e.preventDefault(); first.focus(); } return; }
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && doc.activeElement?.classList.contains("result-play")) {
        const buttons = [...app.querySelectorAll(".result-play")]; const index = buttons.indexOf(doc.activeElement);
        e.preventDefault(); (buttons[index + (e.key === "ArrowDown" ? 1 : -1)] || (e.key === "ArrowUp" ? $("query") : buttons[index])).focus();
      }
    });
    for (const event of ["songchange", "onplaypause", "onprogress"]) {
      sp.Player.addEventListener(event, sync);
      removers.push(() => sp.Player.removeEventListener(event, sync));
    }
    function dispose() {
      if (disposed) return;
      disposed = true; ++requestID; ++actionID; win.clearTimeout(timer);
      for (const remove of removers.splice(0)) remove();
    }
    on(win, "pagehide", dispose);
    sync(); runSearch(); $("query").focus();
    return { dispose, search: runSearch };
  }

  function start(host) {
    if (host.__miniSearchLoaded) return;
    host.__miniSearchLoaded = true;
    let pip = null, controller = null, opening = false, attempts = 0;
    function ready() {
      const sp = host.Spicetify;
      if (!sp?.Player?.addEventListener || !sp?.CosmosAsync || !sp?.Playbar?.Button || !sp?.addToQueue) {
        if (++attempts < 1200) host.setTimeout(ready, 100);
        else { host.__miniSearchLoaded = false; console.warn("[MiniSearch] Spicetify did not become ready. Update Spicetify and restart Spotify."); }
        return;
      }
      async function toggle() {
        if (opening) return;
        if (pip && !pip.closed) { pip.close(); return; }
        if (!host.documentPictureInPicture?.requestWindow) {
          sp.showNotification("MiniSearch needs a Spotify desktop version with picture-in-picture support. Update Spotify and Spicetify.", true);
          return;
        }
        opening = true;
        try {
          // Called directly from a click/key event to retain transient user activation.
          const win = await host.documentPictureInPicture.requestWindow({ width: 360, height: 580 });
          pip = win;
          controller?.dispose();
          controller = mount(win, sp);
          win.addEventListener("pagehide", () => { controller?.dispose(); controller = null; if (pip === win) pip = null; }, { once: true });
        } catch {
          controller?.dispose(); controller = null;
          if (pip && !pip.closed) pip.close(); pip = null;
          sp.showNotification("MiniSearch couldn’t open. Close other mini players and try again.", true);
        } finally { opening = false; }
      }
      const svg = icon("search");
      new sp.Playbar.Button("MiniSearch — search in a floating player", svg, toggle);
      if (sp.Topbar?.Button) new sp.Topbar.Button("MiniSearch", svg, toggle, false, true);
      host.document.addEventListener("keydown", e => {
        if (e.ctrlKey && e.shiftKey && e.code === "KeyK" && !e.repeat && !e.target?.closest?.('input,textarea,[contenteditable="true"]')) {
          e.preventDefault(); toggle();
        }
      });
      // Keep Spotify's original mini player available; our search icon opens MiniSearch.
      host.addEventListener("pagehide", () => { controller?.dispose(); if (pip && !pip.closed) pip.close(); }, { once: true });
    }
    ready();
  }
  return { VERSION, formatTime, imageURL, normalizeTrack, parseSearch, searchTracks, mount, start };
});
