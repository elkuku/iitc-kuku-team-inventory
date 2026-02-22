
export interface HelperHandlebars {
    compile: (templateString: any) => Handlebars.TemplateDelegate
    registerHelper: (name: Handlebars.HelperDeclareSpec) => void
}

export interface KeyExport {
    guid: string
    title: string
    lat: number
    lng: number
    total: number
}

export interface AgentInventory {
    name: string
    importedAt: string
    keys: KeyExport[]
    resonators: Record<string, number>
    weapons: Record<string, number>
    mods: Record<string, number>
    cubes: Record<string, number>
    boosts: Record<string, number>
}

export interface Team {
    id: string
    name: string
    agents: AgentInventory[]
}

export interface KeyInfo {
    portal: {
        guid: string
        title: string
        lat: number
        lng: number
    }
    total: number
    agentCounts: Map<string, number>
}

export interface AgentExportData {
    agent?: string
    keys?: KeyExport[]
    resonators?: Record<string, number>
    weapons?: Record<string, number>
    mods?: Record<string, number>
    cubes?: Record<string, number>
    boosts?: Record<string, number>
}

declare global {
    interface Window {
        plugin: {
            HelperHandlebars: HelperHandlebars
            KuKuTeamInventory: any
        }
    }
}
