const { test } = require('node:test');
const assert = require('node:assert/strict');
const mini = require('../minisearch.js');
const uri = 'spotify:track:0123456789abcdefghijkl';
const raw = { uri, name: 'Song <title>', artists: [{ name: 'Artist' }], album: { name: 'Album', images: [{ url: 'https://i.scdn.co/image/test', width: 64 }] }, duration_ms: 125000 };

test('formats missing, negative and long durations', () => {
  assert.equal(mini.formatTime(undefined), '0:00');
  assert.equal(mini.formatTime(-1), '0:00');
  assert.equal(mini.formatTime(125000), '2:05');
  assert.equal(mini.formatTime(3600000), '60:00');
});
test('only permits HTTPS or Spotify image identifiers', () => {
  assert.equal(mini.imageURL('spotify:image:abc123'), 'https://i.scdn.co/image/abc123');
  for (const url of ['javascript:alert(1)', 'file:///private', 'http://example.com', 'data:text/html,test', 'not a url']) assert.equal(mini.imageURL(url), '');
});
test('normalizes REST tracks and preserves metadata as text', () => {
  const track = mini.normalizeTrack(raw);
  assert.equal(track.name, 'Song <title>');
  assert.equal(track.artist, 'Artist');
  assert.equal(track.duration, 125000);
});
test('normalizes GraphQL tracks, deduplicates and filters unplayable tracks', () => {
  const graph = { uri, name: 'Graph song', artists: { items: [{ profile: { name: 'Graph artist' } }] }, albumOfTrack: { name: 'Album', coverArt: { sources: [{ url: 'https://i.scdn.co/image/abc' }] } }, duration: { totalMilliseconds: 180000 } };
  const tracks = mini.parseSearch({ data: { searchV2: { tracksV2: { items: [{ item: { data: graph } }, { item: { data: graph } }, { item: { data: { ...graph, uri: 'spotify:episode:bad' } } }] } } } });
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].artist, 'Graph artist');
  assert.equal(tracks[0].duration, 180000);
  assert.equal(mini.normalizeTrack({ ...raw, is_playable: false }), null);
});
test('rejects error-shaped search responses instead of showing no results', () => {
  assert.throws(() => mini.parseSearch({ error: { status: 403 } }));
  assert.deepEqual(mini.parseSearch({ tracks: { items: [] } }), []);
});
test('encodes the complete query and does not search blank input', async () => {
  let requested;
  const sp = { CosmosAsync: { get: async url => { requested = new URL(url); return { tracks: { items: [raw] } }; } } };
  assert.deepEqual(await mini.searchTracks(sp, ' '), []);
  assert.equal(requested, undefined);
  assert.equal((await mini.searchTracks(sp, 'AC/DC & Björk?'))[0].uri, uri);
  assert.equal(requested.searchParams.get('q'), 'AC/DC & Björk?');
  assert.equal(requested.searchParams.get('type'), 'track');
});
test('prefers client-provided GraphQL search when available', async () => {
  const definition = { name: 'searchDesktop' };
  let variables;
  const sp = { CosmosAsync: { get: async () => { throw new Error('403'); } }, GraphQL: { Definitions: { searchDesktop: definition }, Request: async (def, vars) => { assert.equal(def, definition); variables = vars; return { data: { searchV2: { tracksV2: { items: [] } } } }; } } };
  assert.deepEqual(await mini.searchTracks(sp, 'song'), []);
  assert.equal(variables.searchTerm, 'song');
});
test('supports current Spotify searchModalResults and filters non-tracks', async () => {
  const definition = { name: 'searchModalResults' };
  const sp = { GraphQL: { Definitions: { searchModalResults: definition }, Request: async (def, vars) => {
    assert.equal(def, definition); assert.equal(vars.includeAuthors, false);
    return { data: { searchV2: { topResultsV2: { itemsV2: [{ item: { data: raw } }, { item: { data: { uri: 'spotify:artist:0123456789abcdefghijkl', name: 'Artist' } } }] } } } };
  } }, CosmosAsync: { get: async () => { throw new Error('REST should not be used'); } } };
  assert.equal((await mini.searchTracks(sp, 'song'))[0].name, raw.name);
});
test('falls back to REST when a native query fails', async () => {
  const sp = { GraphQL: { Definitions: { searchModalResults: {} }, Request: async () => { throw new Error('changed API'); } }, CosmosAsync: { get: async () => ({ tracks: { items: [raw] } }) } };
  assert.equal((await mini.searchTracks(sp, 'song'))[0].uri, uri);
});
test('surfaces failures when no compatible search provider exists', async () => {
  const sp = { CosmosAsync: { get: async () => { throw new Error('offline'); } } };
  await assert.rejects(mini.searchTracks(sp, 'song'), /offline/);
});
