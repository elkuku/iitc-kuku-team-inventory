import {describe, it, expect, beforeEach, vi} from 'vitest'
import {StorageHelper} from './StorageHelper'
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

describe('StorageHelper', () => {
    let store: Record<string, string>
    let helper: StorageHelper

    beforeEach(() => {
        store = {}
        vi.stubGlobal('localStorage', {
            getItem: (key: string) => store[key] ?? undefined,
            setItem: (key: string, value: string) => {
                store[key] = value
            },
            removeItem: (key: string) => {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete store[key]
            },
        })
        helper = new StorageHelper()
    })

    describe('loadTeams / saveTeams', () => {
        it('returns empty array when nothing is stored', () => {
            expect(helper.loadTeams()).toEqual([])
        })

        it('saves and reloads teams', () => {
            const teams = [{id: 't1', name: 'Team Alpha', agents: []}]
            helper.saveTeams(teams)
            expect(helper.loadTeams()).toEqual(teams)
        })

        it('returns empty array when stored value is invalid JSON', () => {
            store['plugin-kuku-team-inventory-teams'] = 'not-json'
            expect(helper.loadTeams()).toEqual([])
        })
    })

    describe('createTeam', () => {
        it('creates a team with a generated id and empty agents', () => {
            const team = helper.createTeam('Alpha')
            expect(team.name).toBe('Alpha')
            expect(team.id).toMatch(/^team-/)
            expect(team.agents).toEqual([])
        })

        it('persists the new team to storage', () => {
            helper.createTeam('Alpha')
            expect(helper.loadTeams()).toHaveLength(1)
        })

        it('generates unique ids for each team', () => {
            const t1 = helper.createTeam('Alpha')
            const t2 = helper.createTeam('Beta')
            expect(t1.id).not.toBe(t2.id)
        })
    })

    describe('deleteTeam', () => {
        it('removes the team by id', () => {
            const t = helper.createTeam('Alpha')
            helper.deleteTeam(t.id)
            expect(helper.loadTeams()).toEqual([])
        })

        it('does nothing for an unknown id', () => {
            helper.createTeam('Alpha')
            helper.deleteTeam('nonexistent')
            expect(helper.loadTeams()).toHaveLength(1)
        })

        it('only removes the target team', () => {
            const t1 = helper.createTeam('Alpha')
            helper.createTeam('Beta')
            helper.deleteTeam(t1.id)
            const remaining = helper.loadTeams()
            expect(remaining).toHaveLength(1)
            expect(remaining[0].name).toBe('Beta')
        })
    })

    describe('getTeam', () => {
        it('returns the team matching the id', () => {
            const t = helper.createTeam('Alpha')
            expect(helper.getTeam(t.id)!.name).toBe('Alpha')
        })

        it('returns undefined for an unknown id', () => {
            expect(helper.getTeam('unknown')).toBeUndefined()
        })
    })

    describe('addAgentToTeam', () => {
        it('adds a new agent to the team', () => {
            const t = helper.createTeam('Alpha')
            helper.addAgentToTeam(t.id, makeAgent('Ag1'))
            expect(helper.getTeam(t.id)!.agents).toHaveLength(1)
        })

        it('replaces an existing agent with the same name', () => {
            const t = helper.createTeam('Alpha')
            helper.addAgentToTeam(t.id, makeAgent('Ag1', {importedAt: 'old', weapons: {XMP8: 5}}))
            helper.addAgentToTeam(t.id, makeAgent('Ag1', {importedAt: 'new', weapons: {XMP8: 10}}))
            const agents = helper.getTeam(t.id)!.agents
            expect(agents).toHaveLength(1)
            expect(agents[0].importedAt).toBe('new')
            expect(agents[0].weapons.XMP8).toBe(10)
        })

        it('does nothing when team id is unknown', () => {
            helper.addAgentToTeam('unknown', makeAgent('Ag1'))
            expect(helper.loadTeams()).toEqual([])
        })
    })

    describe('removeAgent', () => {
        it('removes the agent by name', () => {
            const t = helper.createTeam('Alpha')
            helper.addAgentToTeam(t.id, makeAgent('Ag1'))
            helper.removeAgent(t.id, 'Ag1')
            expect(helper.getTeam(t.id)!.agents).toHaveLength(0)
        })

        it('does nothing for an unknown agent name', () => {
            const t = helper.createTeam('Alpha')
            helper.addAgentToTeam(t.id, makeAgent('Ag1'))
            helper.removeAgent(t.id, 'Unknown')
            expect(helper.getTeam(t.id)!.agents).toHaveLength(1)
        })

        it('does nothing for an unknown team id', () => {
            helper.createTeam('Alpha')
            helper.removeAgent('unknown', 'Ag1')
            expect(helper.loadTeams()).toHaveLength(1)
        })
    })

    describe('loadSettings / saveSettings', () => {
        it('returns default settings when nothing is stored', () => {
            expect(helper.loadSettings()).toEqual({mapDisplayMode: 'count'})
        })

        it('saves and reloads settings', () => {
            helper.saveSettings({mapDisplayMode: 'icon'})
            expect(helper.loadSettings()).toEqual({mapDisplayMode: 'icon'})
        })

        it('returns defaults when stored value is invalid JSON', () => {
            store['plugin-kuku-team-inventory-settings'] = 'bad'
            expect(helper.loadSettings()).toEqual({mapDisplayMode: 'count'})
        })
    })

    describe('loadMapDisplayMode / saveMapDisplayMode', () => {
        it('defaults to count', () => {
            expect(helper.loadMapDisplayMode()).toBe('count')
        })

        it('saves and reloads mode', () => {
            helper.saveMapDisplayMode('icon')
            expect(helper.loadMapDisplayMode()).toBe('icon')
        })
    })
})
