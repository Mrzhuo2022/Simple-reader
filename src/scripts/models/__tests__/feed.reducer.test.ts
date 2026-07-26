jest.mock("../../db", () => ({}))

import {
    feedReducer,
    FeedFilter,
    FilterType,
    RSSFeed,
    ALL,
    SOURCE,
    INIT_FEED,
    LOAD_MORE,
    DISMISS_ITEMS,
} from "../feed"
import { INIT_SOURCES, ADD_SOURCE, DELETE_SOURCE, HIDE_SOURCE, RSSSource } from "../source"
import { FETCH_ITEMS, TOGGLE_HIDDEN, RSSItem } from "../item"
import { APPLY_FILTER, SELECT_PAGE, PageType } from "../page"
import { ActionStatus } from "../../utils"

function makeItem(id: number, overrides: Partial<RSSItem> = {}): RSSItem {
    return {
        _id: id,
        source: 1,
        title: `Item ${id}`,
        link: "",
        date: new Date(2026, 0, id),
        fetchedDate: new Date(),
        content: "",
        snippet: "",
        hasRead: false,
        starred: false,
        hidden: false,
        notify: false,
        ...overrides,
    } as RSSItem
}

function makeSource(sid: number, hidden = false): RSSSource {
    const s = new RSSSource(`https://example.com/${sid}`, `Source ${sid}`)
    s.sid = sid
    s.hidden = hidden
    return s
}

describe("FeedFilter.testItem", () => {
    const defaultFilter = new FeedFilter(FilterType.Default | FilterType.CaseInsensitive)

    it("shows read and unread items with the default filter", () => {
        expect(FeedFilter.testItem(defaultFilter, makeItem(1))).toBe(true)
        expect(FeedFilter.testItem(defaultFilter, makeItem(1, { hasRead: true }))).toBe(true)
    })

    it("hides hidden items unless ShowHidden is set", () => {
        const hidden = makeItem(1, { hidden: true })
        expect(FeedFilter.testItem(defaultFilter, hidden)).toBe(false)
        const showHidden = new FeedFilter(defaultFilter.type | FilterType.ShowHidden)
        expect(FeedFilter.testItem(showHidden, hidden)).toBe(true)
    })

    it("filters unread only", () => {
        const unreadOnly = new FeedFilter(FilterType.UnreadOnly)
        expect(FeedFilter.testItem(unreadOnly, makeItem(1))).toBe(true)
        expect(FeedFilter.testItem(unreadOnly, makeItem(1, { hasRead: true }))).toBe(false)
    })

    it("filters starred only", () => {
        const starredOnly = new FeedFilter(FilterType.StarredOnly)
        expect(FeedFilter.testItem(starredOnly, makeItem(1, { starred: true }))).toBe(true)
        expect(FeedFilter.testItem(starredOnly, makeItem(1))).toBe(false)
    })

    it("searches title case-insensitively", () => {
        const filter = new FeedFilter(FilterType.Default | FilterType.CaseInsensitive, "hello")
        expect(FeedFilter.testItem(filter, makeItem(1, { title: "Hello World" }))).toBe(true)
        expect(FeedFilter.testItem(filter, makeItem(1, { title: "Goodbye" }))).toBe(false)
    })

    it("searches content in full search mode", () => {
        const filter = new FeedFilter(
            FilterType.Default | FilterType.FullSearch | FilterType.CaseInsensitive,
            "needle"
        )
        expect(
            FeedFilter.testItem(filter, makeItem(1, { title: "x", content: "a needle here" }))
        ).toBe(true)
    })

    it("searches creator in creator search mode", () => {
        const filter = new FeedFilter(
            FilterType.Default | FilterType.CreatorSearch | FilterType.CaseInsensitive,
            "alice"
        )
        expect(FeedFilter.testItem(filter, makeItem(1, { creator: "Alice" }))).toBe(true)
        expect(FeedFilter.testItem(filter, makeItem(1, { creator: "Bob" }))).toBe(false)
    })
})

describe("feedReducer", () => {
    it("builds the ALL feed from visible sources on INIT_SOURCES", () => {
        const next = feedReducer(undefined, {
            type: INIT_SOURCES,
            status: ActionStatus.Success,
            sources: {
                1: makeSource(1),
                2: makeSource(2, true), // hidden
                3: makeSource(3),
            },
        } as never)
        expect(next[ALL].sids).toEqual([1, 3])
    })

    it("adds a sid to ALL on ADD_SOURCE success", () => {
        const state = { [ALL]: new RSSFeed(ALL, [1]) }
        const next = feedReducer(state, {
            type: ADD_SOURCE,
            status: ActionStatus.Success,
            batch: false,
            source: makeSource(2),
        } as never)
        expect(next[ALL].sids).toEqual([1, 2])
    })

    it("removes the sid from all feeds on DELETE_SOURCE / HIDE_SOURCE", () => {
        const state = {
            [ALL]: new RSSFeed(ALL, [1, 2]),
            [SOURCE]: new RSSFeed(SOURCE, [2]),
        }
        for (const type of [DELETE_SOURCE, HIDE_SOURCE]) {
            const next = feedReducer(state, {
                type: type,
                status: ActionStatus.Success,
                source: makeSource(2),
            } as never)
            expect(next[ALL].sids).toEqual([1])
            expect(next[SOURCE].sids).toEqual([])
        }
    })

    it("applies a filter to every feed on APPLY_FILTER", () => {
        const state = { [ALL]: new RSSFeed(ALL, [1]) }
        const filter = new FeedFilter(FilterType.UnreadOnly)
        const next = feedReducer(state, {
            type: APPLY_FILTER,
            filter: filter,
        } as never)
        expect(next[ALL].filter).toBe(filter)
    })

    it("marks feed loaded and stores iids on INIT_FEED success", () => {
        const feed = new RSSFeed(ALL, [1])
        const state = { [ALL]: feed }
        const items = [makeItem(1), makeItem(2)]
        const next = feedReducer(state, {
            type: INIT_FEED,
            status: ActionStatus.Success,
            feed: feed,
            items: items,
        } as never)
        expect(next[ALL].loaded).toBe(true)
        expect(next[ALL].allLoaded).toBe(true) // fewer than LOAD_QUANTITY
        expect(next[ALL].iids).toEqual([1, 2])
    })

    it("appends iids on LOAD_MORE success and toggles loading", () => {
        const feed = { ...new RSSFeed(ALL, [1]), loaded: true, iids: [1] }
        const state = { [ALL]: feed as RSSFeed }
        const requested = feedReducer(state, {
            type: LOAD_MORE,
            status: ActionStatus.Request,
            feed: state[ALL],
        } as never)
        expect(requested[ALL].loading).toBe(true)

        const next = feedReducer(state, {
            type: LOAD_MORE,
            status: ActionStatus.Success,
            feed: state[ALL],
            items: [makeItem(2)],
        } as never)
        expect(next[ALL].loading).toBe(false)
        expect(next[ALL].iids).toEqual([1, 2])
    })

    it("prepends new matching items sorted by date on FETCH_ITEMS success", () => {
        const feed = {
            ...new RSSFeed(ALL, [1], new FeedFilter(FilterType.Default)),
            loaded: true,
            iids: [1],
        }
        const state = { [ALL]: feed as RSSFeed }
        const existing = makeItem(1)
        const incoming = makeItem(5)
        const next = feedReducer(state, {
            type: FETCH_ITEMS,
            status: ActionStatus.Success,
            items: [incoming],
            itemState: { 1: existing },
        } as never)
        // newer item (date 2026-01-05) sorts before the existing 2026-01-01
        expect(next[ALL].iids).toEqual([5, 1])
    })

    it("removes dismissed iids on DISMISS_ITEMS", () => {
        const feed = { ...new RSSFeed(ALL, [1]), loaded: true, iids: [1, 2, 3] }
        const state = { [ALL]: feed as RSSFeed }
        const next = feedReducer(state, {
            type: DISMISS_ITEMS,
            fid: ALL,
            iids: new Set([2]),
        } as never)
        expect(next[ALL].iids).toEqual([1, 3])
    })

    it("removes an item that no longer matches on TOGGLE_HIDDEN", () => {
        const feed = {
            ...new RSSFeed(ALL, [1], new FeedFilter(FilterType.Default)),
            loaded: true,
            iids: [1],
        }
        const state = { [ALL]: feed as RSSFeed }
        const next = feedReducer(state, {
            type: TOGGLE_HIDDEN,
            item: makeItem(1), // toggling makes it hidden -> filtered out
        } as never)
        expect(next[ALL].iids).toEqual([])
    })

    it("creates a SOURCE feed on SELECT_PAGE with Sources type", () => {
        const state = { [ALL]: new RSSFeed(ALL, [1]) }
        const filter = new FeedFilter(FilterType.Default)
        const next = feedReducer(state, {
            type: SELECT_PAGE,
            pageType: PageType.Sources,
            init: true,
            keepMenu: false,
            filter: filter,
            sids: [1],
        } as never)
        expect(next[SOURCE].sids).toEqual([1])
        expect(next[SOURCE].filter).toBe(filter)
    })
})
