const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');
const crypto = require('crypto');
const dns = require('dns').promises;
const puppeteer = require('puppeteer');

class AdvancedWebsiteMapper {
    constructor(options = {}) {
        this.options = {
            maxPages: options.maxPages || 100,
            maxDepth: options.maxDepth || 5,
            timeout: options.timeout || 30000,
            userAgent: options.userAgent || 'AdvancedWebMapper/1.0',
            ...options
        };
        
        this.baseDomain = null;
        
        // Core data structures
        this.discoveredUrls = new Set();
        this.visitedUrls = new Set();
        this.pageData = new Map();
        this.linkGraph = new Map();
        this.redirectChains = new Map();
        this.brokenLinks = new Set();
        this.duplicateContent = new Map();
        this.dnsCache = new Map();
        
        // Advanced metrics
        this.pageRankScores = new Map();
        this.hubScores = new Map();
        this.authorityScores = new Map();
        this.communities = new Map();
        
        // Discovery sources
        this.sitemapUrls = new Set();
        this.robotsTxtData = null;
        this.rssFeeds = new Set();
        this.apiEndpoints = new Set();
        this.socialMediaLinks = new Set();
        
        // Performance tracking
        this.crawlStats = {
            startTime: null,
            endTime: null,
            pagesPerSecond: 0,
            totalBytes: 0,
            errors: []
        };
    }

    // ========== DISCOVERY METHODS ==========
    
    async discoverFromRobotsTxt(baseUrl) {
        try {
            const robotsUrl = new URL('/robots.txt', baseUrl).href;
            const response = await axios.get(robotsUrl, { 
                timeout: 5000,
                headers: { 'User-Agent': this.options.userAgent }
            });
            const content = response.data;
            
            // Parse sitemap locations
            const sitemapMatches = content.match(/Sitemap:\s*(.+)/gi) || [];
            for (const match of sitemapMatches) {
                const sitemapUrl = match.replace(/Sitemap:\s*/i, '').trim();
                this.sitemapUrls.add(sitemapUrl);
            }
            
            // Parse crawl rules
            const rules = {
                allowed: [],
                disallowed: [],
                crawlDelay: null,
                userAgents: []
            };
            
            const lines = content.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                if (trimmedLine.startsWith('User-agent:')) {
                    rules.userAgents.push(trimmedLine.replace('User-agent:', '').trim());
                } else if (trimmedLine.startsWith('Allow:')) {
                    rules.allowed.push(trimmedLine.replace('Allow:', '').trim());
                } else if (trimmedLine.startsWith('Disallow:')) {
                    rules.disallowed.push(trimmedLine.replace('Disallow:', '').trim());
                } else if (trimmedLine.startsWith('Crawl-delay:')) {
                    rules.crawlDelay = parseInt(trimmedLine.replace('Crawl-delay:', '').trim());
                }
            }
            
            this.robotsTxtData = rules;
            
            // Try to discover default sitemap locations if none found
            if (this.sitemapUrls.size === 0) {
                await this.discoverDefaultSitemaps(baseUrl);
            }
            
            return rules;
        } catch (error) {
            // Try to discover default sitemap locations even if robots.txt fails
            await this.discoverDefaultSitemaps(baseUrl);
            return { 
                status: 'not_found', 
                error: error.message,
                fallbackSitemaps: this.sitemapUrls.size 
            };
        }
    }
    
    async discoverDefaultSitemaps(baseUrl) {
        const commonSitemapPaths = [
            '/sitemap.xml',
            '/sitemap_index.xml',
            '/sitemaps/sitemap.xml',
            '/sitemaps.xml',
            '/sitemap1.xml'
        ];
        
        for (const path of commonSitemapPaths) {
            try {
                const sitemapUrl = new URL(path, baseUrl).href;
                const response = await axios.head(sitemapUrl, { 
                    timeout: 3000,
                    headers: { 'User-Agent': this.options.userAgent }
                });
                
                if (response.status === 200) {
                    this.sitemapUrls.add(sitemapUrl);
                    console.log(`Found sitemap at: ${sitemapUrl}`);
                }
            } catch (error) {
                // Ignore errors, just try next path
            }
        }
    }
    
    async discoverFromSitemap(sitemapUrl) {
        try {
            const response = await axios.get(sitemapUrl, { timeout: 10000 });
            const $ = cheerio.load(response.data, { xmlMode: true });
            
            // Handle sitemap index files
            const sitemapIndexUrls = $('sitemap loc').map((i, el) => $(el).text()).get();
            if (sitemapIndexUrls.length > 0) {
                for (const indexUrl of sitemapIndexUrls) {
                    await this.discoverFromSitemap(indexUrl);
                }
            }
            
            // Extract URLs from sitemap
            const urls = $('url loc').map((i, el) => $(el).text()).get();
            const urlsWithMetadata = [];
            
            $('url').each((i, el) => {
                const url = $(el).find('loc').text();
                const lastmod = $(el).find('lastmod').text();
                const changefreq = $(el).find('changefreq').text();
                const priority = $(el).find('priority').text();
                
                if (url) {
                    this.discoveredUrls.add(url);
                    urlsWithMetadata.push({
                        url,
                        lastmod,
                        changefreq,
                        priority: parseFloat(priority) || 0.5
                    });
                }
            });
            
            return urlsWithMetadata;
        } catch (error) {
            console.log('Error parsing sitemap:', error.message);
            return [];
        }
    }
    
    async discoverFromRSSFeeds(pageUrl, html) {
        const $ = cheerio.load(html);
        const feeds = [];
        
        // Find RSS/Atom feed links
        $('link[type*="rss"], link[type*="atom"]').each((i, el) => {
            const href = $(el).attr('href');
            if (href) {
                const feedUrl = new URL(href, pageUrl).href;
                this.rssFeeds.add(feedUrl);
                feeds.push(feedUrl);
            }
        });
        
        // Parse RSS feed if this is a feed URL
        if (pageUrl.includes('/feed') || pageUrl.includes('/rss') || pageUrl.includes('.xml')) {
            try {
                const $feed = cheerio.load(html, { xmlMode: true });
                $feed('item link, entry link').each((i, el) => {
                    const url = $(el).text() || $(el).attr('href');
                    if (url) this.discoveredUrls.add(url);
                });
            } catch (error) {
                // Not a valid feed
            }
        }
        
        return feeds;
    }
    
    async discoverWithJavaScript(url) {
        let browser;
        try {
            browser = await puppeteer.launch({ 
                headless: 'new',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            const page = await browser.newPage();
            await page.setUserAgent(this.options.userAgent);
            
            // Intercept and collect API requests
            const apiCalls = [];
            page.on('request', request => {
                const url = request.url();
                if (url.includes('/api/') || url.includes('.json')) {
                    apiCalls.push({
                        url,
                        method: request.method(),
                        resourceType: request.resourceType()
                    });
                    this.apiEndpoints.add(url);
                }
            });
            
            await page.goto(url, { waitUntil: 'networkidle2', timeout: this.options.timeout });
            
            // Extract dynamically generated links
            const links = await page.evaluate(() => {
                const anchors = document.querySelectorAll('a[href]');
                return Array.from(anchors).map(a => a.href);
            });
            
            // Extract structured data
            const structuredData = await page.evaluate(() => {
                const scripts = document.querySelectorAll('script[type="application/ld+json"]');
                return Array.from(scripts).map(s => {
                    try {
                        return JSON.parse(s.textContent);
                    } catch {
                        return null;
                    }
                }).filter(Boolean);
            });
            
            // Take screenshot
            const screenshot = await page.screenshot({ encoding: 'base64', type: 'jpeg', quality: 50 });
            
            await browser.close();
            
            return {
                links,
                apiCalls,
                structuredData,
                screenshot
            };
        } catch (error) {
            if (browser) await browser.close();
            console.log('JavaScript rendering error:', error.message);
            return null;
        }
    }
    
    extractSocialMediaMeta(html, pageUrl) {
        const $ = cheerio.load(html);
        const socialData = {
            openGraph: {},
            twitter: {},
            canonical: null
        };
        
        // Open Graph tags
        $('meta[property^="og:"]').each((i, el) => {
            const property = $(el).attr('property').replace('og:', '');
            const content = $(el).attr('content');
            socialData.openGraph[property] = content;
            
            if (property === 'url' && content) {
                this.discoveredUrls.add(new URL(content, pageUrl).href);
            }
        });
        
        // Twitter cards
        $('meta[name^="twitter:"]').each((i, el) => {
            const name = $(el).attr('name').replace('twitter:', '');
            const content = $(el).attr('content');
            socialData.twitter[name] = content;
            
            if (name === 'url' && content) {
                this.discoveredUrls.add(new URL(content, pageUrl).href);
            }
        });
        
        // Canonical URL
        const canonical = $('link[rel="canonical"]').attr('href');
        if (canonical) {
            socialData.canonical = new URL(canonical, pageUrl).href;
            this.discoveredUrls.add(socialData.canonical);
        }
        
        return socialData;
    }
    
    // ========== CRAWLING STRATEGIES ==========
    
    async crawlDFS(startUrl, maxDepth = 5) {
        const stack = [{ url: startUrl, depth: 0 }];
        const visited = new Set();
        
        while (stack.length > 0 && visited.size < this.options.maxPages) {
            const { url, depth } = stack.pop();
            
            if (visited.has(url) || depth > maxDepth) continue;
            visited.add(url);
            
            const pageData = await this.fetchAndAnalyzePage(url);
            if (!pageData) continue;
            
            // Add children to stack (DFS - last in, first out)
            for (const link of pageData.links || []) {
                if (!visited.has(link)) {
                    stack.push({ url: link, depth: depth + 1 });
                }
            }
        }
        
        return visited;
    }
    
    async crawlBestFirst(startUrl, scoringFunction) {
        const priorityQueue = [{ url: startUrl, score: 1.0 }];
        const visited = new Set();
        
        while (priorityQueue.length > 0 && visited.size < this.options.maxPages) {
            // Sort by score (highest first)
            priorityQueue.sort((a, b) => b.score - a.score);
            const { url } = priorityQueue.shift();
            
            if (visited.has(url)) continue;
            visited.add(url);
            
            const pageData = await this.fetchAndAnalyzePage(url);
            if (!pageData) continue;
            
            // Score and add new URLs
            for (const link of pageData.links || []) {
                if (!visited.has(link)) {
                    const score = scoringFunction ? scoringFunction(link, pageData) : Math.random();
                    priorityQueue.push({ url: link, score });
                }
            }
        }
        
        return visited;
    }
    
    async crawlParallel(urls, concurrency = 5) {
        const results = [];
        const chunks = [];
        
        // Split URLs into chunks
        for (let i = 0; i < urls.length; i += concurrency) {
            chunks.push(urls.slice(i, i + concurrency));
        }
        
        // Process chunks and discover new URLs
        for (const chunk of chunks) {
            const promises = chunk.map(async (url) => {
                const result = await this.fetchAndAnalyzePage(url);
                // Add discovered internal links to the crawl queue
                if (result && result.links) {
                    result.links.forEach(link => {
                        if (!this.visitedUrls.has(link) && 
                            !this.discoveredUrls.has(link) && 
                            this.isInternalUrl(link, url)) {
                            this.discoveredUrls.add(link);
                        }
                    });
                }
                return result;
            });
            const chunkResults = await Promise.allSettled(promises);
            results.push(...chunkResults);
        }
        
        return results;
    }
    
    // ========== ADVANCED ANALYSIS ==========
    
    calculatePageRank(iterations = 10) {
        const dampingFactor = 0.85;
        const nodes = Array.from(this.linkGraph.keys());
        const n = nodes.length;
        
        // Initialize PageRank scores
        nodes.forEach(node => {
            this.pageRankScores.set(node, 1 / n);
        });
        
        // Iterate
        for (let i = 0; i < iterations; i++) {
            const newScores = new Map();
            
            nodes.forEach(node => {
                let rank = (1 - dampingFactor) / n;
                
                // Sum contributions from incoming links
                nodes.forEach(other => {
                    const links = this.linkGraph.get(other) || [];
                    if (links.includes(node)) {
                        rank += dampingFactor * (this.pageRankScores.get(other) / links.length);
                    }
                });
                
                newScores.set(node, rank);
            });
            
            this.pageRankScores = newScores;
        }
        
        return this.pageRankScores;
    }
    
    calculateHITS(iterations = 10) {
        const nodes = Array.from(this.linkGraph.keys());
        
        // Initialize scores
        nodes.forEach(node => {
            this.hubScores.set(node, 1);
            this.authorityScores.set(node, 1);
        });
        
        // Iterate
        for (let i = 0; i < iterations; i++) {
            const newHubs = new Map();
            const newAuthorities = new Map();
            
            // Update authority scores
            nodes.forEach(node => {
                let authScore = 0;
                nodes.forEach(other => {
                    const links = this.linkGraph.get(other) || [];
                    if (links.includes(node)) {
                        authScore += this.hubScores.get(other);
                    }
                });
                newAuthorities.set(node, authScore);
            });
            
            // Update hub scores
            nodes.forEach(node => {
                let hubScore = 0;
                const links = this.linkGraph.get(node) || [];
                links.forEach(link => {
                    hubScore += newAuthorities.get(link) || 0;
                });
                newHubs.set(node, hubScore);
            });
            
            // Normalize
            const maxHub = Math.max(...Array.from(newHubs.values()));
            const maxAuth = Math.max(...Array.from(newAuthorities.values()));
            
            nodes.forEach(node => {
                this.hubScores.set(node, newHubs.get(node) / (maxHub || 1));
                this.authorityScores.set(node, newAuthorities.get(node) / (maxAuth || 1));
            });
        }
        
        return { hubs: this.hubScores, authorities: this.authorityScores };
    }
    
    detectDuplicateContent(html1, html2, threshold = 0.8) {
        // Simple hash-based similarity
        const hash1 = crypto.createHash('md5').update(html1).digest('hex');
        const hash2 = crypto.createHash('md5').update(html2).digest('hex');
        
        if (hash1 === hash2) return 1.0;
        
        // Text similarity using Jaccard index
        const text1 = this.extractText(html1).toLowerCase().split(/\s+/);
        const text2 = this.extractText(html2).toLowerCase().split(/\s+/);
        
        const set1 = new Set(text1);
        const set2 = new Set(text2);
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        
        const similarity = intersection.size / union.size;
        return similarity;
    }
    
    detectCommunities() {
        // Simple community detection using strongly connected components
        const visited = new Set();
        const communities = [];
        
        const dfs = (node, community) => {
            if (visited.has(node)) return;
            visited.add(node);
            community.push(node);
            
            const links = this.linkGraph.get(node) || [];
            links.forEach(link => dfs(link, community));
        };
        
        Array.from(this.linkGraph.keys()).forEach(node => {
            if (!visited.has(node)) {
                const community = [];
                dfs(node, community);
                if (community.length > 1) {
                    communities.push(community);
                }
            }
        });
        
        return communities;
    }
    
    // ========== PERFORMANCE OPTIMIZATIONS ==========
    
    createBloomFilter(size = 10000, hashFunctions = 3) {
        return {
            bits: new Uint8Array(size),
            size,
            hashFunctions,
            
            add(item) {
                for (let i = 0; i < this.hashFunctions; i++) {
                    const hash = crypto.createHash('md5').update(item + i).digest();
                    const index = hash.readUInt32BE() % this.size;
                    this.bits[index] = 1;
                }
            },
            
            contains(item) {
                for (let i = 0; i < this.hashFunctions; i++) {
                    const hash = crypto.createHash('md5').update(item + i).digest();
                    const index = hash.readUInt32BE() % this.size;
                    if (this.bits[index] === 0) return false;
                }
                return true;
            }
        };
    }
    
    async cachedDnsLookup(hostname) {
        if (this.dnsCache.has(hostname)) {
            return this.dnsCache.get(hostname);
        }
        
        try {
            const addresses = await dns.resolve4(hostname);
            this.dnsCache.set(hostname, addresses);
            return addresses;
        } catch (error) {
            return null;
        }
    }
    
    // ========== DATA EXTRACTION ==========
    
    extractStructuredData(html) {
        const $ = cheerio.load(html);
        const data = {
            jsonLd: [],
            microformats: {},
            tables: [],
            forms: []
        };
        
        // JSON-LD
        $('script[type="application/ld+json"]').each((i, el) => {
            try {
                data.jsonLd.push(JSON.parse($(el).html()));
            } catch (error) {
                // Invalid JSON
            }
        });
        
        // Microformats
        const microformatClasses = ['h-card', 'h-event', 'h-entry', 'h-recipe'];
        microformatClasses.forEach(className => {
            $(`.${className}`).each((i, el) => {
                if (!data.microformats[className]) {
                    data.microformats[className] = [];
                }
                data.microformats[className].push(this.extractMicroformat($(el), className));
            });
        });
        
        // Tables
        $('table').each((i, el) => {
            const headers = $(el).find('th').map((i, th) => $(th).text()).get();
            const rows = [];
            $(el).find('tr').each((i, tr) => {
                const cells = $(tr).find('td').map((i, td) => $(td).text()).get();
                if (cells.length) rows.push(cells);
            });
            data.tables.push({ headers, rows });
        });
        
        // Forms
        $('form').each((i, el) => {
            const form = {
                action: $(el).attr('action'),
                method: $(el).attr('method'),
                fields: []
            };
            $(el).find('input, select, textarea').each((i, field) => {
                form.fields.push({
                    name: $(field).attr('name'),
                    type: $(field).attr('type') || field.tagName.toLowerCase(),
                    required: $(field).attr('required') !== undefined
                });
            });
            data.forms.push(form);
        });
        
        return data;
    }
    
    extractMicroformat($element, type) {
        const data = {};
        
        // Common properties
        const properties = {
            'h-card': ['name', 'photo', 'url', 'email', 'tel'],
            'h-event': ['name', 'start', 'end', 'location', 'description'],
            'h-entry': ['name', 'summary', 'content', 'published', 'author'],
            'h-recipe': ['name', 'ingredient', 'instructions', 'yield', 'duration']
        };
        
        (properties[type] || []).forEach(prop => {
            const value = $element.find(`.p-${prop}, .u-${prop}, .dt-${prop}, .e-${prop}`).first().text();
            if (value) data[prop] = value;
        });
        
        return data;
    }
    
    // ========== VISUALIZATION DATA ==========
    
    generateVisualizationData() {
        return {
            networkGraph: this.generateNetworkGraph(),
            treemap: this.generateTreemap(),
            sunburst: this.generateSunburst(),
            heatmap: this.generateHeatmap(),
            sankey: this.generateSankey()
        };
    }
    
    generateNetworkGraph() {
        const nodes = [];
        const edges = [];
        
        this.linkGraph.forEach((links, source) => {
            nodes.push({
                id: source,
                label: new URL(source).pathname,
                pagerank: this.pageRankScores.get(source) || 0,
                hub: this.hubScores.get(source) || 0,
                authority: this.authorityScores.get(source) || 0
            });
            
            links.forEach(target => {
                edges.push({ source, target });
            });
        });
        
        return { nodes, edges };
    }
    
    generateTreemap() {
        const root = { name: 'root', children: [] };
        const pathMap = new Map();
        
        this.visitedUrls.forEach(url => {
            const path = new URL(url).pathname.split('/').filter(Boolean);
            let current = root;
            
            path.forEach((segment, index) => {
                const pathKey = path.slice(0, index + 1).join('/');
                
                if (!pathMap.has(pathKey)) {
                    const node = { name: segment, children: [], value: 1 };
                    current.children.push(node);
                    pathMap.set(pathKey, node);
                    current = node;
                } else {
                    current = pathMap.get(pathKey);
                    current.value++;
                }
            });
        });
        
        return root;
    }
    
    generateSunburst() {
        // Similar to treemap but for radial display
        return this.generateTreemap();
    }
    
    generateHeatmap() {
        const data = [];
        
        this.pageData.forEach((page, url) => {
            data.push({
                url,
                depth: page.depth || 0,
                pagerank: this.pageRankScores.get(url) || 0,
                links: (this.linkGraph.get(url) || []).length,
                loadTime: page.loadTime || 0
            });
        });
        
        return data;
    }
    
    generateSankey() {
        const flows = new Map();
        
        this.linkGraph.forEach((targets, source) => {
            targets.forEach(target => {
                const key = `${source}->${target}`;
                flows.set(key, (flows.get(key) || 0) + 1);
            });
        });
        
        return Array.from(flows.entries()).map(([key, value]) => {
            const [source, target] = key.split('->');
            return { source, target, value };
        });
    }
    
    // ========== ADVANCED FEATURES ==========
    
    async detectChanges(url, previousContent) {
        const currentContent = await this.fetchPage(url);
        if (!currentContent || !previousContent) return null;
        
        const similarity = this.detectDuplicateContent(previousContent, currentContent);
        const changed = similarity < 0.95;
        
        if (changed) {
            // Simple diff - count changed lines
            const lines1 = previousContent.split('\n');
            const lines2 = currentContent.split('\n');
            const changes = {
                added: Math.max(0, lines2.length - lines1.length),
                removed: Math.max(0, lines1.length - lines2.length),
                modified: Math.abs(lines1.length - lines2.length)
            };
            
            return { changed, similarity, changes };
        }
        
        return { changed, similarity };
    }
    
    async detectBrokenLinks() {
        const brokenLinks = [];
        
        for (const [sourceUrl, links] of this.linkGraph.entries()) {
            for (const targetUrl of links) {
                try {
                    const response = await axios.head(targetUrl, { 
                        timeout: 5000,
                        headers: { 'User-Agent': this.options.userAgent }
                    });
                    
                    if (response.status >= 400) {
                        brokenLinks.push({
                            source: sourceUrl,
                            target: targetUrl,
                            status: response.status,
                            error: `HTTP ${response.status}`
                        });
                        this.brokenLinks.add(targetUrl);
                    }
                } catch (error) {
                    brokenLinks.push({
                        source: sourceUrl,
                        target: targetUrl,
                        status: 'error',
                        error: error.message
                    });
                    this.brokenLinks.add(targetUrl);
                }
            }
        }
        
        return brokenLinks;
    }
    
    async detectRedirectChains(maxHops = 5) {
        const redirectChains = new Map();
        
        for (const url of this.visitedUrls) {
            const chain = await this.followRedirects(url, maxHops);
            if (chain.length > 1) {
                redirectChains.set(url, chain);
            }
        }
        
        return redirectChains;
    }
    
    async followRedirects(url, maxHops = 5) {
        const chain = [url];
        let currentUrl = url;
        
        for (let hop = 0; hop < maxHops; hop++) {
            try {
                const response = await axios.get(currentUrl, {
                    maxRedirects: 0,
                    validateStatus: status => status < 400,
                    headers: { 'User-Agent': this.options.userAgent }
                });
                
                const location = response.headers.location;
                if (location && response.status >= 300 && response.status < 400) {
                    const nextUrl = new URL(location, currentUrl).href;
                    chain.push(nextUrl);
                    currentUrl = nextUrl;
                } else {
                    break;
                }
            } catch (error) {
                break;
            }
        }
        
        return chain;
    }
    
    async analyzePerformanceMetrics() {
        const metrics = {
            totalPages: this.visitedUrls.size,
            avgLoadTime: 0,
            slowestPages: [],
            fastestPages: [],
            totalBytes: 0,
            avgPageSize: 0,
            errorRate: 0
        };
        
        const loadTimes = [];
        const pageSizes = [];
        
        for (const [url, pageData] of this.pageData.entries()) {
            if (pageData.loadTime) {
                loadTimes.push({ url, time: pageData.loadTime });
            }
            if (pageData.size) {
                pageSizes.push({ url, size: pageData.size });
                metrics.totalBytes += pageData.size;
            }
        }
        
        if (loadTimes.length > 0) {
            metrics.avgLoadTime = loadTimes.reduce((sum, p) => sum + p.time, 0) / loadTimes.length;
            metrics.slowestPages = loadTimes.sort((a, b) => b.time - a.time).slice(0, 5);
            metrics.fastestPages = loadTimes.sort((a, b) => a.time - b.time).slice(0, 5);
        }
        
        if (pageSizes.length > 0) {
            metrics.avgPageSize = metrics.totalBytes / pageSizes.length;
        }
        
        metrics.errorRate = (this.crawlStats.errors.length / this.visitedUrls.size) * 100;
        
        return metrics;
    }
    
    async analyzeSEO() {
        const seoAnalysis = {
            titlesAnalysis: { missing: 0, tooShort: 0, tooLong: 0, duplicates: new Set() },
            descriptionsAnalysis: { missing: 0, tooShort: 0, tooLong: 0 },
            headingsAnalysis: { missingH1: 0, multipleH1: 0 },
            imageAnalysis: { missingAlt: 0, totalImages: 0 },
            urlAnalysis: { tooLong: 0, nonSEOFriendly: 0 }
        };
        
        const titles = new Map();
        
        for (const [url, pageData] of this.pageData.entries()) {
            // Analyze titles
            if (!pageData.title || pageData.title.trim() === '') {
                seoAnalysis.titlesAnalysis.missing++;
            } else {
                const title = pageData.title.trim();
                if (title.length < 30) seoAnalysis.titlesAnalysis.tooShort++;
                if (title.length > 60) seoAnalysis.titlesAnalysis.tooLong++;
                
                if (titles.has(title)) {
                    seoAnalysis.titlesAnalysis.duplicates.add(title);
                } else {
                    titles.set(title, url);
                }
            }
            
            // Analyze URLs
            if (url.length > 100) seoAnalysis.urlAnalysis.tooLong++;
            if (!/^[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/.test(url)) {
                seoAnalysis.urlAnalysis.nonSEOFriendly++;
            }
        }
        
        seoAnalysis.titlesAnalysis.duplicates = Array.from(seoAnalysis.titlesAnalysis.duplicates);
        
        return seoAnalysis;
    }
    
    async detectTechnology(url, html) {
        const technologies = {
            cms: null,
            frameworks: [],
            analytics: [],
            cdn: null,
            server: null
        };
        
        const $ = cheerio.load(html);
        
        // CMS Detection
        if (html.includes('wp-content') || html.includes('WordPress')) {
            technologies.cms = 'WordPress';
        } else if (html.includes('Drupal')) {
            technologies.cms = 'Drupal';
        } else if (html.includes('Joomla')) {
            technologies.cms = 'Joomla';
        } else if ($('meta[name="generator"]').attr('content')) {
            technologies.cms = $('meta[name="generator"]').attr('content');
        }
        
        // Framework Detection
        if (html.includes('react')) technologies.frameworks.push('React');
        if (html.includes('angular')) technologies.frameworks.push('Angular');
        if (html.includes('vue')) technologies.frameworks.push('Vue.js');
        if (html.includes('jquery')) technologies.frameworks.push('jQuery');
        if (html.includes('bootstrap')) technologies.frameworks.push('Bootstrap');
        
        // Analytics Detection
        if (html.includes('google-analytics.com')) technologies.analytics.push('Google Analytics');
        if (html.includes('googletagmanager.com')) technologies.analytics.push('Google Tag Manager');
        if (html.includes('facebook.com/tr')) technologies.analytics.push('Facebook Pixel');
        
        // CDN Detection from response headers would go here
        // Server detection from headers would go here
        
        return technologies;
    }
    
    // ========== HELPER METHODS ==========
    
    getBaseDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch {
            return '';
        }
    }
    
    isInternalUrl(url, baseUrl) {
        try {
            if (!this.baseDomain) {
                this.baseDomain = this.getBaseDomain(baseUrl);
            }
            const urlDomain = this.getBaseDomain(url);
            return urlDomain === this.baseDomain;
        } catch {
            return false;
        }
    }
    
    async fetchPage(url) {
        try {
            const response = await axios.get(url, {
                timeout: this.options.timeout,
                headers: { 'User-Agent': this.options.userAgent }
            });
            return response.data;
        } catch (error) {
            this.crawlStats.errors.push({ url, error: error.message });
            return null;
        }
    }
    
    async fetchAndAnalyzePage(url) {
        const startTime = Date.now();
        console.log(`📄 Processing page: ${url}`);
        
        // Mark as visited
        this.visitedUrls.add(url);
        
        const html = await this.fetchPage(url);
        
        if (!html) return null;
        
        const $ = cheerio.load(html);
        const links = [];
        
        $('a[href]').each((i, el) => {
            const href = $(el).attr('href');
            try {
                const absoluteUrl = new URL(href, url).href;
                links.push(absoluteUrl);
                
                // Only add internal URLs to discovered set
                if (this.isInternalUrl(absoluteUrl, url)) {
                    this.discoveredUrls.add(absoluteUrl);
                }
            } catch (error) {
                // Invalid URL
            }
        });
        
        // Update link graph
        this.linkGraph.set(url, links);
        
        const pageData = {
            url,
            title: $('title').text(),
            links,
            loadTime: Date.now() - startTime,
            size: html.length,
            timestamp: new Date().toISOString()
        };
        
        this.pageData.set(url, pageData);
        this.visitedUrls.add(url);
        
        return pageData;
    }
    
    extractText(html) {
        const $ = cheerio.load(html);
        $('script, style').remove();
        return $('body').text().trim();
    }
    
    // ========== MAIN ORCHESTRATION ==========
    
    async runComprehensiveAnalysis(startUrl) {
        console.log('Starting comprehensive website analysis...');
        this.crawlStats.startTime = Date.now();
        
        // Phase 1: Discovery
        console.log('Phase 1: Discovery');
        const baseUrl = new URL(startUrl).origin;
        
        await this.discoverFromRobotsTxt(baseUrl);
        
        for (const sitemapUrl of this.sitemapUrls) {
            await this.discoverFromSitemap(sitemapUrl);
        }
        
        // Phase 2: Crawling
        console.log('Phase 2: Crawling');
        console.log(`Initial discovered URLs: ${this.discoveredUrls.size}`);
        let crawledCount = 0;
        let round = 1;
        
        while (crawledCount < this.options.maxPages && this.discoveredUrls.size > crawledCount) {
            console.log(`Crawling round ${round}, discovered ${this.discoveredUrls.size} URLs, crawled ${crawledCount}`);
            
            const remainingPages = this.options.maxPages - crawledCount;
            const urlsToProcess = Array.from(this.discoveredUrls)
                .filter(url => !this.visitedUrls.has(url))
                .slice(0, Math.min(remainingPages, 20)); // Process up to 20 URLs per round
            
            console.log(`Processing ${urlsToProcess.length} URLs in this round:`, urlsToProcess.slice(0, 3).map(u => u.split('/').slice(-1)[0]));
            
            if (urlsToProcess.length === 0) {
                console.log('No more URLs to process, finishing crawl');
                break;
            }
            
            await this.crawlParallel(urlsToProcess, 5);
            crawledCount += urlsToProcess.length;
            round++;
            
            // Prevent infinite loops
            if (round > 10) {
                console.log('Max rounds reached, finishing crawl');
                break;
            }
        }
        
        console.log(`Final stats: discovered ${this.discoveredUrls.size} URLs, crawled ${crawledCount}`);
        
        // Phase 3: Advanced Analysis
        console.log('Phase 3: Advanced Analysis');
        this.calculatePageRank();
        this.calculateHITS();
        const communities = this.detectCommunities();
        
        // Phase 4: Generate Visualizations
        console.log('Phase 4: Generating visualization data');
        const visualizations = this.generateVisualizationData();
        
        this.crawlStats.endTime = Date.now();
        this.crawlStats.pagesPerSecond = this.visitedUrls.size / 
            ((this.crawlStats.endTime - this.crawlStats.startTime) / 1000);
        
        return {
            stats: this.crawlStats,
            discovered: this.discoveredUrls.size,
            visited: this.visitedUrls.size,
            pageRankTop10: this.getTopPages(this.pageRankScores, 10),
            hubsTop10: this.getTopPages(this.hubScores, 10),
            authoritiesTop10: this.getTopPages(this.authorityScores, 10),
            communities: communities.length,
            brokenLinks: this.brokenLinks.size,
            visualizations
        };
    }
    
    getTopPages(scoreMap, n = 10) {
        return Array.from(scoreMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, n)
            .map(([url, score]) => ({ url, score }));
    }
}

module.exports = AdvancedWebsiteMapper;