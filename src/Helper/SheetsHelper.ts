import {AgentInventory, KeyExport, SheetsConfig, Team} from '../../types/Types'

const SHEETS_CLIENT_ID_KEY = 'plugin-kuku-team-inventory-sheets-client-id'
const SHEETS_SPREADSHEET_ID_KEY = 'plugin-kuku-team-inventory-sheets-spreadsheet-id'
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const TEAMS_TAB = '_Teams'

type Category = 'Weapons' | 'Keys' | 'Other'


export class SheetsHelper {

    private accessToken: string | undefined
    private tokenExpiresAt: number | undefined
    private tokenClient: google.accounts.oauth2.TokenClient | undefined

    public loadConfig(): SheetsConfig | undefined {
        const clientId = localStorage.getItem(SHEETS_CLIENT_ID_KEY)
        const spreadsheetId = localStorage.getItem(SHEETS_SPREADSHEET_ID_KEY)
        if (!clientId || !spreadsheetId) return undefined
        return {clientId, spreadsheetId}
    }

    public saveConfig(config: SheetsConfig): void {
        localStorage.setItem(SHEETS_CLIENT_ID_KEY, config.clientId)
        localStorage.setItem(SHEETS_SPREADSHEET_ID_KEY, config.spreadsheetId)
        this.tokenClient = undefined
        this.accessToken = undefined
    }

    public clearConfig(): void {
        localStorage.removeItem(SHEETS_CLIENT_ID_KEY)
        localStorage.removeItem(SHEETS_SPREADSHEET_ID_KEY)
    }

    public pushToSheets(teams: Team[], statusElementId: string): void {
        const config = this.loadConfig()
        if (!config) {
            this.setStatus(statusElementId, 'Error: credentials not configured.')
            return
        }
        this.setStatus(statusElementId, 'Authenticating…')
        this.withToken(() => {
            this.setStatus(statusElementId, 'Writing sheets…')
            this.writeAllSheets(config, teams, statusElementId)
        })
    }

    public pullFromSheets(statusElementId: string, onSuccess: (teams: Team[]) => void): void {
        const config = this.loadConfig()
        if (!config) {
            this.setStatus(statusElementId, 'Error: credentials not configured.')
            return
        }
        this.setStatus(statusElementId, 'Authenticating…')
        this.withToken(() => {
            this.setStatus(statusElementId, 'Reading sheets…')
            this.readAllSheets(config, statusElementId, onSuccess)
        })
    }

    private loadGisScript(onReady: () => void): void {
        if (document.getElementById('gis-client-script')) {
            onReady()
            return
        }
        const script = document.createElement('script')
        script.id = 'gis-client-script'
        script.src = GIS_SCRIPT_URL
        script.addEventListener('load', onReady)
        document.head.appendChild(script)
    }

    private isTokenValid(): boolean {
        return (
            this.accessToken !== undefined &&
            this.tokenExpiresAt !== undefined &&
            Date.now() < this.tokenExpiresAt - 60_000
        )
    }

    private requestToken(onToken: () => void): void {
        if (!this.tokenClient) {
            const config = this.loadConfig()
            if (!config) return
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: config.clientId,
                scope: SHEETS_SCOPE,
                callback: (response: google.accounts.oauth2.TokenResponse) => {
                    if (response.error) return
                    this.accessToken = response.access_token
                    this.tokenExpiresAt = Date.now() + response.expires_in * 1000
                    onToken()
                },
            })
        }
        this.tokenClient.requestAccessToken({prompt: ''})
    }

    private withToken(onReady: () => void): void {
        if (this.isTokenValid()) {
            onReady()
            return
        }
        this.loadGisScript(() => { this.requestToken(onReady) })
    }

    private sanitizeSheetName(name: string): string {
        return name.replace(/[\\/?*[\]:]/g, '-').slice(0, 100)
    }

    private ensureTab(config: SheetsConfig, tabName: string, onCreated: () => void): void {
        const url = `${SHEETS_API_BASE}/${config.spreadsheetId}:batchUpdate`
        const body = {requests: [{addSheet: {properties: {title: tabName}}}]}
        this.sheetsRequest('POST', url, body, () => { onCreated() }, (error: unknown) => {
            if (typeof error === 'string' && (error.includes('already exists') || error.includes('INVALID_ARGUMENT'))) {
                onCreated()
                return
            }
            console.error('[KuKuTeamInventory] Error creating tab:', error)
        })
    }

    private writeSheetData(
        config: SheetsConfig,
        sheetName: string,
        values: string[][],
        onDone?: () => void,
    ): void {
        const clearUrl = `${SHEETS_API_BASE}/${config.spreadsheetId}/values/${encodeURIComponent(`${sheetName}!A:ZZ`)}:clear`
        this.sheetsRequest('POST', clearUrl, {}, () => {
            const range = `${sheetName}!A1`
            const url = `${SHEETS_API_BASE}/${config.spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=RAW`
            this.sheetsRequest('PUT', url, {range, majorDimension: 'ROWS', values}, () => {
                onDone?.()
            }, (error: unknown) => {
                console.error(`[KuKuTeamInventory] Error writing ${sheetName}:`, error)
                onDone?.()
            })
        }, (error: unknown) => {
            console.error(`[KuKuTeamInventory] Error clearing ${sheetName}:`, error)
            onDone?.()
        })
    }

    // Row 0: _importedAt row (blank prefix cols for Keys)
    // Row 1: header (Item/Portal | [GUID | Lat | Lng |] Agent1 | Agent2 | ...)
    // Row 2+: data

    private buildTeamsValues(teams: Team[]): string[][] {
        return [['Team', 'ID'], ...teams.map(t => [t.name, t.id])]
    }

    private buildWeaponsValues(agents: AgentInventory[]): string[][] {
        const allItems = new Set<string>()
        for (const agent of agents) {
            for (const item of Object.keys(agent.weapons)) allItems.add(item)
        }
        const rows: string[][] = [
            ['_importedAt', ...agents.map(a => a.importedAt)],
            ['Item', ...agents.map(a => a.name)],
        ]
        for (const item of [...allItems].toSorted()) {
            rows.push([item, ...agents.map(a => String(a.weapons[item] ?? 0))])
        }
        return rows
    }

    private buildKeysValues(agents: AgentInventory[]): string[][] {
        const portals = new Map<string, {title: string; lat: number; lng: number}>()
        for (const agent of agents) {
            for (const key of agent.keys) portals.set(key.guid, {title: key.title, lat: key.lat, lng: key.lng})
        }
        const sortedPortals = [...portals.entries()].toSorted((a, b) => a[1].title.localeCompare(b[1].title))
        const rows: string[][] = [
            ['_importedAt', '', '', '', ...agents.map(a => a.importedAt)],
            ['Portal', 'GUID', 'Lat', 'Lng', ...agents.map(a => a.name)],
        ]
        for (const [guid, {title, lat, lng}] of sortedPortals) {
            rows.push([
                title, guid, String(lat), String(lng),
                ...agents.map(a => String(a.keys.find(k => k.guid === guid)?.total ?? 0)),
            ])
        }
        return rows
    }

    private buildOtherValues(agents: AgentInventory[]): string[][] {
        const getItems = (agent: AgentInventory): Record<string, number> => {
            const items: Record<string, number> = {}
            for (const [k, v] of Object.entries(agent.resonators)) items[`Resonator ${k}`] = v
            for (const [k, v] of Object.entries(agent.mods)) items[`Mod: ${k}`] = v
            for (const [k, v] of Object.entries(agent.cubes)) items[`Cube: ${k}`] = v
            for (const [k, v] of Object.entries(agent.boosts)) items[`Boost: ${k}`] = v
            return items
        }
        const agentItems = agents.map(getItems)
        const allItems = new Set<string>()
        for (const items of agentItems) {
            for (const item of Object.keys(items)) allItems.add(item)
        }
        const rows: string[][] = [
            ['_importedAt', ...agents.map(a => a.importedAt)],
            ['Item', ...agents.map(a => a.name)],
        ]
        for (const item of [...allItems].toSorted()) {
            rows.push([item, ...agentItems.map(items => String(items[item] ?? 0))])
        }
        return rows
    }

    private writeTeamCategory(config: SheetsConfig, team: Team, category: Category, onDone: () => void): void {
        const sheetName = this.sanitizeSheetName(`${team.name} - ${category}`)
        let values: string[][]
        if (category === 'Weapons') values = this.buildWeaponsValues(team.agents)
        else if (category === 'Keys') values = this.buildKeysValues(team.agents)
        else values = this.buildOtherValues(team.agents)
        this.ensureTab(config, sheetName, () => { this.writeSheetData(config, sheetName, values, onDone) })
    }

    private writeAllSheets(config: SheetsConfig, teams: Team[], statusElementId: string): void {
        const total = 1 + teams.length * 3
        let remaining = total
        const onDone = (): void => {
            if (--remaining === 0) {
                this.setStatus(statusElementId, `Pushed at ${new Date().toLocaleString()}`)
            }
        }
        this.ensureTab(config, TEAMS_TAB, () => {
            this.writeSheetData(config, TEAMS_TAB, this.buildTeamsValues(teams), onDone)
        })
        for (const team of teams) {
            this.writeTeamCategory(config, team, 'Weapons', onDone)
            this.writeTeamCategory(config, team, 'Keys', onDone)
            this.writeTeamCategory(config, team, 'Other', onDone)
        }
    }

    private readAllSheets(
        config: SheetsConfig,
        statusElementId: string,
        onSuccess: (teams: Team[]) => void,
    ): void {
        // Step 1: get list of all sheet names
        const metaUrl = `${SHEETS_API_BASE}/${config.spreadsheetId}?fields=sheets.properties.title`
        this.sheetsRequest('GET', metaUrl, undefined, (data: unknown) => {
            const sheetData = data as {sheets?: {properties: {title: string}}[]}
            const titles = (sheetData.sheets ?? []).map(s => s.properties.title)

            // Derive team names from sheets ending in " - Weapons"
            const suffix = ' - Weapons'
            const teamNames = titles.filter(t => t.endsWith(suffix)).map(t => t.slice(0, -suffix.length))

            if (teamNames.length === 0) {
                this.setStatus(statusElementId, 'Error: no team sheets found.')
                return
            }

            // Step 2: batch-read _Teams + all category sheets
            const allRanges = [
                `${TEAMS_TAB}!A1:B1000`,
                ...teamNames.flatMap(name => {
                    const base = this.sanitizeSheetName(name)
                    return [`${base} - Weapons!A1:ZZ10000`, `${base} - Keys!A1:ZZ10000`, `${base} - Other!A1:ZZ10000`]
                }),
            ]
            const rangeParameters = allRanges.map(r => `ranges=${encodeURIComponent(r)}`).join('&')
            const batchUrl = `${SHEETS_API_BASE}/${config.spreadsheetId}/values:batchGet?${rangeParameters}`

            this.sheetsRequest('GET', batchUrl, undefined, (batchData: unknown) => {
                try {
                    const result = batchData as {valueRanges?: {values?: string[][]}[]}
                    const vr = result.valueRanges ?? []

                    // Parse _Teams for IDs (index 0)
                    const teamIdMap = new Map<string, string>()
                    for (const row of (vr[0]?.values ?? []).slice(1)) {
                        if (row[0] && row[1]) teamIdMap.set(row[0], row[1])
                    }

                    const teams = teamNames.map((name, i) => this.reconstructTeam(
                        name,
                        teamIdMap.get(name) ?? name,
                        vr[1 + i * 3]?.values ?? [],
                        vr[2 + i * 3]?.values ?? [],
                        vr[3 + i * 3]?.values ?? [],
                    ))

                    this.setStatus(statusElementId, `Pulled at ${new Date().toLocaleString()}`)
                    onSuccess(teams)
                } catch {
                    this.setStatus(statusElementId, 'Error: failed to parse sheet data.')
                }
            }, (error: unknown) => {
                this.setStatus(statusElementId, `Error reading: ${String(error)}`)
            })
        }, (error: unknown) => {
            this.setStatus(statusElementId, `Error reading spreadsheet: ${String(error)}`)
        })
    }

    private reconstructTeam(
        name: string,
        id: string,
        weaponsData: string[][],
        keysData: string[][],
        otherData: string[][],
    ): Team {
        // Row 0 = _importedAt, row 1 = header (item | agent...), row 2+ = data
        const agentNames = weaponsData[1]?.slice(1) ?? []
        const importedAts = weaponsData[0]?.slice(1) ?? []

        const agents: AgentInventory[] = agentNames.map((agentName, i) => ({
            name: agentName,
            importedAt: importedAts[i] ?? '',
            keys: [],
            weapons: {},
            resonators: {},
            mods: {},
            cubes: {},
            boosts: {},
        }))

        // Weapons: row = [item, count0, count1, ...]
        for (const row of weaponsData.slice(2)) {
            const item = row[0]
            if (!item) continue
            for (const [index, agent] of agents.entries()) {
                const count = parseInt(row[index + 1] ?? '0', 10)
                if (count > 0) agent.weapons[item] = count
            }
        }

        // Keys: row = [title, guid, lat, lng, count0, count1, ...]
        for (const row of keysData.slice(2)) {
            const [title, guid, latStr, lngStr, ...counts] = row
            if (!guid) continue
            const keyBase: Omit<KeyExport, 'total'> = {
                guid,
                title: title ?? '',
                lat: parseFloat(latStr ?? '0'),
                lng: parseFloat(lngStr ?? '0'),
            }
            for (const [index, agent] of agents.entries()) {
                const count = parseInt(counts[index] ?? '0', 10)
                if (count > 0) agent.keys.push({...keyBase, total: count})
            }
        }

        // Other: item prefixes determine field
        for (const row of otherData.slice(2)) {
            const item = row[0]
            if (!item) continue
            for (const [index, agent] of agents.entries()) {
                const count = parseInt(row[index + 1] ?? '0', 10)
                if (count <= 0) continue
                if (item.startsWith('Resonator ')) agent.resonators[item.slice(10)] = count
                else if (item.startsWith('Mod: ')) agent.mods[item.slice(5)] = count
                else if (item.startsWith('Cube: ')) agent.cubes[item.slice(6)] = count
                else if (item.startsWith('Boost: ')) agent.boosts[item.slice(7)] = count
            }
        }

        return {id, name, agents}
    }

    private sheetsRequest(
        method: string,
        url: string,
        body: unknown,
        onSuccess: (data: unknown) => void,
        onError: (error: unknown) => void,
    ): void {
        if (!this.accessToken) {
            onError('No access token')
            return
        }
        const options: RequestInit = {
            method,
            headers: {
                Authorization: `Bearer ${this.accessToken}`,
                'Content-Type': 'application/json',
            },
        }
        if (body !== undefined) {
            options.body = JSON.stringify(body)
        }
        void fetch(url, options)
            .then(async response => {
                if (!response.ok) {
                    onError(await response.text())
                    return
                }
                onSuccess(await response.json() as unknown)
            })
            .catch((error: unknown) => { onError(error) })
    }

    private setStatus(statusElementId: string, message: string): void {
        const element = document.getElementById(statusElementId) as HTMLElement | undefined
        if (element) element.textContent = message
    }
}
