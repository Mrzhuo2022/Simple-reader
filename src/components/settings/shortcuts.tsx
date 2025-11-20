import * as React from "react"
import intl from "react-intl-universal"
import { Shortcuts } from "../../schema-types"
import { Stack, Label, TextField, MessageBar, MessageBarType } from "@fluentui/react"

type ShortcutsTabProps = Record<string, never>

type ShortcutsTabState = {
    shortcuts: Shortcuts
    message: {
        type: MessageBarType
        text: string
    } | null
}

const DEFAULT_SHORTCUTS: Shortcuts = {
    aiSummary: "Alt+S",
    aiTranslation: "Alt+T",
    markRead: "M",
    star: "S",
    openExternal: "B",
    hide: "H",
    toggleWebpage: "L",
    toggleFull: "W",
    navToggleMenu: "Ctrl+B",
    prevItem: "ArrowLeft",
    nextItem: "ArrowRight",
}

class ShortcutsTab extends React.Component<ShortcutsTabProps, ShortcutsTabState> {
    constructor(props: ShortcutsTabProps) {
        super(props)
        let current: Shortcuts
        try {
            current = window.settings.getShortcuts()
        } catch {
            current = DEFAULT_SHORTCUTS
        }
        this.state = {
            shortcuts: { ...DEFAULT_SHORTCUTS, ...(current || {}) },
            message: null,
        }
    }

    private updateShortcut = (key: keyof Shortcuts, value: string) => {
        this.setState(
            prev => ({
                shortcuts: {
                    ...prev.shortcuts,
                    [key]: value,
                },
                message: null,
            }),
            () => {
                try {
                    window.settings.setShortcuts(this.state.shortcuts)
                } catch (e) {
                    const err = e as Error
                    this.setState({
                        message: {
                            type: MessageBarType.error,
                            text: err.message || String(e),
                        },
                    })
                }
            }
        )
    }

    handleChange =
        (key: keyof Shortcuts) =>
        (_: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
            const value = (newValue || "").trim()
            this.updateShortcut(key, value)
        }

    handleKeyDown = (key: keyof Shortcuts) => (e: React.KeyboardEvent<HTMLInputElement>) => {
        // 允许 Tab 切换焦点
        if (e.key === "Tab") {
            return
        }

        e.preventDefault()
        e.stopPropagation()

        // 无修饰键 + Backspace/Delete 表示清空
        if (
            !e.ctrlKey &&
            !e.metaKey &&
            !e.altKey &&
            !e.shiftKey &&
            (e.key === "Backspace" || e.key === "Delete")
        ) {
            this.updateShortcut(key, "")
            return
        }

        const invalidOnly = ["Shift", "Control", "Alt", "Meta"]
        if (invalidOnly.includes(e.key)) {
            // 仅按下修饰键时不更新
            return
        }

        const parts: string[] = []
        if (e.ctrlKey) parts.push("Ctrl")
        if (e.metaKey) parts.push("Meta")
        if (e.altKey) parts.push("Alt")
        if (e.shiftKey) parts.push("Shift")

        const keyPart = e.key.length === 1 ? e.key.toUpperCase() : e.key
        parts.push(keyPart)

        const accelerator = parts.join("+")
        this.updateShortcut(key, accelerator)
    }

    render() {
        const { shortcuts, message } = this.state

        return (
            <Stack className="settings-tab" tokens={{ childrenGap: 12 }}>
                <Label>{intl.get("settings.shortcuts")}</Label>
                <Label>
                    {intl.get("shortcuts.desc") || "为常用操作配置快捷键，留空则禁用该快捷键。"}
                </Label>

                {message && (
                    <MessageBar
                        messageBarType={message.type}
                        isMultiline={false}
                        onDismiss={() => this.setState({ message: null })}
                    >
                        {message.text}
                    </MessageBar>
                )}

                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.aiSummary") || "AI 摘要"}
                        value={shortcuts.aiSummary || ""}
                        onChange={this.handleChange("aiSummary")}
                        onKeyDown={this.handleKeyDown("aiSummary")}
                        placeholder="Alt+S"
                        description="AI 摘要"
                    />
                    <TextField
                        label={intl.get("shortcuts.aiTranslate") || "AI 翻译"}
                        value={shortcuts.aiTranslation || ""}
                        onChange={this.handleChange("aiTranslation")}
                        onKeyDown={this.handleKeyDown("aiTranslation")}
                        placeholder="Alt+T"
                        description="AI 翻译 / 切换翻译"
                    />
                </Stack>

                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.itemToggleRead") || "标记已读/未读"}
                        value={shortcuts.markRead || ""}
                        onChange={this.handleChange("markRead")}
                        onKeyDown={this.handleKeyDown("markRead")}
                        placeholder="M"
                    />
                    <TextField
                        label={intl.get("shortcuts.itemToggleStar") || "星标/取消星标"}
                        value={shortcuts.star || ""}
                        onChange={this.handleChange("star")}
                        onKeyDown={this.handleKeyDown("star")}
                        placeholder="S"
                    />
                </Stack>

                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.itemOpenExternal") || "在浏览器中打开"}
                        value={shortcuts.openExternal || ""}
                        onChange={this.handleChange("openExternal")}
                        onKeyDown={this.handleKeyDown("openExternal")}
                        placeholder="B"
                    />
                    <TextField
                        label={intl.get("shortcuts.itemToggleHidden") || "隐藏/取消隐藏"}
                        value={shortcuts.hide || ""}
                        onChange={this.handleChange("hide")}
                        onKeyDown={this.handleKeyDown("hide")}
                        placeholder="H"
                    />
                </Stack>

                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.itemToggleWebpage") || "切换加载网页"}
                        value={shortcuts.toggleWebpage || ""}
                        onChange={this.handleChange("toggleWebpage")}
                        onKeyDown={this.handleKeyDown("toggleWebpage")}
                        placeholder="L"
                    />
                    <TextField
                        label={intl.get("shortcuts.itemToggleFull") || "切换抓取全文"}
                        value={shortcuts.toggleFull || ""}
                        onChange={this.handleChange("toggleFull")}
                        onKeyDown={this.handleKeyDown("toggleFull")}
                        placeholder="W"
                    />
                </Stack>

                <Label style={{ marginTop: 16 }}>
                    {intl.get("shortcuts.navSection") || "导航栏快捷键"}
                </Label>
                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.navToggleMenu") || "显示/隐藏菜单"}
                        value={shortcuts.navToggleMenu || ""}
                        onChange={this.handleChange("navToggleMenu")}
                        onKeyDown={this.handleKeyDown("navToggleMenu")}
                        placeholder="F1"
                    />
                    <TextField
                        label={intl.get("shortcuts.navSearch") || "搜索"}
                        value={shortcuts.navSearch || ""}
                        onChange={this.handleChange("navSearch")}
                        onKeyDown={this.handleKeyDown("navSearch")}
                        placeholder="F2"
                    />
                </Stack>
                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.navRefresh") || "刷新订阅"}
                        value={shortcuts.navRefresh || ""}
                        onChange={this.handleChange("navRefresh")}
                        onKeyDown={this.handleKeyDown("navRefresh")}
                        placeholder="F5"
                    />
                    <TextField
                        label={intl.get("shortcuts.navMarkAllRead") || "当前视图全部标记为已读"}
                        value={shortcuts.navMarkAllRead || ""}
                        onChange={this.handleChange("navMarkAllRead")}
                        onKeyDown={this.handleKeyDown("navMarkAllRead")}
                        placeholder="F6"
                    />
                </Stack>
                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.navLogs") || "消息列表（无文章时）"}
                        value={shortcuts.navLogs || ""}
                        onChange={this.handleChange("navLogs")}
                        onKeyDown={this.handleKeyDown("navLogs")}
                        placeholder="F7"
                    />
                    <TextField
                        label={intl.get("shortcuts.navViews") || "视图菜单（无文章时）"}
                        value={shortcuts.navViews || ""}
                        onChange={this.handleChange("navViews")}
                        onKeyDown={this.handleKeyDown("navViews")}
                        placeholder="F8"
                    />
                </Stack>
                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.navSettings") || "设置（无文章时）"}
                        value={shortcuts.navSettings || ""}
                        onChange={this.handleChange("navSettings")}
                        onKeyDown={this.handleKeyDown("navSettings")}
                        placeholder="F9"
                    />
                </Stack>

                <Label style={{ marginTop: 16 }}>
                    {intl.get("shortcuts.articleSection") || "文章视图快捷键"}
                </Label>
                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.prevItem") || "上一篇文章"}
                        value={shortcuts.prevItem || ""}
                        onChange={this.handleChange("prevItem")}
                        onKeyDown={this.handleKeyDown("prevItem")}
                        placeholder="ArrowLeft"
                    />
                    <TextField
                        label={intl.get("shortcuts.nextItem") || "下一篇文章"}
                        value={shortcuts.nextItem || ""}
                        onChange={this.handleChange("nextItem")}
                        onKeyDown={this.handleKeyDown("nextItem")}
                        placeholder="ArrowRight"
                    />
                </Stack>
                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.articleClose") || "关闭当前文章"}
                        value={shortcuts.articleClose || ""}
                        onChange={this.handleChange("articleClose")}
                        onKeyDown={this.handleKeyDown("articleClose")}
                        placeholder="Escape"
                    />
                    <TextField
                        label={intl.get("shortcuts.articleToggleWeb") || "切换“加载网页”"}
                        value={shortcuts.articleToggleWeb || ""}
                        onChange={this.handleChange("articleToggleWeb")}
                        onKeyDown={this.handleKeyDown("articleToggleWeb")}
                        placeholder="L"
                    />
                </Stack>
                <Stack horizontal tokens={{ childrenGap: 16 }}>
                    <TextField
                        label={intl.get("shortcuts.articleToggleFull") || "切换“抓取全文”"}
                        value={shortcuts.articleToggleFull || ""}
                        onChange={this.handleChange("articleToggleFull")}
                        onKeyDown={this.handleKeyDown("articleToggleFull")}
                        placeholder="W"
                    />
                </Stack>
            </Stack>
        )
    }
}

export default ShortcutsTab
