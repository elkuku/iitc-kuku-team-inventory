import {KeyInfo} from '../../types/Types'
import Portal = IITC.Portal

export class LayerHelper {
    private readonly layerGroup = new L.LayerGroup<any>()
    private keys = new Map<string, KeyInfo>()
    private readonly markers = new Map<string, L.Marker>()

    constructor(name: string) {
        window.addLayerGroup(name, this.layerGroup, true)
    }

    public setKeys(keys: Map<string, KeyInfo>): void {
        this.keys = keys
        this.refreshMarkers()
    }

    public onPortalAdded(portal: Portal): void {
        const guid = portal.options.guid
        if (!this.keys.has(guid)) return
        if (this.markers.has(guid)) return

        const marker = this.createMarker(guid)
        this.layerGroup.addLayer(marker)
        this.markers.set(guid, marker)
    }

    public onPortalRemoved(portal: Portal): void {
        const guid = portal.options.guid
        const marker = this.markers.get(guid)
        if (!marker) return

        this.layerGroup.removeLayer(marker)
        this.markers.delete(guid)
    }

    public onPortalSelected(data: any): void {
        const unsel = data.unselectedPortalGuid as string | undefined
        const sel = data.selectedPortalGuid as string | undefined

        if (unsel) this.toggleDetails(unsel, false)
        if (sel) this.toggleDetails(sel, true)
    }

    private toggleDetails(guid: string, showDetails: boolean): void {
        const existing = this.markers.get(guid)
        if (!existing) return

        this.layerGroup.removeLayer(existing)
        this.markers.delete(guid)

        const marker = this.createMarker(guid, showDetails)
        this.layerGroup.addLayer(marker)
        this.markers.set(guid, marker)
    }

    private refreshMarkers(): void {
        for (const marker of this.markers.values()) {
            this.layerGroup.removeLayer(marker)
        }
        this.markers.clear()

        for (const guid of Object.keys(window.portals)) {
            if (!this.keys.has(guid)) continue
            const marker = this.createMarker(guid)
            this.layerGroup.addLayer(marker)
            this.markers.set(guid, marker)
        }
    }

    private createMarker(guid: string, withDetails: boolean = false): L.Marker {
        const keyInfo = this.keys.get(guid)
        if (!keyInfo) throw new Error(`KeyInfo not found for guid: ${guid}`)

        let html = `<strong>${keyInfo.total}</strong>`

        if (withDetails && keyInfo.agentCounts.size > 0) {
            for (const [agent, count] of keyInfo.agentCounts) {
                html += `<br />${agent}: ${count}`
            }
        }

        return L.marker(
            new L.LatLng(keyInfo.portal.lat, keyInfo.portal.lng),
            {
                icon: new L.DivIcon({
                    html,
                    className: 'layer-key-info',
                }),
                interactive: false,
            }
        )
    }
}
