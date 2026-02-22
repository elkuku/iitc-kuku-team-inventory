import * as Plugin from 'iitcpluginkit'
import {DialogHelper} from './Helper/Dialog'

// @ts-expect-error we don't want to import JSON files :(
import plugin from '../plugin.json'

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const PLUGIN_NAME = plugin.name.replace('IITC plugin: ', '') as string

class Main implements Plugin.Class {

    private dialogHelper: DialogHelper
    private dialog?: JQuery

    init() {
        console.log(`${PLUGIN_NAME} - ${VERSION}`)

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('./styles.css')

        this.dialogHelper = new DialogHelper(PLUGIN_NAME, 'My Plugin')

        this.createButtons()
    }

    private createButtons(): void {
        IITC.toolbox.addButton({
            label: 'My Plugin',
            title: 'My new plugin [X]',
            accessKey: 'X',
            id: `btn-${PLUGIN_NAME}`,
            action: this.showDialog
        })
    }

    private showDialog = (): void => {
        if (this.dialog) return

        this.dialog = this.dialogHelper.getDialog()
        this.dialog.on('dialogclose', () => { this.dialog = undefined })

        this.dialogHelper.updateDialog()
    }
}

Plugin.Register(new Main, PLUGIN_NAME)
