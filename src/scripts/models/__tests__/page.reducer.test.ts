jest.mock("../../db", () => ({}))

import {
    pageReducer,
    PageState,
    PageType,
    SELECT_PAGE,
    SWITCH_VIEW,
    SET_VIEW_CONFIGS,
    SHOW_ITEM,
    DISMISS_ITEM,
    APPLY_FILTER,
    TOGGLE_SEARCH,
} from "../page"
import { ALL, SOURCE, FeedFilter, FilterType, INIT_FEED } from "../feed"
import { DELETE_SOURCE } from "../source"
import { ActionStatus } from "../../utils"

describe("pageReducer", () => {
    const initial = new PageState()

    it("selects pages and resets the item", () => {
        const withItem = { ...initial, itemId: 42 }
        const all = pageReducer(withItem, {
            type: SELECT_PAGE,
            pageType: PageType.AllArticles,
        } as never)
        expect(all.feedId).toBe(ALL)
        expect(all.itemId).toBeNull()

        const sources = pageReducer(withItem, {
            type: SELECT_PAGE,
            pageType: PageType.Sources,
        } as never)
        expect(sources.feedId).toBe(SOURCE)
        expect(sources.itemId).toBeNull()
    })

    it("switches view type and reloads view configs", () => {
        ;(window.settings.getViewConfigs as jest.Mock).mockReturnValueOnce(7)
        const next = pageReducer({ ...initial, itemId: 1 }, {
            type: SWITCH_VIEW,
            viewType: 1,
        } as never)
        expect(next.viewType).toBe(1)
        expect(next.viewConfigs).toBe(7)
        expect(next.itemId).toBeNull()
    })

    it("sets view configs", () => {
        const next = pageReducer(initial, {
            type: SET_VIEW_CONFIGS,
            configs: 3,
        } as never)
        expect(next.viewConfigs).toBe(3)
    })

    it("applies a filter", () => {
        const filter = new FeedFilter(FilterType.UnreadOnly)
        const next = pageReducer(initial, {
            type: APPLY_FILTER,
            filter: filter,
        } as never)
        expect(next.filter).toBe(filter)
    })

    it("shows an item and records its origin", () => {
        const fromFeed = pageReducer(initial, {
            type: SHOW_ITEM,
            feedId: ALL,
            item: { _id: 5 },
        } as never)
        expect(fromFeed.itemId).toBe(5)
        expect(fromFeed.itemFromFeed).toBe(true)

        const fromElsewhere = pageReducer(initial, {
            type: SHOW_ITEM,
            feedId: null,
            item: { _id: 5 },
        } as never)
        expect(fromElsewhere.itemFromFeed).toBe(false)
    })

    it("clears the shown item when it disappears from the current feed on INIT_FEED", () => {
        const state = { ...initial, feedId: ALL, itemId: 5 }
        const cleared = pageReducer(state, {
            type: INIT_FEED,
            status: ActionStatus.Success,
            feed: { _id: ALL },
            items: [{ _id: 6 }],
        } as never)
        expect(cleared.itemId).toBeNull()

        const kept = pageReducer(state, {
            type: INIT_FEED,
            status: ActionStatus.Success,
            feed: { _id: ALL },
            items: [{ _id: 5 }],
        } as never)
        expect(kept.itemId).toBe(5)
    })

    it("clears the item on DELETE_SOURCE and DISMISS_ITEM", () => {
        const state = { ...initial, itemId: 5 }
        for (const type of [DELETE_SOURCE, DISMISS_ITEM]) {
            const next = pageReducer(state, { type: type } as never)
            expect(next.itemId).toBeNull()
        }
    })

    it("toggles search", () => {
        const on = pageReducer(initial, { type: TOGGLE_SEARCH } as never)
        expect(on.searchOn).toBe(true)
        const off = pageReducer(on, { type: TOGGLE_SEARCH } as never)
        expect(off.searchOn).toBe(false)
    })
})
