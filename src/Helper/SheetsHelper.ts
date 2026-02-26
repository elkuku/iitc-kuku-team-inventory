import {SheetsConfig, Team} from '../../types/Types'

const SHEETS_CLIENT_ID_KEY = 'plugin-kuku-team-inventory-sheets-client-id'
const SHEETS_SPREADSHEET_ID_KEY = 'plugin-kuku-team-inventory-sheets-spreadsheet-id'
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets'
const TAB_NAME = 'KuKuTeamInventory'

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
            this.setStatus(statusElementId, 'Creating tab if needed…')
            this.createTabIfNeeded(config, () => {
                this.setStatus(statusElementId, 'Writing data…')
                this.writeToSheet(config, teams, statusElementId)
            })
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
            this.setStatus(statusElementId, 'Reading data…')
            this.readFromSheet(config, statusElementId, onSuccess)
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

    private createTabIfNeeded(config: SheetsConfig, onCreated: () => void): void {
        const url = `${SHEETS_API_BASE}/${config.spreadsheetId}:batchUpdate`
        const body = {
            requests: [{addSheet: {properties: {title: TAB_NAME}}}],
        }
        this.sheetsRequest('POST', url, body, () => { onCreated() }, (error: unknown) => {
            if (typeof error === 'string' && error.includes('already exists')) {
                onCreated()
                return
            }
            console.error('[KuKuTeamInventory] Error creating tab:', error)
        })
    }

    private writeToSheet(config: SheetsConfig, teams: Team[], statusElementId: string): void {
        const timestamp = new Date().toISOString()
        const json = JSON.stringify(teams)
        const range = encodeURIComponent(`${TAB_NAME}!A1:A2`)
        const url = `${SHEETS_API_BASE}/${config.spreadsheetId}/values/${range}?valueInputOption=RAW`
        const body = {
            range: `${TAB_NAME}!A1:A2`,
            majorDimension: 'COLUMNS',
            values: [[timestamp, json]],
        }
        this.sheetsRequest('PUT', url, body, () => {
            this.setStatus(statusElementId, `Pushed at ${new Date().toLocaleString()}`)
        }, (error: unknown) => {
            this.setStatus(statusElementId, `Error writing: ${String(error)}`)
        })
    }

    private readFromSheet(config: SheetsConfig, statusElementId: string, onSuccess: (teams: Team[]) => void): void {
        const range = encodeURIComponent(`${TAB_NAME}!A1:A2`)
        const url = `${SHEETS_API_BASE}/${config.spreadsheetId}/values/${range}`
        this.sheetsRequest('GET', url, undefined, (data: unknown) => {
            try {
                const responseData = data as {values?: string[][]}
                const json = responseData.values?.[1]?.[0]
                if (!json) {
                    this.setStatus(statusElementId, 'Error: no data found in sheet.')
                    return
                }
                const teams = JSON.parse(json) as Team[]
                this.setStatus(statusElementId, `Pulled at ${new Date().toLocaleString()}`)
                onSuccess(teams)
            } catch {
                this.setStatus(statusElementId, 'Error: failed to parse data from sheet.')
            }
        }, (error: unknown) => {
            this.setStatus(statusElementId, `Error reading: ${String(error)}`)
        })
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
