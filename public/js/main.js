const regionNames = new Intl.DisplayNames(["en"], { type: "region" })

const COUNTRY_CONTINENT_MAP = {
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

function formatCountryInfo(code) {
    if (!code || code === "--") return "--"
    const upper = code.toUpperCase()
    let name = upper
    try {
        name = regionNames.of(upper) || upper
    } catch {}
    const continent = COUNTRY_CONTINENT_MAP[upper] || "--"
    return `${name} (${upper} · ${continent})`
}

const ipDisplay = document.getElementById("ipDisplay")
const countrySummary = document.getElementById("countrySummary")
const metaCountry = document.getElementById("metaCountry")
const metaAsn = document.getElementById("metaAsn")
const metaAsnOrg = document.getElementById("metaAsnOrg")
const metaAsnCountry = document.getElementById("metaAsnCountry")
const metaNetwork = document.getElementById("metaNetwork")
const metaDomain = document.getElementById("metaDomain")
const apiLink = document.getElementById("apiLink")
const errorBox = document.getElementById("errorBox")
const resetBtn = document.getElementById("resetBtn")
const ipInput = document.getElementById("ipInput")

const initialState = {
    ip: ipDisplay.textContent.trim(),
    countrySummary: countrySummary.textContent.trim(),
    metaCountry: metaCountry.textContent.trim(),
    metaAsnNodes: Array.from(metaAsn.childNodes).map((n) => n.cloneNode(true)),
    metaAsnOrg: metaAsnOrg.textContent.trim(),
    metaAsnCountry: metaAsnCountry.textContent.trim(),
    metaNetwork: metaNetwork.textContent.trim(),
    metaDomainNodes: Array.from(metaDomain.childNodes).map((n) => n.cloneNode(true)),
    apiHref: apiLink.getAttribute("href"),
}

function setMetaDomain(domainRaw) {
    metaDomain.textContent = ""
    const domain =
        domainRaw && domainRaw !== "--" ? String(domainRaw).trim() : null
    if (domain) {
        const link = document.createElement("a")
        link.href = `https://${domain}`
        link.target = "_blank"
        link.rel = "noopener"
        link.textContent = domain
        metaDomain.appendChild(link)
    } else {
        metaDomain.textContent = "--"
    }
}

function setMetaAsn(asnName, asnRaw) {
    metaAsn.textContent = ""
    const hasName = asnName && asnName !== "--"
    const hasAsn = asnRaw && asnRaw !== "--"

    if (!hasName && !hasAsn) {
        metaAsn.textContent = "--"
        return
    }

    const asnClean = hasAsn ? String(asnRaw).replace(/^AS/i, "") : null

    if (hasName && asnClean) {
        metaAsn.appendChild(document.createTextNode(`${asnName} (`))
        const link = document.createElement("a")
        link.href = `https://radar.cloudflare.com/ko-kr/traffic/as${encodeURIComponent(asnClean)}`
        link.target = "_blank"
        link.rel = "noopener"
        link.textContent = `AS${asnClean}`
        metaAsn.appendChild(link)
        metaAsn.appendChild(document.createTextNode(")"))
    } else if (asnClean) {
        const link = document.createElement("a")
        link.href = `https://radar.cloudflare.com/ko-kr/traffic/as${encodeURIComponent(asnClean)}`
        link.target = "_blank"
        link.rel = "noopener"
        link.textContent = `AS${asnClean}`
        metaAsn.appendChild(link)
    } else {
        metaAsn.textContent = asnName
    }
}

function renderData(d) {
    ipDisplay.textContent = d.ip
    countrySummary.textContent = `${d.country_name} (${d.country_code})`
    metaCountry.textContent = `${d.country_name} (${d.country_code} · ${d.continent})`
    setMetaAsn(d.asn_name, d.asn)
    metaAsnOrg.textContent = d.asn_org
    metaAsnCountry.textContent = d.asn_country
    metaNetwork.textContent = d.network
    setMetaDomain(d.domain)
    apiLink.href = `/api/ip/${encodeURIComponent(d.ip)}`
    resetBtn.classList.remove("hidden")
}

document.getElementById("copyBtn").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(ipDisplay.textContent.trim())
        const copyText = document.getElementById("copyText")
        copyText.textContent = "복사됨 ✓"
        setTimeout(() => (copyText.textContent = "복사"), 1500)
    } catch {}
})

document.getElementById("lookupForm").addEventListener("submit", async (e) => {
    e.preventDefault()
    const targetIp = ipInput.value.trim()
    if (!targetIp) return
    errorBox.classList.add("hidden")

    try {
        const res = await fetch(`/api/ip/${encodeURIComponent(targetIp)}`)
        const json = await res.json()
        if (!res.ok) {
            throw new Error(json.error || "IP 정보를 찾을 수 없습니다.")
        }
        const c = json.data?.country || {}
        const a = json.data?.asn || {}
        renderData({
            ip: json.ip || targetIp,
            country_name:
                c.country_name || c.country?.names?.en || "Unknown",
            country_code: c.country_code || c.country?.iso_code || "--",
            continent:
                c.continent || c.continent_code || c.continent?.code || "--",
            asn: a.asn || a.autonomous_system_number || "--",
            asn_name: a.name || "--",
            asn_org:
                a.org ||
                a.autonomous_system_organization ||
                a.name ||
                "--",
            asn_country: formatCountryInfo(a.country_code),
            network: a.network || "--",
            domain: a.domain || "--",
        })
    } catch (err) {
        errorBox.textContent = err.message || "조회 중 오류가 발생했습니다."
        errorBox.classList.remove("hidden")
    }
})

resetBtn.addEventListener("click", () => {
    ipInput.value = ""
    errorBox.classList.add("hidden")
    ipDisplay.textContent = initialState.ip
    countrySummary.textContent = initialState.countrySummary
    metaCountry.textContent = initialState.metaCountry
    metaAsn.textContent = ""
    initialState.metaAsnNodes.forEach((n) => metaAsn.appendChild(n.cloneNode(true)))
    metaAsnOrg.textContent = initialState.metaAsnOrg
    metaAsnCountry.textContent = initialState.metaAsnCountry
    metaNetwork.textContent = initialState.metaNetwork
    metaDomain.textContent = ""
    initialState.metaDomainNodes.forEach((n) => metaDomain.appendChild(n.cloneNode(true)))
    apiLink.href = initialState.apiHref
    resetBtn.classList.add("hidden")
})
