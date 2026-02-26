// @ts-expect-error "Import attributes are only supported when the --module option is set to esnext, nodenext, or preserve"
import dialogTemplate from '../tpl/dialog.hbs' with {type: 'text'}
// @ts-expect-error "Import attributes are only supported when the --module option is set to esnext, nodenext, or preserve"
import itemsImageTemplate from '../tpl/_items-image.hbs' with {type: 'text'}
// @ts-expect-error "Import attributes are only supported when the --module option is set to esnext, nodenext, or preserve"
import itemsLabelTemplate from '../tpl/_items-label.hbs' with {type: 'text'}
// @ts-expect-error "Import attributes are only supported when the --module option is set to esnext, nodenext, or preserve"
import keysTableTemplate from '../tpl/_keys-table.hbs' with {type: 'text'}
// @ts-expect-error "Import attributes are only supported when the --module option is set to esnext, nodenext, or preserve"
import agentsListTemplate from '../tpl/_agents-list.hbs' with {type: 'text'}

import {translateKey} from '../../types/key-translations'
import {AgentInventory, HelperHandlebars, ItemWithBreakdown, KeyInfo, Team} from '../../types/Types'
import {InventoryHelper} from './InventoryHelper'

export class DialogHelper {

    private handlebars!: HelperHandlebars
    private itemsImageTpl!: Handlebars.TemplateDelegate
    private itemsLabelTpl!: Handlebars.TemplateDelegate
    private keysTpl!: Handlebars.TemplateDelegate
    private agentsTpl!: Handlebars.TemplateDelegate

    public constructor(
        private readonly pluginName: string,
        private readonly title: string,
        private readonly inventoryHelper: InventoryHelper,
    ) {}

    public getDialog(): JQuery {
        this.handlebars = window.plugin.HelperHandlebars

        if (!this.handlebars) {
            alert(`${this.pluginName} - Handlebars helper not found`)
            throw new Error(`${this.pluginName} - Handlebars helper not found`)
        }

        this.handlebars.registerHelper({
            eachInMap: (map: Map<any, any>, block: Handlebars.HelperOptions) => {
                let out = ''
                if (map instanceof Map) {
                    for (const [key, value] of map) {
                        out += block.fn({key, value})
                    }
                }
                return out
            },
            translateKey: (key: string): string => translateKey(key),
            distanceToCenter: (lat: number, lng: number): string => {
                const center = window.map.getCenter()
                const distance = L.latLng(lat, lng).distanceTo(center)
                if (distance >= 10_000) return `${Math.round(distance / 1000)} km`
                if (distance >= 1000) return `${Math.round(distance / 100) / 10} km`
                return `${Math.round(distance)} m`
            },
        })

        this.itemsImageTpl = this.handlebars.compile(itemsImageTemplate)
        this.itemsLabelTpl = this.handlebars.compile(itemsLabelTemplate)
        this.keysTpl = this.handlebars.compile(keysTableTemplate)
        this.agentsTpl = this.handlebars.compile(agentsListTemplate)

        const mainTpl = this.handlebars.compile(dialogTemplate)
        const html = mainTpl({
            plugin: `window.plugin.${this.pluginName}`,
            prefix: this.pluginName,
        })

        return window.dialog({
            id: this.pluginName,
            title: this.title,
            html,
            width: 900,
            height: 700,
            buttons: [],
        }).parent()
    }

    public updateAll(teams: Team[], selectedTeamId: string | undefined, agents: AgentInventory[]): void {
        this.updateTeamSelector(teams, selectedTeamId)
        const team = selectedTeamId ? (teams.find(t => t.id === selectedTeamId) ?? undefined) : undefined
        this.updateAgentsList(team)
        this.updateInventoryPanels(agents)
    }

    public updateTeamSelector(teams: Team[], selectedTeamId: string | undefined): void {
        const select = document.getElementById(`${this.pluginName}-team-select`) as HTMLSelectElement | undefined
        if (!select) return

        while (select.options.length > 1) select.remove(1)
        select.options[0].selected = !selectedTeamId

        for (const team of teams) {
            const opt = document.createElement('option')
            opt.value = team.id
            opt.text = `${team.name} (${team.agents.length} agent${team.agents.length === 1 ? '' : 's'})`
            opt.selected = team.id === selectedTeamId
            select.add(opt)
        }
    }

    public updateAgentsList(team: Team | undefined): void {
        const container = this.getContainer('AgentsList')
        if (!container) return

        if (!team) {
            container.innerHTML = '<p>Select a team above to see agents.</p>'
            return
        }

        if (team.agents.length === 0) {
            container.innerHTML = '<p>No agents yet. Import a JSON file to add data.</p>'
            return
        }

        const agentData = team.agents.map(agent => ({
            name: agent.name,
            importedAt: new Date(agent.importedAt).toLocaleString(),
            keyCount: agent.keys.reduce((sum, k) => sum + k.total, 0),
            keyPortals: agent.keys.length,
        }))

        container.innerHTML = this.agentsTpl({
            agents: agentData,
            teamId: team.id,
            plugin: `window.plugin.${this.pluginName}`,
        })
    }

    public updateInventoryPanels(agents: AgentInventory[]): void {
        if (!this.itemsImageTpl) return

        const resonators = this.inventoryHelper.aggregateItems(agents, 'resonators')
        const weapons = this.inventoryHelper.aggregateItems(agents, 'weapons')
        const mods = this.inventoryHelper.aggregateItems(agents, 'mods')
        const cubes = this.inventoryHelper.aggregateItems(agents, 'cubes')
        const boosts = this.inventoryHelper.aggregateItems(agents, 'boosts')
        const keys = this.inventoryHelper.aggregateKeys(agents)

        const cntEquipment = this.processResonators(resonators)
            + this.processWeapons(weapons)
            + this.processMods(mods)
        const cntKeys = this.processKeys(keys)
        const cntOther = this.processCubes(cubes) + this.processBoosts(boosts)

        this.setCount('cntEquipment', cntEquipment)
        this.setCount('cntKeys', cntKeys)
        this.setCount('cntOther', cntOther)
        this.setCount('cntTotal', cntEquipment + cntKeys + cntOther)
    }

    // ------------------------------------------------------------------
    // Private section processors
    // ------------------------------------------------------------------

    private processResonators(resonators: Map<string, ItemWithBreakdown>): number {
        const sorted = this.sortByNumericSuffix(resonators)
        this.getContainer('Resonators').innerHTML = this.itemsImageTpl({items: sorted})

        let total = 0
        for (const item of resonators.values()) total += item.total
        this.setCount('cntResonators', total)
        return total
    }

    private processWeapons(weapons: Map<string, ItemWithBreakdown>): number {
        const bursters = new Map<string, ItemWithBreakdown>()
        const strikes = new Map<string, ItemWithBreakdown>()
        let cntBursters = 0, cntStrikes = 0, cntFlips = 0

        for (const [key, value] of weapons) {
            if (key.startsWith('EMP_BURSTER')) {
                bursters.set(key, value)
                cntBursters += value.total
            } else if (key.startsWith('ULTRA_STRIKE')) {
                strikes.set(key, value)
                cntStrikes += value.total
            } else if (key === 'ADA-0' || key === 'JARVIS-0') {
                strikes.set(key, value)
                cntFlips += value.total
            } else {
                console.warn('[KuKuTeamInventory] Unknown weapon:', key)
            }
        }

        this.getContainer('Bursters').innerHTML = this.itemsImageTpl({items: this.sortByNumericSuffix(bursters)})
        this.getContainer('Strikes').innerHTML = this.itemsImageTpl({items: this.sortByNumericSuffix(strikes)})

        this.setCount('cntBursters', cntBursters)
        this.setCount('cntStrikes', cntStrikes)
        this.setCount('cntFlips', cntFlips)

        const total = cntBursters + cntStrikes + cntFlips
        this.setCount('cntWeapons', total)
        return total
    }

    private processMods(mods: Map<string, ItemWithBreakdown>): number {
        const shields = new Map<string, ItemWithBreakdown>()
        const hackMods = new Map<string, ItemWithBreakdown>()
        const otherMods = new Map<string, ItemWithBreakdown>()
        let cntShields = 0, cntHack = 0, cntOther = 0

        const rarities = ['COMMON', 'RARE', 'VERY_RARE']

        for (const [key, value] of mods) {
            if (key.startsWith('RES_SHIELD') || key.startsWith('EXTRA_SHIELD')) {
                shields.set(key, value)
                cntShields += value.total
            } else if (key.startsWith('HEATSINK') || key.startsWith('MULTIHACK')) {
                hackMods.set(key, value)
                cntHack += value.total
            } else {
                otherMods.set(key, value)
                cntOther += value.total
            }
        }

        this.getContainer('Shields').innerHTML = this.itemsImageTpl({
            items: this.sortByCompoundKey(shields, ['RES_SHIELD', 'EXTRA_SHIELD'], rarities),
        })
        this.getContainer('HackMods').innerHTML = this.itemsImageTpl({
            items: this.sortByCompoundKey(hackMods, ['HEATSINK', 'MULTIHACK'], rarities),
        })
        this.getContainer('OtherMods').innerHTML = this.itemsImageTpl({items: otherMods})

        this.setCount('cntModShields', cntShields)
        this.setCount('cntModHack', cntHack)
        this.setCount('cntModOther', cntOther)

        const total = cntShields + cntHack + cntOther
        this.setCount('cntMods', total)
        return total
    }

    private processCubes(cubes: Map<string, ItemWithBreakdown>): number {
        const sorted = this.sortByNumericSuffix(cubes)
        this.getContainer('Cubes').innerHTML = this.itemsLabelTpl({items: sorted})

        let total = 0
        for (const item of cubes.values()) total += item.total
        this.setCount('cntCubes', total)
        return total
    }

    private processBoosts(boosts: Map<string, ItemWithBreakdown>): number {
        const play = new Map<string, ItemWithBreakdown>()
        const beacons = new Map<string, ItemWithBreakdown>()
        const playTypes = new Set(['FRACK', 'APEX', 'BB_BATTLE', 'FW_ENL', 'FW_RES'])
        let cntPlay = 0, cntBeacons = 0

        for (const [key, value] of boosts) {
            if (playTypes.has(key)) {
                play.set(key, value)
                cntPlay += value.total
            } else {
                beacons.set(key, value)
                cntBeacons += value.total
            }
        }

        this.getContainer('Boosts-Play').innerHTML = this.itemsLabelTpl({items: play})
        this.getContainer('Boosts-Beacons').innerHTML = this.itemsLabelTpl({items: beacons})

        this.setCount('cntBoostsPlay', cntPlay)
        this.setCount('cntBoostsBeacons', cntBeacons)

        const total = cntPlay + cntBeacons
        this.setCount('cntBoosts', total)
        return total
    }

    private processKeys(keys: Map<string, KeyInfo>): number {
        const container = document.getElementById(`${this.pluginName}-Keys-Container`)
        if (container) {
            container.innerHTML = this.keysTpl({items: keys})
        }

        let total = 0
        for (const info of keys.values()) total += info.total
        this.setCount('cntKeysTotal', total)

        this.enableTableSorting(`${this.pluginName}-keysTable`)
        this.enableKeysSearch(`${this.pluginName}-keysTable`, `${this.pluginName}-keys-search`)

        return total
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private getContainer(name: string): Element {
        const element = document.getElementById(`${this.pluginName}-${name}-Container`)
        if (!element) console.warn(`[KuKuTeamInventory] Container not found: ${name}`)
        return element as Element
    }

    private setCount(name: string, count: number): void {
        const element = document.getElementById(`${this.pluginName}-${name}`)
        if (element) element.textContent = count.toString()
    }

    public sortTable(tableId: string, columnIndex: number, type: 'string' | 'number' | 'distance', ascending: boolean): void {
        const table = document.getElementById(tableId) as HTMLTableElement
        const tbody = table.tBodies[0]
        const rows = [...tbody.rows]

        rows.sort((a, b) => {
            const aText = a.cells[columnIndex].textContent?.trim() ?? ''
            const bText = b.cells[columnIndex].textContent?.trim() ?? ''

            switch (type) {
                case 'string':
                    return ascending ? aText.localeCompare(bText) : bText.localeCompare(aText)
                case 'number': {
                    const aNum = parseFloat(aText)
                    const bNum = parseFloat(bText)
                    return ascending ? aNum - bNum : bNum - aNum
                }
                case 'distance': {
                    const aNum = DialogHelper.parseDistance(aText)
                    const bNum = DialogHelper.parseDistance(bText)
                    return ascending ? aNum - bNum : bNum - aNum
                }
            }
        })

        rows.forEach(row => tbody.appendChild(row))
    }

    public enableTableSorting(tableId: string): void {
        const table = document.getElementById(tableId) as HTMLTableElement
        if (!table || table.dataset.sortEnabled) return
        table.dataset.sortEnabled = 'true'

        const headers = table.querySelectorAll<HTMLTableCellElement>('th')

        headers.forEach((header, i) => {
            const type = header.dataset.type as 'string' | 'number' | 'distance' | undefined
            if (!type) return

            const indicator = document.createElement('span')
            indicator.style.marginLeft = '8px'
            header.appendChild(indicator)

            let ascending = true

            header.addEventListener('click', () => {
                this.sortTable(tableId, i, type, ascending)
                ascending = !ascending

                headers.forEach(hdr => {
                    const span = hdr.querySelector('span:not(.cnt)')
                    if (span) span.textContent = ''
                })

                indicator.textContent = ascending ? '▲' : '▼'
            })
        })
    }

    public enableKeysSearch(tableId: string, inputId: string): void {
        const input = document.getElementById(inputId) as HTMLInputElement | null
        if (!input || input.dataset.searchEnabled) return
        input.dataset.searchEnabled = 'true'

        input.addEventListener('input', () => {
            const query = input.value.toLowerCase().trim()
            const table = document.getElementById(tableId) as HTMLTableElement | null
            if (!table) return

            for (const row of table.tBodies[0].rows) {
                const text = row.cells[0]?.textContent?.toLowerCase() ?? ''
                row.style.display = !query || text.includes(query) ? '' : 'none'
            }
        })
    }

    private static parseDistance(distanceStr: string): number {
        const match = /^([\d.]+)\s*(\w+)$/.exec(distanceStr.trim())
        if (!match) return 0
        const value = parseFloat(match[1])
        const unit = match[2].toLowerCase()
        return unit === 'km' ? value * 1000 : value
    }

    private sortByNumericSuffix<V>(map: Map<string, V>): Map<string, V> {
        return new Map(
            [...map.entries()].toSorted(([a], [b]) => {
                const numA = parseInt(/(\d+)$/.exec(a)?.[1] ?? '0', 10)
                const numB = parseInt(/(\d+)$/.exec(b)?.[1] ?? '0', 10)
                return numA - numB
            })
        )
    }

    private sortByCompoundKey<V>(
        map: Map<string, V>,
        typeOrder: string[],
        rarityOrder: string[]
    ): Map<string, V> {
        return new Map(
            [...map.entries()].toSorted(([a], [b]) => {
                const lastA = a.lastIndexOf('-')
                const lastB = b.lastIndexOf('-')
                const typeA = lastA === -1 ? a : a.slice(0, lastA)
                const rarityA = lastA === -1 ? '' : a.slice(lastA + 1)
                const typeB = lastB === -1 ? b : b.slice(0, lastB)
                const rarityB = lastB === -1 ? '' : b.slice(lastB + 1)
                const typeDiff = typeOrder.indexOf(typeA) - typeOrder.indexOf(typeB)
                return typeDiff === 0 ? rarityOrder.indexOf(rarityA) - rarityOrder.indexOf(rarityB) : typeDiff
            })
        )
    }
}
