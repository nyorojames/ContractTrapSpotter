import { defineConfig } from 'cypress';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let serverInstance: http.Server | null = null;

function ensureFixtureServer() {
  const PORT = 3000;
  const fixturesDir = path.resolve(__dirname, 'cypress/fixtures/server');

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

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log('[Cypress Fixture Server] Port 3000 already in use, using existing server.');
    }
  });

  server.listen(PORT, () => {
    console.log(`[Cypress Fixture Server] Serving fixtures on http://localhost:${PORT}`);
  });

  serverInstance = server;
}

export default defineConfig({
  video: true,
  videoCompression: 32,
  viewportWidth: 1280,
  viewportHeight: 720,
  defaultCommandTimeout: 10000,
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    setupNodeEvents(on, config) {
      ensureFixtureServer();

      on('after:run', () => {
        if (serverInstance) {
          serverInstance.close();
        }
      });

      on('before:browser:launch', (browser, launchOptions) => {
        // Load the unpacked Chrome Extension in Chromium / Chrome
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          const shortDist = 'C:\\James\\SOFTWA~1\\3.sinif\\1.sem\\YAZLMG~1\\CONTRA~1\\dist';
          const pathToExtension = fs.existsSync(shortDist) ? shortDist : path.resolve(__dirname, 'dist');
          launchOptions.args = launchOptions.args.filter(
            (arg: string) => !arg.includes('--disable-extensions') && !arg.includes('--disable-component-extensions')
          );
          launchOptions.args.push(`--load-extension=${pathToExtension}`);
          launchOptions.args.push(`--disable-extensions-except=${pathToExtension}`);
        }
        return launchOptions;
      });
    },
  },
});
