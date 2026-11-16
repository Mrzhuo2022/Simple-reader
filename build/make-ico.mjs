// Pack the pre-sized PNGs in build/icons into a single multi-size
// build/icon.ico. electron-builder would otherwise rasterize the source PNG
// through its WASM icon tool (@resvg/resvg-wasm), which fails with
// "WebAssembly.Memory(): could not allocate memory" under some Node 24
// setups; a ready-made .ico makes it skip that step entirely.
//
// ICO entries may embed PNG data directly (Windows Vista+), so no
// re-encoding is needed — this just concatenates the existing files.
//
// Usage: node build/make-ico.mjs
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(import.meta.url))
const sizes = [16, 32, 48, 64, 128, 256]

const pngs = sizes.map(size => {
    const file = path.join(root, "icons", `${size}x${size}.png`)
    if (!fs.existsSync(file)) {
        throw new Error(`missing ${file} — run the icon export first`)
    }
    return { size, data: fs.readFileSync(file) }
})

// ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes per image) + raw PNG payloads.
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0) // reserved
header.writeUInt16LE(1, 2) // type: icon
header.writeUInt16LE(pngs.length, 4)

const entries = []
let offset = header.length + pngs.length * 16
for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16)
    entry.writeUInt8(size === 256 ? 0 : size, 0) // width, 0 means 256
    entry.writeUInt8(size === 256 ? 0 : size, 1) // height
    entry.writeUInt8(0, 2) // palette color count
    entry.writeUInt8(0, 3) // reserved
    entry.writeUInt16LE(1, 4) // color planes
    entry.writeUInt16LE(32, 6) // bits per pixel
    entry.writeUInt32LE(data.length, 8)
    entry.writeUInt32LE(offset, 12)
    offset += data.length
    entries.push(entry)
}

const out = path.join(root, "icon.ico")
fs.writeFileSync(out, Buffer.concat([header, ...entries, ...pngs.map(p => p.data)]))
console.log(`wrote ${out} (${pngs.length} sizes: ${pngs.map(p => p.size).join(", ")})`)
