jest.mock("../../../db", () => ({}))

import { feverServiceHooks, FeverConfigs } from "../fever"
import { SyncService } from "../../../../schema-types"
import { RSSSource } from "../../source"
import { AppDispatch } from "../../../utils"

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

function makeConfigs(overrides: Partial<FeverConfigs> = {}): FeverConfigs {
    return {
        type: SyncService.Fever,
        endpoint: "https://rss.example.com/fever.php",
        username: "user",
        apiKey: "key",
        fetchLimit: 250,
        ...overrides,
    }
}

function mockJsonOnce(payload: unknown) {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => payload,
    })
}

/** Runs a fever thunk with a fake store. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function runThunk(thunk: unknown, state: unknown): any {
    const dispatch = jest.fn(action => (typeof action === "function" ? action(dispatch, () => state) : action))
    return (thunk as (dispatch: AppDispatch, getState: () => unknown) => unknown)(
        dispatch as unknown as AppDispatch,
        () => state
    )
}

beforeEach(() => {
    mockFetch.mockReset()
})

describe("feverServiceHooks.authenticate", () => {
    it("returns true when the API reports auth success", async () => {
        mockJsonOnce({ auth: 1 })
        await expect(feverServiceHooks.authenticate(makeConfigs())).resolves.toBe(true)
        // api_key must be in the POST body
        const body = mockFetch.mock.calls[0][1].body as string
        expect(body).toContain("api_key=key")
    })

    it("returns false when auth fails", async () => {
        mockJsonOnce({ auth: 0 })
        await expect(feverServiceHooks.authenticate(makeConfigs())).resolves.toBe(false)
    })

    it("returns false when the request throws", async () => {
        mockFetch.mockRejectedValueOnce(new Error("network"))
        await expect(feverServiceHooks.authenticate(makeConfigs())).resolves.toBe(false)
    })
})

describe("feverServiceHooks.updateSources", () => {
    it("maps feeds to RSSSource with serviceRef", async () => {
        mockJsonOnce({
            feeds: [
                { id: 1, url: "https://a.com/feed", title: "A" },
                { id: 2, url: "https://b.com/feed", title: "B" },
            ],
            feeds_groups: [],
        })
        const state = { service: makeConfigs() }
        const [sources, groupsMap] = await runThunk(
            feverServiceHooks.updateSources() as never,
            state
        )
        expect(sources).toHaveLength(2)
        expect(sources[0]).toBeInstanceOf(RSSSource)
        expect(sources[0].serviceRef).toBe("1")
        expect(sources[0].url).toBe("https://a.com/feed")
        expect(sources[1].name).toBe("B")
        expect(groupsMap).toBeUndefined()
    })

    it("throws when feeds are missing from the response", async () => {
        mockJsonOnce({})
        const state = { service: makeConfigs() }
        await expect(
            runThunk(feverServiceHooks.updateSources() as never, state)
        ).rejects.toThrow()
    })
})

describe("feverServiceHooks.fetchItems", () => {
    it("parses fetched items into RSSItem shape", async () => {
        const configs = makeConfigs({ lastId: 0 })
        const source = new RSSSource("https://a.com/feed", "A")
        source.sid = 1
        source.serviceRef = "1"
        const state = {
            service: configs,
            sources: { 1: source },
        }
        mockJsonOnce({
            items: [
                {
                    id: 10,
                    feed_id: 1,
                    title: "Hello",
                    author: "alice",
                    html: "<p>content <img src='https://a.com/img.png'/></p>",
                    url: "https://a.com/1",
                    is_read: 0,
                    is_saved: 1,
                    created_on_time: 1700000000,
                },
            ],
        })
        const [items, nextConfigs] = await runThunk(
            feverServiceHooks.fetchItems() as never,
            state
        )
        expect(items).toHaveLength(1)
        expect(items[0].title).toBe("Hello")
        expect(items[0].source).toBe(1)
        expect(items[0].hasRead).toBe(false)
        expect(items[0].starred).toBe(true)
        expect(items[0].serviceRef).toBe("10")
        expect(items[0].thumb).toBe("https://a.com/img.png")
        expect(items[0].date).toEqual(new Date(1700000000 * 1000))
        expect(nextConfigs.lastId).toBe(10)
    })

    it("returns empty when there are no new items", async () => {
        const state = {
            service: makeConfigs({ lastId: 10 }),
            sources: {},
        }
        mockJsonOnce({ items: [] })
        // The int32 fallback triggers a second request
        mockJsonOnce({ items: [] })
        const [items] = await runThunk(feverServiceHooks.fetchItems() as never, state)
        expect(items).toEqual([])
    })

    it("throws when the items response is malformed", async () => {
        const state = { service: makeConfigs(), sources: {} }
        mockJsonOnce({ bad: true })
        await expect(runThunk(feverServiceHooks.fetchItems() as never, state)).rejects.toThrow()
    })
})

describe("feverServiceHooks.syncItems", () => {
    it("returns unread and starred id sets", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce({ unread_item_ids: "1,2,3" })
        mockJsonOnce({ saved_item_ids: "2" })
        const [unread, starred] = await runThunk(feverServiceHooks.syncItems() as never, state)
        expect(unread).toEqual(new Set(["1", "2", "3"]))
        expect(starred).toEqual(new Set(["2"]))
    })

    it("throws on malformed response", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce({ unread_item_ids: 42 })
        mockJsonOnce({ saved_item_ids: "2" })
        await expect(runThunk(feverServiceHooks.syncItems() as never, state)).rejects.toThrow()
    })
})

describe("feverServiceHooks mark actions", () => {
    const item = { serviceRef: "7" }

    it("sends the correct mark commands", async () => {
        const state = { service: makeConfigs() }
        const cases: Array<[keyof typeof feverServiceHooks, string]> = [
            ["markRead", "&mark=item&as=read&id=7"],
            ["markUnread", "&mark=item&as=unread&id=7"],
            ["star", "&mark=item&as=saved&id=7"],
            ["unstar", "&mark=item&as=unsaved&id=7"],
        ]
        for (const [hook, expected] of cases) {
            mockJsonOnce({})
            await runThunk((feverServiceHooks[hook] as CallableFunction)(item), state)
            const body = mockFetch.mock.calls.at(-1)[1].body as string
            expect(body).toContain(expected)
        }
    })

    it("skips items without serviceRef", async () => {
        const state = { service: makeConfigs() }
        await runThunk((feverServiceHooks.markRead as CallableFunction)({}), state)
        expect(mockFetch).not.toHaveBeenCalled()
    })
})
