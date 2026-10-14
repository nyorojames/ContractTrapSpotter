import { defineConfig } from 'cypress';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  video: true,
  videoCompression: 32,
  viewportWidth: 1280,
  viewportHeight: 800,
  defaultCommandTimeout: 10000,
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: false,
    setupNodeEvents(on, config) {
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
