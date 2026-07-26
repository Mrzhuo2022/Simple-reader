// Jest setup: stub the Electron bridge APIs (window.settings / window.utils)
// that many modules access at import time (e.g. reducer initial states).
// Runs before every test file (see jest.config.js setupFiles).

const settingsStub = {
    prefetch: jest.fn(async () => {}),
    saveGroups: jest.fn(),
    loadGroups: jest.fn(() => []),
    getDefaultMenu: jest.fn(() => false),
    setDefaultMenu: jest.fn(),
    getCloseToTray: jest.fn(() => false),
    setCloseToTray: jest.fn(),
    getProxyStatus: jest.fn(() => false),
    toggleProxyStatus: jest.fn(),
    getProxy: jest.fn(() => ""),
    setProxy: jest.fn(),
    getDefaultView: jest.fn(() => 0),
    setDefaultView: jest.fn(),
    getThemeSettings: jest.fn(() => "system"),
    setThemeSettings: jest.fn(),
    shouldUseDarkColors: jest.fn(() => false),
    addThemeUpdateListener: jest.fn(),
    setLocaleSettings: jest.fn(),
    getLocaleSettings: jest.fn(() => "default"),
    getCurrentLocale: jest.fn(() => "en-US"),
    getFontSize: jest.fn(() => 16),
    setFontSize: jest.fn(),
    getFont: jest.fn(() => ""),
    setFont: jest.fn(),
    getFetchInterval: jest.fn(() => 0),
    setFetchInterval: jest.fn(),
    getSearchEngine: jest.fn(() => 0),
    setSearchEngine: jest.fn(),
    getServiceConfigs: jest.fn(() => ({ type: 0 })),
    setServiceConfigs: jest.fn(),
    getFilterType: jest.fn(() => null),
    setFilterType: jest.fn(),
    getViewConfigs: jest.fn(() => undefined),
    setViewConfigs: jest.fn(),
    getNeDBStatus: jest.fn(() => false),
    setNeDBStatus: jest.fn(),
    getShortcuts: jest.fn(() => null),
    setShortcuts: jest.fn(),
    getAIConfigs: jest.fn(() => ({
        enabled: false,
        baseUrl: "",
        apiKey: "",
        defaultModel: "",
        availableModels: [],
    })),
    setAIConfigs: jest.fn(),
    getAll: jest.fn(async () => ({})),
    setAll: jest.fn(),
}

const utilsStub = {
    platform: "linux",
    getVersion: jest.fn(() => "0.0.0-test"),
    openExternal: jest.fn(),
    showErrorBox: jest.fn(),
    showMessageBox: jest.fn(async () => true),
    showSaveDialog: jest.fn(async () => null),
    showOpenDialog: jest.fn(async () => null),
    requestAttention: jest.fn(),
    initTouchBar: jest.fn(),
    isMaximized: jest.fn(() => false),
    isFullscreen: jest.fn(() => false),
    isFocused: jest.fn(() => true),
    addWindowStateListener: jest.fn(),
}

Object.assign(window, {
    settings: settingsStub,
    utils: utilsStub,
})

// getWindowBreakpoint() reads window.outerWidth (0 in jsdom by default)
Object.defineProperty(window, "outerWidth", { value: 1920, writable: true })
