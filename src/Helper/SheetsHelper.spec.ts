import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
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

// ---------------------------------------------------------------------------
// Auth / network internals
// ---------------------------------------------------------------------------

interface SheetsHelperInternals {
    accessToken: string | undefined
    tokenExpiresAt: number | undefined
    isTokenValid(): boolean
    sheetsRequest(
        method: string,
        url: string,
        body: unknown,
        onSuccess: (data: unknown) => void,
        onError: (error: unknown) => void,
    ): void
    ensureTab(config: {clientId: string; spreadsheetId: string}, tabName: string, onCreated: () => void): void
    writeSheetData(
        config: {clientId: string; spreadsheetId: string},
        sheetName: string,
        values: string[][],
        onDone?: () => void,
    ): void
    writeTeamCategory(
        config: {clientId: string; spreadsheetId: string},
        team: Team,
        category: 'Weapons' | 'Keys' | 'Other',
        onDone: () => void,
    ): void
    writeAllSheets(
        config: {clientId: string; spreadsheetId: string},
        teams: Team[],
        statusElementId: string,
    ): void
    readAllSheets(
        config: {clientId: string; spreadsheetId: string},
        statusElementId: string,
        onSuccess: (teams: unknown[]) => void,
    ): void
    loadGisScript(onReady: () => void): void
    requestToken(onToken: () => void): void
    withToken(onReady: () => void): void
}

describe('SheetsHelper (auth / network internals)', () => {
    let helper: SheetsHelperInternals
    let store: Record<string, string>

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
        helper = new SheetsHelper() as unknown as SheetsHelperInternals
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('isTokenValid', () => {
        it('returns false when accessToken is absent', () => {
            expect(helper.isTokenValid()).toBe(false)
        })

        it('returns false when accessToken is set but tokenExpiresAt is absent', () => {
            helper.accessToken = 'tok'
            expect(helper.isTokenValid()).toBe(false)
        })

        it('returns false when token has expired', () => {
            helper.accessToken = 'tok'
            helper.tokenExpiresAt = Date.now() - 1
            expect(helper.isTokenValid()).toBe(false)
        })

        it('returns false when token expires within the 60 s buffer', () => {
            helper.accessToken = 'tok'
            helper.tokenExpiresAt = Date.now() + 30_000
            expect(helper.isTokenValid()).toBe(false)
        })

        it('returns true when token is valid and outside the buffer', () => {
            helper.accessToken = 'tok'
            helper.tokenExpiresAt = Date.now() + 120_000
            expect(helper.isTokenValid()).toBe(true)
        })
    })

    describe('sheetsRequest', () => {
        it('calls onError immediately when there is no access token', () => {
            const onError = vi.fn()
            helper.sheetsRequest('GET', 'http://example.com', undefined, vi.fn(), onError)
            expect(onError).toHaveBeenCalledWith('No access token')
        })

        it('calls onSuccess with the parsed JSON body on an ok response', async () => {
            helper.accessToken = 'mock-token'
            const responseData = {sheets: []}
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(responseData),
            }))

            const onSuccess = vi.fn()
            helper.sheetsRequest('GET', 'http://example.com', undefined, onSuccess, vi.fn())
            await vi.waitFor(() => { expect(onSuccess).toHaveBeenCalledWith(responseData) })
        })

        it('calls onError with the response text on a non-ok response', async () => {
            helper.accessToken = 'mock-token'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                text: () => Promise.resolve('Bad Request'),
            }))

            const onError = vi.fn()
            helper.sheetsRequest('POST', 'http://example.com', {data: 1}, vi.fn(), onError)
            await vi.waitFor(() => { expect(onError).toHaveBeenCalledWith('Bad Request') })
        })

        it('calls onError when fetch itself throws', async () => {
            helper.accessToken = 'mock-token'
            const networkError = new Error('Network failure')
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(networkError))

            const onError = vi.fn()
            helper.sheetsRequest('GET', 'http://example.com', undefined, vi.fn(), onError)
            await vi.waitFor(() => { expect(onError).toHaveBeenCalledWith(networkError) })
        })

        it('includes the Authorization header with the access token', async () => {
            helper.accessToken = 'secret'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({}),
            }))

            helper.sheetsRequest('GET', 'http://example.com', undefined, vi.fn(), vi.fn())
            await vi.waitFor(() => { expect(vi.mocked(fetch)).toHaveBeenCalled() })
            const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
            expect((options.headers as Record<string, string>).Authorization).toBe('Bearer secret')
        })
    })

    describe('loadGisScript', () => {
        it('calls onReady immediately when the script tag already exists', () => {
            vi.stubGlobal('document', {
                getElementById: vi.fn().mockReturnValue({id: 'gis-client-script'}),
            })
            const onReady = vi.fn()
            helper.loadGisScript(onReady)
            expect(onReady).toHaveBeenCalledOnce()
        })

        it('creates a script tag and appends it to head when not yet loaded', () => {
            const appendChildSpy = vi.fn()
            const addEventListenerSpy = vi.fn()
            const mockScript = {id: '', src: '', addEventListener: addEventListenerSpy}
            vi.stubGlobal('document', {
                getElementById: vi.fn(),
                createElement: vi.fn().mockReturnValue(mockScript),
                head: {appendChild: appendChildSpy},
            })
            const onReady = vi.fn()
            helper.loadGisScript(onReady)
            expect(mockScript.id).toBe('gis-client-script')
            expect(addEventListenerSpy).toHaveBeenCalledWith('load', onReady)
            expect(appendChildSpy).toHaveBeenCalledWith(mockScript)
        })
    })

    describe('withToken', () => {
        it('calls onReady directly when the token is already valid', () => {
            helper.accessToken = 'tok'
            helper.tokenExpiresAt = Date.now() + 120_000
            const onReady = vi.fn()
            helper.withToken(onReady)
            expect(onReady).toHaveBeenCalledOnce()
        })

        it('when token is invalid: calls loadGisScript + requestToken', () => {
            // Token is invalid (not set). GIS script tag already exists so loadGisScript calls onReady immediately.
            store[CLIENT_ID_KEY] = 'cid'
            store[SPREADSHEET_ID_KEY] = 'sid'
            const requestAccessToken = vi.fn()
            vi.stubGlobal('document', {
                getElementById: vi.fn().mockReturnValue({id: 'gis-client-script'}),
            })
            vi.stubGlobal('google', {
                accounts: {
                    oauth2: {
                        initTokenClient: vi.fn().mockReturnValue({requestAccessToken}),
                    },
                },
            })
            helper.withToken(vi.fn())
            expect(requestAccessToken).toHaveBeenCalled()
        })
    })

    describe('requestToken', () => {
        it('returns early when there is no config', () => {
            // No localStorage data → loadConfig returns undefined
            const onToken = vi.fn()
            helper.requestToken(onToken)
            expect(onToken).not.toHaveBeenCalled()
        })

        it('initializes tokenClient and calls requestAccessToken when config exists', () => {
            store[CLIENT_ID_KEY] = 'cid'
            store[SPREADSHEET_ID_KEY] = 'sid'
            const requestAccessToken = vi.fn()
            const initTokenClient = vi.fn().mockReturnValue({requestAccessToken})
            vi.stubGlobal('google', {
                accounts: {
                    oauth2: {initTokenClient},
                },
            })
            helper.requestToken(vi.fn())
            expect(initTokenClient).toHaveBeenCalledWith(expect.objectContaining({client_id: 'cid'}))
            expect(requestAccessToken).toHaveBeenCalledWith({prompt: ''})
        })

        it('calls onToken when callback receives a successful response', () => {
            store[CLIENT_ID_KEY] = 'cid'
            store[SPREADSHEET_ID_KEY] = 'sid'
            const requestAccessToken = vi.fn()
            let capturedCallback: ((response: {access_token?: string; expires_in?: number; error?: string}) => void) | undefined
            const initTokenClient = vi.fn().mockImplementation((options: {callback: typeof capturedCallback}) => {
                capturedCallback = options.callback
                return {requestAccessToken}
            })
            vi.stubGlobal('google', {
                accounts: {
                    oauth2: {initTokenClient},
                },
            })
            const onToken = vi.fn()
            helper.requestToken(onToken)
            capturedCallback?.({access_token: 'tok', expires_in: 3600})
            expect(onToken).toHaveBeenCalledOnce()
            expect(helper.accessToken).toBe('tok')
        })

        it('does NOT call onToken when callback has an error field', () => {
            store[CLIENT_ID_KEY] = 'cid'
            store[SPREADSHEET_ID_KEY] = 'sid'
            const requestAccessToken = vi.fn()
            let capturedCallback: ((response: {access_token?: string; expires_in?: number; error?: string}) => void) | undefined
            const initTokenClient = vi.fn().mockImplementation((options: {callback: typeof capturedCallback}) => {
                capturedCallback = options.callback
                return {requestAccessToken}
            })
            vi.stubGlobal('google', {
                accounts: {
                    oauth2: {initTokenClient},
                },
            })
            const onToken = vi.fn()
            helper.requestToken(onToken)
            capturedCallback?.({error: 'access_denied'})
            expect(onToken).not.toHaveBeenCalled()
        })

        it('reuses existing tokenClient on second call', () => {
            store[CLIENT_ID_KEY] = 'cid'
            store[SPREADSHEET_ID_KEY] = 'sid'
            const requestAccessToken = vi.fn()
            const initTokenClient = vi.fn().mockReturnValue({requestAccessToken})
            vi.stubGlobal('google', {
                accounts: {
                    oauth2: {initTokenClient},
                },
            })
            helper.requestToken(vi.fn())
            helper.requestToken(vi.fn())
            expect(initTokenClient).toHaveBeenCalledTimes(1)
            expect(requestAccessToken).toHaveBeenCalledTimes(2)
        })
    })

    describe('pullFromSheets with valid token', () => {
        it('sets "Reading sheets…" status when token is valid', () => {
            store[CLIENT_ID_KEY] = 'cid'
            store[SPREADSHEET_ID_KEY] = 'sid'
            helper.accessToken = 'tok'
            helper.tokenExpiresAt = Date.now() + 120_000

            const element = {textContent: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(element)})
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({sheets: []}),
            }))

            ;(helper as unknown as SheetsHelper).pullFromSheets('status-el', vi.fn())

            // Check synchronously: withToken called onReady immediately (valid token),
            // so setStatus('Reading sheets…') should have been called before any await.
            expect(element.textContent).toBe('Reading sheets…')
        })
    })

    describe('ensureTab', () => {
        const config = {clientId: 'cid', spreadsheetId: 'sid'}

        it('calls onCreated when the tab is successfully created', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({}),
            }))
            const onCreated = vi.fn()
            helper.ensureTab(config, 'MyTab', onCreated)
            await vi.waitFor(() => { expect(onCreated).toHaveBeenCalledOnce() })
        })

        it('calls onCreated when the tab already exists', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                text: () => Promise.resolve('already exists'),
            }))
            const onCreated = vi.fn()
            helper.ensureTab(config, 'MyTab', onCreated)
            await vi.waitFor(() => { expect(onCreated).toHaveBeenCalledOnce() })
        })

        it('does not call onCreated on an unrelated error', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                text: () => Promise.resolve('Internal Server Error'),
            }))
            const onCreated = vi.fn()
            helper.ensureTab(config, 'MyTab', onCreated)
            await new Promise<void>(resolve => setTimeout(resolve, 20))
            expect(onCreated).not.toHaveBeenCalled()
        })
    })

    describe('writeSheetData', () => {
        const config = {clientId: 'cid', spreadsheetId: 'sid'}

        it('clears then writes and calls onDone on full success', async () => {
            helper.accessToken = 'tok'
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({}),
            })
            vi.stubGlobal('fetch', fetchMock)
            const onDone = vi.fn()
            helper.writeSheetData(config, 'Sheet1', [['A', 'B']], onDone)
            await vi.waitFor(() => { expect(onDone).toHaveBeenCalledOnce() })
            expect(fetchMock).toHaveBeenCalledTimes(2)
        })

        it('calls onDone even when the clear request fails', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                text: () => Promise.resolve('Error'),
            }))
            const onDone = vi.fn()
            helper.writeSheetData(config, 'Sheet1', [], onDone)
            await vi.waitFor(() => { expect(onDone).toHaveBeenCalledOnce() })
        })

        it('calls onDone even when the write request fails', async () => {
            helper.accessToken = 'tok'
            let callCount = 0
            vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
                callCount++
                return Promise.resolve(
                    callCount === 1
                        ? {ok: true, json: () => Promise.resolve({})}
                        : {ok: false, text: () => Promise.resolve('Write error')},
                )
            }))
            const onDone = vi.fn()
            helper.writeSheetData(config, 'Sheet1', [], onDone)
            await vi.waitFor(() => { expect(onDone).toHaveBeenCalledOnce() })
        })
    })

    describe('readAllSheets', () => {
        const config = {clientId: 'cid', spreadsheetId: 'sid'}

        beforeEach(() => {
            const statusElement = {textContent: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(statusElement)})
        })

        it('sets error status when no team sheets are found', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: () => Promise.resolve({sheets: [{properties: {title: 'SomeOtherTab'}}]}),
            }))
            const statusElement = {textContent: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(statusElement)})
            helper.readAllSheets(config, 'status-el', vi.fn())
            await vi.waitFor(() => { expect(statusElement.textContent).toContain('Error') })
        })

        it('calls onSuccess with reconstructed teams on full success', async () => {
            helper.accessToken = 'tok'
            let callCount = 0
            vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            sheets: [{properties: {title: 'Alpha - Weapons'}}],
                        }),
                    })
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        valueRanges: [
                            {values: [['Team', 'ID'], ['Alpha', 'team-alpha-id']]},
                            {values: [['_importedAt', '2024-01-01'], ['Item', 'A1'], ['XMP8', '5']]},
                            {values: [['_importedAt', '', '', ''], ['Portal', 'GUID', 'Lat', 'Lng', 'A1']]},
                            {values: [['_importedAt', ''], ['Item', 'A1']]},
                        ],
                    }),
                })
            }))
            const onSuccess = vi.fn()
            helper.readAllSheets(config, 'status-el', onSuccess)
            await vi.waitFor(() => { expect(onSuccess).toHaveBeenCalledOnce() })
            const teams = onSuccess.mock.calls[0][0] as {name: string; id: string}[]
            expect(teams[0].name).toBe('Alpha')
            expect(teams[0].id).toBe('team-alpha-id')
        })

        it('sets error status when the meta request fails', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: false,
                text: () => Promise.resolve('Forbidden'),
            }))
            const statusElement = {textContent: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(statusElement)})
            helper.readAllSheets(config, 'status-el', vi.fn())
            await vi.waitFor(() => { expect(statusElement.textContent).toContain('Error') })
        })

        it('sets error status when the batch request fails', async () => {
            helper.accessToken = 'tok'
            let callCount = 0
            vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            sheets: [{properties: {title: 'Alpha - Weapons'}}],
                        }),
                    })
                }
                return Promise.resolve({
                    ok: false,
                    text: () => Promise.resolve('Service Unavailable'),
                })
            }))
            const statusElement = {textContent: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(statusElement)})
            helper.readAllSheets(config, 'status-el', vi.fn())
            await vi.waitFor(() => { expect(statusElement.textContent).toContain('Error reading') })
        })

        it('sets error status when the batch response cannot be parsed', async () => {
            helper.accessToken = 'tok'
            let callCount = 0
            vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) {
                    return Promise.resolve({
                        ok: true,
                        json: () => Promise.resolve({
                            sheets: [{properties: {title: 'Alpha - Weapons'}}],
                        }),
                    })
                }
                // Returning undefined causes (undefined as any).valueRanges to throw
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(),
                })
            }))
            const statusElement = {textContent: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(statusElement)})
            helper.readAllSheets(config, 'status-el', vi.fn())
            await vi.waitFor(() => { expect(statusElement.textContent).toContain('Error: failed to parse') })
        })
    })

    describe('writeTeamCategory', () => {
        const config = {clientId: 'cid', spreadsheetId: 'sid'}
        const team: Team = {
            id: 'team-id',
            name: 'Alpha',
            agents: [makeAgent('A1', {weapons: {XMP8: 5}})],
        }

        const successFetch = vi.fn().mockResolvedValue({ok: true, json: () => Promise.resolve({})})

        it('calls onDone after writing the Weapons category', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', successFetch)
            const onDone = vi.fn()
            helper.writeTeamCategory(config, team, 'Weapons', onDone)
            await vi.waitFor(() => { expect(onDone).toHaveBeenCalledOnce() })
        })

        it('calls onDone after writing the Keys category', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: () => Promise.resolve({})}))
            const onDone = vi.fn()
            helper.writeTeamCategory(config, team, 'Keys', onDone)
            await vi.waitFor(() => { expect(onDone).toHaveBeenCalledOnce() })
        })

        it('calls onDone after writing the Other category', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: () => Promise.resolve({})}))
            const onDone = vi.fn()
            helper.writeTeamCategory(config, team, 'Other', onDone)
            await vi.waitFor(() => { expect(onDone).toHaveBeenCalledOnce() })
        })

        it('calls onDone when the tab already exists with a localized (non-English) error message', async () => {
            helper.accessToken = 'tok'
            let callCount = 0
            vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) {
                    return Promise.resolve({
                        ok: false,
                        text: () => Promise.resolve(JSON.stringify({
                            error: {
                                code: 400,
                                message: 'Invalid requests[0].addSheet: Es ist bereits ein Tabellenblatt mit dem Namen "Alpha - Keys" vorhanden. Geben Sie einen anderen Namen ein.',
                                status: 'INVALID_ARGUMENT',
                            },
                        })),
                    })
                }
                return Promise.resolve({ok: true, json: () => Promise.resolve({})})
            }))
            const onDone = vi.fn()
            helper.writeTeamCategory(config, team, 'Keys', onDone)
            await vi.waitFor(() => { expect(onDone).toHaveBeenCalledOnce() })
        })
    })

    describe('writeAllSheets', () => {
        const config = {clientId: 'cid', spreadsheetId: 'sid'}

        it('sets pushed status after writing zero teams', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: () => Promise.resolve({})}))
            const statusElement = {textContent: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(statusElement)})
            helper.writeAllSheets(config, [], 'status-el')
            await vi.waitFor(() => { expect(statusElement.textContent).toContain('Pushed at') })
        })

        it('sets pushed status after writing one team with all categories', async () => {
            helper.accessToken = 'tok'
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ok: true, json: () => Promise.resolve({})}))
            const statusElement = {textContent: ''}
            vi.stubGlobal('document', {getElementById: vi.fn().mockReturnValue(statusElement)})
            const teams: Team[] = [{id: 'tid', name: 'Alpha', agents: [makeAgent('A1')]}]
            helper.writeAllSheets(config, teams, 'status-el')
            await vi.waitFor(() => { expect(statusElement.textContent).toContain('Pushed at') })
        })
    })
})
