import { Page } from '@playwright/test';

// 1×1 transparent PNG (68 bytes)
const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Sets up Playwright network route interceptions for IITC:
 * - Mock map tile requests with a 1×1 transparent PNG
 * - Abort Google Maps API requests (prevents GoogleMutant errors)
 * - Stub Google Fonts (prevents network errors)
 */
export async function setupIITCRoutes(page: Page): Promise<void> {
  // CartoDB tiles (default IITC basemap)
  await page.route(/basemaps\.cartocdn\.com/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TRANSPARENT_PNG,
    })
  );

  // OpenStreetMap tiles
  await page.route(/tile\.openstreetmap\.org/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TRANSPARENT_PNG,
    })
  );

  // Google Maps API — abort to prevent GoogleMutant initialization errors
  await page.route(/maps\.googleapis\.com|maps\.gstatic\.com/, (route) =>
    route.abort()
  );

  // Google Fonts — return empty CSS to suppress network errors
  await page.route(/fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );

  // Default portal image
  await page.route(/commondatastorage\.googleapis\.com/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TRANSPARENT_PNG,
    })
  );
}

/**
 * Pre-seeds localStorage entries to suppress IITC dialogs during testing.
 * Pass this function to page.addInitScript() — it runs in the browser context.
 */
export function suppressIITCDialogs(): void {
  // Suppress "not on intel.ingress.com" warning dialog
  // eslint-disable-next-line no-undef
  window.localStorage.setItem('pass-checking-intel-url', 'true');
}
