import express from "express"
import dotenv from "dotenv"
import path from "path"
import fs from "fs"
import { fileURLToPath } from "url"
import {
    getMmdbStatus,
    initializeMmdbService,
    lookupIp,
    triggerMmdbUpdate,
} from "./getIpData.ts"
import axios from "axios"
import helmet from "helmet"
import rateLimit from "express-rate-limit"
import net from "net"

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
        return ip === "127.0.0.1" || ip === "::1"
    },
})

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app = express()
const PORT = 3003

app.use("/api/", limiter)
app.use(helmet())
app.disable("x-powered-by")
app.set("trust proxy", 1)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.set("view engine", "ejs")
app.set("views", path.join(process.cwd(), "views"))

app.get("/", (req, res) => {
    const ip = req.ip
    if (!isValidIP(ip?.toString() || "")) {
        return res.status(400).json({ error: "Invalid IP", status: 400 })
    }
    console.log(`[IP Lookup] Request for IP: ${ip}`)
    const data = lookupIp(ip?.toString() || "")
    const countryData = data?.country as {
        country_name?: string
        country_code?: string
    } | null

    if (!data) {
        return res.status(404).json({ error: "IP data not found", status: 404 })
    }

    res.render("index", {
        countryData: {
            ip: ip?.toString() || "Unknown",
            country_name: countryData?.country_name || "Unknown",
            country_code: countryData?.country_code || "--",
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

        res.json({ ip: ip?.toString() || req.params.ip, data })
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
