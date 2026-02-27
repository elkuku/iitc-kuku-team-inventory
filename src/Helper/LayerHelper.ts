import {KeyInfo} from '../../types/Types'
import Portal = IITC.Portal

interface InventoryKeyInfo {
    total: number
    atHand?: number
    capsules?: Map<string, number>
}

export class LayerHelper {
    private readonly layerGroup = new L.LayerGroup<any>()
    private keys = new Map<string, KeyInfo>()
    private readonly markers = new Map<string, L.Marker>()
    private inventoryLayerSuppressed = false
    private invOrigOnAdded: ((portal: Portal) => void) | null = null
    private mapEventsRegistered = false

    constructor(name: string) {
        window.addLayerGroup(name, this.layerGroup, true)
    }

    public setKeys(keys: Map<string, KeyInfo>): void {
        this.keys = keys
        this.registerMapLayerEvents()
        this.maybeSupressInventoryLayer()
        this.refreshMarkers()
    }

    /**
     * Registers map-level layeradd/layerremove listeners once window.map is ready.
     * These keep the inv plugin markers in sync when the user toggles "Team Keys".
     */
    private registerMapLayerEvents(): void {
        if (this.mapEventsRegistered || !window.map) return
        this.mapEventsRegistered = true

        window.map.on('layerremove', (e) => {
            if ((e as any).layer === this.layerGroup) this.onTeamLayerHidden()
        })
        window.map.on('layeradd', (e) => {
            if ((e as any).layer === this.layerGroup) this.onTeamLayerShown()
        })
    }

    public onPortalAdded(portal: Portal): void {
        this.maybeSupressInventoryLayer()
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

    /**
     * Called when the "Team Keys" layer is hidden via the layer control.
     * Restores inv plugin markers for team portals currently on screen so
     * the "Portal keys" layer keeps showing personal key counts.
     */
    private onTeamLayerHidden(): void {
        const invLayerHelper = this.getInventoryLayerHelper()
        if (!invLayerHelper || !this.invOrigOnAdded) return

        for (const guid of Object.keys(window.portals)) {
            if (!this.keys.has(guid)) continue
            if (invLayerHelper.keys?.has(guid) && !invLayerHelper.markers?.has(guid)) {
                const portal = window.portals[guid]
                if (portal) this.invOrigOnAdded(portal)
            }
        }
    }

    /**
     * Called when the "Team Keys" layer is shown via the layer control.
     * Removes any inv plugin markers for team portals so the combined marker
     * in the "Team Keys" layer takes over without overlap.
     */
    private onTeamLayerShown(): void {
        const invLayerHelper = this.getInventoryLayerHelper()
        if (!invLayerHelper) return

        if (invLayerHelper.markers instanceof Map) {
            for (const [guid, marker] of [...invLayerHelper.markers.entries()]) {
                if (this.keys.has(guid)) {
                    invLayerHelper.layerGroup?.removeLayer(marker)
                    invLayerHelper.markers.delete(guid)
                }
            }
        }
    }

    /**
     * When KuKuInventory is installed, suppress its map markers for portals where
     * the team inventory also has data. This prevents two overlapping DivIcon markers
     * at the same coordinates. The team inventory layer then shows a single combined
     * marker with both personal and team key counts.
     *
     * Only runs once (guarded by inventoryLayerSuppressed). Called on every
     * onPortalAdded to handle the case where the inventory plugin loads after init.
     */
    private maybeSupressInventoryLayer(): void {
        if (this.inventoryLayerSuppressed) return
        const invLayerHelper = this.getInventoryLayerHelper()
        if (!invLayerHelper) return

        this.inventoryLayerSuppressed = true

        // Remove any existing inventory markers that overlap with team portals
        if (invLayerHelper.markers instanceof Map) {
            for (const [guid, marker] of [...invLayerHelper.markers.entries()]) {
                if (this.keys.has(guid)) {
                    invLayerHelper.layerGroup?.removeLayer(marker)
                    invLayerHelper.markers.delete(guid)
                }
            }
        }

        // Save the original method so onTeamLayerHidden can call it directly.
        // Override onPortalAdded: skip inv marker for team portals only when the
        // "Team Keys" layer is active. Arrow function keeps `this.keys` current.
        this.invOrigOnAdded = (invLayerHelper.onPortalAdded as (p: Portal) => void).bind(invLayerHelper)
        invLayerHelper.onPortalAdded = (portal: Portal) => {
            if (this.keys.has(portal.options.guid) && window.map.hasLayer(this.layerGroup)) return
            this.invOrigOnAdded!(portal)
        }
    }

    private getInventoryLayerHelper() {
        return window.plugin.KuKuInventory?.layerHelper ?? null
    }

    private getInventoryKeyInfo(guid: string): InventoryKeyInfo | undefined {
        return this.getInventoryLayerHelper()?.keys?.get(guid) as InventoryKeyInfo | undefined
    }

    private getInventoryCapsuleName(key: string): string {
        return window.plugin.KuKuInventory?.capsuleNames?.[key] ?? key
    }

    private createMarker(guid: string, withDetails: boolean = false): L.Marker {
        const keyInfo = this.keys.get(guid)
        if (!keyInfo) throw new Error(`KeyInfo not found for guid: ${guid}`)

        const invInfo = this.getInventoryKeyInfo(guid)

        // When personal inventory data is available, show "personal / team" counts.
        // Otherwise show team count only (bold).
        let html = invInfo
            ? `${invInfo.total} / <strong>${keyInfo.total}</strong>`
            : `<strong>${keyInfo.total}</strong>`

        if (withDetails) {
            if (invInfo) {
                if (invInfo.atHand !== undefined) {
                    html += `<br /><em>Hand: ${invInfo.atHand}</em>`
                }
                if (invInfo.capsules?.size) {
                    for (const [capsule, count] of invInfo.capsules) {
                        html += `<br />${this.getInventoryCapsuleName(capsule)}: ${count}`
                    }
                }
                if (keyInfo.agentCounts.size > 0) {
                    html += '<br />---'
                }
            }
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
