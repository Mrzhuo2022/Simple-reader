jest.mock("../../db", () => ({}))

import { sourceReducer, RSSSource, SourceState } from "../source"
import {
    INIT_SOURCES,
    ADD_SOURCE,
    UPDATE_SOURCE,
    DELETE_SOURCE,
    UPDATE_UNREAD_COUNTS,
} from "../source"
import { FETCH_ITEMS, MARK_READ, MARK_UNREAD, MARK_ALL_READ, RSSItem } from "../item"
import { ActionStatus } from "../../utils"

function makeSource(sid: number, unreadCount = 0): RSSSource {
    const source = new RSSSource(`https://example.com/${sid}`, `Source ${sid}`)
    source.sid = sid
    source.unreadCount = unreadCount
    return source
}

function makeItem(id: number, source: number, hasRead = false): RSSItem {
    return {
        _id: id,
        source: source,
        title: `Item ${id}`,
        link: "",
        date: new Date(),
        fetchedDate: new Date(),
        content: "",
        snippet: "",
        hasRead: hasRead,
        starred: false,
        hidden: false,
        notify: false,
    } as RSSItem
}

describe("sourceReducer", () => {
    const initial: SourceState = {
        1: makeSource(1, 2),
        2: makeSource(2, 5),
    }

    it("returns the initial state for unknown actions", () => {
        expect(sourceReducer(undefined, { type: "UNKNOWN" } as never)).toEqual({})
    })

    it("replaces state on INIT_SOURCES success", () => {
        const next = sourceReducer(
            {},
            {
                type: INIT_SOURCES,
                status: ActionStatus.Success,
                sources: initial,
            } as never
        )
        expect(next).toBe(initial)
    })

    it("keeps state on INIT_SOURCES request", () => {
        const next = sourceReducer(initial, {
            type: INIT_SOURCES,
            status: ActionStatus.Request,
        } as never)
        expect(next).toBe(initial)
    })

    it("replaces state on UPDATE_UNREAD_COUNTS", () => {
        const updated = { 1: makeSource(1, 0) }
        const next = sourceReducer(initial, {
            type: UPDATE_UNREAD_COUNTS,
            sources: updated,
        } as never)
        expect(next).toBe(updated)
    })

    it("adds a source on ADD_SOURCE success", () => {
        const source = makeSource(3)
        const next = sourceReducer(initial, {
            type: ADD_SOURCE,
            status: ActionStatus.Success,
            batch: false,
            source: source,
        } as never)
        expect(next[3]).toBe(source)
        expect(Object.keys(next)).toHaveLength(3)
    })

    it("updates a source on UPDATE_SOURCE", () => {
        const updated = { ...initial[1], name: "Renamed" } as RSSSource
        const next = sourceReducer(initial, {
            type: UPDATE_SOURCE,
            source: updated,
        } as never)
        expect(next[1].name).toBe("Renamed")
        expect(next[2]).toBe(initial[2])
    })

    it("removes a source on DELETE_SOURCE", () => {
        const state = { ...initial }
        const next = sourceReducer(state, {
            type: DELETE_SOURCE,
            source: state[1],
        } as never)
        expect(next[1]).toBeUndefined()
        expect(next[2]).toBeDefined()
    })

    it("increments unread counts on FETCH_ITEMS success for unread items", () => {
        const items = [makeItem(10, 1), makeItem(11, 1), makeItem(12, 2, true)]
        const next = sourceReducer(initial, {
            type: FETCH_ITEMS,
            status: ActionStatus.Success,
            items: items,
            itemState: {},
        } as never)
        expect(next[1].unreadCount).toBe(4) // 2 + 2 unread
        expect(next[2].unreadCount).toBe(5) // read item does not count
    })

    it("adjusts unread count on MARK_READ / MARK_UNREAD", () => {
        const read = sourceReducer(initial, {
            type: MARK_READ,
            item: makeItem(10, 1),
        } as never)
        expect(read[1].unreadCount).toBe(1)

        const unread = sourceReducer(initial, {
            type: MARK_UNREAD,
            item: makeItem(10, 1),
        } as never)
        expect(unread[1].unreadCount).toBe(3)
    })

    it("zeroes unread counts on MARK_ALL_READ without time", () => {
        const next = sourceReducer(initial, {
            type: MARK_ALL_READ,
            sids: [1, 2],
        } as never)
        expect(next[1].unreadCount).toBe(0)
        expect(next[2].unreadCount).toBe(0)
    })

    it("keeps unread counts on MARK_ALL_READ with time (recount happens separately)", () => {
        const next = sourceReducer(initial, {
            type: MARK_ALL_READ,
            sids: [1],
            time: Date.now(),
            before: true,
        } as never)
        expect(next[1].unreadCount).toBe(2)
    })
})
