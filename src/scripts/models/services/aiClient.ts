/**
 * OpenAI-compatible API client for AI features
 * Supports custom baseUrl and automatic model discovery
 */

export interface AiConfig {
    baseUrl: string
    apiKey: string
    defaultModel: string
    concurrency?: number
    maxTextLengthPerRequest?: number
    maxParagraphsPerRequest?: number
    prompts?: {
        summary?: string
        translation?: string
    }
}

export interface ChatMessage {
    role: "user" | "system" | "assistant"
    content: string
}

export interface ChatCompletionRequest {
    model?: string
    messages: ChatMessage[]
    temperature?: number
    max_tokens?: number
}

interface ModelInfo {
    id: string
    name?: string
}

interface ModelsResponse {
    data?: ModelInfo[]
}

/**
 * Fetch available models from the API
 * @param config AI configuration
 * @returns Array of model IDs
 */
export async function listModels(config: AiConfig, signal?: AbortSignal): Promise<string[]> {
    try {
        const url = `${config.baseUrl}/models`
        const response = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
            signal,
        })

        if (!response.ok) {
            throw new Error(`Failed to list models: ${response.status} ${response.statusText}`)
        }

        const data: ModelsResponse | ModelInfo[] = await response.json()

        // Support OpenAI format: { data: [{ id: "model-name" }] }
        if ("data" in data && data.data && Array.isArray(data.data)) {
            return data.data.map(m => m.id).filter(Boolean)
        }

        // Fallback for other formats
        if (Array.isArray(data)) {
            return data.map(m => m.id || m.name).filter((id): id is string => Boolean(id))
        }

        return []
    } catch (error) {
        console.error("Error listing models:", error)
        throw error
    }
}

/**
 * Send a chat completion request
 * @param config AI configuration
 * @param request Chat completion parameters
 * @returns Generated text response
 */
export async function chatCompletion(
    config: AiConfig,
    request: ChatCompletionRequest,
    signal?: AbortSignal
): Promise<string> {
    try {
        const url = `${config.baseUrl}/chat/completions`
        const body = {
            model: request.model || config.defaultModel,
            messages: request.messages,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.max_tokens ?? 2000,
            stream: false,
        }

        const response = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal,
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`Chat completion failed: ${response.status} ${errorText}`)
        }

        const data = await response.json()

        // Extract content from OpenAI response format
        if (data.choices && data.choices.length > 0) {
            return data.choices[0].message?.content || ""
        }

        throw new Error("Invalid response format from AI API")
    } catch (error) {
        console.error("Error in chat completion:", error)
        throw error
    }
}

/**
 * Generate a summary for an article
 * @param config AI configuration
 * @param content Article content (title + body)
 * @returns Summary text
 */
export async function summarizeArticle(
    config: AiConfig,
    content: string,
    signal?: AbortSignal
): Promise<string> {
    const defaultPrompt =
        "你是一个专业的 RSS 文章摘要助手。请用简洁的中文总结文章的核心要点，保持客观准确。摘要应该在 3-5 句话之内。"
    const systemPrompt = config.prompts?.summary || defaultPrompt

    return await chatCompletion(
        config,
        {
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `请总结以下文章：\n\n${content}` },
            ],
            temperature: 0.5,
            max_tokens: 500,
        },
        signal
    )
}

/**
 * Translate text to target language
 * @param config AI configuration
 * @param text Text to translate
 * @param targetLang Target language ('zh' or 'en')
 * @returns Translated text
 */
export async function translateText(
    config: AiConfig,
    text: string,
    targetLang: "zh" | "en",
    signal?: AbortSignal
): Promise<string> {
    const defaultPrompt = `你是一个专业的翻译助手。输入可能包含 HTML，请严格遵循：
- 仅翻译可见文本内容
- 绝对不要翻译 <pre>、<code> 等代码块中的内容，保留原文
- 保留并原样输出所有 HTML 标签与属性（包括 a、strong、em、code 等），不要新增或删除标签
- 不要添加任何解释、注释或多余文本
- 仅输出译文内容（可包含原有 HTML 标签），不要包裹额外容器`

    const systemPrompt = config.prompts?.translation || defaultPrompt

    return await chatCompletion(
        config,
        {
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text },
            ],
            temperature: 0.3,
            max_tokens: 3000,
        },
        signal
    )
}

/**
 * Translate a batch of texts
 */
async function translateBatch(
    config: AiConfig,
    texts: string[],
    targetLang: "zh" | "en",
    signal?: AbortSignal
): Promise<string[]> {
    if (texts.length === 0) return []
    if (texts.length === 1) {
        return [await translateText(config, texts[0], targetLang, signal)]
    }

    const systemPrompt = `You are a professional translation assistant. 
Translate the following JSON array of texts into ${
        targetLang === "zh" ? "Simplified Chinese" : "English"
    }.
Return ONLY a valid JSON array of strings. 
Maintain the exact same number of elements.
Do not wrap the output in markdown code blocks.
Preserve any HTML tags in the source texts.`

    const content = JSON.stringify(texts)
    const responseRaw = await chatCompletion(
        config,
        {
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: content },
            ],
            temperature: 0.3,
            max_tokens: 4000, // Increase token limit for batches
        },
        signal
    )

    // Clean up potential markdown formatting
    let cleaned = responseRaw.trim()
    if (cleaned.startsWith("```json")) cleaned = cleaned.substring(7)
    if (cleaned.startsWith("```")) cleaned = cleaned.substring(3)
    if (cleaned.endsWith("```")) cleaned = cleaned.substring(0, cleaned.length - 3)
    cleaned = cleaned.trim()

    try {
        const parsed = JSON.parse(cleaned)
        if (!Array.isArray(parsed)) throw new Error("Response is not an array")
        if (parsed.length !== texts.length)
            throw new Error(
                `Response length mismatch: expected ${texts.length}, got ${parsed.length}`
            )
        return parsed.map(s => String(s))
    } catch (e) {
        console.warn("Batch translation JSON parse failed, falling back to sequential:", e)
        // Fallback: sequential translation if batch fails
        const results = []
        for (const t of texts) {
            results.push(await translateText(config, t, targetLang, signal))
        }
        return results
    }
}

/**
 * Translate text paragraph by paragraph with batching and concurrency optimization
 * @param config AI configuration
 * @param paragraphs List of paragraphs to translate
 * @param onParagraphTranslated Callback for each translated paragraph
 * @returns Array of translated paragraphs
 */
export async function translateTextByParagraph(
    config: AiConfig,
    paragraphs: string[],
    onParagraphTranslated?: (index: number, translated: string) => void,
    signal?: AbortSignal,
    forcedTargetLang?: "zh" | "en"
): Promise<Array<{ original: string; translated: string }>> {
    // Initialize results with empty translations
    const results: Array<{ original: string; translated: string }> = paragraphs.map(p => ({
        original: p,
        translated: "",
    }))

    // Detect language from first paragraph
    const sampleText = paragraphs[0] || ""
    const targetLang = forcedTargetLang ?? (/[\u4e00-\u9fa5]/.test(sampleText) ? "en" : "zh")

    // Configuration
    const maxBatchSize = config.maxParagraphsPerRequest || 1
    const maxTextLen = config.maxTextLengthPerRequest || 1500
    const concurrency = config.concurrency || 5

    // Create batches
    interface Batch {
        indices: number[]
        texts: string[]
    }
    const batches: Batch[] = []
    let currentBatch: Batch = { indices: [], texts: [] }
    let currentBatchLen = 0

    for (let i = 0; i < paragraphs.length; i++) {
        const p = paragraphs[i]
        const len = p.length

        // If adding this paragraph exceeds limits, push current batch
        // (Unless current batch is empty, then we must add it)
        if (
            currentBatch.indices.length > 0 &&
            (currentBatch.indices.length >= maxBatchSize || currentBatchLen + len > maxTextLen)
        ) {
            batches.push(currentBatch)
            currentBatch = { indices: [], texts: [] }
            currentBatchLen = 0
        }

        currentBatch.indices.push(i)
        currentBatch.texts.push(p)
        currentBatchLen += len
    }
    if (currentBatch.indices.length > 0) {
        batches.push(currentBatch)
    }

    // Helper for concurrency limitation
    const processBatch = async (batch: Batch) => {
        if (signal?.aborted) return

        const maxRetries = 20 // Fewer retries for batches to fail faster? No, keep it robust.
        let retryCount = 0
        let success = false

        while (!success) {
            if (signal?.aborted) throw new Error("Aborted")

            try {
                const translatedTexts = await translateBatch(
                    config,
                    batch.texts,
                    targetLang,
                    signal
                )

                // Validation：如果翻译结果包含“翻译失败/translation failed”等提示，则记录明确的段落索引并触发重试
                translatedTexts.forEach((t, idx) => {
                    if (/(?:\[\s*翻译失败\s*\]|翻译失败|translation\s*failed)/i.test(t)) {
                        const paragraphIndex = batch.indices[idx]
                        // 与单测保持一致：仅传入一条包含段落信息的字符串
                        console.warn(`Translation failed for paragraph ${paragraphIndex}`)
                        throw new Error("Content verification failed: " + t)
                    }
                })

                // Update results and notify
                batch.indices.forEach((originalIndex, batchIndex) => {
                    const trans = translatedTexts[batchIndex]
                    results[originalIndex].translated = trans
                    if (onParagraphTranslated && !signal?.aborted) {
                        onParagraphTranslated(originalIndex, trans)
                    }
                })

                success = true
            } catch (error) {
                const err = error as Error & { name?: string }
                if (err.name === "AbortError" || err.message?.includes("Abort")) {
                    throw error
                }

                retryCount++
                if (retryCount > maxRetries) {
                    console.warn(
                        `Batch translation failed after ${maxRetries} retries for indices ${batch.indices.join(
                            ","
                        )}:`,
                        error
                    )
                    // Mark as empty to stop spinning
                    batch.indices.forEach(originalIndex => {
                        results[originalIndex].translated = ""
                    })
                    success = true
                } else {
                    const delay = Math.min(1000 * Math.pow(1.5, retryCount - 1), 10000)
                    // console.warn(`Batch failed, retrying in ${delay}ms...`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                }
            }
        }
    }

    // Execute batches with concurrency limit
    const activePromises: Promise<void>[] = []
    for (const batch of batches) {
        if (signal?.aborted) break

        // If we reached concurrency limit, wait for one to finish
        while (activePromises.length >= concurrency) {
            await Promise.race(activePromises)
            // Remove finished promises
            // (Actually Promise.race just returns, we need to clean up the list.
            // A simpler way is to wrap the promise to remove itself)
        }

        const p = processBatch(batch).then(() => {
            const idx = activePromises.indexOf(p)
            if (idx > -1) activePromises.splice(idx, 1)
        })
        activePromises.push(p)
    }

    // Wait for all remaining
    await Promise.all(activePromises)

    return results
}
