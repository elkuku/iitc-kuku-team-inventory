import { test, expect, Page } from '@playwright/test';
import { setupIITCRoutes, suppressIITCDialogs } from './helpers/iitc-page';

// ── Constants ─────────────────────────────────────────────────────────────────

const PLUGIN_PREFIX = 'KuKuTeamInventory';
const STORAGE_KEY = 'plugin-kuku-team-inventory-teams';
const TOOLBOX_BTN = `#btn-${PLUGIN_PREFIX}`;
const TABS_CONTAINER = `#${PLUGIN_PREFIX}-Tabs`;

// ── Sample data ───────────────────────────────────────────────────────────────

const SAMPLE_TEAMS = [
  {
    id: 'team-alpha',
    name: 'Team Alpha',
    agents: [
      {
        name: 'AgentSloane',
        importedAt: '2025-01-15T09:30:00.000Z',
        keys: [
          { guid: 'portal-eiffel',     title: 'Eiffel Tower',       lat: 48.8584, lng: 2.2945, total: 5  },
          { guid: 'portal-louvre',     title: 'Louvre Museum',       lat: 48.8606, lng: 2.3376, total: 12 },
          { guid: 'portal-notre-dame', title: 'Notre-Dame de Paris', lat: 48.853,  lng: 2.3499, total: 3  },
          { guid: 'portal-arc',        title: 'Arc de Triomphe',     lat: 48.8738, lng: 2.295,  total: 2  },
        ],
        weapons:    { EMP_BURSTER_8: 42, EMP_BURSTER_7: 15, EMP_BURSTER_6: 8, ULTRA_STRIKE_8: 6, 'ADA-0': 2 },
        resonators: { L8: 120, L7: 45, L6: 22 },
        mods:       { 'RES_SHIELD-RARE': 8, 'RES_SHIELD-VERY_RARE': 2, 'HEATSINK-RARE': 4, 'MULTIHACK-RARE': 6 },
        cubes:      { XFC: 15 },
        boosts:     { APEX: 2, FRACK: 1 },
      },
      {
        name: 'AgentKraken',
        importedAt: '2025-01-16T14:00:00.000Z',
        keys: [
          { guid: 'portal-eiffel', title: 'Eiffel Tower',  lat: 48.8584, lng: 2.2945, total: 8 },
          { guid: 'portal-sacre',  title: 'Sacré-Cœur',    lat: 48.8867, lng: 2.3431, total: 7 },
          { guid: 'portal-louvre', title: 'Louvre Museum',  lat: 48.8606, lng: 2.3376, total: 4 },
        ],
        weapons:    { EMP_BURSTER_8: 30, EMP_BURSTER_5: 20, ULTRA_STRIKE_6: 10, 'JARVIS-0': 1 },
        resonators: { L8: 80, L7: 30 },
        mods:       { 'RES_SHIELD-COMMON': 10, 'EXTRA_SHIELD-VERY_RARE': 1, 'HEATSINK-VERY_RARE': 2 },
        cubes:      { XFC: 8 },
        boosts:     { APEX: 1 },
      },
    ],
  },
  {
    id: 'team-beta',
    name: 'Team Beta',
    agents: [],
  },
  {
    id: 'team-gamma',
    name: 'Team Gamma',
    agents: [
      {
        name: 'AgentNova',
        importedAt: '2025-02-01T08:00:00.000Z',
        keys: [
          { guid: 'portal-colosseum', title: 'Colosseum',      lat: 41.8902, lng: 12.4922, total: 9 },
          { guid: 'portal-trevi',     title: 'Trevi Fountain',  lat: 41.9009, lng: 12.4833, total: 6 },
          { guid: 'portal-pantheon',  title: 'Pantheon',        lat: 41.8986, lng: 12.4769, total: 4 },
        ],
        weapons:    { EMP_BURSTER_8: 20, EMP_BURSTER_7: 35, ULTRA_STRIKE_7: 8, 'ADA-0': 3 },
        resonators: { L8: 60, L7: 90, L6: 30 },
        mods:       { 'RES_SHIELD-RARE': 5, 'FORCE_AMP-RARE': 3, 'TURRET-RARE': 4 },
        cubes:      { XFC: 10 },
        boosts:     { APEX: 1, FRACK: 2 },
      },
      {
        name: 'AgentOrion',
        importedAt: '2025-02-03T11:15:00.000Z',
        keys: [
          { guid: 'portal-colosseum', title: 'Colosseum',    lat: 41.8902, lng: 12.4922, total: 3 },
          { guid: 'portal-forum',     title: 'Roman Forum',  lat: 41.8925, lng: 12.4853, total: 7 },
        ],
        weapons:    { EMP_BURSTER_8: 50, EMP_BURSTER_6: 12, 'JARVIS-0': 2 },
        resonators: { L8: 100, L7: 20 },
        mods:       { 'RES_SHIELD-VERY_RARE': 4, 'MULTIHACK-RARE': 8 },
        cubes:      { XFC: 5 },
        boosts:     { APEX: 3 },
      },
    ],
  },
];

// ── Fixtures ──────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  // Suppress "not on intel.ingress.com" dialog
  await page.addInitScript(suppressIITCDialogs);

  // Pre-seed localStorage with sample team data
  await page.addInitScript((data: unknown) => {
    window.localStorage.setItem(
      'plugin-kuku-team-inventory-teams',
      JSON.stringify(data)
    );
  }, SAMPLE_TEAMS);

  // Mock external tile/API requests
  await setupIITCRoutes(page);

  // Surface browser errors in the Node console for easier debugging
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log(`[BROWSER ERROR] ${msg.text()}`);
  });
  page.on('pageerror', (err) => console.log(`[PAGE ERROR] ${err.message}`));

  // Navigate and wait for full IITC boot
  await page.goto('/');
  await page.waitForSelector('[data-iitc-fully-loaded="true"]', {
    timeout: 30_000,
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Click the toolbox button and wait for the jQuery UI dialog to appear. */
async function openDialog(page: Page): Promise<void> {
  await page.click(TOOLBOX_BTN);
  // Wait for the jQuery UI dialog wrapper and the tabs widget to initialise
  await page.waitForSelector('.ui-dialog', { state: 'visible', timeout: 10_000 });
  await page.waitForSelector(`${TABS_CONTAINER}.ui-tabs`, { timeout: 10_000 });
}

/** Click a tab by name and wait for its panel to become active. */
async function clickTab(page: Page, tabName: string): Promise<void> {
  await page.click(`a[href="#${PLUGIN_PREFIX}-${tabName}-Panel"]`);
  // Allow the jQuery UI tab transition to settle
  await page.waitForTimeout(200);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('KuKuTeamInventory plugin', () => {

  test('IITC loads and the plugin toolbox button is visible', async ({ page }) => {
    // Core IITC elements
    await expect(page.locator('#map')).toBeVisible();
    await expect(page.locator('#sidebar')).toBeVisible();
    await expect(page.locator('#playerstat')).toContainText('TestAgent');

    // Plugin toolbox button
    await expect(page.locator(TOOLBOX_BTN)).toBeVisible();

    await expect(page).toHaveScreenshot('01-iitc-loaded.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('opens the Team Inventory dialog', async ({ page }) => {
    await openDialog(page);

    await expect(page.locator('.ui-dialog-title')).toContainText('Team Inventory');
    await expect(page.locator(TABS_CONTAINER)).toBeVisible();

    await expect(page).toHaveScreenshot('02-dialog-open.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('Teams panel — default view (all teams)', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Teams');

    // Team selector should list both teams
    await expect(page.locator(`#${PLUGIN_PREFIX}-team-select`)).toBeVisible();

    await expect(page).toHaveScreenshot('03-teams-all.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('Teams panel — single team selected', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Teams');

    // Select Team Alpha — triggers onTeamSelect via onchange handler
    await page.selectOption(`#${PLUGIN_PREFIX}-team-select`, 'team-alpha');
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('04-teams-alpha.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('Inventory (Equipment) panel', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Inventory');

    await expect(page.locator(`#${PLUGIN_PREFIX}-Resonators-Container`)).toBeVisible();

    await expect(page).toHaveScreenshot('05-inventory-panel.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('Keys panel', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Keys');

    await expect(page.locator(`#${PLUGIN_PREFIX}-Keys-Container`)).toBeVisible();

    await expect(page).toHaveScreenshot('06-keys-panel.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('Other panel — cubes and boosts', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Other');

    await expect(page.locator(`#${PLUGIN_PREFIX}-Cubes-Container`)).toBeVisible();

    await expect(page).toHaveScreenshot('07-other-panel.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('Export panel', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Export');

    await expect(page.locator(`#${PLUGIN_PREFIX}-Export-Panel`)).toBeVisible();

    await expect(page).toHaveScreenshot('08-export-panel.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('Settings panel', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Settings');

    await expect(page.locator(`#${PLUGIN_PREFIX}-Settings-Panel`)).toBeVisible();

    await expect(page).toHaveScreenshot('09-settings-panel.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('Sheets panel', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Sheets');

    await expect(page.locator(`#${PLUGIN_PREFIX}-Sheets-Panel`)).toBeVisible();

    await expect(page).toHaveScreenshot('10-sheets-panel.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('Teams panel — Team Gamma with two agents', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Teams');
    await page.selectOption(`#${PLUGIN_PREFIX}-team-select`, 'team-gamma');
    await page.waitForTimeout(300);

    // Both agents should appear
    await expect(page.locator('.agents-table tbody tr')).toHaveCount(2);

    await expect(page).toHaveScreenshot('11-teams-gamma.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('focus — clicking Focus highlights an agent row', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Teams');
    await page.selectOption(`#${PLUGIN_PREFIX}-team-select`, 'team-alpha');
    await page.waitForTimeout(300);

    // Click Focus on AgentSloane (first Focus button in the table)
    await page.locator('.agents-table button', { hasText: 'Focus' }).first().click();
    await page.waitForTimeout(300);

    // Focus bar appears with the agent name
    await expect(page.locator('.agents-focus-bar')).toBeVisible();
    await expect(page.locator('.agents-focus-bar strong')).toHaveText('AgentSloane');

    // AgentSloane's row is highlighted; the Focus button is gone for that row
    await expect(page.locator('tr.agent-row-focused')).toHaveCount(1);
    await expect(page.locator('tr.agent-row-focused td strong')).toHaveText('AgentSloane');

    await expect(page).toHaveScreenshot('12-focus-active.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });

  test('focus — Clear removes the highlight', async ({ page }) => {
    await openDialog(page);
    await clickTab(page, 'Teams');
    await page.selectOption(`#${PLUGIN_PREFIX}-team-select`, 'team-alpha');
    await page.waitForTimeout(300);

    // Set focus then clear it
    await page.locator('.agents-table button', { hasText: 'Focus' }).first().click();
    await page.waitForTimeout(200);
    await expect(page.locator('.agents-focus-bar')).toBeVisible();

    await page.locator('.agents-focus-bar button', { hasText: 'Clear' }).click();
    await page.waitForTimeout(300);

    // Focus bar gone, no highlighted rows, all Focus buttons restored
    await expect(page.locator('.agents-focus-bar')).toHaveCount(0);
    await expect(page.locator('tr.agent-row-focused')).toHaveCount(0);
    await expect(page.locator('.agents-table button', { hasText: 'Focus' })).toHaveCount(2);

    await expect(page).toHaveScreenshot('13-focus-cleared.png', {
      fullPage: true,
      maxDiffPixels: 500,
    });
  });
});
