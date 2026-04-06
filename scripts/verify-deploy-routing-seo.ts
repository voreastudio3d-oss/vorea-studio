type CheckResult = {
  name: string
  ok: boolean
  details: string
}

function normalizeBaseUrl(input?: string): URL {
  const raw = (input ?? process.env.VOREA_VERIFY_BASE_URL ?? 'https://voreastudio3d.com').trim()
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const url = new URL(withProtocol)
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return url
}

function deriveApiHealthUrls(baseUrl: URL): URL[] {
  const urls: URL[] = []
  const envApiBase = process.env.VOREA_VERIFY_API_BASE_URL?.trim()
  if (envApiBase) {
    const apiUrl = new URL(/^https?:\/\//i.test(envApiBase) ? envApiBase : `https://${envApiBase}`)
    apiUrl.pathname = '/api/health'
    apiUrl.search = ''
    apiUrl.hash = ''
    return [apiUrl]
  }

  const sameOrigin = new URL('/api/health', baseUrl)
  urls.push(sameOrigin)

  const host = baseUrl.hostname
  if (host !== 'localhost' && !/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && !host.startsWith('api.')) {
    const apiSubdomain = new URL(baseUrl.toString())
    apiSubdomain.hostname = host.startsWith('www.') ? `api.${host.slice(4)}` : `api.${host}`
    apiSubdomain.pathname = '/api/health'
    apiSubdomain.search = ''
    apiSubdomain.hash = ''
    urls.push(apiSubdomain)
  }

  return urls
}

async function fetchText(url: URL): Promise<{ status: number; contentType: string; text: string }> {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'vorea-routing-seo-smoke/1.0',
      accept: 'text/html,application/xml,text/plain,*/*',
    },
    redirect: 'follow',
  })

  const contentType = response.headers.get('content-type') ?? ''
  const text = await response.text()
  return { status: response.status, contentType, text }
}

function includesCanonical(html: string, absoluteUrl: string): boolean {
  const escaped = absoluteUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']${escaped}["']`, 'i').test(html)
}

function includesMeta(html: string, name: string, contentFragment: string): boolean {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const escapedContent = contentFragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`<meta[^>]+(?:name|property)=["']${escapedName}["'][^>]+content=["'][^"']*${escapedContent}[^"']*["']`, 'i').test(html)
}

async function run(): Promise<void> {
  const baseUrl = normalizeBaseUrl(process.argv[2])
  const checks: CheckResult[] = []

  const robotsUrl = new URL('/robots.txt', baseUrl)
  const robots = await fetchText(robotsUrl)
  checks.push({
    name: 'robots.txt',
    ok:
      robots.status === 200 &&
      !/text\/html/i.test(robots.contentType) &&
      /Sitemap:/i.test(robots.text),
    details: `status=${robots.status}, content-type=${robots.contentType || 'n/a'}`,
  })

  const sitemapUrl = new URL('/sitemap.xml', baseUrl)
  const sitemap = await fetchText(sitemapUrl)
  checks.push({
    name: 'sitemap.xml',
    ok:
      sitemap.status === 200 &&
      !/text\/html/i.test(sitemap.contentType) &&
      /<urlset[\s>]/i.test(sitemap.text),
    details: `status=${sitemap.status}, content-type=${sitemap.contentType || 'n/a'}`,
  })

  const newsUrl = new URL('/noticias', baseUrl)
  const news = await fetchText(newsUrl)
  checks.push({
    name: 'public canonical',
    ok:
      news.status === 200 &&
      includesCanonical(news.text, newsUrl.toString()) &&
      includesMeta(news.text, 'og:title', '') &&
      !includesMeta(news.text, 'robots', 'noindex'),
    details: `status=${news.status}, canonical=${includesCanonical(news.text, newsUrl.toString())}`,
  })

  const aiStudioUrl = new URL('/ai-studio', baseUrl)
  const aiStudio = await fetchText(aiStudioUrl)
  checks.push({
    name: 'private noindex',
    ok:
      aiStudio.status === 200 &&
      includesMeta(aiStudio.text, 'robots', 'noindex') &&
      includesCanonical(aiStudio.text, aiStudioUrl.toString()),
    details: `status=${aiStudio.status}, noindex=${includesMeta(aiStudio.text, 'robots', 'noindex')}`,
  })

  const apiHealthUrls = deriveApiHealthUrls(baseUrl)
  if (apiHealthUrls.length > 0) {
    let apiCheck: CheckResult | null = null
    for (const candidate of apiHealthUrls) {
      try {
        const apiHealth = await fetchText(candidate)
        const ok = apiHealth.status === 200 && /"status"\s*:\s*"ok"/i.test(apiHealth.text)
        if (ok) {
          apiCheck = {
            name: 'api health',
            ok: true,
            details: `status=${apiHealth.status}, url=${candidate.toString()}`,
          }
          break
        }
        apiCheck = {
          name: 'api health',
          ok: false,
          details: `status=${apiHealth.status}, url=${candidate.toString()}`,
        }
      } catch (error) {
        apiCheck = {
          name: 'api health',
          ok: false,
          details: `request failed for ${candidate.toString()}: ${error instanceof Error ? error.message : String(error)}`,
        }
      }
    }
    checks.push(apiCheck!)
  }

  console.log(`\nDeploy smoke for ${baseUrl.toString()}\n`)
  for (const check of checks) {
    const icon = check.ok ? 'PASS' : 'FAIL'
    console.log(`${icon}  ${check.name} -> ${check.details}`)
  }

  const failed = checks.filter((check) => !check.ok)
  console.log(`\nSummary: ${checks.length - failed.length}/${checks.length} checks passed`)

  if (failed.length > 0) {
    process.exitCode = 1
  }
}

run().catch((error) => {
  console.error(`Smoke failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
