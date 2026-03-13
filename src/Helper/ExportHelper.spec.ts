import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest'
import {ExportHelper} from './ExportHelper'
import type {Team} from '../../types/Types'

describe('ExportHelper', () => {
    const helper = new ExportHelper()

    let clickSpy: ReturnType<typeof vi.fn>
    let createObjectURLSpy: ReturnType<typeof vi.fn>
    let revokeObjectURLSpy: ReturnType<typeof vi.fn>
    let mockAnchor: {href: string; download: string; click: ReturnType<typeof vi.fn>}

    beforeEach(() => {
        clickSpy = vi.fn()
        createObjectURLSpy = vi.fn().mockReturnValue('blob:mock-url')
        revokeObjectURLSpy = vi.fn()

        mockAnchor = {href: '', download: '', click: clickSpy}

        vi.stubGlobal('URL', {
            createObjectURL: createObjectURLSpy,
            revokeObjectURL: revokeObjectURLSpy,
        })
        vi.stubGlobal('document', {
            createElement: vi.fn().mockReturnValue(mockAnchor),
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('exportTeams', () => {
        const teams: Team[] = [
            {id: 't1', name: 'Alpha', agents: []},
            {id: 't2', name: 'Beta', agents: []},
        ]

        it('creates a Blob with the JSON-serialised teams', () => {
            helper.exportTeams(teams)
            expect(createObjectURLSpy).toHaveBeenCalledOnce()
            const blob: Blob = createObjectURLSpy.mock.calls[0][0] as Blob
            expect(blob).toBeInstanceOf(Blob)
            expect(blob.type).toBe('application/json')
        })

        it('sets the download filename with the kuku-team-inventory prefix', () => {
            helper.exportTeams(teams)
            expect(mockAnchor.download).toMatch(/^kuku-team-inventory-/)
        })

        it('sets href to the object URL', () => {
            helper.exportTeams(teams)
            expect(mockAnchor.href).toBe('blob:mock-url')
        })

        it('triggers a click on the anchor', () => {
            helper.exportTeams(teams)
            expect(clickSpy).toHaveBeenCalledOnce()
        })

        it('revokes the object URL after clicking', () => {
            helper.exportTeams(teams)
            expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
        })

        it('serialises teams data in the blob', async () => {
            helper.exportTeams(teams)
            const blob: Blob = createObjectURLSpy.mock.calls[0][0] as Blob
            const text = await blob.text()
            expect(JSON.parse(text)).toEqual(teams)
        })

        it('works with an empty teams array', () => {
            expect(() => helper.exportTeams([])).not.toThrow()
            expect(clickSpy).toHaveBeenCalledOnce()
        })
    })
})
