// eslint-disable-next-line @typescript-eslint/no-require-imports
import path = require("path")
// eslint-disable-next-line @typescript-eslint/no-require-imports
import fs = require("fs")
import { app, Menu, Tray, nativeImage } from "electron"
import { store } from "./settings"
import { WindowManager } from "./window"

/**
 * System-tray integration.
 *
 * Behaviour (per user preference):
 *  - Closing the window hides it to the tray instead of quitting, so RSS
 *    fetching can continue in the background.
 *  - Left-click toggles window show/hide.
 *  - Right-click menu offers Show/Hide + Quit.
 *
 * Menu labels follow the configured app locale (zh vs everything else), since
 * the main process has no access to react-intl-universal (renderer-only).
 */

function isZh(): boolean {
    const setting = store.get("locale", "default") as string
    const locale = setting === "default" ? app.getLocale() : setting
    return locale.toLowerCase().startsWith("zh")
}

/**
 * Resolve a usable tray icon file path. We probe several candidate locations
 * (the app root differs between dev and packaged builds, and the icon folder
 * layout varies) and return the first PNG that actually exists on disk. The
 * Tray constructor rejects empty/undefined images, so we must never hand it
 * nothing — the last-resort built-in 16x16 nativeImage is used if no file is
 * found.
 */
function resolveTrayIconPath(): string | null {
    const size = process.platform === "darwin" ? "16x16" : "32x32"
    const candidates = [
        // dev mode: app root is the project dir
        path.join(app.getAppPath(), "build", "icons", `${size}.png`),
        path.join(app.getAppPath(), "build", "icon.png"),
        // packaged: resources may sit beside the asar
        process.resourcesPath && path.join(process.resourcesPath, "build", "icons", `${size}.png`),
        process.resourcesPath && path.join(process.resourcesPath, "build", "icon.png"),
        // relative fallbacks for when getAppPath is the dist dir
        path.join(app.getAppPath(), "..", "build", "icons", `${size}.png`),
        path.join(app.getAppPath(), "..", "build", "icon.png"),
    ].filter(Boolean) as string[]

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) return candidate
        } catch {
            /* ignore, try next */
        }
    }
    return null
}

export class TrayManager {
    private tray: Tray | null = null

    constructor(private manager: WindowManager) {
        app.on("ready", () => this.create())
    }

    private create(): void {
        const iconPath = resolveTrayIconPath()
        let icon: Electron.NativeImage
        if (iconPath) {
            icon = nativeImage.createFromPath(iconPath)
        }
        if (!icon || icon.isEmpty()) {
            // Absolute last resort: a 1x1 transparent image so Tray() never
            // throws "Argument must be a file path or a NativeImage". The
            // tooltip + context menu still identify the app.
            icon = nativeImage.createEmpty()
            // createEmpty returns an empty (0x0) image which some platforms
            // also reject; resize to 1x1 to be safe.
            icon = icon.resize({ width: 16, height: 16 })
        }

        this.tray = new Tray(icon)
        // On macOS a template image adapts to light/dark menu bar.
        if (process.platform === "darwin") icon.setTemplateImage(true)

        this.tray.setToolTip("Simple Reader")

        // Left-click toggles window visibility (see toggleWindow).
        this.tray.on("click", () => this.toggleWindow())

        this.refreshMenu()
    }

    private labelShow(): string {
        return isZh() ? "显示" : "Show"
    }
    private labelHide(): string {
        return isZh() ? "隐藏" : "Hide"
    }
    private labelQuit(): string {
        return isZh() ? "退出" : "Quit"
    }

    /** Rebuild the context menu — call when window state changes if needed. */
    refreshMenu(): void {
        if (!this.tray) return
        const visible = this.isWindowVisible()
        const menu = Menu.buildFromTemplate([
            {
                label: visible ? this.labelHide() : this.labelShow(),
                click: () => this.toggleWindow(),
            },
            { type: "separator" },
            {
                label: this.labelQuit(),
                click: () => this.quit(),
            },
        ])
        this.tray.setContextMenu(menu)
    }

    private isWindowVisible(): boolean {
        const win = this.manager.mainWindow
        return !!win && !win.isDestroyed() && win.isVisible()
    }

    /** Show, hide, or restore+focus the main window depending on its state. */
    toggleWindow(): void {
        const win = this.manager.mainWindow
        if (!win || win.isDestroyed()) {
            this.manager.createWindow()
            return
        }
        if (win.isVisible() && win.isFocused()) {
            win.hide()
        } else {
            if (!win.isVisible()) win.show()
            win.focus()
        }
        this.refreshMenu()
    }

    /** Quit the whole app from the tray (bypasses the hide-to-tray intercept). */
    private quitting = false
    isQuitting(): boolean {
        return this.quitting
    }
    quit(): void {
        this.quitting = true
        app.quit()
    }
}
