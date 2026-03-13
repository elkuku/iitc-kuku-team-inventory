import {describe, it, expect, beforeEach, vi, afterEach} from 'vitest'
import {SidebarHelper} from './SidebarHelper'
import type {KeyInfo} from '../../types/Types'

const makeKeyInfo = (total: number, agentCounts: [string, number][] = []): KeyInfo => ({
    portal: {guid: 'g1', title: 'Portal', lat: 1, lng: 2},
    total,
    agentCounts: new Map(agentCounts),
})

describe('SidebarHelper', () => {
    let helper: SidebarHelper
    let insertAdjacentHTMLSpy: ReturnType<typeof vi.fn>
    let mockTbody: {insertAdjacentHTML: ReturnType<typeof vi.fn>}

    beforeEach(() => {
        insertAdjacentHTMLSpy = vi.fn()
        mockTbody = {insertAdjacentHTML: insertAdjacentHTMLSpy}
        helper = new SidebarHelper()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    describe('onPortalDetailsUpdated', () => {
        it('returns early when data has no guid', () => {
            const querySelectorSpy = vi.fn()
            vi.stubGlobal('document', {querySelector: querySelectorSpy})
            helper.onPortalDetailsUpdated({})
            expect(querySelectorSpy).not.toHaveBeenCalled()
        })

        it('returns early when guid is not in the keys map', () => {
            const querySelectorSpy = vi.fn()
            vi.stubGlobal('document', {querySelector: querySelectorSpy})
            helper.setKeys(new Map())
            helper.onPortalDetailsUpdated({guid: 'unknown'})
            expect(querySelectorSpy).not.toHaveBeenCalled()
        })

        it('returns early when #randdetails tbody is not found', () => {
            vi.stubGlobal('document', {querySelector: vi.fn()})
            helper.setKeys(new Map([['g1', makeKeyInfo(5)]]))
            helper.onPortalDetailsUpdated({guid: 'g1'})
            expect(insertAdjacentHTMLSpy).not.toHaveBeenCalled()
        })

        it('inserts a row showing the total key count', () => {
            vi.stubGlobal('document', {querySelector: vi.fn().mockReturnValue(mockTbody)})
            helper.setKeys(new Map([['g1', makeKeyInfo(7)]]))
            helper.onPortalDetailsUpdated({guid: 'g1'})
            expect(insertAdjacentHTMLSpy).toHaveBeenCalledOnce()
            const [position, html] = insertAdjacentHTMLSpy.mock.calls[0] as [string, string]
            expect(position).toBe('beforeend')
            expect(html).toContain('7')
        })

        it('includes per-agent counts in the inserted HTML', () => {
            vi.stubGlobal('document', {querySelector: vi.fn().mockReturnValue(mockTbody)})
            helper.setKeys(new Map([['g1', makeKeyInfo(5, [['AgentA', 3], ['AgentB', 2]])]]))
            helper.onPortalDetailsUpdated({guid: 'g1'})
            const html = insertAdjacentHTMLSpy.mock.calls[0][1] as string
            expect(html).toContain('AgentA')
            expect(html).toContain('AgentB')
        })

        it('inserts a row without agent details when agentCounts is empty', () => {
            vi.stubGlobal('document', {querySelector: vi.fn().mockReturnValue(mockTbody)})
            helper.setKeys(new Map([['g1', makeKeyInfo(4)]]))
            helper.onPortalDetailsUpdated({guid: 'g1'})
            expect(insertAdjacentHTMLSpy).toHaveBeenCalledOnce()
            const html = insertAdjacentHTMLSpy.mock.calls[0][1] as string
            expect(html).toContain('4')
        })
    })

    describe('setKeys', () => {
        it('updates the internal keys map used by onPortalDetailsUpdated', () => {
            vi.stubGlobal('document', {querySelector: vi.fn().mockReturnValue(mockTbody)})
            helper.setKeys(new Map([['g1', makeKeyInfo(3)]]))
            helper.onPortalDetailsUpdated({guid: 'g1'})
            expect(insertAdjacentHTMLSpy).toHaveBeenCalledOnce()
        })

        it('replacing keys removes previously known portals', () => {
            const querySelectorSpy = vi.fn()
            vi.stubGlobal('document', {querySelector: querySelectorSpy})
            helper.setKeys(new Map([['g1', makeKeyInfo(3)]]))
            helper.setKeys(new Map())
            helper.onPortalDetailsUpdated({guid: 'g1'})
            expect(querySelectorSpy).not.toHaveBeenCalled()
        })
    })
})
