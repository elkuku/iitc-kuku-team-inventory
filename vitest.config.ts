import {defineConfig} from 'vitest/config'

export default defineConfig({
    test: {
        include: ['src/**/*.spec.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json-summary'],
            include: ['src/Helper/**/*.ts'],
            exclude: ['src/**/*.spec.ts'],
        },
    },
})
