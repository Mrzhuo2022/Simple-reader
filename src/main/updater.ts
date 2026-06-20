import { app } from "electron"
// eslint-disable-next-line @typescript-eslint/no-require-imports
import https = require("https")
import { store } from "./settings"

// GitHub release that this binary was built from. We compare the latest
// published release tag against this to decide whether an update is available.
const REPO = "Mrzhuo2022/Simple-reader"
const LATEST_URL = `https://api.github.com/repos/${REPO}/releases/latest`

// Only re-check at most once per day so we don't burn through GitHub's
// unauthenticated rate limit (60 req/IP/hour) on every app launch.
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

const LAST_CHECK_KEY = "updateLastCheckedAt"
const LATEST_VERSION_KEY = "updateLatestVersion"
const LATEST_URL_STORE_KEY = "updateLatestUrl"

export type UpdateStatus = {
    hasUpdate: boolean
    currentVersion: string
    latestVersion: string
    releaseUrl: string
}

/**
 * Strip a leading "v" from a GitHub tag (e.g. "v1.2.3" -> "1.2.3") and any
 * trailing pre-release/build metadata so we only compare the x.y.z core.
 */
function normalizeVersion(raw: string): string {
    return raw
        .trim()
        .replace(/^v/i, "")
        .replace(/[-+].*$/, "")
}

/**
 * Compare two "x.y.z" versions. Returns a negative number if a < b, zero if
 * equal, positive if a > b. Non-numeric segments are treated as 0.
 */
function compareVersions(a: string, b: string): number {
    const pa = normalizeVersion(a).split(".")
    const pb = normalizeVersion(b).split(".")
    const len = Math.max(pa.length, pb.length)
    for (let i = 0; i < len; i++) {
        const na = parseInt(pa[i] || "0", 10)
        const nb = parseInt(pb[i] || "0", 10)
        if (na !== nb) return na - nb
    }
    return 0
}

/**
 * Read the app version from package.json (same logic as utils.getAppVersion),
 * so dev builds report the real app version instead of the Electron version.
 */
function getAppVersion(): string {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pkg = require("../../package.json")
        if (pkg && typeof pkg.version === "string") return pkg.version
    } catch {
        /* fall through */
    }
    return app.getVersion()
}
function fetchLatestRelease(): Promise<{ tag: string; url: string } | null> {
    return new Promise(resolve => {
        const req = https.request(
            LATEST_URL,
            {
                method: "GET",
                headers: {
                    "User-Agent": "Simple-Reader-Updater",
                    Accept: "application/vnd.github+json",
                },
            },
            response => {
                // 404 means there's no "latest" release yet (only drafts/prereleases).
                if (response.statusCode !== 200) {
                    resolve(null)
                    response.resume()
                    return
                }
                let body = ""
                response.setEncoding("utf8")
                response.on("data", (chunk: string) => {
                    body += chunk
                })
                response.on("end", () => {
                    try {
                        const data = JSON.parse(body)
                        resolve({
                            tag: data.tag_name,
                            url: data.html_url,
                        })
                    } catch {
                        resolve(null)
                    }
                })
            }
        )
        req.on("error", () => resolve(null))
        // Don't let a hung request block startup forever.
        req.setTimeout(10000, () => {
            req.destroy()
            resolve(null)
        })
        req.end()
    })
}

/**
 * Fetch the latest release from GitHub (rate-limited to once per day via the
 * persisted cache), then return whether it's newer than the running app.
 *
 * Called from the renderer via the "check-update" IPC handler. The renderer
 * always receives a definitive answer: either a fresh fetch, the cached
 * result, or { hasUpdate: false } on any error so the UI stays silent.
 */
export async function checkForUpdate(): Promise<UpdateStatus> {
    const currentVersion = getAppVersion()
    const now = Date.now()
    const lastChecked = store.get(LAST_CHECK_KEY, 0) as number

    let latestVersion = store.get(LATEST_VERSION_KEY, null) as string | null
    let releaseUrl = store.get(LATEST_URL_STORE_KEY, "") as string

    // Re-query GitHub at most once per day.
    if (now - lastChecked > CHECK_INTERVAL_MS) {
        const release = await fetchLatestRelease()
        if (release) {
            latestVersion = normalizeVersion(release.tag)
            releaseUrl = release.url
            store.set(LAST_CHECK_KEY, now)
            store.set(LATEST_VERSION_KEY, latestVersion)
            store.set(LATEST_URL_STORE_KEY, releaseUrl)
        }
    }

    const hasUpdate =
        latestVersion !== null && compareVersions(latestVersion, currentVersion) > 0

    return {
        hasUpdate,
        currentVersion,
        latestVersion: latestVersion || currentVersion,
        releaseUrl,
    }
}
