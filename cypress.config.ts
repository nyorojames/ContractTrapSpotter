import { defineConfig } from 'cypress';
import path from 'path';

export default defineConfig({
  video: true,
  videoCompression: 32,
  viewportWidth: 1280,
  viewportHeight: 800,
  defaultCommandTimeout: 10000,
  e2e: {
    baseUrl: 'http://localhost:3000',
    setupNodeEvents(on, config) {
      on('before:browser:launch', (browser, launchOptions) => {
        // Load the unpacked Chrome Extension in Chromium / Chrome
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          const pathToExtension = path.resolve(__dirname, 'dist');
          launchOptions.args.push(`--load-extension=${pathToExtension}`);
          launchOptions.args.push(`--disable-extensions-except=${pathToExtension}`);
        }
        return launchOptions;
      });
    },
  },
});
