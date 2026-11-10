const ipDisplay = document.getElementById("ipDisplay")
const countrySummary = document.getElementById("countrySummary")
const metaCountry = document.getElementById("metaCountry")
const metaOrg = document.getElementById("metaOrg")
const metaRoute = document.getElementById("metaRoute")
const metaDomain = document.getElementById("metaDomain")
const apiLink = document.getElementById("apiLink")
const errorBox = document.getElementById("errorBox")
const resetBtn = document.getElementById("resetBtn")
const ipInput = document.getElementById("ipInput")

const initialState = {
    ip: ipDisplay.textContent.trim(),
    countrySummary: countrySummary.textContent.trim(),
    metaCountry: metaCountry.textContent.trim(),
    metaOrgNodes: Array.from(metaOrg.childNodes).map((n) => n.cloneNode(true)),
    metaRoute: metaRoute.textContent.trim(),
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

function setMetaOrg(orgName, asnRaw) {
    metaOrg.textContent = ""
    const asnClean =
        asnRaw && asnRaw !== "--" ? String(asnRaw).replace(/^AS/i, "") : null
    if (asnClean) {
        metaOrg.appendChild(document.createTextNode(`${orgName} (`))
        const link = document.createElement("a")
        link.href = `https://radar.cloudflare.com/ko-kr/traffic/as${encodeURIComponent(asnClean)}`
        link.target = "_blank"
        link.rel = "noopener"
        link.textContent = `AS${asnClean}`
        metaOrg.appendChild(link)
        metaOrg.appendChild(document.createTextNode(")"))
    } else {
        metaOrg.textContent = `${orgName} (--)`
    }
}

function renderData(d) {
    ipDisplay.textContent = d.ip
    countrySummary.textContent = `${d.country_name} (${d.country_code})`
    metaCountry.textContent = `${d.country_name} (${d.country_code} · ${d.continent})`
    setMetaOrg(d.org, d.asn)
    metaRoute.textContent = d.route
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
            org:
                a.name ||
                a.org ||
                a.autonomous_system_organization ||
                "Unknown",
            route: a.route || "--",
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
    metaOrg.textContent = ""
    initialState.metaOrgNodes.forEach((n) => metaOrg.appendChild(n.cloneNode(true)))
    metaRoute.textContent = initialState.metaRoute
    metaDomain.textContent = ""
    initialState.metaDomainNodes.forEach((n) => metaDomain.appendChild(n.cloneNode(true)))
    apiLink.href = initialState.apiHref
    resetBtn.classList.add("hidden")
})

