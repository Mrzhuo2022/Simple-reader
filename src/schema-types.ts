export class SourceGroup {
    isMultiple: boolean
    sids: number[]
    name?: string
    expanded?: boolean
    index?: number // available only from menu or groups tab container

    constructor(sids: number[], name: string = null) {
        name = (name && name.trim()) || "Source group"
        if (sids.length == 1) {
            this.isMultiple = false
        } else {
            this.isMultiple = true
            this.name = name
            this.expanded = true
        }
        this.sids = sids
    }
}

export enum ViewType {
    Cards,
    List,
    Magazine,
    Compact,
    Customized,
}

export enum ViewConfigs {
    ShowCover = 1 << 0,
    ShowSnippet = 1 << 1,
    FadeRead = 1 << 2,
}

export enum ThemeSettings {
    Default = "system",
    Light = "light",
    Dark = "dark",
}

export enum SearchEngines {
    Google,
    Bing,
    Baidu,
    DuckDuckGo,
}

export enum ImageCallbackTypes {
    OpenExternal,
    OpenExternalBg,
    SaveAs,
    Copy,
    CopyLink,
}

export enum SyncService {
    None,
    Fever,
    Feedbin,
    GReader,
    Inoreader,
    Miniflux,
    Nextcloud,
}
export interface ServiceConfigs {
    type: SyncService
    importGroups?: boolean
}

export enum WindowStateListenerType {
    Maximized,
    Focused,
    Fullscreen,
}

export interface TouchBarTexts {
    menu: string
    search: string
    refresh: string
    markAll: string
    notifications: string
}

export interface AIConfigs {
    enabled: boolean
    baseUrl: string
    apiKey: string
    defaultModel: string
    availableModels: string[]
    autoSummary?: boolean
    autoTranslateImmersive?: boolean
    translateTarget?: "zh" | "en"
    translateWhen?: "auto" | "nonTargetOnly" | "always" | "zhOnly" | "nonZhOnly"
    concurrency?: number
    maxTextLengthPerRequest?: number
    maxParagraphsPerRequest?: number
    prompts?: {
        summary?: string
        translation?: string
    }
}

export interface Shortcuts {
    aiSummary: string
    aiTranslation: string
    markRead: string
    star: string
    openExternal: string
    hide: string
    toggleWebpage: string
    toggleFull: string
    // 导航栏
    navToggleMenu?: string
    navSearch?: string
    navRefresh?: string
    navMarkAllRead?: string
    navLogs?: string
    navViews?: string
    navSettings?: string
    // 文章导航与视图控制
    prevItem?: string
    nextItem?: string
    articleClose?: string
    articleToggleWeb?: string
    articleToggleFull?: string
}

export type SchemaTypes = {
    version: string
    theme: ThemeSettings
    pac: string
    pacOn: boolean
    view: ViewType
    locale: string
    sourceGroups: SourceGroup[]
    fontSize: number
    fontFamily: string
    menuOn: boolean
    fetchInterval: number
    searchEngine: SearchEngines
    serviceConfigs: ServiceConfigs
    filterType: number
    listViewConfigs: ViewConfigs
    useNeDB: boolean
    aiConfigs: AIConfigs
    shortcuts: Shortcuts
    closeToTray: boolean
    updateLastCheckedAt: number
    updateLatestVersion: string
    updateLatestUrl: string
}
