// IITC test plugin — signals load completion via DOM attributes.
// Served inline in the mock intel page so it runs before IITC replaces document.body.

(function () {
  if (typeof window.plugin !== 'function') window.plugin = function () {};
  window.plugin.testPlugin = {};

  function setup() {
    document.body.setAttribute('data-test-plugin-loaded', 'true');
    console.log('[TEST PLUGIN] setup() called');

    window.addHook('iitcLoaded', function () {
      document.body.setAttribute('data-iitc-fully-loaded', 'true');
      console.log('[TEST PLUGIN] iitcLoaded hook fired — IITC fully booted');
    });
  }

  setup.info = { buildName: 'test', pluginId: 'test-plugin' };

  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);

  // If IITC already finished booting (e.g. plugin loaded late), run immediately
  if (window.iitcLoaded && typeof setup === 'function') {
    setup();
    document.body.setAttribute('data-iitc-fully-loaded', 'true');
  }
})();
