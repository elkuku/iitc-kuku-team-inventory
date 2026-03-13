import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {LayerHelper} from './LayerHelper'
import type {KeyInfo} from '../../types/Types'

const makeKeyInfo = (guid: string, overrides: Partial<KeyInfo> = {}): KeyInfo => ({
    portal: {guid, title: 'Test Portal', lat: 51.5, lng: -0.1},
    total: 3,
    agentCounts: new Map(),
    ...overrides,
})

const makePortal = (guid: string) => ({options: {guid}} as unknown as IITC.Portal)

describe('LayerHelper', () => {
    let mockLayerGroup: {addLayer: ReturnType<typeof vi.fn>; removeLayer: ReturnType<typeof vi.fn>}
    let mockMarker: object

    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    const makeMockLayerGroupClass = () => class { constructor() { return mockLayerGroup as unknown as this } }
    const MockLatLng = class { lat = 0; lng = 0; constructor(lat: number, lng: number) { this.lat = lat; this.lng = lng } }
    // eslint-disable-next-line @typescript-eslint/no-extraneous-class
    const MockDivIcon = class { constructor(options: {html: string}) { return options as unknown as this } }

    const buildCapturingL = (htmlCaptures: string[]) => ({
        LayerGroup: makeMockLayerGroupClass(),
        marker: vi.fn().mockImplementation((_pos: unknown, options: {icon: {html: string}}) => {
            htmlCaptures.push(options.icon.html ?? '')
            return mockMarker
        }),
        LatLng: MockLatLng,
        DivIcon: MockDivIcon,
    })

    beforeEach(() => {
        mockLayerGroup = {addLayer: vi.fn(), removeLayer: vi.fn()}
        mockMarker = {}
        vi.stubGlobal('L', {
            LayerGroup: makeMockLayerGroupClass(),
            marker: vi.fn().mockReturnValue(mockMarker),
            LatLng: MockLatLng,
            DivIcon: MockDivIcon,
        })
        vi.stubGlobal('window', {
            addLayerGroup: vi.fn(),
            portals: {} as Record<string, unknown>,
            map: {on: vi.fn(), hasLayer: vi.fn().mockReturnValue(true)},
            plugin: {},
        })
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    // -----------------------------------------------------------------------
    // Constructor
    // -----------------------------------------------------------------------

    describe('constructor', () => {
        it('registers layer group with window.addLayerGroup', () => {
            const helper = new LayerHelper('TestLayer')
            // eslint-disable-next-line @typescript-eslint/no-deprecated
            expect(window.addLayerGroup).toHaveBeenCalledWith('TestLayer', mockLayerGroup, true)
            expect(helper).toBeDefined()
        })
    })

    // -----------------------------------------------------------------------
    // setDisplayMode
    // -----------------------------------------------------------------------

    describe('setDisplayMode', () => {
        it('updates display mode and refreshes markers', () => {
            const guid = 'portal-1'
            vi.stubGlobal('window', {
                addLayerGroup: vi.fn(),
                portals: {[guid]: makePortal(guid)},
                map: {on: vi.fn(), hasLayer: vi.fn().mockReturnValue(true)},
                plugin: {},
            })
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid)]]))
            mockLayerGroup.addLayer.mockClear()
            helper.setDisplayMode('icon')
            expect(mockLayerGroup.addLayer).toHaveBeenCalled()
        })
    })

    // -----------------------------------------------------------------------
    // setFocusedAgent
    // -----------------------------------------------------------------------

    describe('setFocusedAgent', () => {
        it('sets agent without throwing', () => {
            const helper = new LayerHelper('TestLayer')
            expect(() => helper.setFocusedAgent('AgentX')).not.toThrow()
        })

        it('clears focused agent when called with undefined', () => {
            const helper = new LayerHelper('TestLayer')
            helper.setFocusedAgent('AgentX')
            expect(() => helper.setFocusedAgent(undefined)).not.toThrow()
        })
    })

    // -----------------------------------------------------------------------
    // setKeys / registerMapLayerEvents
    // -----------------------------------------------------------------------

    describe('setKeys', () => {
        it('registers layerremove and layeradd map events once', () => {
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map())
            expect(window.map.on).toHaveBeenCalledTimes(2)
            const eventNames = (window.map.on as ReturnType<typeof vi.fn>).mock.calls.map(
                (call: unknown[]) => call[0]
            )
            expect(eventNames).toContain('layerremove')
            expect(eventNames).toContain('layeradd')
        })

        it('does not register map events again on second call', () => {
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map())
            helper.setKeys(new Map())
            expect(window.map.on).toHaveBeenCalledTimes(2)
        })

        it('handles absent window.map gracefully', () => {
            vi.stubGlobal('window', {
                addLayerGroup: vi.fn(),
                portals: {},
                map: undefined,
                plugin: {},
            })
            const helper = new LayerHelper('TestLayer')
            expect(() => helper.setKeys(new Map())).not.toThrow()
        })
    })

    // -----------------------------------------------------------------------
    // onPortalAdded
    // -----------------------------------------------------------------------

    describe('onPortalAdded', () => {
        it('skips portals with no key entry', () => {
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map())
            helper.onPortalAdded(makePortal('unknown-guid'))
            expect(mockLayerGroup.addLayer).not.toHaveBeenCalled()
        })

        it('adds a marker when portal has a key entry', () => {
            const guid = 'portal-a'
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid)]]))
            mockLayerGroup.addLayer.mockClear()
            helper.onPortalAdded(makePortal(guid))
            expect(mockLayerGroup.addLayer).toHaveBeenCalledOnce()
        })

        it('does not add duplicate marker', () => {
            const guid = 'portal-b'
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid)]]))
            mockLayerGroup.addLayer.mockClear()
            helper.onPortalAdded(makePortal(guid))
            helper.onPortalAdded(makePortal(guid))
            expect(mockLayerGroup.addLayer).toHaveBeenCalledTimes(1)
        })
    })

    // -----------------------------------------------------------------------
    // onPortalRemoved
    // -----------------------------------------------------------------------

    describe('onPortalRemoved', () => {
        it('does nothing when no marker exists', () => {
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map())
            expect(() => helper.onPortalRemoved(makePortal('no-marker'))).not.toThrow()
            expect(mockLayerGroup.removeLayer).not.toHaveBeenCalled()
        })

        it('removes the existing marker', () => {
            const guid = 'portal-c'
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid)]]))
            mockLayerGroup.addLayer.mockClear()
            mockLayerGroup.removeLayer.mockClear()
            helper.onPortalAdded(makePortal(guid))
            helper.onPortalRemoved(makePortal(guid))
            expect(mockLayerGroup.removeLayer).toHaveBeenCalledOnce()
        })
    })

    // -----------------------------------------------------------------------
    // onPortalSelected
    // -----------------------------------------------------------------------

    describe('onPortalSelected', () => {
        it('does nothing when no markers exist for the guids', () => {
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map())
            expect(() => helper.onPortalSelected({selectedPortalGuid: 'none', unselectedPortalGuid: 'also-none'})).not.toThrow()
        })

        it('re-creates marker with showDetails=false when unselected', () => {
            const guid = 'portal-d'
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid)]]))
            mockLayerGroup.addLayer.mockClear()
            mockLayerGroup.removeLayer.mockClear()
            helper.onPortalAdded(makePortal(guid))
            helper.onPortalSelected({unselectedPortalGuid: guid})
            expect(mockLayerGroup.removeLayer).toHaveBeenCalled()
            expect(mockLayerGroup.addLayer).toHaveBeenCalled()
        })

        it('re-creates marker with showDetails=true when selected', () => {
            const guid = 'portal-e'
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid)]]))
            mockLayerGroup.addLayer.mockClear()
            mockLayerGroup.removeLayer.mockClear()
            helper.onPortalAdded(makePortal(guid))
            helper.onPortalSelected({selectedPortalGuid: guid})
            expect(mockLayerGroup.removeLayer).toHaveBeenCalled()
            expect(mockLayerGroup.addLayer).toHaveBeenCalled()
        })
    })

    // -----------------------------------------------------------------------
    // createMarker HTML output
    // -----------------------------------------------------------------------

    describe('createMarker HTML output', () => {
        it('icon mode: HTML contains team-key-bubble--icon and <svg', () => {
            const htmlCaptures: string[] = []
            vi.stubGlobal('L', buildCapturingL(htmlCaptures))
            const guid = 'g-icon'
            const helper = new LayerHelper('TestLayer')
            helper.setDisplayMode('icon')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid)]]))
            helper.onPortalAdded(makePortal(guid))
            const html = htmlCaptures.at(-1) ?? ''
            expect(html).toContain('team-key-bubble--icon')
            expect(html).toContain('<svg')
        })

        it('count mode: HTML contains total count', () => {
            const htmlCaptures: string[] = []
            vi.stubGlobal('L', buildCapturingL(htmlCaptures))
            const guid = 'g-count'
            const helper = new LayerHelper('TestLayer')
            helper.setDisplayMode('count')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid, {total: 7})]]))
            helper.onPortalAdded(makePortal(guid))
            const html = htmlCaptures.at(-1) ?? ''
            expect(html).toContain('7')
        })

        it('focused agent with keys: HTML contains focused count and team-key-bubble--focused', () => {
            const htmlCaptures: string[] = []
            vi.stubGlobal('L', buildCapturingL(htmlCaptures))
            const guid = 'g-focus'
            const agentCounts = new Map([['AgentA', 2]])
            const helper = new LayerHelper('TestLayer')
            helper.setDisplayMode('count')
            helper.setFocusedAgent('AgentA')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid, {total: 5, agentCounts})]]))
            helper.onPortalAdded(makePortal(guid))
            const html = htmlCaptures.at(-1) ?? ''
            expect(html).toContain('2')
            expect(html).toContain('team-key-bubble--focused')
        })

        it('focused agent without keys: HTML contains team-key-bubble--unfocused', () => {
            const htmlCaptures: string[] = []
            vi.stubGlobal('L', buildCapturingL(htmlCaptures))
            const guid = 'g-unfocus'
            const helper = new LayerHelper('TestLayer')
            helper.setDisplayMode('count')
            helper.setFocusedAgent('AgentNotHere')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid, {total: 3, agentCounts: new Map()})]]))
            helper.onPortalAdded(makePortal(guid))
            const html = htmlCaptures.at(-1) ?? ''
            expect(html).toContain('team-key-bubble--unfocused')
        })

        it('icon mode + focused + has key: both --icon and --focused', () => {
            const htmlCaptures: string[] = []
            vi.stubGlobal('L', buildCapturingL(htmlCaptures))
            const guid = 'g-icon-focused'
            const agentCounts = new Map([['AgentB', 1]])
            const helper = new LayerHelper('TestLayer')
            helper.setDisplayMode('icon')
            helper.setFocusedAgent('AgentB')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid, {total: 4, agentCounts})]]))
            helper.onPortalAdded(makePortal(guid))
            const html = htmlCaptures.at(-1) ?? ''
            expect(html).toContain('team-key-bubble--icon')
            expect(html).toContain('team-key-bubble--focused')
        })

        it('icon mode + focused + no key: both --icon and --unfocused', () => {
            const htmlCaptures: string[] = []
            vi.stubGlobal('L', buildCapturingL(htmlCaptures))
            const guid = 'g-icon-unfocused'
            const helper = new LayerHelper('TestLayer')
            helper.setDisplayMode('icon')
            helper.setFocusedAgent('AgentNone')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid, {total: 2, agentCounts: new Map()})]]))
            helper.onPortalAdded(makePortal(guid))
            const html = htmlCaptures.at(-1) ?? ''
            expect(html).toContain('team-key-bubble--icon')
            expect(html).toContain('team-key-bubble--unfocused')
        })

        it('details view with agent counts: HTML contains agent name, total, --details', () => {
            const htmlCaptures: string[] = []
            vi.stubGlobal('L', buildCapturingL(htmlCaptures))
            const guid = 'g-details'
            const agentCounts = new Map([['AgentC', 3]])
            const helper = new LayerHelper('TestLayer')
            helper.setDisplayMode('count')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid, {total: 3, agentCounts})]]))
            helper.onPortalAdded(makePortal(guid))
            helper.onPortalSelected({selectedPortalGuid: guid})
            const html = htmlCaptures.at(-1) ?? ''
            expect(html).toContain('AgentC')
            expect(html).toContain('3')
            expect(html).toContain('team-key-bubble--details')
        })

        it('combined inv/team count: HTML contains both inv total and team total', () => {
            const htmlCaptures: string[] = []
            vi.stubGlobal('L', buildCapturingL(htmlCaptures))
            const guid = 'g-inv'
            const invLayerHelper = {
                keys: new Map([[guid, {total: 10}]]),
                markers: new Map<string, unknown>(),
                layerGroup: {removeLayer: vi.fn()},
                onPortalAdded: vi.fn(),
            }
            vi.stubGlobal('window', {
                addLayerGroup: vi.fn(),
                portals: {},
                map: {on: vi.fn(), hasLayer: vi.fn().mockReturnValue(true)},
                plugin: {KuKuInventory: {layerHelper: invLayerHelper}},
            })
            const helper = new LayerHelper('TestLayer')
            helper.setDisplayMode('count')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid, {total: 5})]]))
            helper.onPortalAdded(makePortal(guid))
            const html = htmlCaptures.at(-1) ?? ''
            expect(html).toContain('10')
            expect(html).toContain('5')
        })

        it('details view + invInfo with atHand and capsule: HTML contains Hand, capsule name, agent name', () => {
            const htmlCaptures: string[] = []
            vi.stubGlobal('L', buildCapturingL(htmlCaptures))
            const guid = 'g-details-inv'
            const capsuleKey = 'CAP-XY'
            const capsuleName = 'My Capsule'
            const invLayerHelper = {
                keys: new Map([[guid, {total: 8, atHand: 1, capsules: new Map([[capsuleKey, 2]])}]]),
                markers: new Map<string, unknown>(),
                layerGroup: {removeLayer: vi.fn()},
                onPortalAdded: vi.fn(),
            }
            vi.stubGlobal('window', {
                addLayerGroup: vi.fn(),
                portals: {},
                map: {on: vi.fn(), hasLayer: vi.fn().mockReturnValue(true)},
                plugin: {
                    KuKuInventory: {
                        layerHelper: invLayerHelper,
                        capsuleNames: {[capsuleKey]: capsuleName},
                    },
                },
            })
            const agentCounts = new Map([['AgentD', 2]])
            const helper = new LayerHelper('TestLayer')
            helper.setDisplayMode('count')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid, {total: 5, agentCounts})]]))
            helper.onPortalAdded(makePortal(guid))
            helper.onPortalSelected({selectedPortalGuid: guid})
            const html = htmlCaptures.at(-1) ?? ''
            expect(html).toContain('Hand: 1')
            expect(html).toContain(capsuleName)
            expect(html).toContain('AgentD')
        })
    })

    // -----------------------------------------------------------------------
    // maybeSupressInventoryLayer
    // -----------------------------------------------------------------------

    describe('maybeSupressInventoryLayer', () => {
        it('removes overlapping inv markers when KuKuInventory is loaded', () => {
            const guid = 'portal-inv'
            const invMarker = {}
            const invLayerGroup = {removeLayer: vi.fn()}
            const invLayerHelper = {
                keys: new Map([[guid, {total: 2}]]),
                markers: new Map([[guid, invMarker]]),
                layerGroup: invLayerGroup,
                onPortalAdded: vi.fn(),
            }
            vi.stubGlobal('window', {
                addLayerGroup: vi.fn(),
                portals: {},
                map: {on: vi.fn(), hasLayer: vi.fn().mockReturnValue(true)},
                plugin: {KuKuInventory: {layerHelper: invLayerHelper}},
            })
            const helper = new LayerHelper('TestLayer')
            helper.setKeys(new Map([[guid, makeKeyInfo(guid)]]))
            expect(invLayerGroup.removeLayer).toHaveBeenCalledWith(invMarker)
        })
    })

    // -----------------------------------------------------------------------
    // map layer events
    // -----------------------------------------------------------------------

    describe('map layer events', () => {
        it('onTeamLayerShown: removes inv markers that overlap with team keys', () => {
            const guid = 'portal-shown'
            const invMarker = {}
            const invLayerGroup = {removeLayer: vi.fn()}
            const invLayerHelper = {
                keys: new Map([[guid, {total: 1}]]),
                markers: new Map([[guid, invMarker]]),
                layerGroup: invLayerGroup,
                onPortalAdded: vi.fn(),
            }

            const capturedHandlers: Record<string, (event: unknown) => void> = {}
            vi.stubGlobal('window', {
                addLayerGroup: vi.fn(),
                portals: {},
                map: {
                    on: vi.fn((event: string, handler: (event_: unknown) => void) => {
                        capturedHandlers[event] = handler
                    }),
                    hasLayer: vi.fn().mockReturnValue(true),
                },
                plugin: {KuKuInventory: {layerHelper: invLayerHelper}},
            })

            const helper = new LayerHelper('TestLayer')
            const layerGroupReference = (helper as unknown as {layerGroup: unknown}).layerGroup
            helper.setKeys(new Map([[guid, makeKeyInfo(guid)]]))

            // maybeSupressInventoryLayer cleared the inv marker; re-add it so onTeamLayerShown has something to remove
            invLayerHelper.markers.set(guid, invMarker)
            invLayerGroup.removeLayer.mockClear()

            capturedHandlers.layeradd?.({layer: layerGroupReference})
            expect(invLayerGroup.removeLayer).toHaveBeenCalledWith(invMarker)
        })

        it('onTeamLayerHidden: calls invOrigOnAdded for team portals whose inv marker is absent', () => {
            const guid = 'portal-hidden'
            const origOnPortalAdded = vi.fn()
            const invLayerHelper = {
                keys: new Map([[guid, {total: 1}]]),
                markers: new Map<string, unknown>(),
                layerGroup: {removeLayer: vi.fn()},
                onPortalAdded: origOnPortalAdded,
            }

            const capturedHandlers: Record<string, (event: unknown) => void> = {}
            const mockPortal = makePortal(guid)
            vi.stubGlobal('window', {
                addLayerGroup: vi.fn(),
                portals: {[guid]: mockPortal},
                map: {
                    on: vi.fn((event: string, handler: (event_: unknown) => void) => {
                        capturedHandlers[event] = handler
                    }),
                    hasLayer: vi.fn().mockReturnValue(true),
                },
                plugin: {KuKuInventory: {layerHelper: invLayerHelper}},
            })

            const helper = new LayerHelper('TestLayer')
            const layerGroupReference = (helper as unknown as {layerGroup: unknown}).layerGroup
            helper.setKeys(new Map([[guid, makeKeyInfo(guid)]]))

            capturedHandlers.layerremove?.({layer: layerGroupReference})
            expect(origOnPortalAdded).toHaveBeenCalledWith(mockPortal)
        })
    })
})
