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

// Snapshot of everything the renderer used to read through sendSync.
// Filled once by the "get-all-startup-data" invoke before the app boots,
// then kept up to date by the setters and by main-process push events
// (theme-updated, maximized/unmaximized, window-focus/blur, ...).
export interface StartupData {
    groups: SourceGroup[]
    menuOn: boolean
    closeToTray: boolean
    proxyStatus: boolean
    proxy: string
    view: ViewType
    theme: ThemeSettings
    darkColors: boolean
    localeSettings: string
    defaultLocale: string
    fontSize: number
    font: string
    fetchInterval: number
    searchEngine: SearchEngines
    serviceConfigs: ServiceConfigs
    filterType: number
    listViewConfigs: ViewConfigs
    nedbStatus: boolean
    shortcuts: Shortcuts
    aiConfigs: AIConfigs
    version: string
    maximized: boolean
    fullscreen: boolean
    focused: boolean
}

export const cache = {} as StartupData
