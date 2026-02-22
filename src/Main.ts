import * as Plugin from 'iitcpluginkit'

// @ts-expect-error we don't want to import JSON files :(
import plugin from '../plugin.json'

import {DialogHelper} from './Helper/Dialog'
import {ExportHelper} from './Helper/ExportHelper'
import {ImportHelper} from './Helper/ImportHelper'
import {InventoryHelper} from './Helper/InventoryHelper'
import {LayerHelper} from './Helper/LayerHelper'
import {SidebarHelper} from './Helper/SidebarHelper'
import {StorageHelper} from './Helper/StorageHelper'
import {AgentInventory} from '../types/Types'
import Portal = IITC.Portal

// eslint-disable-next-line @typescript-eslint/no-unsafe-call
const PLUGIN_NAME = plugin.name.replace('IITC plugin: ', '') as string

class Main implements Plugin.Class {

    private dialogHelper!: DialogHelper
    private importHelper!: ImportHelper
    private inventoryHelper!: InventoryHelper
    private layerHelper!: LayerHelper
    private sidebarHelper!: SidebarHelper
    private storageHelper!: StorageHelper
    private exportHelper!: ExportHelper
    private dialog: JQuery | undefined
    private selectedTeamId: string | undefined

    init(): void {
        console.log(`${PLUGIN_NAME} ${VERSION}`)

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('./styles.css')

        this.storageHelper = new StorageHelper()
        this.importHelper = new ImportHelper()
        this.inventoryHelper = new InventoryHelper()
        this.layerHelper = new LayerHelper('Team Keys')
        this.sidebarHelper = new SidebarHelper()
        this.exportHelper = new ExportHelper()
        this.dialogHelper = new DialogHelper(PLUGIN_NAME, 'Team Inventory', this.inventoryHelper)

        this.refreshMapAndSidebar()
        this.createButtons()
        this.addHooks()
    }

    // ------------------------------------------------------------------
    // Public API — called from HTML onclick handlers in templates
    // ------------------------------------------------------------------

    public onTeamSelect = (teamId: string): void => {
        this.selectedTeamId = teamId || undefined
        this.refreshMapAndSidebar()

        const teams = this.storageHelper.loadTeams()
        this.dialogHelper.updateTeamSelector(teams, this.selectedTeamId)
        this.dialogHelper.updateAgentsList(
            this.selectedTeamId ? (teams.find(t => t.id === this.selectedTeamId) ?? undefined) : undefined
        )
        this.dialogHelper.updateInventoryPanels(this.getAgentsForDisplay())
    }

    public importFromFile = async (input: HTMLInputElement): Promise<void> => {
        const file = input.files?.[0]
        // Reset so the same file can be re-imported
        input.value = ''

        if (!file) return

        let data
        try {
            data = await this.importHelper.readFile(file)
        } catch {
            alert('Failed to read file. Make sure it is a valid JSON export.')
            return
        }

        let agentName = (data.agent ?? '').trim()
        if (!agentName) {
            const prompted = prompt('No agent name found in file. Enter agent name:')
            agentName = (prompted ?? '').trim()
            if (!agentName) {
                alert('Agent name is required.')
                return
            }
        }

        let teams = this.storageHelper.loadTeams()

        if (teams.length === 0) {
            const teamName = (prompt('No teams exist yet. Enter a name for the first team:') ?? '').trim()
            if (!teamName) {
                alert('Team name is required.')
                return
            }
            const team = this.storageHelper.createTeam(teamName)
            this.selectedTeamId = team.id
            teams = this.storageHelper.loadTeams()
        } else if (!this.selectedTeamId) {
            const teamList = teams.map((t, i) => `${i + 1}. ${t.name}`).join('\n')
            const choice = prompt(`Select team number:\n${teamList}`)
            if (!choice) return

            const index = parseInt(choice, 10) - 1
            if (index < 0 || index >= teams.length) {
                alert('Invalid selection.')
                return
            }
            this.selectedTeamId = teams[index].id
        }

        const agent = this.importHelper.createAgent(data, agentName)
        this.storageHelper.addAgentToTeam(this.selectedTeamId, agent)
        teams = this.storageHelper.loadTeams()

        this.refreshMapAndSidebar()
        this.dialogHelper.updateAll(teams, this.selectedTeamId, this.getAgentsForDisplay())
    }

    public createTeam = (): void => {
        const name = (prompt('Enter team name:') ?? '').trim()
        if (!name) return

        const team = this.storageHelper.createTeam(name)
        this.selectedTeamId = team.id

        const teams = this.storageHelper.loadTeams()
        this.dialogHelper.updateTeamSelector(teams, this.selectedTeamId)
        this.dialogHelper.updateAgentsList(team)
    }

    public deleteSelectedTeam = (): void => {
        if (!this.selectedTeamId) {
            alert('No team selected.')
            return
        }

        const team = this.storageHelper.getTeam(this.selectedTeamId)
        if (!confirm(`Delete team "${team?.name ?? this.selectedTeamId}"? All agent data will be removed.`)) return

        this.storageHelper.deleteTeam(this.selectedTeamId)
        this.selectedTeamId = undefined

        const teams = this.storageHelper.loadTeams()
        this.refreshMapAndSidebar()
        this.dialogHelper.updateAll(teams, undefined, this.getAgentsForDisplay())
    }

    public deleteAgent = (teamId: string, agentName: string): void => {
        if (!confirm(`Remove agent "${agentName}" from team?`)) return

        this.storageHelper.removeAgent(teamId, agentName)

        const teams = this.storageHelper.loadTeams()
        const team = teams.find(t => t.id === teamId)
        this.dialogHelper.updateAgentsList(team)
        this.refreshMapAndSidebar()
        this.dialogHelper.updateInventoryPanels(this.getAgentsForDisplay())
    }

    public exportData = (): void => {
        this.exportHelper.exportTeams(this.storageHelper.loadTeams())
    }

    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------

    private getAgentsForDisplay(): AgentInventory[] {
        const teams = this.storageHelper.loadTeams()
        if (this.selectedTeamId) {
            const team = teams.find(t => t.id === this.selectedTeamId)
            return team?.agents ?? []
        }
        return teams.flatMap(t => t.agents.map(a => ({...a, name: `${t.name} / ${a.name}`})))
    }

    private refreshMapAndSidebar(): void {
        const keys = this.inventoryHelper.aggregateKeys(this.getAgentsForDisplay())
        this.layerHelper.setKeys(keys)
        this.sidebarHelper.setKeys(keys)
    }

    private onPortalAdded = (data: any): void => {
        this.layerHelper.onPortalAdded(data.portal as Portal)
    }

    private onPortalRemoved = (data: any): void => {
        this.layerHelper.onPortalRemoved(data.portal as Portal)
    }

    private onPortalSelected = (data: any): void => {
        this.layerHelper.onPortalSelected(data)
    }

    private onPortalDetailsUpdated = (data: any): void => {
        this.sidebarHelper.onPortalDetailsUpdated(data)
    }

    private addHooks(): void {
        window.addHook('portalAdded', this.onPortalAdded)
        window.addHook('portalRemoved', this.onPortalRemoved)
        window.addHook('portalSelected', this.onPortalSelected)
        window.addHook('portalDetailsUpdated', this.onPortalDetailsUpdated)
    }

    private createButtons(): void {
        IITC.toolbox.addButton({
            label: 'Team Inventory',
            title: 'Show team inventory',
            id: `btn-${PLUGIN_NAME}`,
            action: this.showDialog,
        })
    }

    private showDialog = (): void => {
        if (this.dialog) return

        const teams = this.storageHelper.loadTeams()
        this.dialog = this.dialogHelper.getDialog()
        this.dialog.on('dialogclose', () => { this.dialog = undefined })

        this.dialogHelper.updateAll(teams, this.selectedTeamId, this.getAgentsForDisplay())

        $(`#${PLUGIN_NAME}-Tabs`).tabs()
    }
}

Plugin.Register(new Main(), PLUGIN_NAME)
