import fs from "fs"
import net from "net"
import path from "path"
import { Readable } from "stream"
import { pipeline } from "stream/promises"
import * as maxmind from "maxmind"

const DEFAULT_UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000
const DEFAULT_DATA_DIR = path.join(process.cwd(), "public", "data")
const DEFAULT_COUNTRY_FILE_NAME = "ip-data.mmdb"
const DEFAULT_ASN_FILE_NAME = "ip-asn.mmdb"

type MmdbKind = "country" | "asn"

type LookupResult = Record<string, unknown> | null

type ReaderStore = Record<MmdbKind, maxmind.Reader<any> | null>
type PathStore = Record<MmdbKind, string | null>

const readers: ReaderStore = {
    country: null,
    asn: null,
}

const activeDbPaths: PathStore = {
    country: null,
    asn: null,
}

let updateTimer: NodeJS.Timeout | null = null
let updateTask: Promise<void> | null = null

function getMmdbUrl(kind: MmdbKind): string {
    const apiKey = process.env.IPLOCATE_API_KEY

    if (!apiKey) {
        throw new Error("MMDB_URL or IPLOCATE_API_KEY is not set")
    }

    if (kind === "country") {
        return `https://www.iplocate.io/download/ip-to-country.mmdb?apikey=${apiKey}&variant=daily`
    }

    return `https://www.iplocate.io/download/ip-to-asn.mmdb?apikey=${apiKey}&variant=daily`
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

async function loadDatabase(kind: MmdbKind, filePath: string) {
    const nextReader = await maxmind.open(filePath)
    readers[kind] = nextReader
    activeDbPaths[kind] = filePath
}

function getDbPath(kind: MmdbKind): string {
    const dataDir = process.env.MMDB_DATA_DIR || DEFAULT_DATA_DIR
    const fileName =
        kind === "country"
            ? process.env.MMDB_FILE_NAME || DEFAULT_COUNTRY_FILE_NAME
            : process.env.MMDB_ASN_FILE_NAME || DEFAULT_ASN_FILE_NAME

    return path.join(dataDir, fileName)
}

function isFileFresh(filePath: string): boolean {
    if (!fs.existsSync(filePath)) return false
    const { mtimeMs } = fs.statSync(filePath)
    return Date.now() - mtimeMs < DEFAULT_UPDATE_INTERVAL_MS
}

async function refreshMmdb(reason: "startup" | "daily" | "manual") {
    if (updateTask) return updateTask

    updateTask = (async () => {
        const kinds: MmdbKind[] = ["country", "asn"]

        for (const kind of kinds) {
            const dbPath = getDbPath(kind)
            if (reason === "startup" && isFileFresh(dbPath)) {
                console.log(`[MMDB] Skipping ${kind} download (${reason}): file is up to date`)
                continue
            }

            const dbDir = path.dirname(dbPath)
            const sourceUrl = getMmdbUrl(kind)
            const downloadedPath = await downloadData(sourceUrl, dbDir)

            fs.renameSync(downloadedPath, dbPath)
            await loadDatabase(kind, dbPath)

            console.log(`[MMDB] Updated ${kind} (${reason}) -> ${dbPath}`)
        }
    })()

    try {
        await updateTask
    } finally {
        updateTask = null
    }
}

export async function initializeMmdbService() {
    const countryDbPath = getDbPath("country")
    const asnDbPath = getDbPath("asn")

    if (fs.existsSync(countryDbPath)) {
        await loadDatabase("country", countryDbPath)
    }

    if (fs.existsSync(asnDbPath)) {
        await loadDatabase("asn", asnDbPath)
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
        loaded: {
            country: !!readers.country,
            asn: !!readers.asn,
        },
        dbPath: {
            country: activeDbPaths.country,
            asn: activeDbPaths.asn,
        },
        autoUpdate: !!updateTimer,
    }
}

export function lookupIp(ip: string) {
    if (!net.isIP(ip)) {
        throw new Error("invalid_ip")
    }

    if (!readers.country || !readers.asn) {
        throw new Error("mmdb_not_loaded")
    }

    const country = readers.country.get(ip) as LookupResult
    const asn = readers.asn.get(ip) as LookupResult

    if (!country && !asn) {
        return null
    }

    return {
        country,
        asn,
    }
}

export function stopMmdbService() {
    if (updateTimer) {
        clearInterval(updateTimer)
        updateTimer = null
    }
}
