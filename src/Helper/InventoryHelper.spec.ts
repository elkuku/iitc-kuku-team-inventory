import {describe, it, expect} from 'vitest'
import {InventoryHelper} from './InventoryHelper'
import type {AgentInventory} from '../../types/Types'

const makeAgent = (name: string, overrides: Partial<AgentInventory> = {}): AgentInventory => ({
    name,
    importedAt: '',
    keys: [],
    resonators: {},
    weapons: {},
    mods: {},
    cubes: {},
    boosts: {},
    ...overrides,
})

describe('InventoryHelper', () => {
    const helper = new InventoryHelper()

    describe('aggregateKeys', () => {
        it('returns empty map for no agents', () => {
            expect(helper.aggregateKeys([])).toEqual(new Map())
        })

        it('aggregates keys from a single agent', () => {
            const agents = [makeAgent('A1', {keys: [{guid: 'g1', title: 'Portal A', lat: 1, lng: 2, total: 3}]})]
            const result = helper.aggregateKeys(agents)
            expect(result.size).toBe(1)
            const key = result.get('g1')!
            expect(key.total).toBe(3)
            expect(key.portal.title).toBe('Portal A')
            expect(key.portal.lat).toBe(1)
            expect(key.portal.lng).toBe(2)
            expect(key.agentCounts.get('A1')).toBe(3)
        })

        it('merges key counts from multiple agents for the same portal', () => {
            const agents = [
                makeAgent('A1', {keys: [{guid: 'g1', title: 'Portal A', lat: 1, lng: 2, total: 3}]}),
                makeAgent('A2', {keys: [{guid: 'g1', title: 'Portal A', lat: 1, lng: 2, total: 5}]}),
            ]
            const result = helper.aggregateKeys(agents)
            expect(result.size).toBe(1)
            const key = result.get('g1')!
            expect(key.total).toBe(8)
            expect(key.agentCounts.get('A1')).toBe(3)
            expect(key.agentCounts.get('A2')).toBe(5)
        })

        it('keeps separate entries for different portals', () => {
            const agents = [makeAgent('A1', {keys: [
                {guid: 'g1', title: 'Portal A', lat: 1, lng: 2, total: 3},
                {guid: 'g2', title: 'Portal B', lat: 3, lng: 4, total: 7},
            ]})]
            const result = helper.aggregateKeys(agents)
            expect(result.size).toBe(2)
            expect(result.get('g1')!.total).toBe(3)
            expect(result.get('g2')!.total).toBe(7)
        })

        it('accumulates counts when agent has multiple entries for same portal', () => {
            const agents = [
                makeAgent('A1', {keys: [{guid: 'g1', title: 'P', lat: 0, lng: 0, total: 2}]}),
                makeAgent('A1', {keys: [{guid: 'g1', title: 'P', lat: 0, lng: 0, total: 4}]}),
            ]
            const result = helper.aggregateKeys(agents)
            expect(result.get('g1')!.agentCounts.get('A1')).toBe(6)
        })
    })

    describe('aggregateItems', () => {
        it('returns empty map for no agents', () => {
            expect(helper.aggregateItems([], 'weapons')).toEqual(new Map())
        })

        it('aggregates a single agent\'s weapons', () => {
            const agents = [makeAgent('A1', {weapons: {XMP8: 10, 'Ultrastrike L7': 3}})]
            const result = helper.aggregateItems(agents, 'weapons')
            expect(result.size).toBe(2)
            expect(result.get('XMP8')!.total).toBe(10)
            expect(result.get('XMP8')!.agents.get('A1')).toBe(10)
        })

        it('merges weapons from multiple agents', () => {
            const agents = [
                makeAgent('A1', {weapons: {XMP8: 5}}),
                makeAgent('A2', {weapons: {XMP8: 3, XMP7: 2}}),
            ]
            const result = helper.aggregateItems(agents, 'weapons')
            expect(result.get('XMP8')!.total).toBe(8)
            expect(result.get('XMP8')!.agents.get('A1')).toBe(5)
            expect(result.get('XMP8')!.agents.get('A2')).toBe(3)
            expect(result.get('XMP7')!.total).toBe(2)
        })

        it('works for other fields like resonators and mods', () => {
            const agents = [
                makeAgent('A1', {resonators: {L8: 10}}),
                makeAgent('A2', {resonators: {L8: 5, L7: 3}}),
            ]
            const result = helper.aggregateItems(agents, 'resonators')
            expect(result.get('L8')!.total).toBe(15)
            expect(result.get('L7')!.total).toBe(3)
        })
    })
})
