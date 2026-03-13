declare module '*.hbs' {
    const content: string
    export default content
}

declare module '*.css' {
    const content: string
    export default content
}

declare module 'vitest/browser' {
    export { page, BrowserPage, ScreenshotOptions } from '@vitest/browser/context'
}
