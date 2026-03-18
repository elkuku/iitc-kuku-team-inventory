import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const IITC_DIR = path.join(__dirname, '../iitc-kuku-plugin-tester/iitc');
const port = parseInt(process.env.PORT ?? '3001', 10);

export default defineConfig({
  testDir: path.join(__dirname, 'e2e/tests'),
  snapshotDir: path.join(__dirname, 'e2e/screenshots'),
  snapshotPathTemplate: '{snapshotDir}/{arg}{ext}',
  fullyParallel: false,
  reporter: [
    ['html', { outputFolder: path.join(__dirname, 'e2e/playwright-report'), open: 'never' }],
    ['list'],
  ],
  use: {
    headless: true,
    viewport: { width: 1280, height: 900 },
    baseURL: `http://localhost:${port}`,
    tsconfig: path.join(__dirname, 'e2e/tsconfig.json'),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `node "${path.join(__dirname, 'e2e/server/start.cjs')}"`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 15000,
    env: {
      PORT: String(port),
      IITC_DIR,
      IITC_PLUGINS_DIR: path.join(__dirname, 'e2e/plugins'),
      PLUGIN_FILE: path.join(__dirname, 'dist/iitc_plugin_KuKuTeamInventory.dev.user.js'),
    },
  },
});
