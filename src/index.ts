import express from "express"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"
import {
    getMmdbStatus,
    initializeMmdbService,
    lookupIp,
    triggerMmdbUpdate,
} from "./getIpData.ts"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import net from "net"
dotenv.config()

const regionNames = new Intl.DisplayNames(["en"], { type: "region" })

const COUNTRY_CONTINENT_MAP: Record<string, string> = {
    AF: "AS", AX: "EU", AL: "EU", DZ: "AF", AS: "OC", AD: "EU", AO: "AF", AI: "NA", AQ: "AN", AG: "NA",
    AR: "SA", AM: "AS", AW: "NA", AU: "OC", AT: "EU", AZ: "AS", BS: "NA", BH: "AS", BD: "AS", BB: "NA",
    BY: "EU", BE: "EU", BZ: "NA", BJ: "AF", BM: "NA", BT: "AS", BO: "SA", BQ: "NA", BA: "EU", BW: "AF",
    BV: "AN", BR: "SA", IO: "AS", BN: "AS", BG: "EU", BF: "AF", BI: "AF", CV: "AF", KH: "AS", CM: "AF",
    CA: "NA", KY: "NA", CF: "AF", TD: "AF", CL: "SA", CN: "AS", CX: "AS", CC: "AS", CO: "SA", KM: "AF",
    CG: "AF", CD: "AF", CK: "OC", CR: "NA", CI: "AF", HR: "EU", CU: "NA", CW: "NA", CY: "AS", CZ: "EU",
    DK: "EU", DJ: "AF", DM: "NA", DO: "NA", EC: "SA", EG: "AF", SV: "NA", GQ: "AF", ER: "AF", EE: "EU",
    SZ: "AF", ET: "AF", FK: "SA", FO: "EU", FJ: "OC", FI: "EU", FR: "EU", GF: "SA", PF: "OC", TF: "AN",
    GA: "AF", GM: "AF", GE: "AS", DE: "EU", GH: "AF", GI: "EU", GR: "EU", GL: "NA", GD: "NA", GP: "NA",
    GU: "OC", GT: "NA", GG: "EU", GN: "AF", GW: "AF", GY: "SA", HT: "NA", HM: "AN", VA: "EU", HN: "NA",
    HK: "AS", HU: "EU", IS: "EU", IN: "AS", ID: "AS", IR: "AS", IQ: "AS", IE: "EU", IM: "EU", IL: "AS",
    IT: "EU", JM: "NA", JP: "AS", JE: "EU", JO: "AS", KZ: "AS", KE: "AF", KI: "OC", KP: "AS", KR: "AS",
    KW: "AS", KG: "AS", LA: "AS", LV: "EU", LB: "AS", LS: "AF", LR: "AF", LY: "AF", LI: "EU", LT: "EU",
    LU: "EU", MO: "AS", MG: "AF", MW: "AF", MY: "AS", MV: "AS", ML: "AF", MT: "EU", MH: "OC", MQ: "NA",
    MR: "AF", MU: "AF", YT: "AF", MX: "NA", FM: "OC", MD: "EU", MC: "EU", MN: "AS", ME: "EU", MS: "NA",
    MA: "AF", MZ: "AF", MM: "AS", NA: "AF", NR: "OC", NP: "AS", NL: "EU", NC: "OC", NZ: "OC", NI: "NA",
    NE: "AF", NG: "AF", NU: "OC", NF: "OC", MK: "EU", MP: "OC", NO: "EU", OM: "AS", PK: "AS", PW: "OC",
    PS: "AS", PA: "NA", PG: "OC", PY: "SA", PE: "SA", PH: "AS", PN: "OC", PL: "EU", PT: "EU", PR: "NA",
    QA: "AS", RE: "AF", RO: "EU", RU: "EU", RW: "AF", BL: "NA", SH: "AF", KN: "NA", LC: "NA", MF: "NA",
    PM: "NA", VC: "NA", WS: "OC", SM: "EU", ST: "AF", SA: "AS", SN: "AF", RS: "EU", SC: "AF", SL: "AF",
    SG: "AS", SX: "NA", SK: "EU", SI: "EU", SB: "OC", SO: "AF", ZA: "AF", GS: "AN", SS: "AF", ES: "EU",
    LK: "AS", SD: "AF", SR: "SA", SJ: "EU", SE: "EU", CH: "EU", SY: "AS", TW: "AS", TJ: "AS", TZ: "AF",
    TH: "AS", TL: "AS", TG: "AF", TK: "OC", TO: "OC", TT: "NA", TN: "AF", TR: "AS", TM: "AS", TC: "NA",
    TV: "OC", UG: "AF", UA: "EU", AE: "AS", GB: "EU", US: "NA", UM: "OC", UY: "SA", UZ: "AS", VU: "OC",
    VE: "SA", VN: "AS", VG: "NA", VI: "NA", WF: "OC", EH: "AF", YE: "AS", ZM: "AF", ZW: "AF",
}

function formatCountryInfo(code?: string | null) {
    if (!code || code === "--") return { name: "Unknown", code: "--", continent: "--", summary: "--" }
    const upper = code.toUpperCase()
    let name = upper
    try {
        name = regionNames.of(upper) || upper
    } catch { }
    const continent = COUNTRY_CONTINENT_MAP[upper] || "--"
    return {
        name,
        code: upper,
        continent,
        summary: `${name} (${upper} · ${continent})`,
    }
}

const ATTRIBUTION = {
    required_text: "IP Data by iplocate.io",
    url: "https://iplocate.io",
}

function isValidIP(ip: string) {
    return net.isIP(ip) !== 0
}
const limiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        const ip = req.ip
        return (
            ip === "127.0.0.1" || ip === "::1" || ip === process.env.SERVER_IP
        )
    },
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3003

app.use("/api/", limiter)
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                fontSrc: ["'self'"],
                connectSrc: [
                    "'self'",
                    "https://ipv4.icanhazip.com",
                    "https://ipv6.icanhazip.com",
                    "https://api4.ipify.org",
                    "https://api6.ipify.org",
                ],
            },
        },
    })
)
app.disable("x-powered-by")
app.set("trust proxy", 1)
app.set("json spaces", 2)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set("view engine", "ejs")
app.set("views", path.join(process.cwd(), "views"))
app.use(
    "/css",
    express.static(path.join(process.cwd(), "public", "css"), {
        maxAge: "1d",
    })
)
app.use(
    "/js",
    express.static(path.join(process.cwd(), "public", "js"), {
        maxAge: "1d",
    })
)

app.get("/", (req, res) => {
    let ip = req.ip
    if (!isValidIP(ip?.toString() || "")) {
        return res.status(400).json({ error: "Invalid IP", status: 400 })
    }
    if (ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1") {
        ip = "1.1.1.1"
    }

    console.log(`[IP Lookup] Request for IP: ${ip}`)
    const data = lookupIp(ip?.toString() || "")
    const countryData = data?.country as Record<string, any> | null
    const asnData = data?.asn as Record<string, any> | null

    if (!data) {
        return res.status(404).json({ error: "IP data not found", status: 404 })
    }

    const ua = (req.headers["user-agent"] || "").toLowerCase()
    const accept = (req.headers["accept"] || "").toLowerCase()
    const isCliOrApi =
        /curl|wget|httpie|powershell|python-requests|go-http-client| fetch/i.test(ua) ||
        accept.includes("application/json") ||
        !accept.includes("text/html")

    if (isCliOrApi) {
        return res.json({
            ip: ip?.toString() || "Unknown",
            data,
            attribution: ATTRIBUTION,
        })
    }

    res.render("index", {
        countryData: {
            ip: ip?.toString() || "Unknown",
            country_name:
                countryData?.country_name ||
                countryData?.country?.names?.en ||
                "--",
            country_code:
                countryData?.country_code ||
                countryData?.country?.iso_code ||
                "--",
            continent:
                countryData?.continent ||
                countryData?.continent_code ||
                countryData?.continent?.code ||
                "--",
            asn:
                asnData?.asn ||
                asnData?.autonomous_system_number ||
                "--",
            asn_name: asnData?.name || "--",
            asn_org:
                asnData?.org ||
                asnData?.autonomous_system_organization ||
                asnData?.name ||
                "--",
            asn_country: formatCountryInfo(asnData?.country_code).summary,
            domain: asnData?.domain || "--",
            network: asnData?.network || "--",
        },
    })
})

app.get("/api/health", (req, res) => res.json({ status: "ok" }))

app.get("/api/ip/:ip", (req, res) => {
    try {
        const ip = req.params.ip || req.ip || null
        if (!isValidIP(ip?.toString() || "")) {
            return res.status(400).json({ error: "Invalid IP", status: 400 })
        }
        console.log(`[IP Lookup] Request for IP: ${ip}`)
        const data = lookupIp(ip?.toString() || "")

        if (!data) {
            return res
                .status(404)
                .json({ error: "IP data not found", status: 404 })
        }

        res.json({
            ip: ip?.toString() || req.params.ip,
            data,
            attribution: ATTRIBUTION,
        })
    } catch (error: any) {
        if (error.message === "invalid_ip") {
            return res.status(400).json({ error: "Invalid IP", status: 400 })
        }

        if (error.message === "mmdb_not_loaded") {
            return res.status(503).json({
                error: "MMDB is not loaded",
                status: 503,
                mmdb: getMmdbStatus(),
            })
        }

        throw error
    }
})

initializeMmdbService()
    .then(() => {
        console.log("[MMDB] service initialized")
    })
    .catch((error) => {
        console.error("[MMDB] initialization failed:", error)
    })

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})
