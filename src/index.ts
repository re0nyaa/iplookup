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

app.get("/", (req, res) => {
    // const ip = req.ip
    const ip = "2a09:bac5:472e:1482::20b:4c"
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

    res.type("html").send(`<!doctype html>
<html lang="ko">
    <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
            :root {
                --bg: #0d1722;
                --bg2: #111f2d;
                --panel: rgba(10, 18, 27, 0.72);
                --line: rgba(158, 179, 199, 0.22);
                --text: #e8f1f9;
                --muted: #98adc2;
                --point: #4cd7b2;
                --point-2: #7de2ff;
                --button-text: #042028;
            }
            * {
                box-sizing: border-box;
            }
            html,
            body {
                margin: 0;
                min-height: 100%;
                color: var(--text);
                font-family:
                    "S-Core Dream", "Pretendard", "Noto Sans KR",
                    "Apple SD Gothic Neo", sans-serif;
                background:
                    radial-gradient(
                        900px 480px at 15% 10%,
                        rgba(76, 215, 178, 0.16),
                        transparent 65%
                    ),
                    radial-gradient(
                        800px 460px at 88% 14%,
                        rgba(125, 226, 255, 0.13),
                        transparent 68%
                    ),
                    linear-gradient(160deg, var(--bg), var(--bg2));
            }
            body {
                min-height: 100vh;
                display: flex;
                flex-direction: column;
                padding: 28px;
                gap: 20px;
            }
            .shell {
                width: min(1080px, 100%);
                margin: 0 auto;
                display: flex;
                flex-direction: column;
                min-height: calc(100vh - 56px);
            }
            .topbar {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 14px;
            }
            .brand {
                margin: 0;
                font-size: clamp(28px, 3.2vw, 42px);
                font-weight: 600;
                letter-spacing: 0.015em;
            }
            .brand small {
                margin-left: 10px;
                font-size: 0.34em;
                letter-spacing: 0.14em;
                color: var(--muted);
                vertical-align: middle;
                font-weight: 500;
            }
            .nav {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 6px;
                border: 1px solid var(--line);
                border-radius: 999px;
                backdrop-filter: blur(8px);
                background: rgba(255, 255, 255, 0.02);
            }
            .nav a {
                text-decoration: none;
                color: var(--muted);
                font-size: 14px;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                padding: 10px 14px;
                border-radius: 999px;
                transition:
                    color 140ms ease,
                    background 140ms ease;
            }
            .nav a.active {
                color: var(--text);
                background: rgba(125, 226, 255, 0.13);
            }
            .main {
                flex: 1;
                display: grid;
                align-items: center;
            }
            .panel {
                width: min(760px, 100%);
                margin: 0 auto;
                padding: clamp(26px, 5vw, 48px);
                background: var(--panel);
                border: 1px solid var(--line);
                border-radius: 24px;
                box-shadow: 0 20px 70px rgba(0, 0, 0, 0.35);
                backdrop-filter: blur(14px);
                text-align: center;
                animation: rise 450ms ease-out both;
            }
            .label {
                margin: 0 0 12px;
                font-size: clamp(12px, 1.5vw, 14px);
                text-transform: uppercase;
                letter-spacing: 0.22em;
                color: var(--muted);
            }
            .ip {
                margin: 0;
                font-size: clamp(34px, 6vw, 64px);
                font-weight: 700;
                line-height: 1.04;
                letter-spacing: 0.02em;
                word-break: break-all;
                text-shadow: 0 0 18px rgba(76, 215, 178, 0.2);
            }
            .desc {
                margin: 18px 0 0;
                color: var(--text);
                font-size: clamp(16px, 2vw, 22px);
                line-height: 1.55;
            }
            .country {
                color: var(--point-2);
                font-weight: 600;
            }
            .cta {
                margin-top: 28px;
                border: 0;
                border-radius: 12px;
                padding: 14px 26px;
                font-size: clamp(15px, 1.9vw, 20px);
                font-weight: 700;
                color: var(--button-text);
                background: linear-gradient(
                    110deg,
                    var(--point),
                    var(--point-2)
                );
                cursor: pointer;
                transition:
                    transform 140ms ease,
                    filter 140ms ease;
            }
            .cta:hover {
                transform: translateY(-2px);
                filter: saturate(1.04);
            }
            .footer {
                text-align: center;
                color: var(--muted);
                font-size: clamp(13px, 1.5vw, 16px);
                letter-spacing: 0.01em;
            }
            .footer a {
                color: var(--point-2);
            }
            .footer strong {
                color: var(--text);
                font-weight: 500;
            }
            @keyframes rise {
                from {
                    opacity: 0;
                    transform: translateY(10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            @media (max-width: 800px) {
                body {
                    padding: 18px;
                }
                .shell {
                    min-height: calc(100vh - 36px);
                }
                .topbar {
                    flex-direction: column;
                    align-items: flex-start;
                }
                .nav {
                    width: 100%;
                    justify-content: space-between;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .panel {
                    border-radius: 18px;
                }
                .cta {
                    width: 100%;
                }
            }
        </style>
    </head>
    <body>
        <div class="shell">
            <main class="main">
                <section class="panel" aria-label="아이피 정보">
                    <p class="label">Public IP Address</p>
                    <h2 class="ip">${ip}</h2>
                    <p class="desc">
                        현재 접속 위치는
                        <span class="country"
                            >${countryData?.country_name ?? "Unknown"} (${countryData?.country_code ?? "--"})</span
                        >로 확인됩니다.
                    </p>
                </section>
            </main>
            <footer class="footer">
                <p>
                    IP address data powered by
                    <a href="https://iplocate.io">IPLocate.io</a>
                </p>
            </footer>
        </div>
    </body>
</html>

`)
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
