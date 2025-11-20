/**
 * article-ai.ts
 * 
 * Handles AI-related features for articles: summary generation and translation.
 */

import intl from "react-intl-universal"
import { RSSItem } from "../scripts/models/item"
import { RSSSource } from "../scripts/models/source"
import { summarizeArticle, translateTextByParagraph } from "../scripts/models/services/aiClient"
import type { AiConfig } from "../scripts/models/services/aiClient"
import { getEffectiveItem as buildEffectiveItem } from "./utils/effective-item"
import * as ArticleScripts from "./article-scripts"

export interface ExtendedAiConfig extends AiConfig {
    enabled?: boolean
    autoSummary?: boolean
    autoTranslateImmersive?: boolean
    translateWhen?: string
    translateTarget?: string
}

export interface TranslationItem {
    original: string
    translated: string
}

export interface ArticleAIState {
    aiSummary: string
    aiSummaryLoading: boolean
    showTranslation: boolean
    titleTranslation: string
    aiTranslation: TranslationItem[]
    translationLoading: boolean
    translationProgress: number
    translationTotal: number
    translationRunId: number
}

interface WebViewExecutor {
    executeScript<T = unknown>(code: string): Promise<T | null>
}

/**
 * Helper class to handle AI operations for an article
 */
export class ArticleAIHandler {
    private summaryAbort?: AbortController
    private translationAbort?: AbortController
    private lastActionItemId?: string

    constructor(
        private webviewExecutor: WebViewExecutor,
        private getItem: () => RSSItem,
        private getSource: () => RSSSource,
        private getState: () => ArticleAIState,
        private updateState: (partial: Partial<ArticleAIState>) => void
    ) {}

    /**
     * Load AI cache for the current article
     */
    async loadAICache(): Promise<void> {
        const item = this.getItem()
        const expectedId = String(item._id)
        
        try {
            const cache = await window.settings.getAICache(expectedId)
            if (expectedId !== String(this.getItem()._id)) return

            if (cache) {
                const updates: Partial<ArticleAIState> = {}
                
                if (cache.summary) {
                    updates.aiSummary = cache.summary
                }
                
                if (cache.translation) {
                    try {
                        const translationData: TranslationItem[] = JSON.parse(cache.translation)
                        const hasFailure = translationData.some(
                            t =>
                                t.translated &&
                                (t.translated.includes("[翻译失败") ||
                                    t.translated.includes("Translation failed"))
                        )
                        
                        if (hasFailure) {
                            console.warn(
                                "[ArticleAI] Cached translation contains failure markers, discarding cache."
                            )
                        } else {
                            const titleTranslation = cache.titleTranslation || ""
                            updates.aiTranslation = translationData
                            updates.titleTranslation = titleTranslation
                            updates.showTranslation = true
                        }
                    } catch (e) {
                        console.error("解析翻译缓存失败:", e)
                    }
                }
                
                if (Object.keys(updates).length > 0) {
                    this.updateState(updates)
                }
            }
        } catch (error) {
            console.warn("加载 AI 缓存失败(可忽略):", (error as Error)?.message || String(error))
        }
    }

    /**
     * Auto-run AI features if configured
     */
    maybeAutoRunAI(opts?: { hasSummary?: boolean; hasTranslation?: boolean }): void {
        const aiConfigs = window.settings.getAIConfigs() as ExtendedAiConfig
        if (!aiConfigs.enabled || !aiConfigs.apiKey) return

        const item = this.getItem()
        const currentId = String(item._id)
        this.lastActionItemId = currentId

        const state = this.getState()
        const hasSummary = opts?.hasSummary ?? !!state.aiSummary
        const hasTranslation = opts?.hasTranslation ?? state.aiTranslation.length > 0

        const effectiveItem = buildEffectiveItem(this.getItem(), this.getSource())
        const shouldSummarize = effectiveItem.autoSummarize ?? aiConfigs.autoSummary
        const shouldTranslate = effectiveItem.autoTranslate ?? aiConfigs.autoTranslateImmersive

        if (shouldSummarize && !hasSummary && !state.aiSummaryLoading) {
            this.generateSummary().catch(err => {
                console.warn("[AI] Auto-summary failed:", err?.message || err)
            })
        }
        if (shouldTranslate && !hasTranslation && !state.translationLoading) {
            this.translateArticle().catch(err => {
                console.warn("[AI] Auto-translation failed:", err?.message || err)
            })
        }
    }

    /**
     * Generate AI summary for the article
     */
    async generateSummary(fullContent?: string): Promise<void> {
        const aiConfigs = window.settings.getAIConfigs() as ExtendedAiConfig
        if (!aiConfigs.enabled || !aiConfigs.apiKey) {
            alert(intl.get("ai.notEnabled"))
            return
        }

        if (this.summaryAbort) this.summaryAbort.abort()
        const controller = new AbortController()
        this.summaryAbort = controller
        const item = this.getItem()
        const itemId = String(item._id)

        this.updateState({ aiSummaryLoading: true, aiSummary: "" })
        
        try {
            const fullTextResult = await this.getFullTextForSummary(fullContent)
            if (!fullTextResult.success) {
                this.updateState({ aiSummaryLoading: false })
                const failureResult = fullTextResult as { success: false; reason: "no-content" | "too-short" }
                if (failureResult.reason === "no-content") {
                    alert(
                        intl.get("ai.fullContentRequired") ||
                            "当前文章没有可用的全文内容，暂时无法生成摘要。"
                    )
                } else {
                    alert(
                        intl.get("ai.fullContentTooShort") ||
                            "未能获取有效的全文内容（正文过短），暂时无法生成可靠摘要。"
                    )
                }
                return
            }

            const summary = await summarizeArticle(
                {
                    baseUrl: aiConfigs.baseUrl,
                    apiKey: aiConfigs.apiKey,
                    defaultModel: aiConfigs.defaultModel,
                },
                fullTextResult.content,
                controller.signal
            )
            
            if (itemId === String(this.getItem()._id) && this.summaryAbort === controller) {
                this.updateState({ aiSummary: summary, aiSummaryLoading: false })
                await this.ensureSummaryInjected(summary)
                
                try {
                    await window.settings.saveAISummary(String(item._id), summary)
                } catch (e) {
                    console.warn("保存总结缓存失败(可忽略):", (e as Error).message)
                }
            }
        } catch (error) {
            const err = error as Error & { name?: string }
            if (err.name === "AbortError") {
                return
            }
            alert(`${intl.get("ai.failed")}: ${err.message}`)
            if (itemId === String(this.getItem()._id) && this.summaryAbort === controller) {
                this.updateState({ aiSummaryLoading: false })
            }
        }
    }

    /**
     * Toggle translation visibility or start translation
     */
    async toggleTranslation(): Promise<void> {
        const state = this.getState()
        
        if (state.showTranslation) {
            this.updateState({ showTranslation: false })
            await this.setTranslationVisibility(false)
        } else if (state.aiTranslation.length > 0) {
            this.updateState({ showTranslation: true })
            await this.injectCachedTranslations().catch(() => {
                this.setTranslationVisibility(true)
            })
        } else {
            await this.translateArticle()
        }
    }

    /**
     * Translate the article content
     */
    async translateArticle(fullContent?: string): Promise<void> {
        const aiConfigs = window.settings.getAIConfigs() as ExtendedAiConfig
        if (!aiConfigs.enabled || !aiConfigs.apiKey) {
            alert(intl.get("ai.notEnabled"))
            return
        }

        if (this.translationAbort) this.translationAbort.abort()
        const controller = new AbortController()
        this.translationAbort = controller
        const item = this.getItem()
        const itemId = String(item._id)

        const newRunId = Date.now()
        this.updateState({
            translationLoading: true,
            showTranslation: true,
            aiTranslation: [],
            translationRunId: newRunId,
        })

        try {
            await this.waitForArticleReady()
            await this.webviewExecutor.executeScript(ArticleScripts.getCleanupTranslationsScript())
            await this.webviewExecutor.executeScript(ArticleScripts.getTranslationSpinnerScript(true))

            const textsToTranslate = await this.fetchTextsToTranslate()
            const { shouldTranslate, targetLang } = await this.determineTranslationStrategy(
                aiConfigs,
                textsToTranslate
            )

            if (!shouldTranslate) {
                this.updateState({ translationLoading: false })
                await this.webviewExecutor.executeScript(ArticleScripts.getTranslationSpinnerScript(false))
                return
            }

            // Translate title (don't wait)
            if (item.title?.trim()) {
                this.translateTitle(item.title, targetLang, aiConfigs, controller).then(
                    res => {
                        if (
                            itemId === String(this.getItem()._id) &&
                            this.translationAbort === controller &&
                            this.getState().translationRunId === newRunId
                        ) {
                            this.updateState({ titleTranslation: res || "" })
                            if (res) {
                                this.injectTitleTranslation(res).catch(console.warn)
                            }
                            this.saveTranslationCache()
                        }
                    }
                )
            }

            // Translate paragraphs
            if (textsToTranslate.length > 0) {
                await this.translateParagraphs(
                    textsToTranslate,
                    targetLang,
                    aiConfigs,
                    controller,
                    itemId,
                    newRunId
                )
            } else {
                await this.translateFullContentFallback(
                    targetLang,
                    aiConfigs,
                    controller,
                    itemId,
                    newRunId,
                    fullContent
                )
            }

            if (
                itemId === String(this.getItem()._id) &&
                this.translationAbort === controller &&
                this.getState().translationRunId === newRunId
            ) {
                this.updateState({ translationLoading: false })
                await this.webviewExecutor.executeScript(ArticleScripts.getTranslationSpinnerScript(false))
                await this.saveTranslationCache()
            }
        } catch (error) {
            this.handleTranslationError(error, itemId, controller, newRunId)
        }
    }

    /**
     * Inject summary into the WebView if ready
     */
    async ensureSummaryInjected(summaryText?: string): Promise<void> {
        const text = summaryText || this.getState().aiSummary
        if (!text) return
        
        await this.waitForArticleReady()
        try {
            await this.webviewExecutor.executeScript(ArticleScripts.getInjectSummaryScript(text))
        } catch (e) {
            const error = e as Error
            console.warn("inject summary failed:", error.message || String(e))
        }
    }

    /**
     * Inject title translation into the WebView
     */
    async injectTitleTranslation(titleTranslation: string): Promise<void> {
        await this.waitForArticleReady()
        try {
            await this.webviewExecutor.executeScript(
                ArticleScripts.getInjectTitleTranslationScript(titleTranslation)
            )
        } catch (e) {
            const error = e as Error
            console.warn("inject title translation failed:", error.message || String(e))
        }
    }

    /**
     * Inject cached translations into the WebView
     */
    async injectCachedTranslations(): Promise<void> {
        const state = this.getState()
        if (!state.aiTranslation || state.aiTranslation.length === 0) return
        
        await this.waitForArticleReady()
        const texts = await this.webviewExecutor.executeScript<string[]>(
            ArticleScripts.getMarkParagraphsScript()
        )
        
        if (!texts || texts.length === 0) {
            const allTranslated = state.aiTranslation
                .map(x => x?.translated || "")
                .filter(Boolean)
                .join("\n\n")
            if (allTranslated) {
                await this.webviewExecutor.executeScript(
                    ArticleScripts.getAppendGlobalTranslationScript(allTranslated)
                )
            }
            await this.setTranslationVisibility(true)
            return
        }
        
        const used = new Set<number>()
        for (const t of state.aiTranslation) {
            const original = t?.original || ""
            let bestIdx = -1
            let bestScore = 0
            for (let i = 0; i < texts.length; i++) {
                if (used.has(i)) continue
                const score = this.calculateTextSimilarity(texts[i] || "", original || "")
                if (score > bestScore) {
                    bestScore = score
                    bestIdx = i
                }
            }
            if (bestIdx >= 0 && bestScore >= 0.35) {
                await this.webviewExecutor.executeScript(
                    ArticleScripts.getInsertTranslationScript(bestIdx, t.translated)
                )
                used.add(bestIdx)
            }
        }
        
        if (used.size === 0) {
            const allTranslated = state.aiTranslation
                .map(x => x?.translated || "")
                .filter(Boolean)
                .join("\n\n")
            if (allTranslated) {
                await this.webviewExecutor.executeScript(
                    ArticleScripts.getAppendGlobalTranslationScript(allTranslated)
                )
            }
        }
        await this.setTranslationVisibility(true)
    }

    /**
     * Cleanup on unmount or item change
     */
    cleanup(): void {
        if (this.summaryAbort) this.summaryAbort.abort()
        if (this.translationAbort) this.translationAbort.abort()
    }

    // --- Private Helper Methods ---

    private async getFullTextForSummary(
        providedContent?: string
    ): Promise<
        { success: true; content: string } | { success: false; reason: "no-content" | "too-short" }
    > {
        const item = this.getItem()
        // Try providedContent first, but only if it's not an empty string
        // If providedContent is empty or undefined, fall back to item.content
        let body = ""
        if (providedContent && providedContent.trim()) {
            body = providedContent
        } else if (item.content) {
            body = item.content
        }
        
        if (!body) {
            return { success: false, reason: "no-content" }
        }

        const plainBody = this.stripHtmlTags(body).trim()
        if (!plainBody || plainBody.length < 50) {
            return { success: false, reason: "too-short" }
        }

        const content = `${item.title}\n\n${plainBody}`
        return { success: true, content }
    }

    private stripHtmlTags(input: string): string {
        return (input || "").replace(/<[^>]*>/g, "")
    }

    private async fetchTextsToTranslate(): Promise<string[]> {
        let texts = await this.webviewExecutor.executeScript<string[]>(
            ArticleScripts.getMarkParagraphsScript()
        ).catch(() => [] as string[])

        if (!texts || texts.length === 0) {
            await this.waitForArticleReady(2000, 200)
            texts = await this.webviewExecutor.executeScript<string[]>(
                ArticleScripts.getMarkParagraphsScript()
            ).catch(() => [] as string[])

            if (!texts || texts.length === 0) {
                await new Promise(r => setTimeout(r, 500))
                texts = await this.webviewExecutor.executeScript<string[]>(
                    ArticleScripts.getMarkParagraphsScript()
                ).catch(() => [] as string[])
            }
        }
        return texts || []
    }

    private async determineTranslationStrategy(
        aiConfigs: ExtendedAiConfig,
        texts: string[]
    ): Promise<{ shouldTranslate: boolean; targetLang: "zh" | "en"; isZh: boolean }> {
        const translateWhen = aiConfigs.translateWhen || "auto"
        const translateTarget = aiConfigs.translateTarget || "zh"
        const sampleHtml = (texts && texts[0]) || (await this.getRootHTML())
        const sample = (sampleHtml || "").replace(/<[^>]*>/g, "")
        const isZh = /[\u4e00-\u9fa5]/.test(sample || "")

        let shouldTranslate = true
        switch (translateWhen) {
            case "nonTargetOnly":
                shouldTranslate = translateTarget === "zh" ? !isZh : isZh
                break
            case "zhOnly":
                shouldTranslate = isZh
                break
            case "nonZhOnly":
                shouldTranslate = !isZh
                break
            case "always":
                shouldTranslate = true
                break
            case "auto":
            default:
                shouldTranslate = true
                break
        }

        const targetLang: "zh" | "en" =
            translateWhen === "auto" ? (isZh ? "en" : "zh") : (translateTarget as "zh" | "en")

        return { shouldTranslate, targetLang, isZh }
    }

    private async translateTitle(
        title: string,
        targetLang: "zh" | "en",
        config: ExtendedAiConfig,
        controller: AbortController
    ): Promise<string | null> {
        try {
            const { translateText } = await import("../scripts/models/services/aiClient")
            return await translateText(
                {
                    baseUrl: config.baseUrl,
                    apiKey: config.apiKey,
                    defaultModel: config.defaultModel,
                },
                title,
                targetLang,
                controller.signal
            )
        } catch (e) {
            console.warn("标题翻译失败:", e)
            return null
        }
    }

    private async translateParagraphs(
        texts: string[],
        targetLang: "zh" | "en",
        config: ExtendedAiConfig,
        signal: AbortController,
        itemId: string,
        runId: number
    ): Promise<void> {
        await translateTextByParagraph(
            {
                baseUrl: config.baseUrl,
                apiKey: config.apiKey,
                defaultModel: config.defaultModel,
            },
            texts,
            (index, translatedText) => {
                if (
                    itemId !== String(this.getItem()._id) ||
                    this.translationAbort !== signal ||
                    this.getState().translationRunId !== runId
                )
                    return
                this.insertTranslatedParagraph(index, translatedText)
                const state = this.getState()
                const list = [...state.aiTranslation]
                list[index] = { original: texts[index], translated: translatedText }
                this.updateState({ aiTranslation: list })
            },
            signal.signal,
            targetLang
        )
    }

    private async translateFullContentFallback(
        targetLang: "zh" | "en",
        config: ExtendedAiConfig,
        signal: AbortController,
        itemId: string,
        runId: number,
        fullContent?: string
    ): Promise<void> {
        const rootText = fullContent || (await this.getRootHTML())
        if (rootText && rootText.replace(/<[^>]*>/g, "").trim().length > 30) {
            const single = await translateTextByParagraph(
                {
                    baseUrl: config.baseUrl,
                    apiKey: config.apiKey,
                    defaultModel: config.defaultModel,
                },
                [rootText],
                (i, translatedText) => {
                    if (i === 0 && this.getState().translationRunId === runId)
                        this.appendGlobalTranslation(translatedText)
                },
                signal.signal,
                targetLang
            )
            if (
                single &&
                single.length > 0 &&
                itemId === String(this.getItem()._id) &&
                this.getState().translationRunId === runId
            ) {
                this.updateState({
                    aiTranslation: [{ original: rootText, translated: single[0].translated }],
                })
            }
        }
    }

    private async saveTranslationCache(): Promise<void> {
        const state = this.getState()
        try {
            const hasFailure = state.aiTranslation.some(
                t =>
                    t.translated &&
                    (t.translated.includes("[翻译失败") ||
                        t.translated.includes("Translation failed"))
            )
            if (!hasFailure) {
                await window.settings.saveAITranslation(
                    String(this.getItem()._id),
                    JSON.stringify(state.aiTranslation)
                )
                if (state.titleTranslation) {
                    await window.settings.saveTitleTranslation(
                        String(this.getItem()._id),
                        state.titleTranslation
                    )
                }
            } else {
                console.warn("[ArticleAI] Translation contains failure, skipping cache save.")
            }
        } catch (e) {
            console.warn("保存翻译缓存失败:", (e as Error).message)
        }
    }

    private async handleTranslationError(
        error: unknown,
        itemId: string,
        signal: AbortController,
        runId?: number
    ): Promise<void> {
        const err = error as Error & { name?: string }
        if (err.name === "AbortError" || err.message?.includes("Abort")) return

        alert(`${intl.get("ai.failed")}: ${err.message}`)

        if (itemId === String(this.getItem()._id) && this.translationAbort === signal) {
            if (runId !== undefined && this.getState().translationRunId !== runId) return

            this.updateState({ translationLoading: false, showTranslation: false })
            await this.webviewExecutor.executeScript(ArticleScripts.getTranslationSpinnerScript(false))
        }
    }

    private async insertTranslatedParagraph(index: number, translated: string): Promise<void> {
        if (!translated || translated.trim().length === 0) return
        await this.webviewExecutor.executeScript(
            ArticleScripts.getInsertTranslationScript(index, translated)
        )
    }

    private async appendGlobalTranslation(translated: string): Promise<void> {
        await this.webviewExecutor.executeScript(
            ArticleScripts.getAppendGlobalTranslationScript(translated)
        )
    }

    private async setTranslationVisibility(show: boolean): Promise<void> {
        await this.webviewExecutor.executeScript(
            ArticleScripts.getSetTranslationVisibilityScript(show)
        )
    }

    private async waitForArticleReady(
        timeoutMs: number = 12000,
        pollMs: number = 200
    ): Promise<void> {
        await this.webviewExecutor.executeScript(
            ArticleScripts.getWaitForArticleReadyScript(timeoutMs, pollMs)
        )
    }

    private async getRootHTML(): Promise<string> {
        return (await this.webviewExecutor.executeScript<string>(
            ArticleScripts.getRootHTMLScript()
        )) || ""
    }

    private calculateTextSimilarity(text1: string, text2: string): number {
        const strip = (s: string) => (s || "").replace(/<[^>]*>/g, "")
        const a = strip(text1)
        const b = strip(text2)
        const len = Math.min(a.length, b.length, 100)
        if (len === 0) return 0

        let matches = 0
        for (let i = 0; i < len; i++) {
            if (a[i] === b[i]) matches++
        }

        return matches / len
    }
}
