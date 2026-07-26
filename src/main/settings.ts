// eslint-disable-next-line @typescript-eslint/no-require-imports
import Store = require("electron-store")
import {
    SchemaTypes,
    SourceGroup,
    ViewType,
    ThemeSettings,
    SearchEngines,
    SyncService,
    ServiceConfigs,
    ViewConfigs,
    AIConfigs,
    Shortcuts,
} from "../schema-types"
import { ipcMain, session, nativeTheme, app } from "electron"
import { WindowManager } from "./window"

export const store = new Store<SchemaTypes>()

const GROUPS_STORE_KEY = "sourceGroups"
ipcMain.handle("set-groups", (_, groups: SourceGroup[]) => {
    store.set(GROUPS_STORE_KEY, groups)
})
function getGroups() {
    return store.get(GROUPS_STORE_KEY, [])
}
ipcMain.handle("get-groups", () => getGroups())

const MENU_STORE_KEY = "menuOn"
function getMenu() {
    return store.get(MENU_STORE_KEY, false)
}
ipcMain.handle("get-menu", () => getMenu())
ipcMain.handle("set-menu", (_, state: boolean) => {
    store.set(MENU_STORE_KEY, state)
})

const CLOSE_TO_TRAY_KEY = "closeToTray"
function getCloseToTray() {
    return store.get(CLOSE_TO_TRAY_KEY, true)
}
ipcMain.handle("get-close-to-tray", () => getCloseToTray())
ipcMain.handle("set-close-to-tray", (_, state: boolean) => {
    store.set(CLOSE_TO_TRAY_KEY, state)
})

const PAC_STORE_KEY = "pac"
const PAC_STATUS_KEY = "pacOn"
function getProxyStatus() {
    return store.get(PAC_STATUS_KEY, false)
}
function toggleProxyStatus() {
    store.set(PAC_STATUS_KEY, !getProxyStatus())
    setProxy()
}
function getProxy() {
    return store.get(PAC_STORE_KEY, "")
}
function setProxy(address = null) {
    if (!address) {
        address = getProxy()
    } else {
        store.set(PAC_STORE_KEY, address)
    }
    if (getProxyStatus()) {
        const rules = { pacScript: address }
        session.defaultSession.setProxy(rules)
        session.fromPartition("sandbox").setProxy(rules)
    }
}
ipcMain.handle("get-proxy-status", () => getProxyStatus())
ipcMain.on("toggle-proxy-status", () => {
    toggleProxyStatus()
})
ipcMain.handle("get-proxy", () => getProxy())
ipcMain.handle("set-proxy", (_, address?: string | null) => {
    setProxy(address)
})

const VIEW_STORE_KEY = "view"
function getView() {
    return store.get(VIEW_STORE_KEY, ViewType.Cards)
}
ipcMain.handle("get-view", () => getView())
ipcMain.handle("set-view", (_, viewType: ViewType) => {
    store.set(VIEW_STORE_KEY, viewType)
})

const THEME_STORE_KEY = "theme"
function getTheme() {
    return store.get(THEME_STORE_KEY, ThemeSettings.Default)
}
ipcMain.handle("get-theme", () => getTheme())
ipcMain.handle("set-theme", (_, theme: ThemeSettings) => {
    store.set(THEME_STORE_KEY, theme)
    nativeTheme.themeSource = theme
})
ipcMain.handle("get-theme-dark-color", () => nativeTheme.shouldUseDarkColors)
export function setThemeListener(manager: WindowManager) {
    nativeTheme.removeAllListeners()
    nativeTheme.on("updated", () => {
        if (manager.hasWindow()) {
            const contents = manager.mainWindow.webContents
            if (!contents.isDestroyed()) {
                contents.send("theme-updated", nativeTheme.shouldUseDarkColors)
            }
        }
    })
}

const LOCALE_STORE_KEY = "locale"
ipcMain.handle("set-locale", (_, option: string) => {
    store.set(LOCALE_STORE_KEY, option)
})
function getLocaleSettings() {
    return store.get(LOCALE_STORE_KEY, "default")
}
ipcMain.handle("get-locale-settings", () => getLocaleSettings())
ipcMain.handle("get-locale", () => {
    const setting = getLocaleSettings()
    return setting === "default" ? app.getLocale() : setting
})

const FONT_SIZE_STORE_KEY = "fontSize"
function getFontSize() {
    return store.get(FONT_SIZE_STORE_KEY, 16)
}
ipcMain.handle("get-font-size", () => getFontSize())
ipcMain.handle("set-font-size", (_, size: number) => {
    store.set(FONT_SIZE_STORE_KEY, size)
})

const FONT_STORE_KEY = "fontFamily"
function getFont() {
    return store.get(FONT_STORE_KEY, "")
}
ipcMain.handle("get-font", () => getFont())
ipcMain.handle("set-font", (_, font: string) => {
    store.set(FONT_STORE_KEY, font)
})

ipcMain.handle("get-all-settings", () => {
    const output: Record<string, unknown> = {}
    for (const [key, value] of store) {
        output[key] = value
    }
    return output
})

const FETCH_INTEVAL_STORE_KEY = "fetchInterval"
function getFetchInterval() {
    return store.get(FETCH_INTEVAL_STORE_KEY, 0)
}
ipcMain.handle("get-fetch-interval", () => getFetchInterval())
ipcMain.handle("set-fetch-interval", (_, interval: number) => {
    store.set(FETCH_INTEVAL_STORE_KEY, interval)
})

const SEARCH_ENGINE_STORE_KEY = "searchEngine"
function getSearchEngine() {
    return store.get(SEARCH_ENGINE_STORE_KEY, SearchEngines.Google)
}
ipcMain.handle("get-search-engine", () => getSearchEngine())
ipcMain.handle("set-search-engine", (_, engine: SearchEngines) => {
    store.set(SEARCH_ENGINE_STORE_KEY, engine)
})

const SERVICE_CONFIGS_STORE_KEY = "serviceConfigs"
function getServiceConfigs() {
    return store.get(SERVICE_CONFIGS_STORE_KEY, {
        type: SyncService.None,
    })
}
ipcMain.handle("get-service-configs", () => getServiceConfigs())
ipcMain.handle("set-service-configs", (_, configs: ServiceConfigs) => {
    store.set(SERVICE_CONFIGS_STORE_KEY, configs)
})

const FILTER_TYPE_STORE_KEY = "filterType"
function getFilterType() {
    return store.get(FILTER_TYPE_STORE_KEY, null)
}
ipcMain.handle("get-filter-type", () => getFilterType())
ipcMain.handle("set-filter-type", (_, filterType: number) => {
    store.set(FILTER_TYPE_STORE_KEY, filterType)
})

const LIST_CONFIGS_STORE_KEY = "listViewConfigs"
function getListViewConfigs() {
    return store.get(LIST_CONFIGS_STORE_KEY, ViewConfigs.ShowCover)
}
ipcMain.handle("get-view-configs", (_, view: ViewType) => {
    switch (view) {
        case ViewType.List:
            return getListViewConfigs()
        default:
            return undefined
    }
})
ipcMain.handle("set-view-configs", (_, view: ViewType, configs: ViewConfigs) => {
    switch (view) {
        case ViewType.List:
            store.set(LIST_CONFIGS_STORE_KEY, configs)
            break
    }
})

const NEDB_STATUS_STORE_KEY = "useNeDB"
function getNeDBStatus() {
    return store.get(NEDB_STATUS_STORE_KEY, true)
}
ipcMain.handle("get-nedb-status", () => getNeDBStatus())
ipcMain.handle("set-nedb-status", (_, flag: boolean) => {
    store.set(NEDB_STATUS_STORE_KEY, flag)
})

// 全局快捷键配置
const SHORTCUTS_STORE_KEY = "shortcuts"
const DEFAULT_SHORTCUTS: Shortcuts = {
    aiSummary: "Alt+S",
    aiTranslation: "Alt+T",
    markRead: "M",
    star: "S",
    openExternal: "B",
    hide: "H",
    toggleWebpage: "L",
    toggleFull: "W",
    navToggleMenu: "F1",
    navSearch: "F2",
    navRefresh: "F5",
    navMarkAllRead: "F6",
    navLogs: "F7",
    navViews: "F8",
    navSettings: "F9",
    prevItem: "ArrowLeft",
    nextItem: "ArrowRight",
    articleClose: "Escape",
    articleToggleWeb: "L",
    articleToggleFull: "W",
}
function getShortcuts(): Shortcuts {
    const saved = store.get(SHORTCUTS_STORE_KEY, DEFAULT_SHORTCUTS) as Partial<Shortcuts>
    return { ...DEFAULT_SHORTCUTS, ...(saved || {}) }
}
ipcMain.handle("get-shortcuts", () => getShortcuts())
ipcMain.handle("set-shortcuts", (_, shortcuts: Shortcuts) => {
    store.set(SHORTCUTS_STORE_KEY, shortcuts)
})

const AI_CONFIGS_STORE_KEY = "aiConfigs"
const DEFAULT_AI_CONFIGS: AIConfigs = {
    enabled: false,
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    defaultModel: "gpt-4o-mini",
    availableModels: [] as string[],
    autoSummary: false,
    autoTranslateImmersive: false,
    translateTarget: "zh",
    translateWhen: "auto",
    concurrency: 5,
    maxTextLengthPerRequest: 1500,
    maxParagraphsPerRequest: 1,
}
function getAIConfigs(): AIConfigs {
    // 合并默认值，兼容历史存储缺失字段
    const saved = store.get(AI_CONFIGS_STORE_KEY, DEFAULT_AI_CONFIGS) as Partial<AIConfigs>
    return { ...DEFAULT_AI_CONFIGS, ...(saved || {}) }
}
ipcMain.handle("get-ai-configs", () => getAIConfigs())
ipcMain.handle("set-ai-configs", (_, configs: AIConfigs) => {
    store.set(AI_CONFIGS_STORE_KEY, configs)
})

// AI Cache IPC handlers
import * as aiCache from "../scripts/models/services/aiCache"

// Initialize AI cache database when app is ready
let cacheInitialized = false
const ensureCacheInit = (): void => {
    if (!cacheInitialized && app.isReady()) {
        aiCache.initDB(app.getPath("userData"))
        cacheInitialized = true
    }
}

ipcMain.handle("ai-cache-get", (_, itemId: string) => {
    ensureCacheInit()
    return aiCache.getCache(itemId)
})

ipcMain.handle("ai-cache-save-summary", (_, itemId: string, summary: string) => {
    ensureCacheInit()
    aiCache.saveSummary(itemId, summary)
})

ipcMain.handle("ai-cache-save-translation", (_, itemId: string, translation: string) => {
    ensureCacheInit()
    aiCache.saveTranslation(itemId, translation)
})

ipcMain.handle("ai-cache-save-title-translation", (_, itemId: string, titleTranslation: string) => {
    ensureCacheInit()
    aiCache.saveTitleTranslation(itemId, titleTranslation)
})

ipcMain.handle("ai-cache-clear-old", (_, daysToKeep: number) => {
    ensureCacheInit()
    aiCache.clearOldCache(daysToKeep)
})

ipcMain.handle("ai-cache-size", () => {
    ensureCacheInit()
    return { bytes: aiCache.getCacheSize(), count: aiCache.getCacheCount() }
})

app.on("before-quit", () => {
    aiCache.closeDB()
})

// One-shot snapshot consumed by the renderer at startup so that all former
// sendSync getters can be served from a local cache (see bridges/startup-cache).
export function getAllStartupSettings() {
    const localeSettings = getLocaleSettings()
    return {
        groups: getGroups(),
        menuOn: getMenu(),
        closeToTray: getCloseToTray(),
        proxyStatus: getProxyStatus(),
        proxy: getProxy(),
        view: getView(),
        theme: getTheme(),
        darkColors: nativeTheme.shouldUseDarkColors,
        localeSettings: localeSettings,
        defaultLocale: app.getLocale(),
        fontSize: getFontSize(),
        font: getFont(),
        fetchInterval: getFetchInterval(),
        searchEngine: getSearchEngine(),
        serviceConfigs: getServiceConfigs(),
        filterType: getFilterType(),
        listViewConfigs: getListViewConfigs(),
        nedbStatus: getNeDBStatus(),
        shortcuts: getShortcuts(),
        aiConfigs: getAIConfigs(),
    }
}
