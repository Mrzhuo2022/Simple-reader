// eslint-disable-next-line @typescript-eslint/no-require-imports
import path = require("path")
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

function resolveTrayIcon(): string {
    // 16x16 is the standard tray size; macOS prefers a template image so the
    // icon adapts to the menu-bar color. We ship 16/32/64 PNGs under build/icons.
    const size = process.platform === "darwin" ? "16x16" : "32x32"
    return path.join(app.getAppPath(), "build", "icons", `${size}.png`)
}

export class TrayManager {
    private tray: Tray | null = null
    private zh: boolean

    constructor(private manager: WindowManager) {
        this.zh = isZh()
        app.on("ready", () => this.create())
    }

    private create(): void {
        let icon
        try {
            icon = nativeImage.createFromPath(resolveTrayIcon())
            if (icon.isEmpty()) icon = undefined
        } catch {
            icon = undefined
        }

        this.tray = new Tray(icon)
        // On macOS a template image adapts to light/dark menu bar.
        if (process.platform === "darwin" && icon) icon.setTemplateImage(true)

        this.tray.setToolTip("Simple Reader")

        // Left-click toggles window visibility (see toggleWindow).
        this.tray.on("click", () => this.toggleWindow())

        this.refreshMenu()
    }

    private labelShow(): string {
        return this.zh ? "显示 Simple Reader" : "Show Simple Reader"
    }
    private labelHide(): string {
        return this.zh ? "隐藏 Simple Reader" : "Hide Simple Reader"
    }
    private labelQuit(): string {
        return this.zh ? "退出" : "Quit"
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
