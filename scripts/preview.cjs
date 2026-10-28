const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const allowed = new Map([
  ['/', ['tests/fixture.html', 'text/html']],
  ['/tests/mock-spotify.js', ['tests/mock-spotify.js', 'text/javascript']],
  ['/minisearch.js', ['minisearch.js', 'text/javascript']],
  ['/launcher', ['tests/launcher.html', 'text/html']],
]);
function createServer() {
  return http.createServer((req, res) => {
    const item = allowed.get(new URL(req.url, 'http://localhost').pathname);
    if (!item) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'Content-Type': item[1] + '; charset=utf-8', 'Cache-Control': 'no-store' });
    fs.createReadStream(path.join(root, item[0])).pipe(res);
  });
}
if (require.main === module) {
  const server = createServer();
  server.listen(4318, '127.0.0.1', () => console.log('Simulated Spotify preview: http://127.0.0.1:4318 (does not play audio)'));
}
module.exports = { createServer };
