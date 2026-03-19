import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Allow CI to override via env var; fall back to the sibling-repo path for local dev.
const IITC_DIR = process.env.IITC_DIR ?? path.join(__dirname, '../iitc-kuku-plugin-tester/iitc');
const port = parseInt(process.env.PORT ?? '3001', 10);

export default defineConfig({
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 },
  },
  testDir: path.join(__dirname, 'e2e/tests'),
  testMatch: '**/*.spec.ts',
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
