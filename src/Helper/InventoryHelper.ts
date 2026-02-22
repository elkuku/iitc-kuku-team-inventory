import {AgentInventory, KeyInfo} from '../../types/Types'

type InventoryField = 'resonators' | 'weapons' | 'mods' | 'cubes' | 'boosts'

export class InventoryHelper {

    public aggregateKeys(agents: AgentInventory[]): Map<string, KeyInfo> {
        const result = new Map<string, KeyInfo>()

        for (const agent of agents) {
            for (const key of agent.keys) {
                const existing = result.get(key.guid)
                if (existing) {
                    existing.total += key.total
                    existing.agentCounts.set(
                        agent.name,
                        (existing.agentCounts.get(agent.name) ?? 0) + key.total
                    )
                } else {
                    result.set(key.guid, {
                        portal: {guid: key.guid, title: key.title, lat: key.lat, lng: key.lng},
                        total: key.total,
                        agentCounts: new Map([[agent.name, key.total]]),
                    })
                }
            }
        }

        return result
    }

    public aggregateItems(agents: AgentInventory[], field: InventoryField): Map<string, number> {
        const result = new Map<string, number>()

        for (const agent of agents) {
            for (const [key, count] of Object.entries(agent[field])) {
                result.set(key, (result.get(key) ?? 0) + count)
            }
        }

        return result
    }
}
