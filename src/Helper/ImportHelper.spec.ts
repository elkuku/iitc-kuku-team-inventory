import {describe, it, expect} from 'vitest'
import {ImportHelper} from './ImportHelper'
import type {AgentExportData} from '../../types/Types'

const makeFileMock = (content: string): File =>
    ({text: () => Promise.resolve(content)}) as unknown as File

describe('ImportHelper', () => {
    const helper = new ImportHelper()

    describe('readFile', () => {
        it('parses JSON from a file and returns AgentExportData', async () => {
            const data = {weapons: {XMP8: 5}, keys: []}
            const result = await helper.readFile(makeFileMock(JSON.stringify(data)))
            expect(result).toEqual(data)
        })

        it('throws on invalid JSON', async () => {
            await expect(helper.readFile(makeFileMock('not-json'))).rejects.toThrow()
        })
    })

    describe('readTeamsFile', () => {
        it('parses a JSON array of teams', async () => {
            const teams = [{id: 't1', name: 'Alpha', agents: []}]
            const result = await helper.readTeamsFile(makeFileMock(JSON.stringify(teams)))
            expect(result).toEqual(teams)
        })

        it('throws when the JSON is not an array', async () => {
            await expect(helper.readTeamsFile(makeFileMock('{"not": "array"}'))).rejects.toThrow('Expected an array')
        })

        it('throws on invalid JSON', async () => {
            await expect(helper.readTeamsFile(makeFileMock('bad json'))).rejects.toThrow()
        })
    })

    describe('createAgent', () => {
        it('creates an agent with all fields from export data', () => {
            const data: AgentExportData = {
                keys: [{guid: 'g1', title: 'Portal', lat: 1.5, lng: 2.5, total: 3}],
                weapons: {XMP8: 5},
                resonators: {L8: 2},
                mods: {'HS-Rare': 1},
                cubes: {XFC: 4},
                boosts: {Apex: 1},
            }
            const agent = helper.createAgent(data, 'TestAgent')
            expect(agent.name).toBe('TestAgent')
            expect(agent.keys).toEqual(data.keys)
            expect(agent.weapons).toEqual({XMP8: 5})
            expect(agent.resonators).toEqual({L8: 2})
            expect(agent.mods).toEqual({'HS-Rare': 1})
            expect(agent.cubes).toEqual({XFC: 4})
            expect(agent.boosts).toEqual({Apex: 1})
        })

        it('defaults missing fields to empty collections', () => {
            const agent = helper.createAgent({}, 'EmptyAgent')
            expect(agent.name).toBe('EmptyAgent')
            expect(agent.keys).toEqual([])
            expect(agent.weapons).toEqual({})
            expect(agent.resonators).toEqual({})
            expect(agent.mods).toEqual({})
            expect(agent.cubes).toEqual({})
            expect(agent.boosts).toEqual({})
        })

        it('sets importedAt to a valid ISO 8601 string close to now', () => {
            const before = new Date().toISOString()
            const agent = helper.createAgent({}, 'Agent')
            const after = new Date().toISOString()
            expect(agent.importedAt >= before).toBe(true)
            expect(agent.importedAt <= after).toBe(true)
        })

        it('uses provided keys array and ignores undefined', () => {
            const agent = helper.createAgent({keys: undefined}, 'Agent')
            expect(agent.keys).toEqual([])
        })
    })
})
