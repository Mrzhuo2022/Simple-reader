jest.mock("../../../db", () => ({}))

import { feedbinServiceHooks, FeedbinConfigs } from "../feedbin"
import { SyncService } from "../../../../schema-types"
import { RSSSource } from "../../source"
import { AppDispatch } from "../../../utils"

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

function makeConfigs(overrides: Partial<FeedbinConfigs> = {}): FeedbinConfigs {
    return {
        type: SyncService.Feedbin,
        endpoint: "https://api.feedbin.com/v2/",
        username: "user",
        password: "pass",
        fetchLimit: 250,
        ...overrides,
    }
}

function mockJsonOnce(payload: unknown, status = 200) {
    mockFetch.mockResolvedValueOnce({
        ok: status >= 200 && status < 300,
        status: status,
        json: async () => payload,
    })
}

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

describe("feedbinServiceHooks.authenticate", () => {
    it("returns true on 200 with basic auth header", async () => {
        mockJsonOnce({}, 200)
        await expect(feedbinServiceHooks.authenticate(makeConfigs())).resolves.toBe(true)
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe("https://api.feedbin.com/v2/authentication.json")
        expect((init.headers as Headers).get("Authorization")).toBe("Basic " + btoa("user:pass"))
    })

    it("returns false on 401", async () => {
        mockJsonOnce({}, 401)
        await expect(feedbinServiceHooks.authenticate(makeConfigs())).resolves.toBe(false)
    })

    it("returns false when fetch throws", async () => {
        mockFetch.mockRejectedValueOnce(new Error("network"))
        await expect(feedbinServiceHooks.authenticate(makeConfigs())).resolves.toBe(false)
    })
})

describe("feedbinServiceHooks.updateSources", () => {
    it("maps subscriptions and taggings to sources and groups", async () => {
        const state = { service: makeConfigs({ importGroups: true }), groups: [] }
        mockJsonOnce([
            { feed_id: 1, feed_url: "https://a.com/feed", title: "A" },
            { feed_id: 2, feed_url: "https://b.com/feed", title: "B" },
        ])
        mockJsonOnce([{ id: 10, feed_id: 1, name: " News " }])
        const [sources, groupsMap] = await runThunk(
            feedbinServiceHooks.updateSources() as never,
            state
        )
        expect(sources).toHaveLength(2)
        expect(sources[0]).toBeInstanceOf(RSSSource)
        expect(sources[0].serviceRef).toBe("1")
        expect(groupsMap.get("1")).toBe("News")
        expect(groupsMap.has("2")).toBe(false)
    })

    it("throws on non-200", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce({}, 500)
        await expect(
            runThunk(feedbinServiceHooks.updateSources() as never, state)
        ).rejects.toThrow()
    })
})

describe("feedbinServiceHooks.syncItems", () => {
    it("returns unread and starred id sets as strings", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce([1, 2])
        mockJsonOnce([2])
        const [unread, starred] = await runThunk(feedbinServiceHooks.syncItems() as never, state)
        expect(unread).toEqual(new Set(["1", "2"]))
        expect(starred).toEqual(new Set(["2"]))
    })

    it("throws when either request fails", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce([1], 200)
        mockJsonOnce({}, 500)
        await expect(runThunk(feedbinServiceHooks.syncItems() as never, state)).rejects.toThrow()
    })
})

describe("feedbinServiceHooks.fetchItems", () => {
    it("parses entries with unread/starred state", async () => {
        const source = new RSSSource("https://a.com/feed", "A")
        source.sid = 1
        source.serviceRef = "5"
        const state = {
            service: makeConfigs({ lastId: 0 }),
            sources: { 1: source },
        }
        // entries page 1
        mockJsonOnce([
            {
                id: 100,
                feed_id: 5,
                title: "Hello",
                author: "alice",
                content: "<p>body <img src='https://a.com/x.png'></p>",
                url: "https://a.com/1",
                published: "2026-01-01T00:00:00Z",
                created_at: "2026-01-01T00:00:01Z",
            },
        ])
        // unread + starred
        mockJsonOnce([100])
        mockJsonOnce([])
        const [items, configs] = await runThunk(feedbinServiceHooks.fetchItems() as never, state)
        expect(items).toHaveLength(1)
        expect(items[0].source).toBe(1)
        expect(items[0].hasRead).toBe(false)
        expect(items[0].starred).toBe(false)
        expect(items[0].serviceRef).toBe("100")
        expect(items[0].thumb).toBe("https://a.com/x.png")
        expect((configs as FeedbinConfigs).lastId).toBe(100)
    })

    it("returns empty when nothing new", async () => {
        const state = { service: makeConfigs({ lastId: 100 }), sources: {} }
        mockJsonOnce([])
        const [items, configs] = await runThunk(feedbinServiceHooks.fetchItems() as never, state)
        expect(items).toEqual([])
        expect((configs as FeedbinConfigs).lastId).toBe(100)
    })
})

describe("feedbin mark actions", () => {
    it("markRead DELETEs unread_entries with the id", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce({})
        await runThunk(
            (feedbinServiceHooks.markRead as CallableFunction)({ serviceRef: "9" }),
            state
        )
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe("https://api.feedbin.com/v2/unread_entries.json")
        expect(init.method).toBe("DELETE")
        expect(JSON.parse(init.body)).toEqual({ unread_entries: [9] })
    })

    it("star POSTs starred_entries with the id", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce({})
        await runThunk(
            (feedbinServiceHooks.star as CallableFunction)({ serviceRef: "9" }),
            state
        )
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe("https://api.feedbin.com/v2/starred_entries.json")
        expect(init.method).toBe("POST")
        expect(JSON.parse(init.body)).toEqual({ starred_entries: [9] })
    })
})
