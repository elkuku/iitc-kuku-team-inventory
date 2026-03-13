import {describe, it, expect, vi, afterEach, beforeEach} from 'vitest'

vi.mock('../tpl/dialog.hbs', () => ({default: ''}))
vi.mock('../tpl/_items-image.hbs', () => ({default: ''}))
vi.mock('../tpl/_items-label.hbs', () => ({default: ''}))
vi.mock('../tpl/_keys-table.hbs', () => ({default: ''}))
vi.mock('../tpl/_agents-list.hbs', () => ({default: ''}))

import {DialogHelper} from './Dialog'
import {InventoryHelper} from './InventoryHelper'
import type {AgentInventory, ItemWithBreakdown, Team} from '../../types/Types'

interface DialogHelperTestable {
    sortByNumericSuffix<V>(map: Map<string, V>): Map<string, V>
    sortByCompoundKey<V>(map: Map<string, V>, typeOrder: string[], rarityOrder: string[]): Map<string, V>
}

const parseDistance = (str: string): number =>
    (DialogHelper as unknown as {parseDistance(str: string): number}).parseDistance(str)

const makeHelper = (): DialogHelper =>
    new DialogHelper('KuKuTeamInventory', 'Team Inventory', new InventoryHelper())

const makeAgent = (name: string): AgentInventory => ({
    name,
    importedAt: '2024-01-01T00:00:00.000Z',
    keys: [],
    resonators: {},
    weapons: {},
    mods: {},
    cubes: {},
    boosts: {},
})

const makeItem = (total: number): ItemWithBreakdown => ({total, agents: new Map()})

const makeTableRows = (cellTexts: string[][]): {cells: {textContent: string}[]}[] =>
    cellTexts.map(cells => ({cells: cells.map(text => ({textContent: text}))}))

// DOM element mock covering all usages: getContainer / setCount /
// enableTableSorting / enableKeysSearch all work without errors.
const makeElement = (): Record<string, unknown> => ({
    innerHTML: '',
    textContent: '',
    dataset: {} as Record<string, string>,
    querySelectorAll: vi.fn().mockReturnValue([]),
    addEventListener: vi.fn(),
    value: '',
    tBodies: [{rows: []}],
})

describe('DialogHelper', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('parseDistance (static)', () => {
        it('converts km to metres', () => {
            expect(parseDistance('1.5 km')).toBe(1500)
        })

        it('returns metres as-is', () => {
            expect(parseDistance('500 m')).toBe(500)
        })

        it('handles whole km values', () => {
            expect(parseDistance('10 km')).toBe(10_000)
        })

        it('returns 0 for empty or unrecognised input', () => {
            expect(parseDistance('')).toBe(0)
            expect(parseDistance('not a distance')).toBe(0)
        })
    })

    describe('sortByNumericSuffix', () => {
        it('sorts entries by trailing number ascending', () => {
            const h = makeHelper() as unknown as DialogHelperTestable
            const input = new Map<string, number>([['XMP8', 1], ['XMP1', 2], ['XMP3', 3]])
            const result = h.sortByNumericSuffix(input)
            expect([...result.keys()]).toEqual(['XMP1', 'XMP3', 'XMP8'])
        })

        it('treats entries without a trailing number as 0', () => {
            const h = makeHelper() as unknown as DialogHelperTestable
            const input = new Map<string, number>([['XMP3', 1], ['NoNum', 2]])
            const result = h.sortByNumericSuffix(input)
            expect([...result.keys()][0]).toBe('NoNum')
        })

        it('preserves values', () => {
            const h = makeHelper() as unknown as DialogHelperTestable
            const input = new Map([['R8', makeItem(10)], ['R1', makeItem(5)]])
            const result = h.sortByNumericSuffix(input)
            expect([...result.values()].map(v => v.total)).toEqual([5, 10])
        })
    })

    describe('sortByCompoundKey', () => {
        it('sorts by type order first', () => {
            const h = makeHelper() as unknown as DialogHelperTestable
            const input = new Map<string, number>([
                ['MULTIHACK-RARE', 1],
                ['HEATSINK-RARE', 2],
            ])
            const result = h.sortByCompoundKey(input, ['HEATSINK', 'MULTIHACK'], ['COMMON', 'RARE', 'VERY_RARE'])
            expect([...result.keys()]).toEqual(['HEATSINK-RARE', 'MULTIHACK-RARE'])
        })

        it('sorts by rarity order when type is the same', () => {
            const h = makeHelper() as unknown as DialogHelperTestable
            const input = new Map<string, number>([
                ['RES_SHIELD-VERY_RARE', 1],
                ['RES_SHIELD-COMMON', 2],
                ['RES_SHIELD-RARE', 3],
            ])
            const result = h.sortByCompoundKey(input, ['RES_SHIELD'], ['COMMON', 'RARE', 'VERY_RARE'])
            expect([...result.keys()]).toEqual(['RES_SHIELD-COMMON', 'RES_SHIELD-RARE', 'RES_SHIELD-VERY_RARE'])
        })
    })

    describe('updateTeamSelector', () => {
        it('returns early when select element is not found', () => {
            vi.stubGlobal('document', {getElementById: vi.fn()})
            expect(() => makeHelper().updateTeamSelector([], 'any')).not.toThrow()
        })

        it('populates options for each team', () => {
            const options: unknown[] = [{selected: false}]
            const mockSelect = {
                options,
                get length(): number { return options.length },
                remove: vi.fn((index: number) => options.splice(index, 1)),
                add: vi.fn((opt: unknown) => options.push(opt)),
            }
            vi.stubGlobal('document', {
                getElementById: vi.fn().mockReturnValue(mockSelect),
                createElement: vi.fn().mockReturnValue({value: '', text: '', selected: false}),
            })
            const teams: Team[] = [
                {id: 't1', name: 'Alpha', agents: []},
                {id: 't2', name: 'Beta', agents: []},
            ]
            makeHelper().updateTeamSelector(teams, 't1')
            expect(mockSelect.add).toHaveBeenCalledTimes(2)
        })

        it('marks the matching team option as selected', () => {
            const createdOptions: {value: string; selected: boolean}[] = []
            const mockSelect = {
                options: [{selected: false}],
                get length() { return this.options.length },
                remove: vi.fn(),
                add: vi.fn((opt: {value: string; selected: boolean}) => createdOptions.push(opt)),
            }
            vi.stubGlobal('document', {
                getElementById: vi.fn().mockReturnValue(mockSelect),
                createElement: vi.fn().mockImplementation(() => ({value: '', text: '', selected: false})),
            })
            makeHelper().updateTeamSelector([{id: 'tid', name: 'T', agents: []}], 'tid')
            expect(createdOptions[0].selected).toBe(true)
        })
    })

    describe('updateAgentsList', () => {
        it('returns early when container is not found', () => {
            vi.stubGlobal('document', {getElementById: vi.fn()})
            // eslint-disable-next-line unicorn/no-useless-undefined
            expect(() => makeHelper().updateAgentsList(undefined)).not.toThrow()
        })

        it('sets "select a team" message when no team is provided', () => {
            const container = {innerHTML: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(container)})
            // eslint-disable-next-line unicorn/no-useless-undefined
            makeHelper().updateAgentsList(undefined)
            expect(container.innerHTML).toContain('Select a team')
        })

        it('sets "no agents" message when team has no agents', () => {
            const container = {innerHTML: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(container)})
            makeHelper().updateAgentsList({id: 't1', name: 'T', agents: []})
            expect(container.innerHTML).toContain('No agents')
        })

        it('renders agents via agentsTpl when team has agents', () => {
            const helper = makeHelper()
            const agentsTplSpy = vi.fn().mockReturnValue('<ul>rendered-agents</ul>')
            ;(helper as unknown as {agentsTpl: unknown}).agentsTpl = agentsTplSpy
            const container = {innerHTML: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(container)})
            const agentWithKeys: AgentInventory = {
                ...makeAgent('A1'),
                keys: [{guid: 'g1', title: 'Portal', lat: 1, lng: 2, total: 5}],
            }
            helper.updateAgentsList({id: 't1', name: 'T', agents: [agentWithKeys]})
            expect(agentsTplSpy).toHaveBeenCalledOnce()
            expect(container.innerHTML).toBe('<ul>rendered-agents</ul>')
        })
    })

    describe('sortTable', () => {
        it('sorts rows by string column ascending', () => {
            const rows = makeTableRows([['banana'], ['apple'], ['cherry']])
            const appended: typeof rows = []
            const table = {tBodies: [{rows, appendChild: (r: typeof rows[0]) => appended.push(r)}]}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(table)})
            makeHelper().sortTable('t', 0, 'string', true)
            expect(appended.map(r => r.cells[0].textContent)).toEqual(['apple', 'banana', 'cherry'])
        })

        it('sorts rows by string column descending', () => {
            const rows = makeTableRows([['banana'], ['apple'], ['cherry']])
            const appended: typeof rows = []
            const table = {tBodies: [{rows, appendChild: (r: typeof rows[0]) => appended.push(r)}]}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(table)})
            makeHelper().sortTable('t', 0, 'string', false)
            expect(appended.map(r => r.cells[0].textContent)).toEqual(['cherry', 'banana', 'apple'])
        })

        it('sorts rows by number column ascending', () => {
            const rows = makeTableRows([['30'], ['5'], ['100']])
            const appended: typeof rows = []
            const table = {tBodies: [{rows, appendChild: (r: typeof rows[0]) => appended.push(r)}]}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(table)})
            makeHelper().sortTable('t', 0, 'number', true)
            expect(appended.map(r => r.cells[0].textContent)).toEqual(['5', '30', '100'])
        })

        it('sorts rows by distance column (km/m mixed)', () => {
            const rows = makeTableRows([['2 km'], ['500 m'], ['1.5 km']])
            const appended: typeof rows = []
            const table = {tBodies: [{rows, appendChild: (r: typeof rows[0]) => appended.push(r)}]}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(table)})
            makeHelper().sortTable('t', 0, 'distance', true)
            expect(appended.map(r => r.cells[0].textContent)).toEqual(['500 m', '1.5 km', '2 km'])
        })

    })

    describe('enableKeysSearch', () => {
        it('returns early when input is not found', () => {
            vi.stubGlobal('document', {getElementById: vi.fn()})
            expect(() => makeHelper().enableKeysSearch('tableId', 'inputId')).not.toThrow()
        })

        it('returns early when input is already search-enabled', () => {
            const addEventListenerSpy = vi.fn()
            const mockInput = {dataset: {searchEnabled: 'true'}, addEventListener: addEventListenerSpy}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(mockInput)})
            makeHelper().enableKeysSearch('tableId', 'inputId')
            expect(addEventListenerSpy).not.toHaveBeenCalled()
        })

        it('attaches an input listener on first call', () => {
            const addEventListenerSpy = vi.fn()
            const mockInput = {dataset: {} as Record<string, string>, addEventListener: addEventListenerSpy}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(mockInput)})
            makeHelper().enableKeysSearch('tableId', 'inputId')
            expect(addEventListenerSpy).toHaveBeenCalledWith('input', expect.any(Function))
            expect(mockInput.dataset.searchEnabled).toBe('true')
        })

        it('hides rows not matching the query and shows matching ones', () => {
            let inputHandler: (() => void) | undefined
            const mockInput = {
                dataset: {} as Record<string, string>,
                value: 'alpha',
                addEventListener: vi.fn((_event: string, handler: () => void) => { inputHandler = handler }),
            }
            const rows = [
                {cells: [{textContent: 'Portal Alpha'}], style: {display: ''}},
                {cells: [{textContent: 'Portal Beta'}], style: {display: ''}},
            ]
            const mockTable = {tBodies: [{rows}]}
            vi.stubGlobal('document', {
                getElementById: vi.fn((id: string) =>
                    id === 'inputId' ? mockInput : mockTable
                ),
            })
            makeHelper().enableKeysSearch('tableId', 'inputId')
            inputHandler?.()
            expect(rows[0].style.display).toBe('')
            expect(rows[1].style.display).toBe('none')
        })

        it('shows all rows when the query is cleared', () => {
            let inputHandler: (() => void) | undefined
            const mockInput = {
                dataset: {} as Record<string, string>,
                value: '',
                addEventListener: vi.fn((_event: string, handler: () => void) => { inputHandler = handler }),
            }
            const rows = [
                {cells: [{textContent: 'Portal Alpha'}], style: {display: 'none'}},
                {cells: [{textContent: 'Portal Beta'}], style: {display: 'none'}},
            ]
            const mockTable = {tBodies: [{rows}]}
            vi.stubGlobal('document', {
                getElementById: vi.fn((id: string) =>
                    id === 'inputId' ? mockInput : mockTable
                ),
            })
            makeHelper().enableKeysSearch('tableId', 'inputId')
            inputHandler?.()
            expect(rows[0].style.display).toBe('')
            expect(rows[1].style.display).toBe('')
        })
    })

    describe('enableTableSorting', () => {
        it('returns early when table is not found', () => {
            vi.stubGlobal('document', {getElementById: vi.fn()})
            expect(() => makeHelper().enableTableSorting('tableId')).not.toThrow()
        })

        it('returns early when already sort-enabled', () => {
            const mockTable = {dataset: {sortEnabled: 'true'}, querySelectorAll: vi.fn()}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(mockTable)})
            makeHelper().enableTableSorting('tableId')
            expect(mockTable.querySelectorAll).not.toHaveBeenCalled()
        })

        it('marks the table as sort-enabled and queries headers', () => {
            const mockTable = {dataset: {} as Record<string, string>, querySelectorAll: vi.fn().mockReturnValue([])}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(mockTable)})
            makeHelper().enableTableSorting('tableId')
            expect(mockTable.dataset.sortEnabled).toBe('true')
            expect(mockTable.querySelectorAll).toHaveBeenCalledWith('th')
        })

        it('skips headers without data-type and wires click on headers with data-type', () => {
            const clickListeners: (() => void)[] = []
            const indicator = {style: {marginLeft: ''}, textContent: ''}
            const headers = [
                {
                    dataset: {type: 'string'},
                    appendChild: vi.fn(),
                    addEventListener: vi.fn((_event: string, handler: () => void) => clickListeners.push(handler)),
                    querySelector: vi.fn(),
                },
                {
                    dataset: {},
                    appendChild: vi.fn(),
                    addEventListener: vi.fn(),
                    querySelector: vi.fn(),
                },
            ]
            const rows = makeTableRows([['b'], ['a']])
            const appended: typeof rows = []
            const mockTable = {
                dataset: {} as Record<string, string>,
                querySelectorAll: vi.fn().mockReturnValue(headers),
                tBodies: [{rows, appendChild: (r: typeof rows[0]) => appended.push(r)}],
            }
            vi.stubGlobal('document', {
                getElementById: vi.fn().mockReturnValue(mockTable),
                createElement: vi.fn().mockReturnValue(indicator),
            })
            makeHelper().enableTableSorting('tableId')
            // Only the header with data-type gets a click listener
            expect(clickListeners).toHaveLength(1)
            // Trigger click — should sort and update indicator
            headers[0].querySelector.mockReturnValue({textContent: ''})
            clickListeners[0]()
            expect(appended).toHaveLength(2)
            expect(indicator.textContent).toBe('▼') // ascending toggled to false → shows ▼
        })
    })

    describe('getDialog', () => {
        it('alerts and throws when HelperHandlebars is not available', () => {
            vi.stubGlobal('alert', vi.fn())
            vi.stubGlobal('window', {plugin: {}})
            expect(() => makeHelper().getDialog()).toThrow('Handlebars helper not found')
            expect(alert).toHaveBeenCalledWith(expect.stringContaining('Handlebars helper not found'))
        })

        it('returns the dialog parent when HelperHandlebars is available', () => {
            const mockHandlebars = {
                registerHelper: vi.fn(),
                compile: vi.fn().mockReturnValue(() => ''),
            }
            const mockParent = {id: 'dialog-parent'}
            const mockDialogResult = {parent: vi.fn().mockReturnValue(mockParent)}
            vi.stubGlobal('window', {
                plugin: {HelperHandlebars: mockHandlebars},
                dialog: vi.fn().mockReturnValue(mockDialogResult),
            })
            const result = makeHelper().getDialog()
            expect(result).toBe(mockParent)
            expect(mockHandlebars.registerHelper).toHaveBeenCalledOnce()
            expect(mockHandlebars.compile).toHaveBeenCalledTimes(5)
        })
    })

    describe('registered Handlebars helpers', () => {
        interface RegisteredHelpers {
            eachInMap(map: unknown, block: {fn: (context: unknown) => string}): string
            translateKey(key: string): string
            distanceToCenter(lat: number, lng: number): string
        }

        const getHelpers = (): RegisteredHelpers => {
            let captured: RegisteredHelpers | undefined
            const mockHandlebars = {
                registerHelper: vi.fn((helpers: RegisteredHelpers) => { captured = helpers }),
                compile: vi.fn().mockReturnValue(() => ''),
            }
            vi.stubGlobal('window', {
                plugin: {HelperHandlebars: mockHandlebars},
                dialog: vi.fn().mockReturnValue({parent: vi.fn()}),
            })
            makeHelper().getDialog()
            return captured!
        }

        it('eachInMap iterates a Map and concatenates block output', () => {
            const helpers = getHelpers()
            const map = new Map([['k1', 'v1'], ['k2', 'v2']])
            const block = {fn: (context: unknown) => { const {key, value} = context as {key: string; value: string}; return `${key}=${value};` }}
            expect(helpers.eachInMap(map, block)).toBe('k1=v1;k2=v2;')
        })

        it('eachInMap returns empty string for a non-Map', () => {
            const helpers = getHelpers()
            const block = {fn: () => 'x'}
            expect(helpers.eachInMap({}, block)).toBe('')
        })

        it('translateKey delegates to the key-translations module', () => {
            const helpers = getHelpers()
            // translateKey('EMP_BURSTER_8') should return a translated label, not the raw key
            const result = helpers.translateKey('EMP_BURSTER_8')
            expect(typeof result).toBe('string')
            expect(result).not.toBe('')
        })

        it('distanceToCenter returns metres for distances under 1000 m', () => {
            const helpers = getHelpers()
            vi.stubGlobal('window', {
                map: {getCenter: vi.fn().mockReturnValue({lat: 0, lng: 0})},
            })
            vi.stubGlobal('L', {
                latLng: vi.fn().mockReturnValue({distanceTo: vi.fn().mockReturnValue(500)}),
            })
            expect(helpers.distanceToCenter(0, 0)).toBe('500 m')
        })

        it('distanceToCenter returns decimal km for 1000–9999 m', () => {
            const helpers = getHelpers()
            vi.stubGlobal('window', {
                map: {getCenter: vi.fn().mockReturnValue({lat: 0, lng: 0})},
            })
            vi.stubGlobal('L', {
                latLng: vi.fn().mockReturnValue({distanceTo: vi.fn().mockReturnValue(2500)}),
            })
            expect(helpers.distanceToCenter(0, 0)).toBe('2.5 km')
        })

        it('distanceToCenter returns rounded km for distances >= 10000 m', () => {
            const helpers = getHelpers()
            vi.stubGlobal('window', {
                map: {getCenter: vi.fn().mockReturnValue({lat: 0, lng: 0})},
            })
            vi.stubGlobal('L', {
                latLng: vi.fn().mockReturnValue({distanceTo: vi.fn().mockReturnValue(15_000)}),
            })
            expect(helpers.distanceToCenter(0, 0)).toBe('15 km')
        })
    })

    describe('updateAll', () => {
        it('delegates to updateTeamSelector, updateAgentsList, and updateInventoryPanels', () => {
            const helper = makeHelper()
            // stub document so all three methods exit early without throwing
            vi.stubGlobal('document', {getElementById: vi.fn()})
            const selectSpy = vi.spyOn(helper, 'updateTeamSelector')
            const agentsSpy = vi.spyOn(helper, 'updateAgentsList')
            const panelsSpy = vi.spyOn(helper, 'updateInventoryPanels')
            helper.updateAll([], undefined, [])
            expect(selectSpy).toHaveBeenCalledOnce()
            expect(agentsSpy).toHaveBeenCalledOnce()
            expect(panelsSpy).toHaveBeenCalledOnce()
        })

        it('passes the found team and focusedAgent to updateAgentsList', () => {
            const helper = makeHelper()
            vi.stubGlobal('document', {getElementById: vi.fn()})
            const agentsSpy = vi.spyOn(helper, 'updateAgentsList')
            const teams: Team[] = [{id: 'tid', name: 'Alpha', agents: []}]
            helper.updateAll(teams, 'tid', [], 'focused-agent')
            expect(agentsSpy).toHaveBeenCalledWith(teams[0], 'focused-agent')
        })
    })

    describe('updateInventoryPanels', () => {

        beforeEach(() => {
            vi.stubGlobal('document', {getElementById: vi.fn().mockImplementation(makeElement)})
        })

        it('returns early without rendering when templates are not initialised', () => {
            makeHelper().updateInventoryPanels([])
            expect(document.getElementById).not.toHaveBeenCalled()
        })

        it('renders all inventory sections for a full agent inventory', () => {
            const helper = makeHelper()
            const internal = helper as unknown as {
                itemsImageTpl: (...args: unknown[]) => string
                itemsLabelTpl: (...args: unknown[]) => string
                keysTpl: (...args: unknown[]) => string
            }
            internal.itemsImageTpl = () => ''
            internal.itemsLabelTpl = () => ''
            internal.keysTpl = () => ''

            const agents: AgentInventory[] = [{
                name: 'A1',
                importedAt: '2024-01-01T00:00:00.000Z',
                keys: [{guid: 'g1', title: 'Portal', lat: 1, lng: 2, total: 3}],
                weapons: {EMP_BURSTER_8: 10, ULTRA_STRIKE_8: 5, 'ADA-0': 1, UNKNOWN_WEAPON: 2},
                resonators: {L8: 20},
                mods: {RES_SHIELD_RARE: 3, HEATSINK_RARE: 2, EXTRA_SHIELD_RARE: 1, LINK_AMP_RARE: 4},
                cubes: {XFC: 6},
                boosts: {APEX: 1, SOME_BEACON: 2},
            }]

            expect(() => helper.updateInventoryPanels(agents)).not.toThrow()
            expect(document.getElementById).toHaveBeenCalled()
        })
    })
})
