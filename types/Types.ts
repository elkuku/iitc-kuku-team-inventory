
export interface HelperHandlebars {
    compile: (templateString: any) => Handlebars.TemplateDelegate
    registerHelper: (name: Handlebars.HelperDeclareSpec) => void
}

declare global {
    interface Window {
        plugin: {
            HelperHandlebars: HelperHandlebars
        }
    }
}
