/**
 * Webpack config override for iitc-kuku-team-inventory.
 * Disables css-loader URL resolution so that absolute paths like /img/ico/...
 * are emitted as-is (they are served by the IITC host at runtime).
 */
module.exports = (config) => {
    for (const rule of config.module.rules) {
        const uses = rule.use
        if (!Array.isArray(uses)) continue
        for (const use of uses) {
            if (typeof use === 'object' && typeof use.loader === 'string'
                && use.loader.includes('css-loader') && !use.loader.includes('postcss')) {
                use.options = {...(use.options || {}), url: false}
            }
        }
    }
}
