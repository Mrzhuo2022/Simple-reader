jest.mock("../../db", () => ({}))

import {
    appReducer,
    AppState,
    ContextMenuType,
    AppLogType,
    INIT_INTL,
    TOGGLE_MENU,
    TOGGLE_LOGS,
    TOGGLE_SETTINGS,
    SAVE_SETTINGS,
    PUSH_NOTIFICATION,
    CLOSE_CONTEXT_MENU,
    OPEN_VIEW_MENU,
} from "../app"
import { INIT_SOURCES, ADD_SOURCE } from "../source"
import { FETCH_ITEMS } from "../item"
import { ActionStatus } from "../../utils"

describe("appReducer", () => {
    // The reducer mutates logMenu.logs in place, so use a fresh state per test
    let initial: AppState
    beforeEach(() => {
        initial = new AppState()
    })

    it("stores the locale on INIT_INTL", () => {
        const next = appReducer(initial, {
            type: INIT_INTL,
            locale: "zh-CN",
        } as never)
        expect(next.locale).toBe("zh-CN")
    })

    it("marks sources initialized on INIT_SOURCES success", () => {
        const next = appReducer(initial, {
            type: INIT_SOURCES,
            status: ActionStatus.Success,
            sources: {},
        } as never)
        expect(next.sourceInit).toBe(true)
    })

    it("tracks fetching state on ADD_SOURCE", () => {
        const requested = appReducer(initial, {
            type: ADD_SOURCE,
            status: ActionStatus.Request,
            batch: false,
        } as never)
        expect(requested.fetchingItems).toBe(true)
        expect(requested.settings.saving).toBe(true)

        const done = appReducer(requested, {
            type: ADD_SOURCE,
            status: ActionStatus.Success,
            batch: false,
            source: { sid: 1 },
        } as never)
        expect(done.fetchingItems).toBe(false)
        expect(done.settings.saving).toBe(false)
    })

    it("tracks fetch progress on FETCH_ITEMS", () => {
        const requested = appReducer(initial, {
            type: FETCH_ITEMS,
            status: ActionStatus.Request,
            fetchCount: 3,
        } as never)
        expect(requested.fetchingItems).toBe(true)
        expect(requested.fetchingTotal).toBe(3)
        expect(requested.fetchingProgress).toBe(0)

        const progressed = appReducer(requested, {
            type: FETCH_ITEMS,
            status: ActionStatus.Intermediate,
        } as never)
        expect(progressed.fetchingProgress).toBe(1)

        const done = appReducer(progressed, {
            type: FETCH_ITEMS,
            status: ActionStatus.Success,
            items: [],
            itemState: {},
        } as never)
        expect(done.fetchingItems).toBe(false)
        expect(done.fetchingTotal).toBe(0)
        // no log entry for an empty fetch
        expect(done.logMenu.logs).toHaveLength(0)
    })

    it("logs failures on FETCH_ITEMS failure and notifies", () => {
        const next = appReducer(initial, {
            type: FETCH_ITEMS,
            status: ActionStatus.Failure,
            errSource: { name: "Feed" },
            err: new Error("boom"),
        } as never)
        expect(next.logMenu.logs).toHaveLength(1)
        expect(next.logMenu.logs[0].type).toBe(AppLogType.Failure)
        expect(next.logMenu.notify).toBe(true)
    })

    it("toggles the menu", () => {
        const next = appReducer(initial, { type: TOGGLE_MENU } as never)
        expect(next.menu).toBe(!initial.menu)
    })

    it("toggles the log menu and clears notify", () => {
        const withNotify = { ...initial, logMenu: { ...initial.logMenu, notify: true } }
        const next = appReducer(withNotify, { type: TOGGLE_LOGS } as never)
        expect(next.logMenu.display).toBe(true)
        expect(next.logMenu.notify).toBe(false)
    })

    it("opens and resets settings on TOGGLE_SETTINGS", () => {
        const opened = appReducer(initial, {
            type: TOGGLE_SETTINGS,
            open: true,
            sids: [1, 2],
        } as never)
        expect(opened.settings.display).toBe(true)
        expect(opened.settings.sids).toEqual([1, 2])
        expect(opened.settings.changed).toBe(false)
    })

    it("flips saving on SAVE_SETTINGS", () => {
        const next = appReducer(initial, { type: SAVE_SETTINGS } as never)
        expect(next.settings.saving).toBe(true)
        const again = appReducer(next, { type: SAVE_SETTINGS } as never)
        expect(again.settings.saving).toBe(false)
    })

    it("appends a log on PUSH_NOTIFICATION", () => {
        const next = appReducer(initial, {
            type: PUSH_NOTIFICATION,
            iid: 1,
            title: "Title",
            source: "Source",
        } as never)
        expect(next.logMenu.logs).toHaveLength(1)
        expect(next.logMenu.logs[0].type).toBe(AppLogType.Article)
        expect(next.logMenu.notify).toBe(true)
    })

    it("opens and closes context menus", () => {
        const opened = appReducer(initial, { type: OPEN_VIEW_MENU } as never)
        expect(opened.contextMenu.type).toBe(ContextMenuType.View)
        // toggling again closes it
        const toggled = appReducer(opened, { type: OPEN_VIEW_MENU } as never)
        expect(toggled.contextMenu.type).toBe(ContextMenuType.Hidden)

        const closed = appReducer(opened, { type: CLOSE_CONTEXT_MENU } as never)
        expect(closed.contextMenu.type).toBe(ContextMenuType.Hidden)
    })
})
