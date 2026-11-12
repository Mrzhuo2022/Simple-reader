import { app, ipcMain, Menu, nativeTheme, session } from "electron"
import { ThemeSettings, SchemaTypes } from "./schema-types"
import { store, setAIConfigs } from "./main/settings"
import performUpdate from "./main/update-scripts"
import { WindowManager } from "./main/window"
import { TrayManager } from "./main/tray"

// 禁用GPU缓存以避免缓存权限错误
app.commandLine.appendSwitch("disable-gpu-shader-disk-cache")

if (!process.mas && !app.requestSingleInstanceLock()) {
    // Another instance holds the lock; quit without building any UI.
    app.quit()
} else {
    main()
}

function main() {
    if (!app.isPackaged) app.setAppUserModelId(process.execPath)
    else if (process.platform === "win32") app.setAppUserModelId("me.evarle.Simple-reader")

    let restarting = false

    function init() {
        performUpdate(store)
        nativeTheme.themeSource = store.get("theme", ThemeSettings.Default)
    }

    init()

    if (process.platform === "darwin") {
        const template = [
            {
                label: "Application",
                submenu: [
                    {
                        label: "Hide",
                        accelerator: "Command+H",
                        click: () => {
                            app.hide()
                        },
                    },
                    {
                        label: "Quit",
                        accelerator: "Command+Q",
                        click: () => {
                            trayManager.quit()
                        },
                    },
                ],
            },
            {
                label: "Edit",
                submenu: [
                    {
                        label: "Undo",
                        accelerator: "CmdOrCtrl+Z",
                        selector: "undo:",
                    },
                    {
                        label: "Redo",
                        accelerator: "Shift+CmdOrCtrl+Z",
                        selector: "redo:",
                    },
                    { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
                    {
                        label: "Copy",
                        accelerator: "CmdOrCtrl+C",
                        selector: "copy:",
                    },
                    {
                        label: "Paste",
                        accelerator: "CmdOrCtrl+V",
                        selector: "paste:",
                    },
                    {
                        label: "Select All",
                        accelerator: "CmdOrCtrl+A",
                        selector: "selectAll:",
                    },
                ],
            },
            {
                label: "Window",
                submenu: [
                    {
                        label: "Close",
                        accelerator: "Command+W",
                        click: () => {
                            if (winManager.hasWindow()) winManager.mainWindow.close()
                        },
                    },
                    {
                        label: "Minimize",
                        accelerator: "Command+M",
                        click: () => {
                            if (winManager.hasWindow()) winManager.mainWindow.minimize()
                        },
                    },
                    { label: "Zoom", click: () => winManager.zoom() },
                ],
            },
        ]
        Menu.setApplicationMenu(Menu.buildFromTemplate(template))
    } else {
        Menu.setApplicationMenu(null)
    }

    const winManager = new WindowManager()
    // System tray (background icon). Created after window manager so it can drive
    // the main window. Closing the window hides to tray instead of quitting.
    const trayManager = new TrayManager(winManager)
    // Wire the close-to-tray behaviour: the close button hides the window unless
    // the user explicitly quit from the tray menu (or via Cmd/Ctrl+Q on macOS) or
    // has chosen "quit on close" in settings.
    winManager.shouldHideOnClose = () => store.get("closeToTray", true) && !trayManager.isQuitting()
    // Rebuild the tray menu when the locale changes so labels follow the
    // configured language without an app restart.
    store.onDidChange("locale", () => trayManager.refreshMenu())

    app.on("window-all-closed", () => {
        // The main window runs on the default session; clear its web storage
        // directly. Checking winManager here is too late — the window is
        // already destroyed by the time this event fires, so the old check
        // silently skipped the wipe on every real close.
        session.defaultSession.clearStorageData({
            storages: ["cookies", "localstorage"],
        })
        winManager.mainWindow = null
        if (restarting) {
            restarting = false
            winManager.createWindow()
        } else if (trayManager.isQuitting()) {
            app.quit()
        }
        // Otherwise (window closed by user): stay alive in the tray; the user can
        // reopen via the tray icon or quit via the tray menu.
    })

    // Keys that may be written by importing settings. A fixed whitelist keeps
    // a compromised renderer from planting arbitrary store entries (e.g. the
    // updater cache keys). useNeDB is included because restoring a nedb-era
    // backup must re-trigger the nedb migration on restart; the renderer can
    // set it through set-nedb-status anyway, so excluding it adds nothing.
    const IMPORTABLE_KEYS: (keyof SchemaTypes)[] = [
        "version",
        "theme",
        "pac",
        "pacOn",
        "view",
        "locale",
        "sourceGroups",
        "fontSize",
        "fontFamily",
        "menuOn",
        "fetchInterval",
        "searchEngine",
        "serviceConfigs",
        "filterType",
        "listViewConfigs",
        "useNeDB",
        "shortcuts",
        "closeToTray",
    ]

    ipcMain.handle("import-all-settings", (_, configs: SchemaTypes) => {
        restarting = true
        store.clear()
        for (const key of IMPORTABLE_KEYS) {
            if (key in configs) {
                store.set(key, configs[key])
            }
        }
        // aiConfigs goes through the dedicated setter so the imported API
        // key is sealed with the OS keyring like every other write path.
        if ("aiConfigs" in configs) {
            setAIConfigs(configs.aiConfigs)
        }
        performUpdate(store)
        nativeTheme.themeSource = store.get("theme", ThemeSettings.Default)
        // Wait for the theme update to propagate before closing the window on macOS to avoid visual glitches
        const closeDelay = process.platform === "darwin" ? 1000 : 0
        setTimeout(() => {
            if (winManager.hasWindow()) {
                // destroy() bypasses the close handler, which would otherwise
                // hide-to-tray (default closeToTray) and leave the "restart"
                // as a hidden window running with stale settings.
                winManager.mainWindow.destroy()
            }
        }, closeDelay)
    })
}
