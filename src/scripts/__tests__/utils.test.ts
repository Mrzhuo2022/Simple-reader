import {
    cutText,
    mergeSortedArrays,
    byteToMB,
    urlTest,
    validateRegex,
    htmlDecode,
    platformCtrl,
    getWindowBreakpoint,
    matchShortcut,
} from "../utils"

describe("utils", () => {
    describe("cutText", () => {
        it("returns the string unchanged when within length", () => {
            expect(cutText("hello", 5)).toBe("hello")
            expect(cutText("", 3)).toBe("")
        })

        it("truncates and appends ellipsis when too long", () => {
            expect(cutText("hello world", 5)).toBe("hello…")
        })
    })

    describe("mergeSortedArrays", () => {
        const asc = (a: number, b: number) => a - b

        it("merges two sorted arrays", () => {
            expect(mergeSortedArrays([1, 3, 5], [2, 4, 6], asc)).toEqual([1, 2, 3, 4, 5, 6])
        })

        it("handles empty arrays", () => {
            expect(mergeSortedArrays([], [1, 2], asc)).toEqual([1, 2])
            expect(mergeSortedArrays([1, 2], [], asc)).toEqual([1, 2])
            expect(mergeSortedArrays([], [], asc)).toEqual([])
        })

        it("is stable for equal elements (takes from first array first)", () => {
            const a = [{ v: 1, tag: "a" }]
            const b = [{ v: 1, tag: "b" }]
            const merged = mergeSortedArrays(a, b, (x, y) => x.v - y.v)
            expect(merged.map(x => x.tag)).toEqual(["a", "b"])
        })
    })

    describe("byteToMB", () => {
        it("converts bytes to rounded MB", () => {
            expect(byteToMB(1048576)).toBe("1MB")
            expect(byteToMB(1572864)).toBe("2MB") // rounds up
            expect(byteToMB(0)).toBe("0MB")
        })

        it("returns 0MB for invalid input", () => {
            expect(byteToMB(NaN)).toBe("0MB")
            expect(byteToMB(undefined as unknown as number)).toBe("0MB")
        })
    })

    describe("urlTest", () => {
        it("accepts http and https URLs", () => {
            expect(urlTest("https://example.com")).toBe(true)
            expect(urlTest("http://example.com/path?query=1")).toBe(true)
            expect(urlTest("https://www.example.co.uk/a/b")).toBe(true)
        })

        it("rejects non-URLs", () => {
            expect(urlTest("not a url")).toBe(false)
            expect(urlTest("ftp://example.com")).toBe(false)
            expect(urlTest("")).toBe(false)
        })

        it("is not affected by the global flag lastIndex", () => {
            // Calling twice with the same valid URL must return true both times
            const url = "https://example.com"
            expect(urlTest(url)).toBe(true)
            expect(urlTest(url)).toBe(true)
        })
    })

    describe("validateRegex", () => {
        it("returns a RegExp for a valid pattern", () => {
            const r = validateRegex("abc", "i")
            expect(r).toBeInstanceOf(RegExp)
            expect(r.test("ABC")).toBe(true)
        })

        it("returns null for an invalid pattern", () => {
            expect(validateRegex("[")).toBeNull()
            expect(validateRegex("abc", "bad-flags")).toBeNull()
        })
    })

    describe("htmlDecode", () => {
        it("decodes HTML entities", () => {
            expect(htmlDecode("&amp;&lt;&gt;")).toBe("&<>")
            expect(htmlDecode("caf&eacute;")).toBe("café")
        })

        it("strips tags and returns text content", () => {
            expect(htmlDecode("<p>hello <b>world</b></p>")).toBe("hello world")
        })
    })

    describe("platformCtrl", () => {
        afterEach(() => {
            ;(window.utils as { platform: string }).platform = "linux"
        })

        it("uses ctrlKey on non-darwin", () => {
            expect(platformCtrl({ ctrlKey: true, metaKey: false } as KeyboardEvent)).toBe(true)
            expect(platformCtrl({ ctrlKey: false, metaKey: true } as KeyboardEvent)).toBe(false)
        })

        it("uses metaKey on darwin", () => {
            ;(window.utils as { platform: string }).platform = "darwin"
            expect(platformCtrl({ ctrlKey: false, metaKey: true } as KeyboardEvent)).toBe(true)
            expect(platformCtrl({ ctrlKey: true, metaKey: false } as KeyboardEvent)).toBe(false)
        })
    })

    describe("getWindowBreakpoint", () => {
        it("returns true when outer width >= 1440", () => {
            Object.defineProperty(window, "outerWidth", { value: 1920, writable: true })
            expect(getWindowBreakpoint()).toBe(true)
        })

        it("returns false when outer width < 1440", () => {
            Object.defineProperty(window, "outerWidth", { value: 1024, writable: true })
            expect(getWindowBreakpoint()).toBe(false)
        })
    })

    describe("matchShortcut", () => {
        const ev = (
            key: string,
            mods: Partial<{ ctrl: boolean; meta: boolean; alt: boolean; shift: boolean }> = {}
        ) => ({
            key,
            ctrlKey: !!mods.ctrl,
            metaKey: !!mods.meta,
            altKey: !!mods.alt,
            shiftKey: !!mods.shift,
        })

        it("matches plain keys", () => {
            expect(matchShortcut("F5", ev("F5"))).toBe(true)
            expect(matchShortcut("Escape", ev("Escape"))).toBe(true)
            expect(matchShortcut("F5", ev("F6"))).toBe(false)
        })

        it("matches modifier combinations", () => {
            expect(matchShortcut("Ctrl+K", ev("k", { ctrl: true }))).toBe(true)
            expect(matchShortcut("Ctrl+K", ev("k"))).toBe(false)
            expect(matchShortcut("Ctrl+K", ev("k", { ctrl: true, shift: true }))).toBe(false)
            expect(matchShortcut("Ctrl+Shift+F", ev("F", { ctrl: true, shift: true }))).toBe(true)
        })

        it("accepts alias names for modifiers", () => {
            expect(matchShortcut("Control+K", ev("k", { ctrl: true }))).toBe(true)
            expect(matchShortcut("Cmd+K", ev("k", { meta: true }))).toBe(true)
            expect(matchShortcut("Command+K", ev("k", { meta: true }))).toBe(true)
            expect(matchShortcut("Meta+K", ev("k", { meta: true }))).toBe(true)
        })

        it("is case-insensitive for both shortcut and event key", () => {
            expect(matchShortcut("ctrl+k", ev("K", { ctrl: true }))).toBe(true)
            expect(matchShortcut("CTRL+K", ev("k", { ctrl: true }))).toBe(true)
        })

        it("returns false for missing shortcuts", () => {
            expect(matchShortcut(undefined, ev("k", { ctrl: true }))).toBe(false)
            expect(matchShortcut("", ev("k", { ctrl: true }))).toBe(false)
        })
    })
})
