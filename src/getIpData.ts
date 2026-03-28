import fs from "fs"
import net from "net"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import * as maxmind from "maxmind"

const DEFAULT_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000
const DEFAULT_DATA_DIR = path.join(process.cwd(), "public", "data")
const DEFAULT_FILE_NAME = "ip-data.mmdb"

let reader: maxmind.Reader<any> | null = null
let activeDbPath: string | null = null
let updateTimer: NodeJS.Timeout | null = null
let updateTask: Promise<void> | null = null

function getMmdbUrl(): string {
    const url = process.env.IPLOCATE_API_KEY
        ? `https://www.iplocate.io/download/ip-to-country.mmdb?apikey=${process.env.IPLOCATE_API_KEY}&variant=daily`
        : ""

    if (!url) {
        throw new Error("MMDB_URL or IPLOCATE_API_KEY is not set")
    }

    return url
}

function getFilenameFromDisposition(disposition: string | null): string | null {
    if (!disposition) return null

    let match = disposition.match(/filename\*=UTF-8''(.+)/i)
    if (match && match[1]) return decodeURIComponent(match[1])

    match = disposition.match(/filename="?([^"]+)"?/i)
    if (match && match[1]) return match[1]

    return null
}

async function downloadData(url: string, dir: string): Promise<string> {
    const res = await fetch(url)

    if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`)
    }

    const disposition = res.headers.get("content-disposition")

    const filename =
        getFilenameFromDisposition(disposition) ??
        path.basename(new URL(url).pathname) ??
        "download.mmdb"

    fs.mkdirSync(dir, { recursive: true })

    const tempPath = path.join(dir, `${filename}.tmp`)

    const nodeStream = Readable.fromWeb(res.body as any)

    await pipeline(nodeStream, fs.createWriteStream(tempPath))

    return tempPath
}

async function loadDatabase(filePath: string) {
    const nextReader = await maxmind.open(filePath)
    reader = nextReader
    activeDbPath = filePath
}

function getDbPath(): string {
    const dataDir = process.env.MMDB_DATA_DIR || DEFAULT_DATA_DIR
    const fileName = process.env.MMDB_FILE_NAME || DEFAULT_FILE_NAME

    return path.join(dataDir, fileName)
}

async function refreshMmdb(reason: "startup" | "daily" | "manual") {
    if (updateTask) return updateTask

    updateTask = (async () => {
        const dbPath = getDbPath()
        const dbDir = path.dirname(dbPath)
        const sourceUrl = getMmdbUrl()
        const downloadedPath = await downloadData(sourceUrl, dbDir)

        fs.renameSync(downloadedPath, dbPath)
        await loadDatabase(dbPath)

        console.log(`[MMDB] Updated (${reason}) -> ${dbPath}`)
    })()

    try {
        await updateTask
    } finally {
        updateTask = null
    }
}

export async function initializeMmdbService() {
    const dbPath = getDbPath()

    if (fs.existsSync(dbPath)) {
        await loadDatabase(dbPath)
    }

    await refreshMmdb("startup")

    if (updateTimer) {
        clearInterval(updateTimer)
    }

    updateTimer = setInterval(() => {
        void refreshMmdb("daily").catch((error) => {
            console.error("[MMDB] Daily update failed:", error)
        })
    }, DEFAULT_UPDATE_INTERVAL_MS)
}

export async function triggerMmdbUpdate() {
    await refreshMmdb("manual")
}

export function getMmdbStatus() {
    return {
        loaded: !!reader,
        dbPath: activeDbPath,
        autoUpdate: !!updateTimer,
    }
}

export function lookupIp(ip: string) {
    if (!net.isIP(ip)) {
        throw new Error("invalid_ip")
    }

    if (!reader) {
        throw new Error("mmdb_not_loaded")
    }

    const result = reader.get(ip)

    if (!result) {
        return null
    }

    return result
}

export function stopMmdbService() {
    if (updateTimer) {
        clearInterval(updateTimer)
        updateTimer = null
    }
}
