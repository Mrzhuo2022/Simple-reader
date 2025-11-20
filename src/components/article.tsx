import * as React from "react"
import intl from "react-intl-universal"
import { renderToString } from "react-dom/server"
import { RSSItem } from "../scripts/models/item"
import {
    Stack,
    CommandBarButton,
    IContextualMenuProps,
    FocusZone,
    ContextualMenuItemType,
    Spinner,
    Icon,
    Link,
} from "@fluentui/react"
import SourceIcon from "./utils/source-icon"
import { RSSSource, SourceOpenTarget, SourceTextDirection } from "../scripts/models/source"
import { shareSubmenu } from "./context-menu"
import { platformCtrl, decodeFetchResponse } from "../scripts/utils"
import { getEffectiveItem as buildEffectiveItem } from "./utils/effective-item"
import { ArticleAIHandler, ArticleAIState } from "./article-ai"
import * as ArticleScripts from "./article-scripts"

const FONT_SIZE_OPTIONS = [12, 13, 14, 15, 16, 17, 18, 19, 20]

interface ArticleProps {
    item: RSSItem
    source: RSSSource
    locale: string
    shortcuts: (item: RSSItem, e: KeyboardEvent) => void
    dismiss: () => void
    offsetItem: (offset: number) => void
    toggleHasRead: (item: RSSItem) => void
    toggleStarred: (item: RSSItem) => void
    toggleHidden: (item: RSSItem) => void
    textMenu: (position: [number, number], text: string, url: string) => void
    imageMenu: (position: [number, number]) => void
    dismissContextMenu: () => void
    updateSourceTextDirection: (source: RSSSource, direction: SourceTextDirection) => void
}

interface ArticleState extends ArticleAIState {
    fontFamily: string
    fontSize: number
    loadWebpage: boolean
    loadFull: boolean
    fullContent: string
    loaded: boolean
    error: boolean
    errorDescription: string
}

class Article extends React.Component<ArticleProps, ArticleState> {
    private webview: Electron.WebviewTag | null = null
    private aiHandler: ArticleAIHandler | null = null
    private unmounted: boolean = false

    constructor(props: ArticleProps) {
        super(props)
        this.state = {
            fontFamily: window.settings.getFont(),
            fontSize: window.settings.getFontSize(),
            loadWebpage: props.source.openTarget === SourceOpenTarget.Webpage,
            loadFull: props.source.openTarget === SourceOpenTarget.FullContent,
            fullContent: "",
            loaded: false,
            error: false,
            errorDescription: "",
            aiSummary: "",
            aiSummaryLoading: false,
            showTranslation: false,
            titleTranslation: "",
            aiTranslation: [],
            translationLoading: false,
            translationProgress: 0,
            translationTotal: 0,
            translationRunId: 0,
        }
        
        
        if (props.source.openTarget === SourceOpenTarget.FullContent) {
            this.loadFull()
        }
    }

    componentDidMount = () => {
        // Bind global webview-related listeners
        window.utils.addWebviewContextListener(this.contextMenuHandler)
        window.utils.addWebviewKeydownListener(this.keyDownHandler)
        window.utils.addWebviewErrorListener(this.webviewError)
        this.initWebviewReference()
        this.initAIHandler()
        
        const effectiveItem = this.getEffectiveItem()
        if (effectiveItem.autoFullText && !this.state.loadFull) {
            this.toggleFull()
        }
    }

    componentDidUpdate = (prevProps: ArticleProps, prevState: ArticleState) => {
        if (prevProps.item._id !== this.props.item._id) {
            // Article changed - cleanup and reset
            this.cleanupAIHandler()
            this.setState(
                {
                    loadWebpage: this.props.source.openTarget === SourceOpenTarget.Webpage,
                    loadFull: this.props.source.openTarget === SourceOpenTarget.FullContent,
                    aiSummary: "",
                    aiSummaryLoading: false,
                    showTranslation: false,
                    titleTranslation: "",
                    aiTranslation: [],
                    translationLoading: false,
                    translationProgress: 0,
                    translationTotal: 0,
                    translationRunId: 0,
                    fullContent: "",
                },
                () => {
                    this.initAIHandler()
                    const effectiveItem = this.getEffectiveItem()
                    if (effectiveItem.autoFullText && !this.state.loadFull) {
                        this.toggleFull()
                    }
                }
            )
            if (this.props.source.openTarget === SourceOpenTarget.FullContent) {
                this.loadFull()
            }
        }
        
        // Handle full content changes
        if (
            prevState.loadFull !== this.state.loadFull ||
            (this.state.loadFull && prevState.fullContent !== this.state.fullContent)
        ) {
            if (this.state.showTranslation && this.aiHandler) {
                this.aiHandler.translateArticle(this.state.fullContent).catch(err =>
                    console.warn("re-translate after full content change:", err)
                )
            }
            if (this.state.aiSummary && this.aiHandler) {
                this.aiHandler.ensureSummaryInjected()
            }
        }
        
        // Monitor aiSummary changes for auto-injection
        if (prevState.aiSummary !== this.state.aiSummary && this.state.aiSummary && this.aiHandler) {
            this.aiHandler.ensureSummaryInjected()
        }
        
        this.initWebviewReference()
    }

    componentWillUnmount = () => {
        this.unmounted = true
        if (this.webview) {
            this.webview.removeEventListener("did-stop-loading", this.webviewLoaded)
        }
        // Reset global listeners to no-op
        window.utils.addWebviewContextListener(() => {})
        window.utils.addWebviewKeydownListener(() => {})
        window.utils.addWebviewErrorListener(() => {})
        const refocus = document.querySelector(
            `#refocus div[data-iid="${this.props.item._id}"]`
        ) as HTMLElement
        if (refocus) refocus.focus()
        this.cleanupAIHandler()
    }

    // --- AI Handler Initialization ---

    private initAIHandler = () => {
        this.aiHandler = new ArticleAIHandler(
            {
                executeScript: <T = unknown>(code: string) => this.webviewExec<T>(code),
            },
            () => this.props.item,
            () => this.props.source,
            () => this.getAIState(),
            (partial) => this.updateAIState(partial)
        )
        
        // Load cached AI content
        this.aiHandler.loadAICache()
    }

    private cleanupAIHandler = () => {
        if (this.aiHandler) {
            this.aiHandler.cleanup()
            this.aiHandler = null
        }
    }

    private getAIState = (): ArticleAIState => ({
        aiSummary: this.state.aiSummary,
        aiSummaryLoading: this.state.aiSummaryLoading,
        showTranslation: this.state.showTranslation,
        titleTranslation: this.state.titleTranslation,
        aiTranslation: this.state.aiTranslation,
        translationLoading: this.state.translationLoading,
        translationProgress: this.state.translationProgress,
        translationTotal: this.state.translationTotal,
        translationRunId: this.state.translationRunId,
    })

    private updateAIState = (partial: Partial<ArticleAIState>) => {
        if (this.unmounted) return
        this.setState(prevState => ({ ...prevState, ...partial }))
    }

    private getEffectiveItem = (): RSSItem => buildEffectiveItem(this.props.item, this.props.source)

    // --- WebView Management ---

    private initWebviewReference = () => {
        const webview = document.getElementById("article") as Electron.WebviewTag
        if (webview !== this.webview) {
            if (this.webview) {
                this.webview.removeEventListener("did-stop-loading", this.webviewLoaded)
            }
            this.webview = webview
            if (webview) {
                webview.focus()
                this.setState({ loaded: false, error: false })
                webview.addEventListener("did-stop-loading", this.webviewLoaded)
                const card = document.querySelector(
                    `#refocus div[data-iid="${this.props.item._id}"]`
                ) as HTMLElement
                if (card && "scrollIntoViewIfNeeded" in card) {
                    (card as HTMLElement & { scrollIntoViewIfNeeded: () => void }).scrollIntoViewIfNeeded()
                }
            }
        }
    }

    private webviewExec = async <T = unknown>(code: string): Promise<T | null> => {
        if (!this.webview || this.unmounted) return null
        try {
            return await (
                this.webview as {
                    executeJavaScript: (code: string, userGesture: boolean) => Promise<T>
                }
            ).executeJavaScript(code, true)
        } catch {
            return null
        }
    }

    private injectCodeBlockStyles = async () => {
        await this.webviewExec(ArticleScripts.getCodeBlockStylesScript())
    }

    private webviewLoaded = () => {
        this.setState({ loaded: true }, () => {
            this.injectCodeBlockStyles().catch(console.warn)
            
            if (!this.aiHandler) return
            
            // Inject AI summary if available
            if (this.state.aiSummary) {
                this.aiHandler.ensureSummaryInjected().catch(err =>
                    console.warn("inject AI summary after webview loaded failed:", err)
                )
            }
            
            // Handle translation injection
            if (this.state.showTranslation) {
                if (this.state.aiTranslation.length > 0) {
                    this.aiHandler.injectCachedTranslations().catch(err =>
                        console.warn("inject cached translations failed:", err)
                    )
                }
                if (this.state.titleTranslation) {
                    this.aiHandler.injectTitleTranslation(this.state.titleTranslation).catch(err =>
                        console.warn("inject title translation failed:", err)
                    )
                }
                if (this.state.aiTranslation.length === 0 && !this.state.translationLoading) {
                    this.aiHandler.translateArticle(this.state.fullContent).catch(err =>
                        console.warn("translate after webviewLoaded failed:", err)
                    )
                }
            }
            
            // Auto-run AI features if configured
            this.aiHandler.maybeAutoRunAI()
        })
    }

    private webviewError = (reason: string) => {
        this.setState({ error: true, errorDescription: reason })
    }

    private webviewReload = () => {
        if (this.webview) {
            this.setState({ loaded: false, error: false })
            this.webview.reload()
        } else if (this.state.loadFull) {
            this.loadFull()
        }
    }

    // --- Event Handlers ---

    private contextMenuHandler = (pos: [number, number], text: string, url: string) => {
        if (pos) {
            if (text || url) this.props.textMenu(pos, text, url)
            else this.props.imageMenu(pos)
        } else {
            this.props.dismissContextMenu()
        }
    }

    private keyDownHandler = (input: Electron.Input) => {
        if (input.type !== "keyDown") return

        let shortcuts: import("../schema-types").Shortcuts | null = null
        try {
            shortcuts = window.settings?.getShortcuts?.() || null
        } catch {
            shortcuts = null
        }

        const isMatch = (shortcut: string | undefined, ev: Electron.Input) => {
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
            if (!!ev.control !== needCtrl) return false
            if (!!ev.meta !== needMeta) return false
            if (!!ev.alt !== needAlt) return false
            if (!!ev.shift !== needShift) return false

            return true
        }

        if (shortcuts) {
            // Article-level controls
            if (isMatch(shortcuts.articleClose, input)) {
                this.props.dismiss()
                return
            }
            if (isMatch(shortcuts.prevItem, input)) {
                this.props.offsetItem(-1)
                return
            }
            if (isMatch(shortcuts.nextItem, input)) {
                this.props.offsetItem(1)
                return
            }
            if (isMatch(shortcuts.articleToggleWeb, input)) {
                this.toggleWebpage()
                return
            }
            if (isMatch(shortcuts.articleToggleFull, input)) {
                this.toggleFull()
                return
            }

            // AI features
            const aiConfigs = window.settings.getAIConfigs()
            if (aiConfigs.enabled) {
                if (isMatch(shortcuts.aiSummary, input)) {
                    this.generateSummary().catch(console.warn)
                    return
                }
                if (isMatch(shortcuts.aiTranslation, input)) {
                    this.toggleTranslation()
                    return
                }
            }

            // Item shortcuts
            const keyboardEvent = new KeyboardEvent("keydown", {
                code: input.code,
                key: input.key,
                shiftKey: input.shift,
                altKey: input.alt,
                ctrlKey: input.control,
                metaKey: input.meta,
                repeat: input.isAutoRepeat,
                bubbles: true,
            })
            this.props.shortcuts(this.props.item, keyboardEvent)
            document.dispatchEvent(keyboardEvent)
            return
        }

        // Fallback to legacy key bindings
        switch (input.key) {
            case "Escape":
                this.props.dismiss()
                break
            case "ArrowLeft":
            case "ArrowRight":
                this.props.offsetItem(input.key === "ArrowLeft" ? -1 : 1)
                break
            case "l":
            case "L":
                this.toggleWebpage()
                break
            case "w":
            case "W":
                this.toggleFull()
                break
            case "H":
            case "h":
                if (!input.meta) this.props.toggleHidden(this.props.item)
                break
            default: {
                const keyboardEvent = new KeyboardEvent("keydown", {
                    code: input.code,
                    key: input.key,
                    shiftKey: input.shift,
                    altKey: input.alt,
                    ctrlKey: input.control,
                    metaKey: input.meta,
                    repeat: input.isAutoRepeat,
                    bubbles: true,
                })
                this.props.shortcuts(this.props.item, keyboardEvent)
                document.dispatchEvent(keyboardEvent)
                break
            }
        }
    }

    // --- Font and Display Settings ---

    private setFontSize = (size: number) => {
        window.settings.setFontSize(size)
        this.setState({ fontSize: size })
    }

    private setFont = (font: string) => {
        window.settings.setFont(font)
        this.setState({ fontFamily: font })
    }

    private fontSizeMenuProps = (): IContextualMenuProps => ({
        items: FONT_SIZE_OPTIONS.map(size => ({
            key: String(size),
            text: String(size),
            canCheck: true,
            checked: size === this.state.fontSize,
            onClick: () => this.setFontSize(size),
        })),
    })

    private fontFamilyMenuProps = (): IContextualMenuProps => ({
        items: window.fontList.map((font, idx) => ({
            key: String(idx),
            text: font === "" ? intl.get("default") : font,
            canCheck: true,
            checked: this.state.fontFamily === font,
            onClick: () => this.setFont(font),
        })),
    })

    private updateTextDirection = (direction: SourceTextDirection) => {
        this.props.updateSourceTextDirection(this.props.source, direction)
    }

    private directionMenuProps = (): IContextualMenuProps => ({
        items: [
            {
                key: "LTR",
                text: intl.get("nav.LTR"),
                iconProps: { iconName: "Forward" },
                canCheck: true,
                checked: this.props.source.textDir === SourceTextDirection.LTR,
                onClick: () => this.updateTextDirection(SourceTextDirection.LTR),
            },
            {
                key: "RTL",
                text: intl.get("nav.RTL"),
                iconProps: { iconName: "Back" },
                canCheck: true,
                checked: this.props.source.textDir === SourceTextDirection.RTL,
                onClick: () => this.updateTextDirection(SourceTextDirection.RTL),
            },
            {
                key: "Vertical",
                text: intl.get("nav.Vertical"),
                iconProps: { iconName: "Down" },
                canCheck: true,
                checked: this.props.source.textDir === SourceTextDirection.Vertical,
                onClick: () => this.updateTextDirection(SourceTextDirection.Vertical),
            },
        ],
    })

    private moreMenuProps = (): IContextualMenuProps => ({
        items: [
            {
                key: "openInBrowser",
                text: intl.get("openExternal"),
                iconProps: { iconName: "NavigateExternalInline" },
                onClick: e => {
                    window.utils.openExternal(this.props.item.link, platformCtrl(e))
                },
            },
            {
                key: "copyURL",
                text: intl.get("context.copyURL"),
                iconProps: { iconName: "Link" },
                onClick: () => {
                    window.utils.writeClipboard(this.props.item.link)
                },
            },
            {
                key: "toggleHidden",
                text: this.props.item.hidden
                    ? intl.get("article.unhide")
                    : intl.get("article.hide"),
                iconProps: {
                    iconName: this.props.item.hidden ? "View" : "Hide3",
                },
                onClick: () => {
                    this.props.toggleHidden(this.props.item)
                },
            },
            {
                key: "divider_0",
                itemType: ContextualMenuItemType.Divider,
            },
            {
                key: "fontMenu",
                text: intl.get("nav.font"),
                iconProps: { iconName: "Font" },
                disabled: this.state.loadWebpage,
                subMenuProps: this.fontFamilyMenuProps(),
            },
            {
                key: "fontSizeMenu",
                text: intl.get("nav.fontSize"),
                iconProps: { iconName: "FontSize" },
                disabled: this.state.loadWebpage,
                subMenuProps: this.fontSizeMenuProps(),
            },
            {
                key: "directionMenu",
                text: intl.get("nav.textDir"),
                iconProps: { iconName: "ChangeEntitlements" },
                disabled: this.state.loadWebpage,
                subMenuProps: this.directionMenuProps(),
            },
            {
                key: "divider_1",
                itemType: ContextualMenuItemType.Divider,
            },
            ...shareSubmenu(this.props.item),
        ],
    })

    // --- Toggle Functions ---

    private toggleWebpage = () => {
        if (this.state.loadWebpage) {
            this.setState({ loadWebpage: false })
        } else if (
            this.props.item.link.startsWith("https://") ||
            this.props.item.link.startsWith("http://")
        ) {
            this.setState({ loadWebpage: true, loadFull: false })
        }
    }

    private toggleFull = () => {
        if (this.state.loadFull) {
            this.setState({ loadFull: false })
        } else if (this.canLoadFullFromUrl()) {
            this.setState({ loadFull: true, loadWebpage: false })
            this.loadFull()
        }
    }

    private canLoadFullFromUrl = (): boolean => {
        const link = this.props.item.link || ""
        return link.startsWith("https://") || link.startsWith("http://")
    }

    private loadFull = async () => {
        this.setState({ fullContent: "", loaded: false, error: false })
        const link = this.props.item.link
        try {
            const result = await fetch(link)
            if (!result || !result.ok) throw new Error(`HTTP ${result?.status || "error"}`)
            const html = await decodeFetchResponse(result, true)
            if (!this.unmounted && link === this.props.item.link) {
                this.setState({ fullContent: html, loaded: true })
            }
        } catch (err) {
            const error = err as Error
            console.error("[Article] Load full content failed:", error.message || error)
            if (!this.unmounted && link === this.props.item.link) {
                this.setState({
                    loaded: true,
                    error: true,
                    errorDescription: "MERCURY_PARSER_FAILURE",
                })
            }
        }
    }

    // --- AI Feature Handlers ---

    private generateSummary = async () => {
        if (this.aiHandler) {
            await this.aiHandler.generateSummary(this.state.fullContent)
        }
    }

    private toggleTranslation = async () => {
        if (this.aiHandler) {
            await this.aiHandler.toggleTranslation()
        }
    }

    // --- Rendering ---

    private articleView = () => {
        const articleContent = this.state.loadFull
            ? this.state.fullContent
            : this.props.item.content || this.props.item.snippet || ""

        const a = encodeURIComponent(articleContent)

        const h = encodeURIComponent(
            renderToString(
                <>
                    <p className="title">{this.props.item.title}</p>
                    <p className="date">
                        {this.props.item.date.toLocaleString(this.props.locale, {
                            hour12: !this.props.locale.startsWith("zh"),
                        })}
                    </p>
                    <article></article>
                </>
            )
        )
        return `article/article.html?a=${a}&h=${h}&f=${encodeURIComponent(
            this.state.fontFamily
        )}&s=${this.state.fontSize}&d=${this.props.source.textDir}&u=${this.props.item.link}&m=${
            this.state.loadFull ? 1 : 0
        }`
    }

    render = () => (
        <FocusZone className="article">
            <Stack horizontal style={{ height: 36 }}>
                <span style={{ width: 96 }}></span>
                <Stack className="actions" grow horizontal tokens={{ childrenGap: 12 }}>
                    <Stack.Item grow>
                        <span className="source-name">
                            {this.state.loaded ? (
                                <SourceIcon url={this.props.source.iconurl} />
                            ) : (
                                <Spinner size={1} />
                            )}
                            {this.props.source.name}
                            {this.props.item.creator && (
                                <span className="creator">{this.props.item.creator}</span>
                            )}
                        </span>
                    </Stack.Item>
                    <CommandBarButton
                        title={
                            this.props.item.hasRead
                                ? intl.get("article.markUnread")
                                : intl.get("article.markRead")
                        }
                        iconProps={
                            this.props.item.hasRead
                                ? { iconName: "StatusCircleRing" }
                                : {
                                      iconName: "RadioBtnOn",
                                      style: {
                                          fontSize: 14,
                                          textAlign: "center",
                                      },
                                  }
                        }
                        onClick={() => this.props.toggleHasRead(this.props.item)}
                    />
                    <CommandBarButton
                        title={
                            this.props.item.starred
                                ? intl.get("article.unstar")
                                : intl.get("article.star")
                        }
                        iconProps={{
                            iconName: this.props.item.starred ? "FavoriteStarFill" : "FavoriteStar",
                        }}
                        onClick={() => this.props.toggleStarred(this.props.item)}
                    />
                    <CommandBarButton
                        title={intl.get("nav.loadFull")}
                        className={this.state.loadFull ? "active" : ""}
                        iconProps={{ iconName: "RawSource" }}
                        onClick={this.toggleFull}
                    />
                    <CommandBarButton
                        title={intl.get("nav.loadWebpage")}
                        className={this.state.loadWebpage ? "active" : ""}
                        iconProps={{ iconName: "Globe" }}
                        onClick={this.toggleWebpage}
                    />
                    <CommandBarButton
                        title={intl.get("ai.summary")}
                        iconProps={{ iconName: "Lightbulb" }}
                        onClick={() => {
                            this.generateSummary().catch(err => {
                                console.error("Summary generation error:", err)
                            })
                        }}
                        disabled={this.state.aiSummaryLoading}
                    />
                    <CommandBarButton
                        title={intl.get("ai.translate")}
                        className={this.state.showTranslation ? "active" : ""}
                        iconProps={{ iconName: "LocaleLanguage" }}
                        onClick={this.toggleTranslation}
                        disabled={this.state.translationLoading}
                    />
                    <CommandBarButton
                        title={intl.get("more")}
                        iconProps={{ iconName: "More" }}
                        menuIconProps={{ style: { display: "none" } }}
                        menuProps={this.moreMenuProps()}
                    />
                </Stack>
                <Stack horizontal horizontalAlign="end" style={{ width: 112 }}>
                    <CommandBarButton
                        title={intl.get("close")}
                        iconProps={{ iconName: "BackToWindow" }}
                        onClick={this.props.dismiss}
                    />
                </Stack>
            </Stack>
            {(!this.state.loadFull || this.state.fullContent) && (
                <webview
                    id="article"
                    className={this.state.error ? "error" : ""}
                    key={
                        this.props.item._id +
                        (this.state.loadWebpage ? "_" : "") +
                        (this.state.loadFull ? "__" : "")
                    }
                    src={this.state.loadWebpage ? this.props.item.link : this.articleView()}
                    // eslint-disable-next-line react/no-unknown-property
                    allowpopups={"true" as unknown as boolean}
                    // eslint-disable-next-line react/no-unknown-property
                    webpreferences="contextIsolation,disableDialogs,autoplayPolicy=document-user-activation-required"
                    // eslint-disable-next-line react/no-unknown-property
                    partition={this.state.loadWebpage ? "sandbox" : undefined}
                />
            )}
            {this.state.error && (
                <Stack
                    className="error-prompt"
                    verticalAlign="center"
                    horizontalAlign="center"
                    tokens={{ childrenGap: 12 }}
                >
                    <Icon iconName="HeartBroken" style={{ fontSize: 32 }} />
                    <Stack horizontal horizontalAlign="center" tokens={{ childrenGap: 7 }}>
                        <small>{intl.get("article.error")}</small>
                        <small>
                            <Link onClick={this.webviewReload}>{intl.get("article.reload")}</Link>
                        </small>
                    </Stack>
                    <span style={{ fontSize: 11 }}>{this.state.errorDescription}</span>
                </Stack>
            )}
        </FocusZone>
    )
}

export default Article
