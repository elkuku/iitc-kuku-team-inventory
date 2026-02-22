import {AgentInventory, Team} from '../../types/Types'

const STORAGE_KEY = 'plugin-kuku-team-inventory-teams'

export class StorageHelper {

    public loadTeams(): Team[] {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        try {
            return JSON.parse(raw) as Team[]
        } catch {
            console.warn('[KuKuTeamInventory] Failed to parse teams from localStorage, resetting')
            return []
        }
    }

    public saveTeams(teams: Team[]): void {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(teams))
    }

    public getTeam(teamId: string): Team | undefined {
        return this.loadTeams().find(t => t.id === teamId)
    }

    public createTeam(name: string): Team {
        const teams = this.loadTeams()
        const team: Team = {
            id: `team-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name,
            agents: [],
        }
        teams.push(team)
        this.saveTeams(teams)
        return team
    }

    public deleteTeam(teamId: string): void {
        const teams = this.loadTeams().filter(t => t.id !== teamId)
        this.saveTeams(teams)
    }

    public addAgentToTeam(teamId: string, agent: AgentInventory): void {
        const teams = this.loadTeams()
        const team = teams.find(t => t.id === teamId)
        if (!team) {
            console.warn(`[KuKuTeamInventory] Team not found: ${teamId}`)
            return
        }
        // Replace existing agent data if same name
        const existingIndex = team.agents.findIndex(a => a.name === agent.name)
        if (existingIndex === -1) {
            team.agents.push(agent)
        } else {
            team.agents[existingIndex] = agent
        }
        this.saveTeams(teams)
    }

    public removeAgent(teamId: string, agentName: string): void {
        const teams = this.loadTeams()
        const team = teams.find(t => t.id === teamId)
        if (!team) return
        team.agents = team.agents.filter(a => a.name !== agentName)
        this.saveTeams(teams)
    }
}
