/* Synthetic data only. Does not connect to Spotify or play audio. */
(() => {
  const base = 'https://i.scdn.co/image/';
  const tracks = [
    ['Midnight Signal', 'The Night Atlas', 'After Hours', 'cover-a'],
    ['Midnight City Lights', 'Northbound', 'Electric Skyline', 'cover-b'],
    ['Midnight in Motion', 'Velvet Circuit', 'Soft Focus', 'cover-c'],
    ['Past Midnight', 'The Night Atlas', 'After Hours', 'cover-a'],
    ['Midnight Bloom', 'Juniper Coast', 'Low Tide', 'cover-d'],
    ['Midnight Drive', 'Glass Echo', 'Neon Weather', 'cover-b'],
  ].map(([name, artist, album, image], i) => ({
    uri: 'spotify:track:' + String(i + 1).padStart(22, '0'), name,
    artists: [{ name: artist }], album: { name: album, images: [{ url: base + image, width: 300 }] },
    duration_ms: 180000 + i * 17000, explicit: i === 2,
  }));
  const calls = window.mockCalls = { searches: [], plays: [], queued: [], seek: [], volume: [], listeners: {} };
  const listeners = new Map();
  let playing = true, volume = .55, position = 73000, shuffle = false, repeat = 0, liked = false;
  function emit(event) { for (const fn of listeners.get(event) || []) fn(); }
  window.Spicetify = {
    Player: {
      data: { item: { ...tracks[0], metadata: { image_url: tracks[0].album.images[0].url } } },
      isPlaying: () => playing, getDuration: () => 223000, getProgress: () => position, getVolume: () => volume,
      togglePlay() { playing = !playing; emit('onplaypause'); },
      back() { calls.back = (calls.back || 0) + 1; }, next() { calls.next = (calls.next || 0) + 1; },
      seek(value) { calls.seek.push(value); position = value; emit('onprogress'); },
      setVolume(value) { calls.volume.push(value); volume = value; },
      getShuffle: () => shuffle, setShuffle(value) { shuffle = value; },
      getRepeat: () => repeat, setRepeat(value) { repeat = value; },
      getHeart: () => liked, toggleHeart() { liked = !liked; },
      async playUri(uri) { if (window.failPlayback) throw new Error('Playback denied'); calls.plays.push(uri); this.data.item = { ...tracks.find(t => t.uri === uri), metadata: {} }; playing = true; emit('songchange'); },
      addEventListener(event, fn) { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn); calls.listeners[event] = listeners.get(event).size; },
      removeEventListener(event, fn) { listeners.get(event)?.delete(fn); calls.listeners[event] = listeners.get(event)?.size || 0; },
    },
    CosmosAsync: { async get(url) {
      const q = new URL(url).searchParams.get('q'); calls.searches.push(q);
      await new Promise(resolve => setTimeout(resolve, q === 'slow' ? 900 : 20));
      if (q === 'offline') throw new Error('Offline');
      if (q === 'empty') return { tracks: { items: [] } };
      if (q === 'unsafe') return { tracks: { items: [{ ...tracks[0], name: '<img src=x onerror="window.injected=true">', artists: [{ name: '<script>alert(1)</script>' }] }] } };
      if (q === 'slow') return { tracks: { items: [{ ...tracks[0], name: 'Slow stale result' }] } };
      return { tracks: { items: tracks } };
    } },
    async addToQueue(items) { if (window.failQueue) throw new Error('Queue denied'); calls.queued.push(...items); },
    Platform: { ClipboardAPI: { async copy(text) { calls.clipboard = text; } } },
    Playbar: { Button: class {
      constructor(label, icon, callback) { const button = document.createElement('button'); button.textContent = label; button.onclick = callback; button.id = 'launcher'; document.body.append(button); calls.launchers = (calls.launchers || 0) + 1; }
    } }, showNotification(message) { calls.notification = message; },
  };
})();
