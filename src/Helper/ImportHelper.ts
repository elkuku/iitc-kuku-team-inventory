import {AgentExportData, AgentInventory} from '../../types/Types'

export class ImportHelper {

    public async readFile(file: File): Promise<AgentExportData> {
        const text = await file.text()
        return JSON.parse(text) as AgentExportData
    }

    public createAgent(data: AgentExportData, agentName: string): AgentInventory {
        return {
            name: agentName,
            importedAt: new Date().toISOString(),
            keys: data.keys ?? [],
            resonators: data.resonators ?? {},
            weapons: data.weapons ?? {},
            mods: data.mods ?? {},
            cubes: data.cubes ?? {},
            boosts: data.boosts ?? {},
        }
    }
}
