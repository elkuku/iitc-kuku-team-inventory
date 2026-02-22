import {KeyInfo} from '../../types/Types'

export class SidebarHelper {

    private keys = new Map<string, KeyInfo>()

    public setKeys(keys: Map<string, KeyInfo>): void {
        this.keys = keys
    }

    public onPortalDetailsUpdated(data: any): void {
        const guid = data.guid as string | undefined
        if (!guid) return

        const keyInfo = this.keys.get(guid)
        if (!keyInfo) return

        const tbody = document.querySelector('#randdetails tbody')
        if (!tbody) return

        let html = '<tr>'
        html += `<td>Team: <strong>${keyInfo.total}</strong></td>`
        html += '<td colspan="3">'

        if (keyInfo.agentCounts.size > 0) {
            for (const [agent, count] of keyInfo.agentCounts) {
                html += `${agent}: ${count}<br />`
            }
        }

        html += '</td>'
        html += '</tr>'

        tbody.insertAdjacentHTML('beforeend', html)
    }
}
