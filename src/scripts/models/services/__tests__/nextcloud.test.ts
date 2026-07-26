jest.mock("../../../db", () => ({}))

import { nextcloudServiceHooks, NextcloudConfigs } from "../nextcloud"
import { SyncService } from "../../../../schema-types"
import { RSSSource } from "../../source"
import { AppDispatch } from "../../../utils"

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

function makeConfigs(overrides: Partial<NextcloudConfigs> = {}): NextcloudConfigs {
    return {
        type: SyncService.Nextcloud,
        endpoint: "https://cloud.example.com/index.php/apps/news/api/v1-3",
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

function makeItem(overrides: Record<string, unknown> = {}) {
    return {
        id: 100,
        feedId: 5,
        title: "Hello",
        author: "alice",
        body: "<p>body <img src='https://a.com/x.png'></p>",
        url: "https://a.com/1",
        unread: true,
        starred: false,
        pubDate: 1700000000,
        lastModified: 1700000100,
        ...overrides,
    }
}

beforeEach(() => {
    mockFetch.mockReset()
})

describe("nextcloudServiceHooks.authenticate", () => {
    it("returns true when /version responds 200", async () => {
        mockJsonOnce({}, 200)
        await expect(nextcloudServiceHooks.authenticate(makeConfigs())).resolves.toBe(true)
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe("https://cloud.example.com/index.php/apps/news/api/v1-3/version")
        expect((init.headers as Headers).get("Authorization")).toBe("Basic " + btoa("user:pass"))
    })

    it("returns false on error status or network failure", async () => {
        mockJsonOnce({}, 401)
        await expect(nextcloudServiceHooks.authenticate(makeConfigs())).resolves.toBe(false)
        mockFetch.mockRejectedValueOnce(new Error("network"))
        await expect(nextcloudServiceHooks.authenticate(makeConfigs())).resolves.toBe(false)
    })
})

describe("nextcloudServiceHooks.updateSources", () => {
    it("maps feeds and folders to sources and groups", async () => {
        const state = { service: makeConfigs({ importGroups: true }), groups: [] }
        mockJsonOnce({
            feeds: [
                {
                    id: 5,
                    url: "https://a.com/feed",
                    title: "A",
                    folderId: 3,
                    faviconLink: "https://a.com/favicon.ico",
                },
                { id: 6, url: "https://b.com/feed", title: "B" },
            ],
        })
        mockJsonOnce({ folders: [{ id: 3, name: " News " }] })
        const [sources, groupsMap] = await runThunk(
            nextcloudServiceHooks.updateSources() as never,
            state
        )
        expect(sources).toHaveLength(2)
        expect(sources[0]).toBeInstanceOf(RSSSource)
        expect(sources[0].serviceRef).toBe("5")
        expect(sources[0].iconurl).toBe("https://a.com/favicon.ico")
        expect(groupsMap.get("5")).toBe("News")
        expect(groupsMap.has("6")).toBe(false)
    })

    it("throws on non-200", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce({}, 500)
        await expect(
            runThunk(nextcloudServiceHooks.updateSources() as never, state)
        ).rejects.toThrow()
    })
})

describe("nextcloudServiceHooks.syncItems", () => {
    it("returns unread and starred id sets", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce({ items: [{ id: 1 }, { id: 2 }] })
        mockJsonOnce({ items: [{ id: 2 }] })
        const [unread, starred] = await runThunk(
            nextcloudServiceHooks.syncItems() as never,
            state
        )
        expect(unread).toEqual(new Set(["1", "2"]))
        expect(starred).toEqual(new Set(["2"]))
    })
})

describe("nextcloudServiceHooks.fetchItems", () => {
    it("does a full fetch on first sync and parses items", async () => {
        const source = new RSSSource("https://a.com/feed", "A")
        source.sid = 1
        source.serviceRef = "5"
        const state = {
            service: makeConfigs(),
            sources: { 1: source },
        }
        mockJsonOnce({ items: [makeItem()] })
        const [items, configs] = await runThunk(
            nextcloudServiceHooks.fetchItems() as never,
            state
        )
        expect(String(mockFetch.mock.calls[0][0])).toContain("getRead=true&type=3")
        expect(items).toHaveLength(1)
        expect(items[0].source).toBe(1)
        expect(items[0].hasRead).toBe(false)
        expect(items[0].serviceRef).toBe("100")
        expect(items[0].thumb).toBe("https://a.com/x.png")
        const next = configs as NextcloudConfigs
        expect(next.lastId).toBe(100)
        expect(next.lastModified).toBe(1700000101) // max lastModified + 1
    })

    it("uses incremental sync when lastModified is set", async () => {
        const source = new RSSSource("https://a.com/feed", "A")
        source.sid = 1
        source.serviceRef = "5"
        const state = {
            service: makeConfigs({ lastModified: 1700000000, lastId: 100 }),
            sources: { 1: source },
        }
        mockJsonOnce({ items: [makeItem({ id: 101, enclosureLink: "https://a.com/pod.jpg" })] })
        const [items, configs] = await runThunk(
            nextcloudServiceHooks.fetchItems() as never,
            state
        )
        expect(String(mockFetch.mock.calls[0][0])).toContain(
            "/items/updated?lastModified=1700000000"
        )
        expect(items).toHaveLength(1)
        expect(items[0].thumb).toBe("https://a.com/pod.jpg")
        expect((configs as NextcloudConfigs).lastId).toBe(101)
    })

    it("filters out already-seen ids on incremental sync", async () => {
        const state = {
            service: makeConfigs({ lastModified: 1700000000, lastId: 100 }),
            sources: {},
        }
        mockJsonOnce({ items: [makeItem({ id: 99 })] })
        const [items] = await runThunk(nextcloudServiceHooks.fetchItems() as never, state)
        expect(items).toEqual([])
    })
})

describe("nextcloud mark actions", () => {
    it("markRead POSTs to /items/read/multiple", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce({})
        await runThunk(
            (nextcloudServiceHooks.markRead as CallableFunction)({ serviceRef: "9" }),
            state
        )
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe(
            "https://cloud.example.com/index.php/apps/news/api/v1-3/items/read/multiple"
        )
        expect(init.method).toBe("POST")
        expect(JSON.parse(init.body)).toEqual({ itemIds: [9] })
    })

    it("star POSTs to /items/star/multiple", async () => {
        const state = { service: makeConfigs() }
        mockJsonOnce({})
        await runThunk(
            (nextcloudServiceHooks.star as CallableFunction)({ serviceRef: "9" }),
            state
        )
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe(
            "https://cloud.example.com/index.php/apps/news/api/v1-3/items/star/multiple"
        )
        expect(JSON.parse(init.body)).toEqual({ itemIds: [9] })
    })
})
