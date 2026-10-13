import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const fixturesDir = path.resolve(__dirname, 'fixtures/server');

const server = http.createServer((req, res) => {
  const urlPath = req.url?.split('?')[0] || '/';
  let filename = 'tos_page.html';

  if (urlPath === '/ambiguous' || urlPath === '/ambiguous.html') {
    filename = 'ambiguous_page.html';
  } else if (urlPath === '/injection' || urlPath === '/injection.html') {
    filename = 'injection_page.html';
  } else if (urlPath === '/tos' || urlPath === '/tos.html' || urlPath === '/') {
    filename = 'tos_page.html';
  }

  const filePath = path.join(fixturesDir, filename);

  if (fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(filePath));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`[Cypress Test Server] Serving fixtures on http://localhost:${PORT}`);
});
