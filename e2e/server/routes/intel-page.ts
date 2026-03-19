import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

const FIXTURES_DIR = path.join(__dirname, '../fixtures');

// Plugins are loaded from IITC_PLUGINS_DIR (e2e/plugins/ by default).
const PLUGINS_DIR =
  process.env.IITC_PLUGINS_DIR ?? path.join(process.cwd(), 'e2e/plugins');

// An extra plugin file (e.g. the built team-inventory plugin) can be
// specified via PLUGIN_FILE and will be appended after PLUGINS_DIR entries.
const EXTRA_PLUGIN_FILE = process.env.PLUGIN_FILE ?? null;

// Boot-signal plugin from the package — always appended so [data-iitc-fully-loaded]
// is always set, regardless of what is in PLUGINS_DIR.
const BUILTIN_TEST_PLUGIN = require.resolve('iitc-kuku-plugin-tester/tests/test-plugin.js');

const player = JSON.parse(
  fs.readFileSync(path.join(FIXTURES_DIR, 'player.json'), 'utf8')
);

/** Read all plugin files and return their contents as a single JS string. */
function loadPlugins(): string {
  const entries: Array<{ name: string; content: string }> = [];

  if (fs.existsSync(PLUGINS_DIR)) {
    fs.readdirSync(PLUGINS_DIR)
      .filter((f) => f.endsWith('.js'))
      .sort() // deterministic load order
      .forEach((f) => {
        entries.push({
          name: f,
          content: fs.readFileSync(path.join(PLUGINS_DIR, f), 'utf8'),
        });
      });
  }

  entries.push({
    name: path.basename(BUILTIN_TEST_PLUGIN),
    content: fs.readFileSync(BUILTIN_TEST_PLUGIN, 'utf8'),
  });

  if (EXTRA_PLUGIN_FILE && fs.existsSync(EXTRA_PLUGIN_FILE)) {
    entries.push({
      name: path.basename(EXTRA_PLUGIN_FILE),
      content: fs.readFileSync(EXTRA_PLUGIN_FILE, 'utf8'),
    });
  }

  return entries
    .map(({ name, content }) => `// === plugin: ${name} ===\n${content}`)
    .join('\n\n');
}

export function serveIntelPage(_req: Request, res: Response): void {
  res.cookie('csrftoken', 'mockedcsrftoken', { path: '/' });
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(buildPage());
}

function buildPage(): string {
  const pluginCode = loadPlugins();

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Ingress Intel Map</title>
  <!-- Handlebars UMD — loaded before plugins so window.Handlebars is available
       when the mock HelperHandlebars plugin's setup() runs during IITC boot. -->
  <script src="/libs/handlebars.min.js"></script>
</head>
<body>
<script>
  // Satisfy extractFromStock() regex: /"X-CSRFToken".*[a-z].v="([a-f0-9]{40})";/
  // Everything must be on a SINGLE LINE so the regex (no s-flag) can match across it.
  var Xb = function() {};
  // prettier-ignore
  Xb.prototype.ab = function() { var r={headers:{"X-CSRFToken":"mock"}}; var a={}; a.v="aabbccdd1122334455667788990011aabbccdd12"; return a; };
  window.Xb = Xb;

  // ZOOM_TO_LEVEL: integer array, length 12-18, starts with 8, non-increasing
  window.Zt = [8, 8, 8, 8, 7, 7, 7, 6, 6, 5, 4, 4, 3, 2, 2, 1, 1];

  // TILES_PER_EDGE: integer array, length 12-18, non-decreasing, last >= 9000
  window.Yu = [1, 1, 1, 40, 40, 80, 80, 320, 1000, 2000, 2000, 4000, 8000, 16000, 16000, 32000];

  // PLAYER object — required before IITC script runs
  window.PLAYER = ${JSON.stringify(player)};

  // Pre-populate bootPlugins so IITC's boot() will call setup() for each plugin.
  // Plugins are embedded inline so they run BEFORE IITC replaces document.body,
  // avoiding the detached-node issue with <script src> tags placed after the IITC script.
  window.bootPlugins = window.bootPlugins || [];
</script>
<script>
${pluginCode}
</script>
<script src="/iitc/total-conversion-build.js"></script>
</body>
</html>`;
}
