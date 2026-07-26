import {
    SourceGroup,
    ViewType,
    ThemeSettings,
    SearchEngines,
    ServiceConfigs,
    ViewConfigs,
    AIConfigs,
    Shortcuts,
} from "../schema-types"
import { ipcRenderer } from "electron"
import { AICacheEntry } from "../scripts/models/services/aiCache"
import { cache } from "./startup-cache"

const settingsBridge = {
    // Fills the local cache with one round-trip. Must resolve before any of
    // the synchronous getters below are used (index.tsx awaits it on boot).
    prefetch: async (): Promise<void> => {
        Object.assign(cache, await ipcRenderer.invoke("get-all-startup-data"))
    },

    saveGroups: (groups: SourceGroup[]) => {
        cache.groups = groups
        ipcRenderer.invoke("set-groups", groups)
    },
    loadGroups: (): SourceGroup[] => {
        return cache.groups
    },

    getDefaultMenu: (): boolean => {
        return cache.menuOn
    },
    setDefaultMenu: (state: boolean) => {
        cache.menuOn = state
        ipcRenderer.invoke("set-menu", state)
    },

    getCloseToTray: (): boolean => {
        return cache.closeToTray
    },
    setCloseToTray: (state: boolean) => {
        cache.closeToTray = state
        ipcRenderer.invoke("set-close-to-tray", state)
    },

    getProxyStatus: (): boolean => {
        return cache.proxyStatus
    },
    toggleProxyStatus: () => {
        cache.proxyStatus = !cache.proxyStatus
        ipcRenderer.send("toggle-proxy-status")
    },
    getProxy: (): string => {
        return cache.proxy
    },
    setProxy: (address?: string | null) => {
        if (address) cache.proxy = address
        ipcRenderer.invoke("set-proxy", address)
    },

    getDefaultView: (): ViewType => {
        return cache.view
    },
    setDefaultView: (viewType: ViewType) => {
        cache.view = viewType
        ipcRenderer.invoke("set-view", viewType)
    },

    getThemeSettings: (): ThemeSettings => {
        return cache.theme
    },
    setThemeSettings: (theme: ThemeSettings) => {
        cache.theme = theme
        ipcRenderer.invoke("set-theme", theme)
    },
    shouldUseDarkColors: (): boolean => {
        return cache.darkColors
    },
    addThemeUpdateListener: (callback: (shouldDark: boolean) => void) => {
        ipcRenderer.on("theme-updated", (_, shouldDark) => {
            cache.darkColors = shouldDark
            callback(shouldDark)
        })
    },

    setLocaleSettings: (option: string) => {
        cache.localeSettings = option
        ipcRenderer.invoke("set-locale", option)
    },
    getLocaleSettings: (): string => {
        return cache.localeSettings
    },
    getCurrentLocale: (): string => {
        return cache.localeSettings === "default" ? cache.defaultLocale : cache.localeSettings
    },

    getFontSize: (): number => {
        return cache.fontSize
    },
    setFontSize: (size: number) => {
        cache.fontSize = size
        ipcRenderer.invoke("set-font-size", size)
    },

    getFont: (): string => {
        return cache.font
    },
    setFont: (font: string) => {
        cache.font = font
        ipcRenderer.invoke("set-font", font)
    },

    getFetchInterval: (): number => {
        return cache.fetchInterval
    },
    setFetchInterval: (interval: number) => {
        cache.fetchInterval = interval
        ipcRenderer.invoke("set-fetch-interval", interval)
    },

    getSearchEngine: (): SearchEngines => {
        return cache.searchEngine
    },
    setSearchEngine: (engine: SearchEngines) => {
        cache.searchEngine = engine
        ipcRenderer.invoke("set-search-engine", engine)
    },

    getServiceConfigs: (): ServiceConfigs => {
        return cache.serviceConfigs
    },
    setServiceConfigs: (configs: ServiceConfigs) => {
        cache.serviceConfigs = configs
        ipcRenderer.invoke("set-service-configs", configs)
    },

    getFilterType: (): number => {
        return cache.filterType
    },
    setFilterType: (filterType: number) => {
        cache.filterType = filterType
        ipcRenderer.invoke("set-filter-type", filterType)
    },

    getViewConfigs: (view: ViewType): ViewConfigs => {
        switch (view) {
            case ViewType.List:
                return cache.listViewConfigs
            default:
                return undefined
        }
    },
    setViewConfigs: (view: ViewType, configs: ViewConfigs) => {
        if (view === ViewType.List) cache.listViewConfigs = configs
        ipcRenderer.invoke("set-view-configs", view, configs)
    },

    getNeDBStatus: (): boolean => {
        return cache.nedbStatus
    },
    setNeDBStatus: (flag: boolean) => {
        cache.nedbStatus = flag
        ipcRenderer.invoke("set-nedb-status", flag)
    },

    getShortcuts: (): Shortcuts => {
        return cache.shortcuts
    },
    setShortcuts: (shortcuts: Shortcuts) => {
        cache.shortcuts = shortcuts
        ipcRenderer.invoke("set-shortcuts", shortcuts)
    },

    getAIConfigs: (): AIConfigs => {
        return cache.aiConfigs
    },
    setAIConfigs: (configs: AIConfigs) => {
        cache.aiConfigs = configs
        ipcRenderer.invoke("set-ai-configs", configs)
    },

    // AI Cache
    getAICache: async (itemId: string): Promise<AICacheEntry | null> => {
        return ipcRenderer.invoke("ai-cache-get", itemId)
    },
    saveAISummary: async (itemId: string, summary: string): Promise<void> => {
        return ipcRenderer.invoke("ai-cache-save-summary", itemId, summary)
    },
    saveAITranslation: async (itemId: string, translation: string): Promise<void> => {
        return ipcRenderer.invoke("ai-cache-save-translation", itemId, translation)
    },
    saveTitleTranslation: async (itemId: string, titleTranslation: string): Promise<void> => {
        return ipcRenderer.invoke("ai-cache-save-title-translation", itemId, titleTranslation)
    },
    clearOldAICache: async (daysToKeep: number = 30): Promise<void> => {
        return ipcRenderer.invoke("ai-cache-clear-old", daysToKeep)
    },
    getAICacheSize: async (): Promise<{ bytes: number; count: number }> => {
        return ipcRenderer.invoke("ai-cache-size")
    },

    getAll: async (): Promise<Record<string, unknown>> => {
        return (await ipcRenderer.invoke("get-all-settings")) as Record<string, unknown>
    },

    setAll: (configs: Record<string, unknown>): void => {
        ipcRenderer.invoke("import-all-settings", configs)
    },
}

declare global {
    interface Window {
        settings: typeof settingsBridge
    }
}

export default settingsBridge
