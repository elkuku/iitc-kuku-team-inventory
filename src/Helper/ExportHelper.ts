import {Team} from '../../types/Types'

export class ExportHelper {

    public exportTeams(teams: Team[]): void {
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '')
        const json = JSON.stringify(teams, undefined, 2)
        const blob = new Blob([json], {type: 'application/json'})
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `kuku-team-inventory-${timestamp}.json`
        anchor.click()
        URL.revokeObjectURL(url)
    }
}
