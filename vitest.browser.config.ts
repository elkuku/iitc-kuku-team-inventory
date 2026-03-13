import {defineConfig} from 'vitest/config'
import {playwright} from '@vitest/browser-playwright'

export default defineConfig({
    plugins: [{
        name: 'hbs-as-text',
        transform: (code: string, id: string) => {
            if (id.endsWith('.hbs')) return {code: `export default ${JSON.stringify(code)}`}
        },
    }],
    test: {
        include: ['src/**/*.browser.spec.ts'],
        browser: {
            enabled: true,
            provider: playwright({launchOptions: {headless: true}}),
            instances: [{browser: 'chromium'}],
        },
    },
})
