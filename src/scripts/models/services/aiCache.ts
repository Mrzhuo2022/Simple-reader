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
            // Validate shape: only accept entries that look like AICacheEntry.
            const valid = new Map<string, AICacheEntry>()
            for (const [key, value] of Object.entries(parsed)) {
                if (value && typeof value === "object" && "itemId" in value) {
                    const entry = value as AICacheEntry
                    entry.createdAt =
                        typeof entry.createdAt === "number" ? entry.createdAt : Date.now()
                    valid.set(key, entry)
                }
            }
            cacheData = valid
        }
    } catch (error) {
        console.warn("Failed to load cache:", error)
        cacheData = new Map()
    }
}

// Debounced persistence: the cache holds per-article summaries plus full
// paragraph translations, so it grows into the MBs, and rewriting it
// synchronously on every save blocked IPC handling for the whole main
// process. Collapses bursts (title + summary + several paragraphs per
// article view) into one trailing async write.
let saveTimer: NodeJS.Timeout | null = null
let saving = false
const SAVE_DEBOUNCE_MS = 500

function saveCache(): void {
    if (!cacheFilePath) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(flushCache, SAVE_DEBOUNCE_MS)
}

async function flushCache(): Promise<void> {
    if (!cacheFilePath) return
    saveTimer = null
    if (saving) {
        // A write is still in flight; schedule another pass so the latest
        // state is not lost.
        saveCache()
        return
    }
    saving = true
    try {
        const obj = Object.fromEntries(cacheData)
        await fs.promises.writeFile(cacheFilePath, JSON.stringify(obj), "utf8")
    } catch (error) {
        console.error("Failed to save cache:", error)
    } finally {
        saving = false
    }
}

function getOrCreateEntry(itemId: string): AICacheEntry {
    const existing = cacheData.get(itemId)
    if (existing) return existing
    // createdAt records when the entry was FIRST created; later partial
    // updates (summary/translation/title) must not reset it, otherwise the
    // TTL-based cleanup in clearOldCache would never expire re-saved entries.
    const entry: AICacheEntry = { itemId, createdAt: Date.now() }
    cacheData.set(itemId, entry)
    return entry
}

export function saveSummary(itemId: string, summary: string): void {
    if (!cacheFilePath) return

    try {
        const entry = getOrCreateEntry(itemId)
        entry.summary = summary
        saveCache()
    } catch (error) {
        console.error("Failed to save summary:", error)
    }
}

export function saveTranslation(itemId: string, translation: string): void {
    if (!cacheFilePath) return

    try {
        const entry = getOrCreateEntry(itemId)
        entry.translation = translation
        saveCache()
    } catch (error) {
        console.error("Failed to save translation:", error)
    }
}

export function saveTitleTranslation(itemId: string, titleTranslation: string): void {
    if (!cacheFilePath) return

    try {
        const entry = getOrCreateEntry(itemId)
        entry.titleTranslation = titleTranslation
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

/**
 * Total size of the AI cache file on disk, in bytes. Returns 0 before the
 * cache is initialized or if the file does not exist yet.
 */
export function getCacheSize(): number {
    if (!cacheFilePath) return 0
    try {
        return fs.statSync(cacheFilePath).size
    } catch (error) {
        // A missing cache file simply means nothing cached yet.
        if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
            console.error("Failed to get cache size:", error)
        }
        return 0
    }
}

/**
 * Number of cached entries (articles with summary/translation cached).
 */
export function getCacheCount(): number {
    return cacheData.size
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
    // Flush synchronously on quit: a pending debounced write is cancelled,
    // and async writes are not guaranteed to complete before process exit.
    if (saveTimer) {
        clearTimeout(saveTimer)
        saveTimer = null
    }
    if (!cacheFilePath) return
    try {
        const obj = Object.fromEntries(cacheData)
        fs.writeFileSync(cacheFilePath, JSON.stringify(obj), "utf8")
    } catch (error) {
        console.error("Failed to save cache:", error)
    }
}
