import {AgentInventory, ItemWithBreakdown, KeyInfo} from '../../types/Types'

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

    public aggregateItems(agents: AgentInventory[], field: InventoryField): Map<string, ItemWithBreakdown> {
        const result = new Map<string, ItemWithBreakdown>()

        for (const agent of agents) {
            for (const [key, count] of Object.entries(agent[field])) {
                const existing = result.get(key)
                if (existing) {
                    existing.total += count
                    existing.agents.set(agent.name, (existing.agents.get(agent.name) ?? 0) + count)
                } else {
                    result.set(key, {total: count, agents: new Map([[agent.name, count]])})
                }
            }
        }

        return result
    }
}
