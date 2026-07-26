jest.mock("../../../db", () => ({}))

import { minifluxServiceHooks, MinifluxConfigs } from "../miniflux"
import { SyncService } from "../../../../schema-types"
import { RSSSource } from "../../source"
import { AppDispatch } from "../../../utils"

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

function makeConfigs(overrides: Partial<MinifluxConfigs> = {}): MinifluxConfigs {
    return {
        type: SyncService.Miniflux,
        endpoint: "https://miniflux.example.com",
        apiKeyAuth: true,
        authKey: "token",
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

describe("miniflux fetchAPI url and auth handling", () => {
    it("normalizes the endpoint to /v1/ and sends the token header", async () => {
        mockJsonOnce({})
        await minifluxServiceHooks.authenticate(makeConfigs())
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe("https://miniflux.example.com/v1/me")
        expect((init.headers as Headers).get("X-Auth-Token")).toBe("token")
    })

    it("uses basic auth when apiKeyAuth is false", async () => {
        mockJsonOnce({})
        await minifluxServiceHooks.authenticate(makeConfigs({ apiKeyAuth: false, authKey: "dXNlcjpwYXNz" }))
        const init = mockFetch.mock.calls[0][1]
        expect((init.headers as Headers).get("Authorization")).toBe("Basic dXNlcjpwYXNz")
    })
})

describe("minifluxServiceHooks.authenticate", () => {
    it("returns true when /me has no error", async () => {
        mockJsonOnce({ id: 1, username: "user" })
        await expect(minifluxServiceHooks.authenticate(makeConfigs())).resolves.toBe(true)
    })

    it("returns false when /me returns an error message", async () => {
        mockJsonOnce({ error_message: "unauthorized" })
        await expect(minifluxServiceHooks.authenticate(makeConfigs())).resolves.toBe(false)
    })
})

describe("minifluxServiceHooks.updateSources", () => {
    it("maps feeds to sources and categories to a groups map", async () => {
        const state = { service: makeConfigs({ importGroups: true }), groups: [] }
        mockJsonOnce([{ title: "News" }]) // categories
        mockJsonOnce([
            {
                id: 5,
                feed_url: "https://a.com/feed",
                title: "A",
                category: { title: "News" },
            },
        ])
        const [sources, groupsMap] = await runThunk(
            minifluxServiceHooks.updateSources() as never,
            state
        )
        expect(sources).toHaveLength(1)
        expect(sources[0]).toBeInstanceOf(RSSSource)
        expect(sources[0].serviceRef).toBe("5")
        expect(groupsMap.get("5")).toBe("News")
    })

    it("omits the groups map when importGroups is off", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce([
            { id: 5, feed_url: "https://a.com/feed", title: "A", category: { title: "News" } },
        ])
        const [, groupsMap] = await runThunk(
            minifluxServiceHooks.updateSources() as never,
            state
        )
        expect(groupsMap).toBeUndefined()
    })
})

describe("minifluxServiceHooks.fetchItems", () => {
    it("parses entries into RSSItem shape", async () => {
        const configs = makeConfigs({ lastId: 0 })
        const source = new RSSSource("https://a.com/feed", "A")
        source.sid = 1
        source.serviceRef = "5"
        const state = { service: configs, sources: { 1: source } }
        mockJsonOnce({
            total: 1,
            entries: [
                {
                    id: 100,
                    status: "unread",
                    title: "Hello",
                    url: "https://a.com/1",
                    published_at: "2026-01-01T00:00:00Z",
                    created_at: "2026-01-01T00:00:00Z",
                    content: "<p>hi <img src='https://a.com/x.png'></p>",
                    author: "alice",
                    starred: true,
                    feed: { id: 5, feed_url: "https://a.com/feed", title: "A", category: { title: "c" } },
                },
            ],
        })
        const [items, nextConfigs] = await runThunk(
            minifluxServiceHooks.fetchItems() as never,
            state
        )
        expect(items).toHaveLength(1)
        expect(items[0].source).toBe(1)
        expect(items[0].hasRead).toBe(false)
        expect(items[0].starred).toBe(true)
        expect(items[0].serviceRef).toBe("100")
        expect(items[0].thumb).toBe("https://a.com/x.png")
        expect(nextConfigs.lastId).toBe(100)
    })

    it("returns empty when no entries", async () => {
        const state = { service: makeConfigs({ lastId: 7 }), sources: {} }
        mockJsonOnce({ total: 0, entries: [] })
        const [items, configs] = await runThunk(
            minifluxServiceHooks.fetchItems() as never,
            state
        )
        expect(items).toEqual([])
        expect(configs.lastId).toBe(7)
    })
})

describe("minifluxServiceHooks.syncItems", () => {
    it("pages through unread and starred ids", async () => {
        const state = { service: makeConfigs() }
        mockFetch.mockImplementation(async url => ({
            ok: true,
            status: 200,
            json: async () =>
                String(url).includes("status=unread")
                    ? { total: 2, entries: [{ id: 1 }, { id: 2 }] }
                    : { total: 1, entries: [{ id: 2 }] },
        }))
        const [unread, starred] = await runThunk(
            minifluxServiceHooks.syncItems() as never,
            state
        )
        expect(unread).toEqual(new Set(["1", "2"]))
        expect(starred).toEqual(new Set(["2"]))
    })
})

describe("minifluxServiceHooks.markRead", () => {
    it("PUTs the entry id with read status", async () => {
        const state = { service: makeConfigs() }
        mockFetch.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) })
        await runThunk(
            (minifluxServiceHooks.markRead as CallableFunction)({ serviceRef: "9" }),
            state
        )
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe("https://miniflux.example.com/v1/entries")
        expect(init.method).toBe("PUT")
        expect(JSON.parse(init.body)).toEqual({ entry_ids: [9], status: "read" })
    })

    it("throws when the API rejects", async () => {
        const state = { service: makeConfigs() }
        mockFetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })
        await expect(
            runThunk(
                (minifluxServiceHooks.markRead as CallableFunction)({ serviceRef: "9" }),
                state
            )
        ).rejects.toThrow()
    })

    it("skips items without serviceRef", async () => {
        const state = { service: makeConfigs() }
        await runThunk((minifluxServiceHooks.markRead as CallableFunction)({}), state)
        expect(mockFetch).not.toHaveBeenCalled()
    })
})
