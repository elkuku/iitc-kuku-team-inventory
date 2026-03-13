import {describe, it, beforeAll} from 'vitest'
import {page} from 'vitest/browser'
import Handlebars from 'handlebars'
import {translateKey} from '../types/key-translations'
import {DialogHelper} from './Helper/Dialog'
import {InventoryHelper} from './Helper/InventoryHelper'
import type {AgentInventory, Team} from '../types/Types'
import dialogTemplate from './tpl/dialog.hbs'
import itemsImageTemplate from './tpl/_items-image.hbs'
import itemsLabelTemplate from './tpl/_items-label.hbs'
import keysTableTemplate from './tpl/_keys-table.hbs'
import agentsListTemplate from './tpl/_agents-list.hbs'
import './styles.css'

const PREFIX = 'KuKuTeamInventory'
const ALL_PANELS = ['Teams', 'Inventory', 'Keys', 'Other', 'Export', 'Settings', 'Sheets'] as const

const showOnlyPanel = (name: string): void => {
    for (const panelName of ALL_PANELS) {
        const element = document.getElementById(`${PREFIX}-${panelName}-Panel`)
        if (element) element.style.display = panelName === name ? 'block' : 'none'
    }
}

// Register Handlebars helpers at module scope
Handlebars.registerHelper('eachInMap', (map: unknown, block: {fn: (context: unknown) => string}): string => {
    let output = ''
    if (map instanceof Map) {
        for (const [key, value] of map) {
            output += block.fn({key, value})
        }
    }
    return output
})
Handlebars.registerHelper('translateKey', (key: string): string => translateKey(key))
Handlebars.registerHelper('distanceToCenter', (): string => '0.5 km')

// Pre-compile templates
const mainTpl = Handlebars.compile(dialogTemplate)
const itemsImageTpl = Handlebars.compile(itemsImageTemplate)
const itemsLabelTpl = Handlebars.compile(itemsLabelTemplate)
const keysTpl = Handlebars.compile(keysTableTemplate)
const agentsTpl = Handlebars.compile(agentsListTemplate)

// ── Sample data ────────────────────────────────────────────────────────────

const SAMPLE_AGENTS: AgentInventory[] = [
    {
        name: 'AgentSloane',
        importedAt: new Date('2025-01-15T09:30:00Z').toISOString(),
        keys: [
            {guid: 'portal-eiffel',     title: 'Eiffel Tower',        lat: 48.858_4, lng: 2.294_5, total: 5},
            {guid: 'portal-louvre',     title: 'Louvre Museum',        lat: 48.860_6, lng: 2.337_6, total: 12},
            {guid: 'portal-notre-dame', title: 'Notre-Dame de Paris',  lat: 48.853,   lng: 2.3499,  total: 3},
            {guid: 'portal-arc',        title: 'Arc de Triomphe',      lat: 48.8738,  lng: 2.295,   total: 2},
        ],
        weapons: {EMP_BURSTER_8: 42, EMP_BURSTER_7: 15, EMP_BURSTER_6: 8, ULTRA_STRIKE_8: 6, 'ADA-0': 2},
        resonators: {L8: 120, L7: 45, L6: 22},
        mods: {'RES_SHIELD-RARE': 8, 'RES_SHIELD-VERY_RARE': 2, 'HEATSINK-RARE': 4, 'MULTIHACK-RARE': 6},
        cubes: {XFC: 15},
        boosts: {APEX: 2, FRACK: 1},
    },
    {
        name: 'AgentKraken',
        importedAt: new Date('2025-01-16T14:00:00Z').toISOString(),
        keys: [
            {guid: 'portal-eiffel',     title: 'Eiffel Tower',   lat: 48.858_4, lng: 2.294_5, total: 8},
            {guid: 'portal-sacre',      title: 'Sacré-Cœur',     lat: 48.886_7, lng: 2.343_1, total: 7},
            {guid: 'portal-louvre',     title: 'Louvre Museum',  lat: 48.860_6, lng: 2.337_6, total: 4},
        ],
        weapons: {EMP_BURSTER_8: 30, EMP_BURSTER_5: 20, ULTRA_STRIKE_6: 10, 'JARVIS-0': 1},
        resonators: {L8: 80, L7: 30},
        mods: {'RES_SHIELD-COMMON': 10, 'EXTRA_SHIELD-VERY_RARE': 1, 'HEATSINK-VERY_RARE': 2},
        cubes: {XFC: 8},
        boosts: {APEX: 1},
    },
]

const SAMPLE_TEAM: Team = {id: 'team-alpha', name: 'Team Alpha', agents: SAMPLE_AGENTS}
const SAMPLE_TEAMS: Team[] = [SAMPLE_TEAM, {id: 'team-beta', name: 'Team Beta', agents: []}]

// ── Base page styles ───────────────────────────────────────────────────────

const BASE_STYLES = `
    * { box-sizing: border-box; }
    body {
        margin: 0;
        padding: 20px;
        background: #1a1a1a;
        color: #ccc;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
    }
    h3 { color: #ddd; margin: 8px 0; }
    p  { margin: 4px 0; }
    button {
        background: #333;
        color: #ccc;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 3px 10px;
        cursor: pointer;
        font-size: 12px;
    }
    button:hover { background: #444; }
    select, input[type="text"] {
        background: #2a2a2a;
        color: #ccc;
        border: 1px solid #555;
        border-radius: 3px;
        padding: 3px 6px;
        font-size: 12px;
    }
    label { color: #aaa; }
    hr { border-color: #444; }
    a { color: #5af; text-decoration: none; }
    /* Dialog wrapper */
    #dialog-wrapper {
        max-width: 940px;
        background: #242424;
        border: 1px solid #555;
        border-radius: 4px;
        overflow: hidden;
    }
    /* Tab nav (jQuery UI replacement) */
    #${PREFIX}-Tabs > ul {
        display: flex;
        flex-wrap: wrap;
        list-style: none;
        margin: 0;
        padding: 0 8px;
        background: #1e1e1e;
        border-bottom: 1px solid #555;
        gap: 2px;
    }
    #${PREFIX}-Tabs > ul li { display: inline-block; }
    #${PREFIX}-Tabs > ul li a {
        display: block;
        padding: 6px 12px;
        color: #aaa;
        border: 1px solid transparent;
        border-radius: 3px 3px 0 0;
        font-size: 12px;
    }
    #${PREFIX}-Tabs > ul li a:hover { color: #ddd; background: #2a2a2a; }
    #${PREFIX}-Tabs > ul li.active a {
        color: #fff;
        background: #242424;
        border-color: #555 #555 #242424;
    }
    /* Panels — hide all by default; JS shows the active one */
    #${PREFIX}-Teams-Panel,
    #${PREFIX}-Inventory-Panel,
    #${PREFIX}-Keys-Panel,
    #${PREFIX}-Other-Panel,
    #${PREFIX}-Export-Panel,
    #${PREFIX}-Settings-Panel,
    #${PREFIX}-Sheets-Panel { display: none; padding: 12px 16px; }
    /* Table base */
    table { border-collapse: collapse; width: 100%; }
    th, td { padding: 4px 8px; }
    th { background: #2a2a2a; color: #aaa; border-bottom: 1px solid #444; font-size: 12px; }
    td { border-bottom: 1px solid #333; font-size: 12px; }
    /* Icon placeholder for missing images */
    .icon { background-color: #2e2e2e; border: 1px solid #444; border-radius: 3px; }
`

describe('Plugin UI Screenshots', () => {
    let helper: DialogHelper

    beforeAll(() => {
        // Inject base styles
        const styleElement = document.createElement('style')
        styleElement.textContent = BASE_STYLES
        document.head.appendChild(styleElement)

        // Render main dialog template
        const html = mainTpl({plugin: `window.plugin.${PREFIX}`, prefix: PREFIX})
        const wrapper = document.createElement('div')
        wrapper.id = 'dialog-wrapper'
        wrapper.innerHTML = html
        document.body.appendChild(wrapper)

        // Wire up DialogHelper with real DOM
        helper = new DialogHelper(PREFIX, 'Team Inventory', new InventoryHelper())
        ;(helper as unknown as {itemsImageTpl: Handlebars.TemplateDelegate}).itemsImageTpl = itemsImageTpl
        ;(helper as unknown as {itemsLabelTpl: Handlebars.TemplateDelegate}).itemsLabelTpl = itemsLabelTpl
        ;(helper as unknown as {keysTpl: Handlebars.TemplateDelegate}).keysTpl = keysTpl
        ;(helper as unknown as {agentsTpl: Handlebars.TemplateDelegate}).agentsTpl = agentsTpl

        // Populate with sample data
        helper.updateTeamSelector(SAMPLE_TEAMS, SAMPLE_TEAM.id)
        helper.updateInventoryPanels(SAMPLE_AGENTS)
    })

    it('captures the team bar and Teams panel (empty agents)', async () => {
        helper.updateAgentsList(SAMPLE_TEAMS.find(t => t.id === 'team-beta'))
        showOnlyPanel('Teams')
        await page.screenshot({path: '../screenshots/01-teams-empty.png'})
    })

    it('captures the agents list', async () => {
        helper.updateAgentsList(SAMPLE_TEAM)
        showOnlyPanel('Teams')
        await page.screenshot({path: '../screenshots/02-agents-list.png'})
    })

    it('captures the Equipment panel', async () => {
        showOnlyPanel('Inventory')
        await page.screenshot({path: '../screenshots/03-equipment.png'})
    })

    it('captures the Keys panel', async () => {
        showOnlyPanel('Keys')
        helper.enableTableSorting(`${PREFIX}-keysTable`)
        helper.enableKeysSearch(`${PREFIX}-keysTable`, `${PREFIX}-keys-search`)
        await page.screenshot({path: '../screenshots/04-keys.png'})
    })

    it('captures the Other panel (cubes & boosts)', async () => {
        showOnlyPanel('Other')
        await page.screenshot({path: '../screenshots/05-other.png'})
    })

    it('captures the Sheets panel', async () => {
        showOnlyPanel('Sheets')
        await page.screenshot({path: '../screenshots/06-sheets.png'})
    })
})
