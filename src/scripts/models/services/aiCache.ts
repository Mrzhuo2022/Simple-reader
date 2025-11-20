// eslint-disable-next-line @typescript-eslint/no-require-imports
const fs = require("fs")
// eslint-disable-next-line @typescript-eslint/no-require-imports
const path = require("path")

let cacheFilePath: string | null = null
let cacheData: Map<string, AICacheEntry> = new Map()

export interface AICacheEntry {
    itemId: string
    summary?: string
    translation?: string
    titleTranslation?: string
    createdAt: number
}

// Initialize cache with path from main process
export function initDB(userDataPath: string): void {
    cacheFilePath = path.join(userDataPath, "ai-cache.json")
    loadCache()
}

function loadCache(): void {
    if (!cacheFilePath) return

    try {
        if (fs.existsSync(cacheFilePath)) {
            const data = fs.readFileSync(cacheFilePath, "utf8")
            const parsed = JSON.parse(data)
            cacheData = new Map(Object.entries(parsed))
        }
    } catch (error) {
        console.warn("Failed to load cache:", error)
        cacheData = new Map()
    }
}

function saveCache(): void {
    if (!cacheFilePath) return

    try {
        const obj = Object.fromEntries(cacheData)
        fs.writeFileSync(cacheFilePath, JSON.stringify(obj, null, 2), "utf8")
    } catch (error) {
        console.error("Failed to save cache:", error)
    }
}

export function saveSummary(itemId: string, summary: string): void {
    if (!cacheFilePath) return

    try {
        const entry = cacheData.get(itemId) || { itemId, createdAt: Date.now() }
        entry.summary = summary
        entry.createdAt = Date.now()
        cacheData.set(itemId, entry)
        saveCache()
    } catch (error) {
        console.error("Failed to save summary:", error)
    }
}

export function saveTranslation(itemId: string, translation: string): void {
    if (!cacheFilePath) return

    try {
        const entry = cacheData.get(itemId) || { itemId, createdAt: Date.now() }
        entry.translation = translation
        entry.createdAt = Date.now()
        cacheData.set(itemId, entry)
        saveCache()
    } catch (error) {
        console.error("Failed to save translation:", error)
    }
}

export function saveTitleTranslation(itemId: string, titleTranslation: string): void {
    if (!cacheFilePath) return

    try {
        const entry = cacheData.get(itemId) || { itemId, createdAt: Date.now() }
        entry.titleTranslation = titleTranslation
        entry.createdAt = Date.now()
        cacheData.set(itemId, entry)
        saveCache()
    } catch (error) {
        console.error("Failed to save title translation:", error)
    }
}

export function getCache(itemId: string): AICacheEntry | null {
    if (!cacheFilePath) return null

    try {
        return cacheData.get(itemId) || null
    } catch (error) {
        console.error("Failed to get cache:", error)
        return null
    }
}

export function clearOldCache(daysToKeep: number = 30): void {
    if (!cacheFilePath) return

    try {
        const cutoffTime = Date.now() - daysToKeep * 24 * 60 * 60 * 1000
        for (const [key, entry] of cacheData.entries()) {
            if (entry.createdAt < cutoffTime) {
                cacheData.delete(key)
            }
        }
        saveCache()
    } catch (error) {
        console.error("Failed to clear old cache:", error)
    }
}

export function closeDB(): void {
    // JSON文件方式不需要关闭
    saveCache()
}
