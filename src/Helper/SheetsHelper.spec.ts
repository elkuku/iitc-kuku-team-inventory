import {describe, it, expect, beforeEach, vi} from 'vitest'
import {SheetsHelper} from './SheetsHelper'
import type {AgentInventory, Team} from '../../types/Types'

const CLIENT_ID_KEY = 'plugin-kuku-team-inventory-sheets-client-id'
const SPREADSHEET_ID_KEY = 'plugin-kuku-team-inventory-sheets-spreadsheet-id'

describe('SheetsHelper (config / localStorage)', () => {
    let store: Record<string, string>
    let helper: SheetsHelper

    beforeEach(() => {
        store = {}
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store[key] ?? undefined,
            setItem: (key: string, value: string) => { store[key] = value },
            removeItem: (key: string) => {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete store[key]
            },
        })
        helper = new SheetsHelper()
    })

    describe('loadConfig', () => {
        it('returns undefined when both keys are missing', () => {
            expect(helper.loadConfig()).toBeUndefined()
        })

        it('returns undefined when only clientId is set', () => {
            store[CLIENT_ID_KEY] = 'cid'
            expect(helper.loadConfig()).toBeUndefined()
        })

        it('returns undefined when only spreadsheetId is set', () => {
            store[SPREADSHEET_ID_KEY] = 'sid'
            expect(helper.loadConfig()).toBeUndefined()
        })

        it('returns the config when both keys are present', () => {
            store[CLIENT_ID_KEY] = 'my-client-id'
            store[SPREADSHEET_ID_KEY] = 'my-sheet-id'
            expect(helper.loadConfig()).toEqual({clientId: 'my-client-id', spreadsheetId: 'my-sheet-id'})
        })
    })

    describe('saveConfig', () => {
        it('persists clientId and spreadsheetId to localStorage', () => {
            helper.saveConfig({clientId: 'cid', spreadsheetId: 'sid'})
            expect(store[CLIENT_ID_KEY]).toBe('cid')
            expect(store[SPREADSHEET_ID_KEY]).toBe('sid')
        })

        it('allows loadConfig to return the saved values', () => {
            helper.saveConfig({clientId: 'cid', spreadsheetId: 'sid'})
            expect(helper.loadConfig()).toEqual({clientId: 'cid', spreadsheetId: 'sid'})
        })

        it('overwrites previously saved config', () => {
            helper.saveConfig({clientId: 'old-cid', spreadsheetId: 'old-sid'})
            helper.saveConfig({clientId: 'new-cid', spreadsheetId: 'new-sid'})
            expect(helper.loadConfig()).toEqual({clientId: 'new-cid', spreadsheetId: 'new-sid'})
        })
    })

    describe('clearConfig', () => {
        it('removes both keys so loadConfig returns undefined', () => {
            helper.saveConfig({clientId: 'cid', spreadsheetId: 'sid'})
            helper.clearConfig()
            expect(helper.loadConfig()).toBeUndefined()
        })

        it('is safe to call when nothing is stored', () => {
            expect(() => helper.clearConfig()).not.toThrow()
        })
    })

    describe('pushToSheets / pullFromSheets without config', () => {
        it('pushToSheets sets an error status when no config', () => {
            const element = {textContent: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(element)})
            helper.pushToSheets([], 'status-el')
            expect(element.textContent).toContain('Error')
        })

        it('pullFromSheets sets an error status when no config', () => {
            const element = {textContent: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(element)})
            helper.pullFromSheets('status-el', vi.fn())
            expect(element.textContent).toContain('Error')
        })
    })
})

// Typed interface exposing the private pure-logic methods under test
interface SheetsHelperTestable {
    sanitizeSheetName(name: string): string
    buildTeamsValues(teams: Team[]): string[][]
    buildWeaponsValues(agents: AgentInventory[]): string[][]
    buildKeysValues(agents: AgentInventory[]): string[][]
    buildOtherValues(agents: AgentInventory[]): string[][]
    reconstructTeam(
        name: string,
        id: string,
        weaponsData: string[][],
        keysData: string[][],
        otherData: string[][],
    ): Team
}

const makeAgent = (name: string, overrides: Partial<AgentInventory> = {}): AgentInventory => ({
    name,
    importedAt: '2024-01-01T00:00:00.000Z',
    keys: [],
    resonators: {},
    weapons: {},
    mods: {},
    cubes: {},
    boosts: {},
    ...overrides,
})

describe('SheetsHelper (data transformation)', () => {
    const h = new SheetsHelper() as unknown as SheetsHelperTestable

    describe('sanitizeSheetName', () => {
        it('replaces forbidden characters with dashes', () => {
            expect(h.sanitizeSheetName('A/B\\C?D*E[F]G:H')).toBe('A-B-C-D-E-F-G-H')
        })

        it('truncates names longer than 100 characters', () => {
            expect(h.sanitizeSheetName('x'.repeat(150))).toHaveLength(100)
        })

        it('leaves clean names unchanged', () => {
            expect(h.sanitizeSheetName('Team Alpha - Weapons')).toBe('Team Alpha - Weapons')
        })
    })

    describe('buildTeamsValues', () => {
        it('returns a header row followed by team rows', () => {
            const teams: Team[] = [
                {id: 'id1', name: 'Alpha', agents: []},
                {id: 'id2', name: 'Beta', agents: []},
            ]
            const result = h.buildTeamsValues(teams)
            expect(result[0]).toEqual(['Team', 'ID'])
            expect(result[1]).toEqual(['Alpha', 'id1'])
            expect(result[2]).toEqual(['Beta', 'id2'])
        })

        it('returns only the header for an empty teams array', () => {
            expect(h.buildTeamsValues([])).toEqual([['Team', 'ID']])
        })
    })

    describe('buildWeaponsValues', () => {
        it('builds _importedAt, header, and sorted item rows', () => {
            const agents = [
                makeAgent('A1', {weapons: {XMP8: 5, XMP7: 3}}),
                makeAgent('A2', {weapons: {XMP8: 2}}),
            ]
            const result = h.buildWeaponsValues(agents)
            expect(result[0][0]).toBe('_importedAt')
            expect(result[0].slice(1)).toEqual(['2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'])
            expect(result[1]).toEqual(['Item', 'A1', 'A2'])
            const items = result.slice(2).map(r => r[0])
            expect(items).toEqual([...items].toSorted())
        })

        it('fills 0 for agents missing an item', () => {
            const agents = [makeAgent('A1', {weapons: {XMP8: 5}}), makeAgent('A2', {})]
            const result = h.buildWeaponsValues(agents)
            const xmp8Row = result.find(r => r[0] === 'XMP8')!
            expect(xmp8Row[1]).toBe('5')
            expect(xmp8Row[2]).toBe('0')
        })
    })

    describe('buildKeysValues', () => {
        it('builds _importedAt, header, and portal rows sorted by title', () => {
            const agents = [
                makeAgent('A1', {keys: [
                    {guid: 'g2', title: 'Zeta Portal', lat: 3, lng: 4, total: 1},
                    {guid: 'g1', title: 'Alpha Portal', lat: 1, lng: 2, total: 3},
                ]}),
            ]
            const result = h.buildKeysValues(agents)
            expect(result[0][0]).toBe('_importedAt')
            expect(result[1]).toEqual(['Portal', 'GUID', 'Lat', 'Lng', 'A1'])
            expect(result[2][0]).toBe('Alpha Portal')
            expect(result[3][0]).toBe('Zeta Portal')
        })

        it('fills 0 for agents without a given portal key', () => {
            const agents = [
                makeAgent('A1', {keys: [{guid: 'g1', title: 'P', lat: 1, lng: 2, total: 3}]}),
                makeAgent('A2', {}),
            ]
            const result = h.buildKeysValues(agents)
            expect(result[2][4]).toBe('3')
            expect(result[2][5]).toBe('0')
        })
    })

    describe('buildOtherValues', () => {
        it('prefixes resonators, mods, cubes, and boosts correctly', () => {
            const agents = [makeAgent('A1', {
                resonators: {L8: 10},
                mods: {'HS-Rare': 2},
                cubes: {XFC: 1},
                boosts: {Apex: 1},
            })]
            const result = h.buildOtherValues(agents)
            const items = result.slice(2).map(r => r[0])
            expect(items).toContain('Resonator L8')
            expect(items).toContain('Mod: HS-Rare')
            expect(items).toContain('Cube: XFC')
            expect(items).toContain('Boost: Apex')
        })

        it('returns sorted item rows', () => {
            const agents = [makeAgent('A1', {resonators: {L8: 1, L1: 2}})]
            const result = h.buildOtherValues(agents)
            const items = result.slice(2).map(r => r[0])
            expect(items).toEqual([...items].toSorted())
        })
    })

    describe('reconstructTeam', () => {
        const weaponsData = [
            ['_importedAt', '2024-01-01T00:00:00.000Z'],
            ['Item', 'A1'],
            ['XMP8', '5'],
            ['XMP7', '3'],
        ]
        const keysData = [
            ['_importedAt', ''],
            ['Portal', 'GUID', 'Lat', 'Lng', 'A1'],
            ['Alpha', 'g1', '1.5', '2.5', '3'],
        ]
        const otherData = [
            ['_importedAt', ''],
            ['Item', 'A1'],
            ['Resonator L8', '10'],
            ['Mod: HS-Rare', '2'],
            ['Cube: XFC', '1'],
            ['Boost: Apex', '1'],
        ]

        it('reconstructs team name and id', () => {
            const team = h.reconstructTeam('TeamA', 'id1', weaponsData, keysData, otherData)
            expect(team.name).toBe('TeamA')
            expect(team.id).toBe('id1')
        })

        it('reconstructs agent weapons from weapons sheet', () => {
            const team = h.reconstructTeam('T', 'id', weaponsData, keysData, otherData)
            expect(team.agents[0].weapons.XMP8).toBe(5)
            expect(team.agents[0].weapons.XMP7).toBe(3)
        })

        it('reconstructs agent keys from keys sheet', () => {
            const team = h.reconstructTeam('T', 'id', weaponsData, keysData, otherData)
            const key = team.agents[0].keys[0]
            expect(key.guid).toBe('g1')
            expect(key.title).toBe('Alpha')
            expect(key.lat).toBe(1.5)
            expect(key.lng).toBe(2.5)
            expect(key.total).toBe(3)
        })

        it('reconstructs resonators, mods, cubes, and boosts from other sheet', () => {
            const team = h.reconstructTeam('T', 'id', weaponsData, keysData, otherData)
            const agent = team.agents[0]
            expect(agent.resonators.L8).toBe(10)
            expect(agent.mods['HS-Rare']).toBe(2)
            expect(agent.cubes.XFC).toBe(1)
            expect(agent.boosts.Apex).toBe(1)
        })

        it('omits items with count 0', () => {
            const w = [['_importedAt', ''], ['Item', 'A1'], ['XMP8', '0']]
            const team = h.reconstructTeam('T', 'id', w, [['_importedAt'], ['Portal', 'GUID', 'Lat', 'Lng']], [['_importedAt'], ['Item', 'A1']])
            expect(team.agents[0].weapons.XMP8).toBeUndefined()
        })

        it('handles empty sheet data gracefully', () => {
            const team = h.reconstructTeam('T', 'id', [], [], [])
            expect(team.agents).toEqual([])
        })
    })
})
