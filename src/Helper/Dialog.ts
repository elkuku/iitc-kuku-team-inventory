// @ts-expect-error "Import attributes are only supported when the --module option is set to esnext, nodenext, or preserve"
import dialogTemplate from '../tpl/dialog.hbs' with {type: 'text'}

import {HelperHandlebars} from '../../types/Types'

export class DialogHelper {

    private handlebars: HelperHandlebars

    public constructor(
        private pluginName: string,
        private title: string,
    ) {}

    public getDialog(): JQuery {
        this.handlebars = window.plugin.HelperHandlebars

        if (!this.handlebars) {
            alert(`${this.pluginName} - Handlebars helper not found`)
            throw new Error(`${this.pluginName} - Handlebars helper not found`)
        }

        const template = this.handlebars.compile(dialogTemplate)

        const data = {
            plugin: 'window.plugin.' + this.pluginName,
            prefix: this.pluginName,
        }

        return window.dialog({
           // position: {my: 'top', at: 'top', of: window},
            id: this.pluginName,
            title: this.title,
            html: template(data),
            width: 'auto',
            height: 'auto',
            buttons: [],
        }).parent()
    }

    public updateDialog() {
        console.log('DialogHelper.updateDialog')
    }
}
