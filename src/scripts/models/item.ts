import * as db from "../db"
import lf from "lovefield"
import intl from "react-intl-universal"
import type { MyParserItem } from "../utils"
import { domParser, htmlDecode, ActionStatus, AppThunk, platformCtrl } from "../utils"
import { RSSSource, updateSource, updateUnreadCounts } from "./source"
import { FeedActionTypes, INIT_FEED, LOAD_MORE, dismissItems } from "./feed"
import { pushNotification, setupAutoFetch, SettingsActionTypes, FREE_MEMORY } from "./app"
import { getServiceHooks, syncWithService, ServiceActionTypes, SYNC_LOCAL_ITEMS } from "./service"

export class RSSItem {
    _id: number
    source: number
    title: string
    link: string
    date: Date
    fetchedDate: Date
    thumb?: string
    content: string
    snippet: string
    creator?: string
    hasRead: boolean
    starred: boolean
    hidden: boolean
    notify: boolean
    autoTranslate?: boolean
    autoSummarize?: boolean
    autoFullText?: boolean
    serviceRef?: string

    constructor(item: MyParserItem, source: RSSSource) {
        for (const field of ["title", "link", "creator"]) {
            const content = item[field]
            if (content && typeof content !== "string") delete item[field]
        }
        this.source = source.sid
        this.title = item.title || intl.get("nav.untitled")
        this.link = item.link || ""
        this.fetchedDate = new Date()
        this.date = new Date(item.isoDate ?? item.pubDate ?? this.fetchedDate)
        this.creator = item.creator
        this.hasRead = false
        this.starred = false
        this.hidden = false
        this.notify = false
    }

    static parseContent(item: RSSItem, parsed: MyParserItem) {
        for (const field of ["thumb", "content", "fullContent"]) {
            const content = parsed[field]
            if (content && typeof content !== "string") delete parsed[field]
        }
        if (parsed.fullContent) {
            item.content = parsed.fullContent
            item.snippet = htmlDecode(parsed.fullContent)
        } else {
            item.content = parsed.content || ""
            item.snippet = htmlDecode(parsed.contentSnippet || "")
        }
        if (parsed.thumb) {
            item.thumb = parsed.thumb
        } else if (parsed.image?.$?.url) {
            item.thumb = parsed.image.$.url
        } else if (parsed.image && typeof parsed.image === "string") {
            item.thumb = parsed.image
        } else if (parsed.mediaContent) {
            const images = parsed.mediaContent.filter(c => c.$ && c.$.medium === "image" && c.$.url)
            if (images.length > 0) item.thumb = images[0].$.url
        }
        if (!item.thumb) {
            const dom = domParser.parseFromString(item.content, "text/html")
            const baseEl = dom.createElement("base")
            baseEl.setAttribute("href", item.link.split("/").slice(0, 3).join("/"))
            dom.head.append(baseEl)
            const img = dom.querySelector("img")
            if (img && img.src) item.thumb = img.src
        }
        if (item.thumb && !item.thumb.startsWith("https://") && !item.thumb.startsWith("http://")) {
            delete item.thumb
        }
    }
}

export type ItemState = {
    [_id: number]: RSSItem
}

export const FETCH_ITEMS = "FETCH_ITEMS"
export const MARK_READ = "MARK_READ"
export const MARK_ALL_READ = "MARK_ALL_READ"
export const MARK_UNREAD = "MARK_UNREAD"
export const TOGGLE_STARRED = "TOGGLE_STARRED"
export const TOGGLE_HIDDEN = "TOGGLE_HIDDEN"

interface FetchItemsAction {
    type: typeof FETCH_ITEMS
    status: ActionStatus
    fetchCount?: number
    items?: RSSItem[]
    itemState?: ItemState
    errSource?: RSSSource
    err?
}

interface MarkReadAction {
    type: typeof MARK_READ
    item: RSSItem
}

interface MarkAllReadAction {
    type: typeof MARK_ALL_READ
    sids: number[]
    time?: number
    before?: boolean
}

interface MarkUnreadAction {
    type: typeof MARK_UNREAD
    item: RSSItem
}

interface ToggleStarredAction {
    type: typeof TOGGLE_STARRED
    item: RSSItem
}

interface ToggleHiddenAction {
    type: typeof TOGGLE_HIDDEN
    item: RSSItem
}

export type ItemActionTypes =
    | FetchItemsAction
    | MarkReadAction
    | MarkAllReadAction
    | MarkUnreadAction
    | ToggleStarredAction
    | ToggleHiddenAction

export function fetchItemsRequest(fetchCount = 0): ItemActionTypes {
    return {
        type: FETCH_ITEMS,
        status: ActionStatus.Request,
        fetchCount: fetchCount,
    }
}

export function fetchItemsSuccess(items: RSSItem[], itemState: ItemState): ItemActionTypes {
    return {
        type: FETCH_ITEMS,
        status: ActionStatus.Success,
        items: items,
        itemState: itemState,
    }
}

export function fetchItemsFailure(source: RSSSource, err): ItemActionTypes {
    return {
        type: FETCH_ITEMS,
        status: ActionStatus.Failure,
        errSource: source,
        err: err,
    }
}

export function fetchItemsIntermediate(): ItemActionTypes {
    return {
        type: FETCH_ITEMS,
        status: ActionStatus.Intermediate,
    }
}

export async function insertItems(items: RSSItem[]): Promise<RSSItem[]> {
    items.sort((a, b) => a.date.getTime() - b.date.getTime())
    const rows = items.map(item => db.items.createRow(item))
    return (await db.itemsDB.insert().into(db.items).values(rows).exec()) as RSSItem[]
}

export function fetchItems(background = false, sids: number[] = null): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const promises = new Array<Promise<RSSItem[]>>()
        const initState = getState()
        if (!initState.app.fetchingItems && !initState.app.syncing) {
            if (
                sids === null ||
                sids.filter(sid => initState.sources[sid].serviceRef !== undefined).length > 0
            )
                await dispatch(syncWithService(background))
            const timenow = new Date().getTime()
            const sourcesState = getState().sources
            const sources =
                sids === null
                    ? Object.values(sourcesState).filter(s => {
                          const last = s.lastFetched ? s.lastFetched.getTime() : 0
                          return (
                              !s.serviceRef &&
                              (last > timenow || last + (s.fetchFrequency || 0) * 60000 <= timenow)
                          )
                      })
                    : sids.map(sid => sourcesState[sid]).filter(s => !s.serviceRef)
            for (const source of sources) {
                const promise = RSSSource.fetchItems(source)
                promise.then(() => dispatch(updateSource({ ...source, lastFetched: new Date() })))
                promise.finally(() => dispatch(fetchItemsIntermediate()))
                promises.push(promise)
            }
            dispatch(fetchItemsRequest(promises.length))
            const results = await Promise.allSettled(promises)
            return await new Promise<void>((resolve, reject) => {
                const items = new Array<RSSItem>()
                results.map((r, i) => {
                    if (r.status === "fulfilled") items.push(...r.value)
                    else {
                        console.warn(r.reason)
                        dispatch(fetchItemsFailure(sources[i], r.reason))
                    }
                })
                insertItems(items)
                    .then(inserted => {
                        dispatch(fetchItemsSuccess(inserted.reverse(), getState().items))
                        resolve()
                        if (background) {
                            for (const item of inserted) {
                                if (item.notify) {
                                    dispatch(pushNotification(item))
                                }
                            }
                            if (inserted.length > 0) {
                                window.utils.requestAttention()
                            }
                        } else {
                            dispatch(dismissItems())
                        }
                        dispatch(setupAutoFetch())
                    })
                    .catch(err => {
                        dispatch(fetchItemsSuccess([], getState().items))
                        window.utils.showErrorBox("A database error has occurred.", String(err))
                        console.error(err)
                        reject(err)
                    })
            })
        }
    }
}

const markReadDone = (item: RSSItem): ItemActionTypes => ({
    type: MARK_READ,
    item: item,
})

const markUnreadDone = (item: RSSItem): ItemActionTypes => ({
    type: MARK_UNREAD,
    item: item,
})

export function markRead(item: RSSItem): AppThunk {
    return (dispatch, getState) => {
        item = getState().items[item._id]
        if (!item.hasRead) {
            db.itemsDB
                .update(db.items)
                .where(db.items._id.eq(item._id))
                .set(db.items.hasRead, true)
                .exec()
            dispatch(markReadDone(item))
            if (item.serviceRef) {
                dispatch(dispatch(getServiceHooks()).markRead?.(item))
            }
        }
    }
}

export function markAllRead(
    sids: number[] = null,
    date: Date = null,
    before = true
): AppThunk<Promise<void>> {
    return async (dispatch, getState) => {
        const state = getState()
        if (sids === null) {
            const feed = state.feeds[state.page.feedId]
            sids = feed.sids
        }
        const action = dispatch(getServiceHooks()).markAllRead?.(sids, date, before)
        if (action) await dispatch(action)
        const predicates: lf.Predicate[] = [db.items.source.in(sids), db.items.hasRead.eq(false)]
        if (date) {
            predicates.push(before ? db.items.date.lte(date) : db.items.date.gte(date))
        }
        const query = lf.op.and.apply(null, predicates)
        await db.itemsDB.update(db.items).set(db.items.hasRead, true).where(query).exec()
        if (date) {
            dispatch({
                type: MARK_ALL_READ,
                sids: sids,
                time: date.getTime(),
                before: before,
            })
            dispatch(updateUnreadCounts())
        } else {
            dispatch({
                type: MARK_ALL_READ,
                sids: sids,
            })
        }
    }
}

export function markUnread(item: RSSItem): AppThunk {
    return (dispatch, getState) => {
        item = getState().items[item._id]
        if (item.hasRead) {
            db.itemsDB
                .update(db.items)
                .where(db.items._id.eq(item._id))
                .set(db.items.hasRead, false)
                .exec()
            dispatch(markUnreadDone(item))
            if (item.serviceRef) {
                dispatch(dispatch(getServiceHooks()).markUnread?.(item))
            }
        }
    }
}

const toggleStarredDone = (item: RSSItem): ItemActionTypes => ({
    type: TOGGLE_STARRED,
    item: item,
})

export function toggleStarred(item: RSSItem): AppThunk {
    return dispatch => {
        db.itemsDB
            .update(db.items)
            .where(db.items._id.eq(item._id))
            .set(db.items.starred, !item.starred)
            .exec()
        dispatch(toggleStarredDone(item))
        if (item.serviceRef) {
            const hooks = dispatch(getServiceHooks())
            if (item.starred) dispatch(hooks.unstar?.(item))
            else dispatch(hooks.star?.(item))
        }
    }
}

const toggleHiddenDone = (item: RSSItem): ItemActionTypes => ({
    type: TOGGLE_HIDDEN,
    item: item,
})

export function toggleHidden(item: RSSItem): AppThunk {
    return dispatch => {
        db.itemsDB
            .update(db.items)
            .where(db.items._id.eq(item._id))
            .set(db.items.hidden, !item.hidden)
            .exec()
        dispatch(toggleHiddenDone(item))
    }
}

export function itemShortcuts(item: RSSItem, e: KeyboardEvent): AppThunk {
    return dispatch => {
        if (e.metaKey) return
        const shortcuts =
            (window.settings && window.settings.getShortcuts
                ? window.settings.getShortcuts()
                : null) || null

        const isMatch = (shortcut: string | undefined, ev: KeyboardEvent) => {
            if (!shortcut) return false
            const parts = shortcut.toLowerCase().split("+")
            const key = parts[parts.length - 1]
            const needCtrl = parts.includes("ctrl") || parts.includes("control")
            const needMeta =
                parts.includes("meta") || parts.includes("command") || parts.includes("cmd")
            const needAlt = parts.includes("alt")
            const needShift = parts.includes("shift")

            const inputKey = ev.key.toLowerCase()

            if (inputKey !== key) return false
            if (!!ev.ctrlKey !== needCtrl) return false
            if (!!ev.metaKey !== needMeta) return false
            if (!!ev.altKey !== needAlt) return false
            if (!!ev.shiftKey !== needShift) return false

            return true
        }

        if (shortcuts) {
            if (isMatch(shortcuts.markRead, e)) {
                if (item.hasRead) dispatch(markUnread(item))
                else dispatch(markRead(item))
                return
            }
            if (isMatch(shortcuts.openExternal, e)) {
                if (!item.hasRead) dispatch(markRead(item))
                window.utils.openExternal(item.link, platformCtrl(e))
                return
            }
            if (isMatch(shortcuts.star, e)) {
                dispatch(toggleStarred(item))
                return
            }
            if (isMatch(shortcuts.hide, e)) {
                if (!item.hasRead && !item.hidden) dispatch(markRead(item))
                dispatch(toggleHidden(item))
                return
            }
            // 若有快捷键配置但未命中，则不再使用旧默认按键
            return
        }

        // 若无法读取快捷键配置（极端情况），回退到内置默认按键
        switch (e.key) {
            case "m":
            case "M":
                if (item.hasRead) dispatch(markUnread(item))
                else dispatch(markRead(item))
                break
            case "b":
            case "B":
                if (!item.hasRead) dispatch(markRead(item))
                window.utils.openExternal(item.link, platformCtrl(e))
                break
            case "s":
            case "S":
                dispatch(toggleStarred(item))
                break
            case "h":
            case "H":
                if (!item.hasRead && !item.hidden) dispatch(markRead(item))
                dispatch(toggleHidden(item))
                break
        }
    }
}

export function applyItemReduction(item: RSSItem, type: string) {
    const nextItem = { ...item }
    switch (type) {
        case MARK_READ:
        case MARK_UNREAD: {
            nextItem.hasRead = type === MARK_READ
            break
        }
        case TOGGLE_STARRED: {
            nextItem.starred = !item.starred
            break
        }
        case TOGGLE_HIDDEN: {
            nextItem.hidden = !item.hidden
            break
        }
    }
    return nextItem
}

export function itemReducer(
    state: ItemState = {},
    action: ItemActionTypes | FeedActionTypes | ServiceActionTypes | SettingsActionTypes
): ItemState {
    switch (action.type) {
        case FETCH_ITEMS:
            switch (action.status) {
                case ActionStatus.Success: {
                    const newMap = {}
                    for (const i of action.items) {
                        newMap[i._id] = i
                    }
                    return { ...newMap, ...state }
                }
                default:
                    return state
            }
        case MARK_UNREAD:
        case MARK_READ:
        case TOGGLE_STARRED:
        case TOGGLE_HIDDEN: {
            return {
                ...state,
                [action.item._id]: applyItemReduction(state[action.item._id], action.type),
            }
        }
        case MARK_ALL_READ: {
            const nextState = { ...state }
            const sids = new Set(action.sids)
            for (const item of Object.values(state)) {
                if (sids.has(item.source) && !item.hasRead) {
                    if (
                        !action.time ||
                        (action.before
                            ? item.date.getTime() <= action.time
                            : item.date.getTime() >= action.time)
                    ) {
                        nextState[item._id] = {
                            ...item,
                            hasRead: true,
                        }
                    }
                }
            }
            return nextState
        }
        case LOAD_MORE:
        case INIT_FEED: {
            switch (action.status) {
                case ActionStatus.Success: {
                    const nextState = { ...state }
                    for (const i of action.items) {
                        nextState[i._id] = i
                    }
                    return nextState
                }
                default:
                    return state
            }
        }
        case SYNC_LOCAL_ITEMS: {
            const nextState = { ...state }
            for (const item of Object.values(state)) {
                if (Object.prototype.hasOwnProperty.call(item, "serviceRef")) {
                    const nextItem = { ...item }
                    nextItem.hasRead = !action.unreadIds.has(item.serviceRef)
                    nextItem.starred = action.starredIds.has(item.serviceRef)
                    nextState[item._id] = nextItem
                }
            }
            return nextState
        }
        case FREE_MEMORY: {
            const nextState: ItemState = {}
            for (const item of Object.values(state)) {
                if (action.iids.has(item._id)) nextState[item._id] = item
            }
            return nextState
        }
        default:
            return state
    }
}
