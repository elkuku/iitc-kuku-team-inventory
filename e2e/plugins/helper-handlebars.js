// Mock HelperHandlebars plugin — provides window.plugin.HelperHandlebars
// backed by the real Handlebars UMD build served at /libs/handlebars.min.js.
// Load order: this plugin's setup() runs before KuKuTeamInventory's setup()
// because files in e2e/plugins/ are sorted alphabetically and loaded first.

(function () {
  if (typeof window.plugin !== 'function') window.plugin = function () {};

  function setup() {
    if (!window.Handlebars) {
      console.error('[MOCK HelperHandlebars] window.Handlebars not available — make sure /libs/handlebars.min.js loaded');
      return;
    }

    window.plugin.HelperHandlebars = {
      /** Register one or more Handlebars helpers. */
      registerHelper: function (nameOrSpec, fn) {
        if (typeof nameOrSpec === 'object' && nameOrSpec !== null) {
          Object.keys(nameOrSpec).forEach(function (key) {
            window.Handlebars.registerHelper(key, nameOrSpec[key]);
          });
        } else {
          window.Handlebars.registerHelper(nameOrSpec, fn);
        }
      },

      /** Compile a Handlebars template string and return a render function. */
      compile: function (templateString) {
        return window.Handlebars.compile(templateString);
      },
    };

    console.log('[MOCK HelperHandlebars] setup() done — window.plugin.HelperHandlebars ready');
  }

  setup.info = { buildName: 'test', pluginId: 'helper-handlebars' };

  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);

  if (window.iitcLoaded && typeof setup === 'function') {
    setup();
  }
})();
