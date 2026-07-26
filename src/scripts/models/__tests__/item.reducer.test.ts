jest.mock("../../db", () => ({}))

import {
    itemReducer,
    applyItemReduction,
    RSSItem,
    ItemState,
    FETCH_ITEMS,
    MARK_READ,
    MARK_UNREAD,
    MARK_ALL_READ,
    TOGGLE_STARRED,
    TOGGLE_HIDDEN,
} from "../item"
import { INIT_FEED, LOAD_MORE } from "../feed"
import { SYNC_LOCAL_ITEMS } from "../service"
import { FREE_MEMORY } from "../app"
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

describe("applyItemReduction", () => {
    const item = makeItem(1)

    it("marks read / unread", () => {
        expect(applyItemReduction(item, MARK_READ).hasRead).toBe(true)
        expect(applyItemReduction({ ...item, hasRead: true }, MARK_UNREAD).hasRead).toBe(false)
    })

    it("toggles starred and hidden", () => {
        expect(applyItemReduction(item, TOGGLE_STARRED).starred).toBe(true)
        expect(applyItemReduction(item, TOGGLE_HIDDEN).hidden).toBe(true)
    })

    it("does not mutate the original item", () => {
        applyItemReduction(item, MARK_READ)
        expect(item.hasRead).toBe(false)
    })
})

describe("itemReducer", () => {
    const initial: ItemState = {
        1: makeItem(1),
        2: makeItem(2, { source: 2, hasRead: true }),
    }

    it("returns empty initial state", () => {
        expect(itemReducer(undefined, { type: "UNKNOWN" } as never)).toEqual({})
    })

    it("merges new items on FETCH_ITEMS success", () => {
        const next = itemReducer(initial, {
            type: FETCH_ITEMS,
            status: ActionStatus.Success,
            items: [makeItem(3)],
            itemState: initial,
        } as never)
        expect(Object.keys(next)).toHaveLength(3)
        expect(next[3]._id).toBe(3)
        expect(next[1]).toBe(initial[1])
    })

    it("applies item reduction on MARK_READ", () => {
        const next = itemReducer(initial, {
            type: MARK_READ,
            item: initial[1],
        } as never)
        expect(next[1].hasRead).toBe(true)
        expect(next[2]).toBe(initial[2])
    })

    it("marks matching unread items on MARK_ALL_READ", () => {
        const state: ItemState = {
            1: makeItem(1),
            2: makeItem(2),
            3: makeItem(3, { source: 9 }),
        }
        const next = itemReducer(state, {
            type: MARK_ALL_READ,
            sids: [1],
        } as never)
        expect(next[1].hasRead).toBe(true)
        expect(next[2].hasRead).toBe(true)
        expect(next[3].hasRead).toBe(false) // different source
    })

    it("respects the time boundary on MARK_ALL_READ", () => {
        const state: ItemState = {
            1: makeItem(1), // date 2026-01-01
            5: makeItem(5), // date 2026-01-05
        }
        const boundary = new Date(2026, 0, 3).getTime()
        const before = itemReducer(state, {
            type: MARK_ALL_READ,
            sids: [1],
            time: boundary,
            before: true,
        } as never)
        expect(before[1].hasRead).toBe(true)
        expect(before[5].hasRead).toBe(false)

        const after = itemReducer(state, {
            type: MARK_ALL_READ,
            sids: [1],
            time: boundary,
            before: false,
        } as never)
        expect(after[1].hasRead).toBe(false)
        expect(after[5].hasRead).toBe(true)
    })

    it("adds loaded items on INIT_FEED and LOAD_MORE success", () => {
        for (const type of [INIT_FEED, LOAD_MORE]) {
            const next = itemReducer(initial, {
                type: type,
                status: ActionStatus.Success,
                feed: { _id: "ALL" },
                items: [makeItem(7)],
            } as never)
            expect(next[7]._id).toBe(7)
        }
    })

    it("syncs read/starred state on SYNC_LOCAL_ITEMS", () => {
        const state: ItemState = {
            1: makeItem(1, { serviceRef: "a", hasRead: true }),
            2: makeItem(2, { serviceRef: "b", starred: true }),
            3: makeItem(3), // no serviceRef, untouched
        }
        const next = itemReducer(state, {
            type: SYNC_LOCAL_ITEMS,
            unreadIds: new Set(["a"]),
            starredIds: new Set(["a"]),
        } as never)
        expect(next[1].hasRead).toBe(false)
        expect(next[1].starred).toBe(true)
        expect(next[2].hasRead).toBe(true)
        expect(next[2].starred).toBe(false)
        expect(next[3]).toBe(state[3])
    })

    it("drops items not in the keep set on FREE_MEMORY", () => {
        const next = itemReducer(initial, {
            type: FREE_MEMORY,
            iids: new Set([1]),
        } as never)
        expect(next[1]).toBeDefined()
        expect(next[2]).toBeUndefined()
    })
})
