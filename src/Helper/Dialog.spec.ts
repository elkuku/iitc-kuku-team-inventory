import {describe, it, expect, vi, afterEach} from 'vitest'

vi.mock('../tpl/dialog.hbs', () => ({default: ''}))
vi.mock('../tpl/_items-image.hbs', () => ({default: ''}))
vi.mock('../tpl/_items-label.hbs', () => ({default: ''}))
vi.mock('../tpl/_keys-table.hbs', () => ({default: ''}))
vi.mock('../tpl/_agents-list.hbs', () => ({default: ''}))

import {DialogHelper} from './Dialog'
import {InventoryHelper} from './InventoryHelper'
import type {ItemWithBreakdown, Team} from '../../types/Types'

interface DialogHelperTestable {
    sortByNumericSuffix<V>(map: Map<string, V>): Map<string, V>
    sortByCompoundKey<V>(map: Map<string, V>, typeOrder: string[], rarityOrder: string[]): Map<string, V>
}

const parseDistance = (str: string): number =>
    (DialogHelper as unknown as {parseDistance(str: string): number}).parseDistance(str)

const makeHelper = (): DialogHelper =>
    new DialogHelper('KuKuTeamInventory', 'Team Inventory', new InventoryHelper())

const makeItem = (total: number): ItemWithBreakdown => ({total, agents: new Map()})

const makeTableRows = (cellTexts: string[][]): {cells: {textContent: string}[]}[] =>
    cellTexts.map(cells => ({cells: cells.map(text => ({textContent: text}))}))

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
    })
})
