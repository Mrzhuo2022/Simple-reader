jest.mock("../../../db", () => ({}))

import { gReaderServiceHooks, GReaderConfigs } from "../greader"
import { SyncService } from "../../../../schema-types"
import { RSSSource } from "../../source"
import { AppDispatch } from "../../../utils"

global.fetch = jest.fn()
const mockFetch = fetch as jest.Mock

function makeConfigs(overrides: Partial<GReaderConfigs> = {}): GReaderConfigs {
    return {
        type: SyncService.GReader,
        endpoint: "https://reader.example.com",
        username: "user",
        password: "pass",
        fetchLimit: 250,
        auth: "GoogleLogin auth=token",
        useInt64: false,
        ...overrides,
    }
}

function mockResponseOnce(payload: unknown, status = 200) {
    mockFetch.mockResolvedValueOnce({
        ok: status >= 200 && status < 300,
        status: status,
        json: async () => payload,
        text: async () => String(payload),
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

describe("gReaderServiceHooks.authenticate", () => {
    it("returns true when user-info responds 200", async () => {
        mockResponseOnce({}, 200)
        await expect(gReaderServiceHooks.authenticate(makeConfigs())).resolves.toBe(true)
        const [url, init] = mockFetch.mock.calls[0]
        expect(url).toBe("https://reader.example.com/reader/api/0/user-info")
        expect((init.headers as Headers).get("Authorization")).toBe("GoogleLogin auth=token")
    })

    it("returns false on failure", async () => {
        mockResponseOnce({}, 401)
        await expect(gReaderServiceHooks.authenticate(makeConfigs())).resolves.toBe(false)
    })
})

describe("gReaderServiceHooks.reauthenticate", () => {
    it("extracts the auth token from ClientLogin", async () => {
        mockFetch.mockResolvedValueOnce({
            status: 200,
            text: async () => "SID=x\nAuth=newtoken\n",
        })
        const next = await gReaderServiceHooks.reauthenticate(makeConfigs({ auth: null }))
        expect((next as GReaderConfigs).auth).toBe("GoogleLogin auth=newtoken")
    })

    it("throws on failed login", async () => {
        mockFetch.mockResolvedValueOnce({ status: 403, text: async () => "Error" })
        await expect(
            gReaderServiceHooks.reauthenticate(makeConfigs({ auth: null }))
        ).rejects.toThrow()
    })
})

describe("gReaderServiceHooks.updateSources", () => {
    it("maps subscriptions to sources with serviceRef and groups", async () => {
        const state = { service: makeConfigs({ importGroups: true }), groups: [] }
        mockResponseOnce({
            subscriptions: [
                {
                    id: "feed/1",
                    url: "https://a.com/feed",
                    title: "A",
                    categories: [{ label: "News" }],
                },
                { id: "feed/2", htmlUrl: "https://b.com", title: "B" },
            ],
        })
        const [sources, groupsMap] = await runThunk(
            gReaderServiceHooks.updateSources() as never,
            state
        )
        expect(sources).toHaveLength(2)
        expect(sources[0]).toBeInstanceOf(RSSSource)
        expect(sources[0].serviceRef).toBe("feed/1")
        expect(sources[1].url).toBe("https://b.com") // htmlUrl fallback
        expect(groupsMap.get("feed/1")).toBe("News")
        expect(groupsMap.has("feed/2")).toBe(false)
    })

    it("throws on non-200", async () => {
        const state = { service: makeConfigs() }
        mockResponseOnce({}, 500)
        await expect(
            runThunk(gReaderServiceHooks.updateSources() as never, state)
        ).rejects.toThrow()
    })
})

describe("gReaderServiceHooks.fetchItems", () => {
    it("parses stream contents into RSSItem shape and compacts ids", async () => {
        const source = new RSSSource("https://a.com/feed", "A")
        source.sid = 1
        source.serviceRef = "feed/1"
        const state = {
            service: makeConfigs({ lastId: undefined }),
            sources: { 1: source },
        }
        mockResponseOnce({
            items: [
                {
                    id: "tag:google.com,2005:reader/item/00000000000004d2",
                    origin: { streamId: "feed/1" },
                    title: "Hello",
                    canonical: [{ href: "https://a.com/1" }],
                    published: 1700000000,
                    crawlTimeMsec: "1700000000000",
                    summary: { content: "<p>body</p>" },
                    author: "alice",
                    categories: ["user/-/state/com.google/read"],
                },
            ],
        })
        const [items, configs] = await runThunk(
            gReaderServiceHooks.fetchItems() as never,
            state
        )
        expect(items).toHaveLength(1)
        expect(items[0].source).toBe(1)
        expect(items[0].title).toBe("Hello")
        expect(items[0].link).toBe("https://a.com/1")
        expect(items[0].hasRead).toBe(true) // read tag present
        expect(items[0].snippet).toBe("body")
        // id is compacted to the last path segment when useInt64 is false
        expect((configs as GReaderConfigs).lastId).toBe("00000000000004d2")
    })

    it("stops at lastId and skips unknown sources", async () => {
        const state = {
            service: makeConfigs({ lastId: "known" }),
            sources: {},
        }
        mockResponseOnce({
            items: [
                {
                    id: "x/unknown-src",
                    origin: { streamId: "feed/999" },
                    title: "t",
                    canonical: [{ href: "https://x.com" }],
                    published: 1700000000,
                    crawlTimeMsec: "1700000000000",
                    summary: { content: "c" },
                    categories: [],
                },
            ],
        })
        const [items] = await runThunk(gReaderServiceHooks.fetchItems() as never, state)
        expect(items).toEqual([])
    })
})

describe("gReaderServiceHooks.syncItems", () => {
    it("fetches unread and starred id sets", async () => {
        const state = { service: makeConfigs() }
        mockFetch.mockImplementation(async url => ({
            ok: true,
            status: 200,
            json: async () =>
                String(url).includes("starred")
                    ? { itemRefs: [{ id: "2" }] }
                    : { itemRefs: [{ id: "1" }, { id: "2" }] },
        }))
        const [unread, starred] = await runThunk(gReaderServiceHooks.syncItems() as never, state)
        expect(unread).toEqual(new Set(["1", "2"]))
        expect(starred).toEqual(new Set(["2"]))
    })
})
