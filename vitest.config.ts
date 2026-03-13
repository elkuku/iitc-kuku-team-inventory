import {defineConfig} from 'vitest/config'

export default defineConfig({
    plugins: [{
        name: 'hbs-as-text',
        transform(code: string, id: string) {
            if (id.endsWith('.hbs')) return {code: `export default ${JSON.stringify(code)}`}
        },
    }],
    test: {
        include: ['src/**/*.spec.ts'],
        exclude: ['src/**/*.browser.spec.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json-summary'],
            include: ['src/Helper/**/*.ts'],
            exclude: ['src/**/*.spec.ts'],
        },
    },
})
