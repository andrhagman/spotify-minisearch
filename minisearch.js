/* MiniSearch v0.3.0 | MIT License | https://github.com/andrhagman/spotify-minisearch */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.MiniSearch = api;
    api.start(root);
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const VERSION = "0.3.0";
  const TRACK_URI = /^spotify:track:[A-Za-z0-9]{22}$/;
  const GEOMETRY_KEY = "minisearch:window:v1";
  function normalizeGeometry(raw) {
    if (!raw || typeof raw !== "object") return null;
    const size = (value, fallback, min, max) => typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
    const geometry = {
      width: size(raw.width, 320, 280, 4096),
      compactHeight: size(raw.compactHeight ?? raw.height, 164, 164, 2160),
      expandedHeight: size(raw.expandedHeight, 398, 240, 2160),
    };
    if (typeof raw.x === "number" && Number.isFinite(raw.x) && Math.abs(raw.x) < 100000 && typeof raw.y === "number" && Number.isFinite(raw.y) && Math.abs(raw.y) < 100000) {
      geometry.x = Math.round(raw.x); geometry.y = Math.round(raw.y);
    }
    return geometry;
  }
  function readGeometry(storage) {
    try { return normalizeGeometry(JSON.parse(storage.getItem(GEOMETRY_KEY))); } catch { return null; }
  }
  function writeGeometry(storage, geometry) {
    try { storage.setItem(GEOMETRY_KEY, JSON.stringify(normalizeGeometry(geometry))); } catch { /* Storage may be disabled. */ }
  }
  function windowOptions(geometry, screen) {
    const saved = normalizeGeometry(geometry);
    const options = { width: saved?.width || 320, height: saved?.compactHeight || 164, preferInitialWindowPlacement: true };
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      let { x, y } = saved;
      // Preserve negative coordinates on multi-monitor desktops. If only one
      // display remains, bring a previously disconnected window back on screen.
      if (screen?.isExtended === false && screen.availWidth > 0 && screen.availHeight > 0) {
        const left = screen.availLeft || 0, top = screen.availTop || 0;
        x = Math.max(left, Math.min(x, left + Math.max(0, screen.availWidth - options.width)));
        y = Math.max(top, Math.min(y, top + Math.max(0, screen.availHeight - options.height)));
      }
      options.cefOptions = { position: { x, y }, resizable: true };
    }
    return options;
  }
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
    shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3M17 14l4 4-4 4M3 18h3c2 0 4-3 6-6s4-6 6-6h3M17 2l4 4-4 4"/>',
    repeat: '<path d="M18 3l3 3-3 3M3 11V9a3 3 0 0 1 3-3h15M6 21l-3-3 3-3M21 13v2a3 3 0 0 1-3 3H3"/>',
    share: '<path d="M12 15V3M8 7l4-4 4 4M6 11H4v10h16V11h-2"/>',
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
    .app{height:100%;display:flex;flex-direction:column;background:#080909}
    .bar{position:relative;flex-shrink:0;padding:0}
    .bar,.bar *{-webkit-app-region:drag;app-region:drag;user-select:none}
    .bar button,.bar button *{-webkit-app-region:no-drag;app-region:no-drag}
    /* The volume popup overlaps the header. Its complete painted area must
       override the native drag region underneath, including the slider track. */
    .controls,.controls *,.volume-popup,.volume-popup *,input,button,button *{-webkit-app-region:no-drag;app-region:no-drag}
    .brand-icon{color:#9be6b1;display:flex}.brand{font-size:12px;font-weight:650;letter-spacing:.04em}.version{font-size:10px;color:#9ca89f;margin-left:auto}
    .icon-button{display:inline-flex;align-items:center;justify-content:center;width:27px;height:27px;border-radius:50%;flex-shrink:0}
    .now{display:flex;align-items:center;gap:10px;padding:8px 8px 4px}.art{width:52px;height:52px;flex-shrink:0;border-radius:4px;background:#25352c;object-fit:cover}
    .placeholder{display:flex;align-items:center;justify-content:center;color:#a6c7af}.placeholder svg{width:30px;height:30px}
    .track-info{min-width:0;flex:1}.eyebrow{font-size:9px;letter-spacing:.14em;color:#a8c0af;font-weight:650;margin:0 0 5px}
    .title{font-size:14px;font-weight:600;line-height:1.35;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}
    .artist{font-size:11px;color:#b5beb8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:3px 0 0}
    .track-actions{display:flex;align-items:center;align-self:flex-start;padding-top:8px;gap:0}.track-actions svg{width:17px;height:17px}
    .controls{position:relative;display:flex;align-items:center;justify-content:space-evenly;gap:2px;padding:9px 8px 7px;flex-shrink:0}
    .controls svg{width:17px;height:17px}.primary{background:#fff;color:#080909;width:32px;height:32px}.primary:hover{background:#ddd}.primary svg{width:20px;height:20px}
    .icon-button[aria-pressed=true]{color:#1ed760}.repeat-one{position:relative}.repeat-one::after{content:'1';position:absolute;right:1px;top:0;font-size:9px;color:#1ed760}
    .timeline{padding:0 9px;flex-shrink:0}.times{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
    input[type=range]{display:block;width:100%;height:4px;margin:6px 0;accent-color:#b5ecc4;cursor:pointer}
    .volume-popup{position:absolute;left:9px;bottom:43px;width:125px;padding:12px;background:#252525;border:1px solid #444;border-radius:6px;z-index:2}
    .search-area{padding:5px 8px 7px;flex-shrink:0}.search-box{display:flex;align-items:center;gap:7px;border:1px solid #383d39;border-radius:5px;background:#171b18;padding:0 8px;color:#aab7ae}
    .search-box>svg{width:15px;height:15px}.search-box:focus-within{border-color:#7ab78b}.search-box input{min-width:0;flex:1;width:100%;height:29px;border:0;outline:none;background:none;color:#f6fbf7;font-size:12px}
    .search-box input::placeholder{color:#acbcb1}.search-box input:focus-visible{outline:none}.clear{width:25px;height:25px}.clear svg{width:15px}
    .results-head{display:flex;align-items:center;justify-content:space-between;padding:5px 12px 6px;border-top:1px solid #303532;border-bottom:1px solid #ffffff0c;flex-shrink:0}
    .results-head h2{font-size:9px;letter-spacing:.1em;font-weight:600;margin:0;color:#a4b5aa}.count{font-size:10px;color:#9aa89f}
    .results{flex:1;min-height:0;overflow:auto;scrollbar-width:thin;scrollbar-color:#405548 transparent;padding:5px 8px}
    .result{display:flex;align-items:center;gap:5px;border-radius:8px;margin:2px 0}.result:hover,.result:focus-within{background:#ffffff0a}
    .result-play{display:flex;align-items:center;gap:8px;text-align:left;flex:1;min-width:0;padding:6px;border-radius:5px}
    .result-art{width:32px;height:32px;border-radius:3px;background:#2b3d31;object-fit:cover;flex-shrink:0}.result-copy{min-width:0;flex:1}
    .result-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:550;line-height:1.5}
    .result-artist{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:#a6b5ac;line-height:1.5}
    .result-time{font-size:10px;color:#93a299;font-variant-numeric:tabular-nums}.queue{width:30px;height:30px;margin-right:5px;color:#c0d2c5}.queue svg{width:16px}
    .explicit{font-size:9px;background:#b5beb8;color:#142019;border-radius:2px;padding:0 3px;margin-right:4px;font-weight:bold}
    .empty{text-align:center;padding:23px 18px;color:#a4b6aa;font-size:12px;line-height:1.65}.empty strong{display:block;color:#e4eee7;font-weight:550;margin-bottom:4px}
    .status{flex-shrink:0;margin:0;padding:3px 10px 5px;color:#acc7b5;font-size:10px;line-height:1.4}.status:empty{display:none}.status[data-error=true]{color:#ffb8a9}
    .busy{opacity:.65}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
    .timeline input{height:2px;margin:1px 0 3px}.controls .icon-button:not(.primary){color:#b8bfba}.controls .icon-button[aria-pressed=true]{color:#1ed760}
    @media(prefers-reduced-motion:no-preference){button{transition:background .12s ease,opacity .12s ease}}
  `;

  function mount(win, sp, { resizeWindow = false, geometry = null, onBoundsChange = null } = {}) {
    const doc = win.document;
    doc.title = "MiniSearch";
    const style = doc.createElement("style");
    style.textContent = CSS;
    doc.head.appendChild(style);
    const app = doc.createElement("main");
    app.className = "app";
    // This template contains only our static markup. Spotify metadata always uses textContent.
    app.innerHTML = `
      <header class="bar" title="MiniSearch v${VERSION} · Drag here to move"><span class="sr-only">MiniSearch v${VERSION}</span><section class="now" aria-label="Now playing"><div id="art-placeholder" class="art placeholder">${icon("music")}</div><img id="art" class="art" alt="" hidden><div class="track-info"><h1 class="title" id="title">Nothing playing yet</h1><p class="artist" id="artist">Find a song below</p></div><div class="track-actions"><button class="icon-button" id="close" aria-label="Close mini player" title="Close">${icon("close")}</button><button class="icon-button" id="like" aria-label="Save to Liked Songs" title="Save to Liked Songs">${icon("plus")}</button></div></section></header>
      <div class="controls" aria-label="Playback controls"><button class="icon-button" id="volume-toggle" aria-label="Show volume" title="Volume" aria-expanded="false">${icon("volume")}</button><label class="volume-popup" id="volume-popup" hidden><span class="sr-only">Volume</span><input id="volume" type="range" aria-label="Volume" min="0" max="100" step="1" value="50"></label><button class="icon-button" id="shuffle" aria-label="Shuffle" title="Shuffle" aria-pressed="false">${icon("shuffle")}</button><button class="icon-button" id="previous" aria-label="Previous track" title="Previous">${icon("previous")}</button><button class="icon-button primary" id="play-pause" aria-label="Play" title="Play">${icon("play")}</button><button class="icon-button" id="next" aria-label="Next track" title="Next">${icon("next")}</button><button class="icon-button" id="repeat" aria-label="Repeat off" title="Repeat off" aria-pressed="false">${icon("repeat")}</button><button class="icon-button" id="share" aria-label="Copy song link" title="Copy song link">${icon("share")}</button></div>
      <div class="timeline"><input id="seek" type="range" aria-label="Seek position" min="0" max="1000" value="0" step="1"><div class="times"><span id="elapsed">0:00</span><span id="duration">0:00</span></div></div>
      <form class="search-area" role="search"><label class="search-box">${icon("search")}<span class="sr-only">Search songs or artists</span><input id="query" type="text" placeholder="Search songs or artists" autocomplete="off" spellcheck="false" maxlength="300"><button id="clear" class="icon-button clear" type="button" aria-label="Clear search" title="Clear search" hidden>${icon("close")}</button></label></form>
      <div class="results-head" id="results-head" hidden><h2>SONGS</h2><span class="count" id="count"></span></div>
      <section class="results" id="results" aria-label="Search results" aria-busy="false" hidden></section>
      <p class="status" id="status" role="status" aria-live="polite"></p>`;
    doc.body.replaceChildren(app);
    const $ = id => doc.getElementById(id);
    let disposed = false, requestID = 0, timer = null, seeking = false;
    let actionID = 0, drag = null, expanded = false;
    const preferred = normalizeGeometry(geometry) || normalizeGeometry({});
    let pendingHeight = null;
    function saveBounds() {
      if (!onBoundsChange || win.innerWidth <= 0 || win.innerHeight <= 0) return;
      onBoundsChange({ ...preferred, width: win.innerWidth, x: win.screenX, y: win.screenY });
    }
    function sizeWindow() {
      if (!resizeWindow || disposed) return;
      const chrome = Math.max(0, win.outerHeight - win.innerHeight);
      const contentHeight = expanded ? preferred.expandedHeight : preferred.compactHeight;
      const height = contentHeight + chrome;
      // A PiP resize consumes user activation. Do not spend it on a no-op,
      // a loading message, or every keystroke before search results arrive.
      if (Math.abs(win.outerHeight - height) <= 1) return;
      try { pendingHeight = contentHeight; win.resizeTo(Math.max(280, win.outerWidth || 320), height); } catch { pendingHeight = null; }
    }
    function setExpanded(value) {
      const changed = expanded !== Boolean(value);
      expanded = Boolean(value);
      $("results").hidden = !expanded; $("results-head").hidden = !expanded;
      $("query").setAttribute("aria-expanded", String(expanded));
      if (changed) sizeWindow();
    }
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
      setExpanded(tracks.length > 0);
      if (!tracks.length) { status("No songs found. Try another title or artist."); return; }
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
      if (!query) { setExpanded(false); $("results").replaceChildren(); status(""); return; }
      setExpanded(false);
      $("results").replaceChildren();
      $("results").setAttribute("aria-busy", "true"); status("Searching Spotify…");
      try {
        const tracks = await searchTracks(sp, query);
        if (disposed || id !== requestID) return;
        renderResults(tracks);
        status(tracks.length ? "" : "No songs found. Try another title or artist.");
      } catch {
        if (disposed || id !== requestID) return;
        status("Search is unavailable. Press Enter to retry.", true);
      } finally {
        if (!disposed && id === requestID) $("results").setAttribute("aria-busy", "false");
      }
    }
    function sync() {
      if (disposed) return;
      try {
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
      $("shuffle").disabled = typeof player.setShuffle !== "function";
      $("shuffle").setAttribute("aria-pressed", String(Boolean(player.getShuffle?.())));
      const repeat = Number(player.getRepeat?.()) || 0;
      $("repeat").disabled = typeof player.setRepeat !== "function";
      $("repeat").setAttribute("aria-pressed", String(repeat !== 0));
      $("repeat").classList.toggle("repeat-one", repeat === 2);
      $("repeat").setAttribute("aria-label", ["Repeat off", "Repeat all", "Repeat one"][repeat] || "Repeat off");
      $("repeat").title = $("repeat").getAttribute("aria-label");
      $("like").disabled = !item || typeof player.toggleHeart !== "function";
      const liked = Boolean(player.getHeart?.());
      $("like").innerHTML = icon(liked ? "check" : "plus");
      $("like").setAttribute("aria-label", liked ? "Remove from Liked Songs" : "Save to Liked Songs");
      $("like").title = $("like").getAttribute("aria-label");
      $("share").disabled = !TRACK_URI.test(item?.uri || "") || typeof sp.Platform?.ClipboardAPI?.copy !== "function";
      const duration = Number(player.getDuration()) || 0;
      const progress = Math.min(duration, Math.max(0, Number(player.getProgress()) || 0));
      if (!seeking) $("seek").value = duration ? String(Math.round(progress / duration * 1000)) : "0";
      $("seek").disabled = !duration;
      $("elapsed").textContent = formatTime(progress); $("duration").textContent = formatTime(duration);
      if (doc.activeElement !== $("volume")) $("volume").value = String(Math.round((Number(player.getVolume()) || 0) * 100));
      } catch { status("Waiting for Spotify playback…"); }
    }
    const header = app.querySelector(".bar");
    on(win, "resize", () => {
      // Match the requested height instead of ignoring all resize events for a
      // time window: a quick manual resize must become the new preference.
      if (pendingHeight === null || Math.abs(win.innerHeight - pendingHeight) > 1) {
        preferred[expanded ? "expandedHeight" : "compactHeight"] = Math.max(expanded ? 240 : 164, win.innerHeight);
      }
      pendingHeight = null;
      saveBounds();
    });
    // Native app-region dragging handles supported CEF builds. On other builds,
    // move the PiP window directly while the header owns the pointer.
    on(header, "pointerdown", e => {
      if (e.button !== 0 || e.target.closest("button,input,select,textarea,a,[contenteditable],.volume-popup")) return;
      drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    });
    on(win, "pointermove", e => {
      if (!drag || drag.id !== e.pointerId) return;
      if (!(e.buttons & 1)) { drag = null; return; }
      win.moveTo(Math.round(e.screenX - drag.x), Math.round(e.screenY - drag.y));
    });
    on(win, "pointerup", () => { drag = null; saveBounds(); });
    on(win, "pointercancel", () => { drag = null; });
    on(win, "blur", () => { drag = null; });
    on(header, "lostpointercapture", () => { drag = null; });
    on($("close"), "click", () => win.close());
    on($("previous"), "click", () => action(() => sp.Player.back()));
    on($("play-pause"), "click", () => action(() => sp.Player.togglePlay()));
    on($("next"), "click", () => action(() => sp.Player.next()));
    on($("shuffle"), "click", () => action(async () => { await sp.Player.setShuffle(!sp.Player.getShuffle()); sync(); }));
    on($("repeat"), "click", () => action(async () => { await sp.Player.setRepeat((Number(sp.Player.getRepeat()) + 1) % 3); sync(); }));
    on($("like"), "click", () => action(async () => { await sp.Player.toggleHeart(); sync(); }));
    on($("share"), "click", () => action(() => sp.Platform.ClipboardAPI.copy("https://open.spotify.com/track/" + sp.Player.data.item.uri.split(":")[2]), "Song link copied"));
    on($("volume-toggle"), "click", () => {
      $("volume-popup").hidden = !$("volume-popup").hidden;
      $("volume-toggle").setAttribute("aria-expanded", String(!$("volume-popup").hidden));
    });
    on($("seek"), "input", () => { seeking = true; $("elapsed").textContent = formatTime(Number($("seek").value) / 1000 * sp.Player.getDuration()); });
    on($("seek"), "change", () => { seeking = false; action(() => sp.Player.seek(Math.round(Number($("seek").value) / 1000 * sp.Player.getDuration()))); });
    on($("seek"), "blur", () => { seeking = false; });
    on($("volume"), "input", () => action(() => sp.Player.setVolume(Number($("volume").value) / 100)));
    on($("query"), "input", () => {
      ++requestID; // Invalidate in-flight responses immediately, before the debounce expires.
      win.clearTimeout(timer); $("clear").hidden = !$("query").value;
      if (!$("query").value.trim()) { runSearch(); return; }
      // Remove old results immediately so they cannot be mistaken for the new query.
      setExpanded(false);
      $("results").replaceChildren(); $("count").textContent = "";
      $("results").setAttribute("aria-busy", "true"); status("Searching Spotify…");
      timer = win.setTimeout(runSearch, 300);
    });
    on(app.querySelector("form"), "submit", e => { e.preventDefault(); runSearch(); });
    on($("clear"), "click", () => { $("query").value = ""; runSearch(); $("query").focus(); });
    on($("query"), "focus", () => { if ($("query").value.trim() && $("results").querySelector(".result")) setExpanded(true); });
    on(doc, "pointerdown", e => {
      if (!e.target.closest(".bar") || e.target.closest("button,input,select,textarea,a,[contenteditable],.volume-popup")) drag = null;
      if (!e.target.closest(".search-area,.results,.results-head")) setExpanded(false);
      if (!e.target.closest(".volume-popup,#volume-toggle")) {
        $("volume-popup").hidden = true; $("volume-toggle").setAttribute("aria-expanded", "false");
      }
    });
    on(doc, "keydown", e => {
      if (e.ctrlKey && e.shiftKey && (e.code === "KeyK" || e.key.toLowerCase() === "k")) { e.preventDefault(); e.stopImmediatePropagation(); win.close(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") { e.preventDefault(); $("query").focus(); $("query").select(); }
      if (e.key === "Escape") {
        e.preventDefault(); e.stopImmediatePropagation();
        $("volume-popup").hidden = true; $("volume-toggle").setAttribute("aria-expanded", "false");
        if ($("query").value) { $("query").value = ""; runSearch(); $("query").focus(); }
        else setExpanded(false);
      }
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
      saveBounds();
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
    let geometry = readGeometry(host.localStorage);
    function ready() {
      const sp = host.Spicetify;
      if (!sp?.Player?.addEventListener || !sp?.CosmosAsync || !sp?.addToQueue) {
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
          const options = windowOptions(geometry, host.screen);
          const win = await host.documentPictureInPicture.requestWindow(options);
          pip = win;
          controller?.dispose();
          // CEF's creation-time position is the primary path. moveTo also
          // restores it on older Spotify builds that support the move API.
          if (options.cefOptions?.position) { try { win.moveTo(options.cefOptions.position.x, options.cefOptions.position.y); } catch {} }
          controller = mount(win, sp, { resizeWindow: true, geometry, onBoundsChange: bounds => {
            geometry = normalizeGeometry(bounds); writeGeometry(host.localStorage, geometry);
          } });
          win.addEventListener("pagehide", () => { controller?.dispose(); controller = null; if (pip === win) pip = null; }, { once: true });
        } catch {
          controller?.dispose(); controller = null;
          if (pip && !pip.closed) pip.close(); pip = null;
          sp.showNotification("MiniSearch couldn’t open. Close other mini players and try again.", true);
        } finally { opening = false; }
      }
      // Window capture runs before Spotify's document shortcut handlers. The
      // modifier chord is intentional even when a search/edit field has focus.
      host.addEventListener("keydown", e => {
        if (e.ctrlKey && e.shiftKey && (e.code === "KeyK" || e.key?.toLowerCase() === "k") && !e.repeat && !e.isComposing) {
          e.preventDefault(); e.stopImmediatePropagation(); toggle();
        }
      }, true);
      const svg = icon("search");
      try { if (sp.Playbar?.Button) new sp.Playbar.Button("MiniSearch — search in a floating player", svg, toggle); }
      catch { console.warn("[MiniSearch] Playback-bar button unavailable; keyboard shortcut remains active."); }
      try { if (sp.Topbar?.Button) new sp.Topbar.Button("MiniSearch", svg, toggle, false, true); }
      catch { console.warn("[MiniSearch] Top-bar button unavailable; keyboard shortcut remains active."); }
      // Keep Spotify's original mini player available; our search icon opens MiniSearch.
      host.addEventListener("pagehide", () => { controller?.dispose(); if (pip && !pip.closed) pip.close(); }, { once: true });
    }
    ready();
  }
  return { VERSION, GEOMETRY_KEY, normalizeGeometry, readGeometry, writeGeometry, windowOptions, formatTime, imageURL, normalizeTrack, parseSearch, searchTracks, mount, start };
});
