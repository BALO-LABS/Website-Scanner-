// Website Scanner Application with Automatic CORS Proxy Support
let comprehensiveMapData = null;

// Proxy Manager for automatic CORS proxy fallback
class ProxyManager {
    constructor() {
        this.proxies = [
            { 
                name: 'allorigins', 
                buildUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                priority: 1
            },
            { 
                name: 'corsproxy.io', 
                buildUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
                priority: 2
            },
            { 
                name: 'thingproxy', 
                buildUrl: (url) => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
                priority: 3
            },
            { 
                name: 'proxy.cors.sh', 
                buildUrl: (url) => `https://proxy.cors.sh/${encodeURIComponent(url)}`,
                priority: 4
            },
            { 
                name: 'cors-anywhere', 
                buildUrl: (url) => `https://cors-anywhere.herokuapp.com/${url}`,
                priority: 5
            }
        ];
        this.workingProxies = new Map(); // Cache working proxies per domain
        this.currentProxyIndex = 0;
    }
    
    async fetchWithFallback(targetUrl, timeout = 8000) {
        const domain = new URL(targetUrl).hostname;
        
        // Update status to show we're trying proxies
        this.updateProxyStatus('Connecting to proxy...', 'trying');
        
        // Try cached working proxy first
        if (this.workingProxies.has(domain)) {
            const cachedProxy = this.workingProxies.get(domain);
            try {
                const proxyUrl = cachedProxy.buildUrl(targetUrl);
                const response = await this.fetchWithTimeout(proxyUrl, timeout);
                if (response.ok) {
                    const html = await response.text();
                    if (this.isValidHTML(html)) {
                        console.log(`✓ Cache hit: ${cachedProxy.name} for ${domain}`);
                        this.updateProxyStatus(`Using ${cachedProxy.name}`, 'success');
                        return html;
                    }
                }
            } catch {}
        }
        
        // Try all proxies in order
        for (let i = 0; i < this.proxies.length; i++) {
            const proxy = this.proxies[i];
            try {
                console.log(`Trying ${proxy.name}...`);
                this.updateProxyStatus(`Trying ${proxy.name} (${i + 1}/${this.proxies.length})`, 'trying');
                
                const proxyUrl = proxy.buildUrl(targetUrl);
                const response = await this.fetchWithTimeout(proxyUrl, timeout);
                
                if (response.ok) {
                    const html = await response.text();
                    // Validate HTML content
                    if (this.isValidHTML(html)) {
                        console.log(`✓ Success with ${proxy.name}`);
                        this.workingProxies.set(domain, proxy);
                        this.updateProxyStatus(`Connected via ${proxy.name}`, 'success');
                        return html;
                    }
                }
            } catch (error) {
                console.log(`✗ Failed ${proxy.name}: ${error.message}`);
            }
        }
        
        // Last resort: try direct fetch (might work for same-origin)
        try {
            this.updateProxyStatus('Trying direct connection...', 'trying');
            const response = await this.fetchWithTimeout(targetUrl, timeout);
            if (response.ok) {
                const html = await response.text();
                if (this.isValidHTML(html)) {
                    console.log('✓ Direct fetch worked');
                    this.updateProxyStatus('Direct connection successful', 'success');
                    return html;
                }
            }
        } catch {}
        
        this.updateProxyStatus('All proxies failed', 'error');
        throw new Error('All proxy methods failed');
    }
    
    isValidHTML(html) {
        return html && html.length > 100 && 
               (html.includes('<html') || html.includes('<!DOCTYPE') || html.includes('<HTML') || html.includes('<body'));
    }
    
    async fetchWithTimeout(url, timeout) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        try {
            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            return response;
        } finally {
            clearTimeout(timeoutId);
        }
    }
    
    updateProxyStatus(message, status) {
        const currentUrlEl = document.getElementById('currentUrl');
        if (currentUrlEl) {
            currentUrlEl.textContent = message;
            currentUrlEl.className = `proxy-status ${status}`;
        }
    }
}

// Global proxy manager instance
const proxyManager = new ProxyManager();

class WebsiteScanner {
    constructor() {
        this.visited = new Set();
        this.queue = [];
        this.siteMap = new Map();
        this.edges = [];
        this.pageRelationships = new Map(); // Track parent-child relationships
        this.scanning = false;
        this.startUrl = '';
        this.baseDomain = '';
        this.maxPages = 50;
        this.maxDepth = 3;
        this.delay = 500;
        this.proxyType = 'allorigins';
        this.pagesScanned = 0;
    }
    
    normalizeUrl(url) {
        try {
            const urlObj = new URL(url);
            urlObj.hash = '';
            let normalized = urlObj.href;
            if (normalized.endsWith('/')) {
                normalized = normalized.slice(0, -1);
            }
            return normalized;
        } catch {
            return null;
        }
    }
    
    getBaseDomain(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.hostname.replace(/^www\./, '');
        } catch {
            return '';
        }
    }
    
    isInternalLink(url) {
        const urlDomain = this.getBaseDomain(url);
        return urlDomain === this.baseDomain;
    }
    
    shouldCrawl(url) {
        if (!url || this.visited.has(url)) return false;
        if (!this.isInternalLink(url)) return false;
        
        const urlLower = url.toLowerCase();
        
        // Skip file extensions
        const skipExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', 
                              '.zip', '.rar', '.jpg', '.jpeg', '.png', '.gif', '.svg', 
                              '.mp3', '.mp4', '.avi', '.mov', '.css', '.js'];
        
        if (skipExtensions.some(ext => urlLower.includes(ext))) {
            return false;
        }
        
        // Skip user-specific and transactional pages - be more specific to avoid false positives
        const skipPatterns = [
            '/login', '/logout', '/signin', '/signup', '/register',
            '/cart', '/checkout', '/payment', 
            '/user/account', '/user/profile', '/my-account', '/myprofile',
            '/wp-admin', '/admin/', '/administrator/',
            '?search=', '?filter=', '?sort=', '?page=',
            '/download.php', '/print.php'
        ];
        
        // Check for exact pattern matches or at end of URL to avoid false positives
        if (skipPatterns.some(pattern => {
            return urlLower.includes(pattern) && 
                   (urlLower.endsWith(pattern) || urlLower.includes(pattern + '/') || urlLower.includes(pattern + '?'));
        })) {
            return false;
        }
        
        // Prioritize customer service content (return true immediately)
        const priorityPatterns = [
            '/help', '/support', '/faq', '/documentation', '/docs',
            '/guide', '/tutorial', '/how-to', '/knowledge',
            '/troubleshoot', '/api', '/manual', '/resources'
        ];
        
        if (priorityPatterns.some(pattern => urlLower.includes(pattern))) {
            return true;
        }
        
        return true;
    }
    
    getProxyUrl(url) {
        switch(this.proxyType) {
            case 'allorigins':
                // Primary proxy with fallback
                return `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
            case 'corsproxy':
                return `https://corsproxy.io/?${encodeURIComponent(url)}`;
            case 'cors-anywhere':
                return `https://cors-anywhere.herokuapp.com/${url}`;
            default:
                return url;
        }
    }
    
    async fetchPage(url) {
        try {
            // Use the global proxy manager with automatic fallback
            return await proxyManager.fetchWithFallback(url);
        } catch (error) {
            console.error(`Failed to fetch ${url}:`, error);
            return null;
        }
    }
    
    parseHtml(html, currentUrl) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Extract title
        const title = doc.querySelector('title')?.textContent?.trim() || 'Untitled';
        
        // Extract meta information for RAG
        const metaDescription = doc.querySelector('meta[name="description"]')?.content || '';
        const metaKeywords = doc.querySelector('meta[name="keywords"]')?.content || '';
        
        // Extract structured content with better context preservation
        const fullContent = this.extractFullContent(doc);
        const wordCount = fullContent.text.split(/\s+/).filter(word => word.length > 0).length;
        
        // Extract Q&A pairs (for FAQ pages)
        const qaItems = this.extractQAPairs(doc);
        
        // Extract heading hierarchy for context
        const headingStructure = this.extractHeadingStructure(doc);
        
        // Enhanced link extraction
        const links = new Set();
        const baseUrl = new URL(currentUrl);
        
        // Multiple selectors for comprehensive link discovery
        const linkSelectors = [
            'a[href]',
            'link[rel="canonical"]',
            'link[rel="alternate"]',
            'area[href]',
            '[data-href]',
            '[data-url]',
            '[data-link]'
        ];
        
        linkSelectors.forEach(selector => {
            doc.querySelectorAll(selector).forEach(elem => {
                const href = elem.getAttribute('href') || 
                           elem.getAttribute('data-href') || 
                           elem.getAttribute('data-url') ||
                           elem.getAttribute('data-link');
                           
                if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
                    try {
                        // Handle various URL formats
                        let absoluteUrl;
                        if (href.startsWith('http://') || href.startsWith('https://')) {
                            absoluteUrl = href;
                        } else if (href.startsWith('//')) {
                            absoluteUrl = baseUrl.protocol + href;
                        } else if (href.startsWith('/')) {
                            absoluteUrl = baseUrl.origin + href;
                        } else {
                            // Relative URL
                            const currentPath = currentUrl.endsWith('/') ? currentUrl : currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
                            absoluteUrl = currentPath + href;
                        }
                        
                        const normalized = this.normalizeUrl(absoluteUrl);
                        if (normalized && this.isInternalLink(normalized)) {
                            links.add(normalized);
                        }
                    } catch {}
                }
            });
        });
        
        // Also try to find links in onclick attributes and JavaScript
        doc.querySelectorAll('[onclick]').forEach(elem => {
            const onclick = elem.getAttribute('onclick');
            if (onclick) {
                // Look for common patterns like window.location or location.href
                const patterns = [
                    /(?:window\.location|location\.href)\s*=\s*['"]([^'"]+)['"]/,
                    /(?:window\.open|open)\s*\(['"]([^'"]+)['"]/,
                    /href\s*=\s*['"]([^'"]+)['"]/
                ];
                
                for (const pattern of patterns) {
                    const match = onclick.match(pattern);
                    if (match && match[1]) {
                        try {
                            const absoluteUrl = new URL(match[1], currentUrl).href;
                            const normalized = this.normalizeUrl(absoluteUrl);
                            if (normalized && this.isInternalLink(normalized)) {
                                links.add(normalized);
                            }
                        } catch {}
                    }
                }
            }
        });
        
        // Extract images with alt text for context
        const imageData = this.extractImageData(doc);
        
        // Extract tables and lists for structured data
        const structuredData = this.extractStructuredData(doc);
        
        // Classify page type with enhanced categories
        const pageType = this.classifyPageType(currentUrl, doc);
        
        // Calculate content quality score
        const qualityScore = this.calculateQualityScore(fullContent, headingStructure, qaItems, pageType);
        
        // Extract schema.org data if present
        const schemaData = this.extractSchemaData(doc);
        
        return {
            url: currentUrl,
            title,
            metaDescription,
            metaKeywords,
            content: fullContent,
            wordCount,
            links: Array.from(links),
            images: imageData.count,
            imageData,
            headings: headingStructure,
            pageType,
            qualityScore,
            qaItems,
            structuredData,
            schemaData,
            depth: 0
        };
    }
    
    extractFullContent(doc) {
        // Remove script, style, nav, footer elements
        const elementsToRemove = doc.querySelectorAll('script, style, nav, footer, header, .navigation, .menu, .sidebar, .advertisement');
        elementsToRemove.forEach(el => el.remove());
        
        // Extract main content areas
        const contentSelectors = ['main', 'article', '.content', '#content', '.main-content', '[role="main"]'];
        let mainContent = null;
        
        for (const selector of contentSelectors) {
            mainContent = doc.querySelector(selector);
            if (mainContent) break;
        }
        
        // Fallback to body if no main content area found
        if (!mainContent) {
            mainContent = doc.body;
        }
        
        // Extract paragraphs with context
        const paragraphs = [];
        const paragraphElements = mainContent.querySelectorAll('p, li, dd, td, blockquote');
        paragraphElements.forEach(el => {
            const text = el.textContent?.trim();
            if (text && text.length > 20) { // Filter out very short text
                paragraphs.push(text);
            }
        });
        
        // Extract all text for full context
        const fullText = mainContent.textContent?.replace(/\s+/g, ' ').trim() || '';
        
        return {
            text: fullText,
            paragraphs: paragraphs,
            cleanedHtml: mainContent.innerHTML
        };
    }
    
    extractQAPairs(doc) {
        const qaItems = [];
        
        // Method 1: Look for FAQ schema markup
        const faqSchema = doc.querySelectorAll('[itemtype*="FAQPage"], [itemtype*="Question"]');
        faqSchema.forEach(item => {
            const question = item.querySelector('[itemprop="name"]')?.textContent?.trim();
            const answer = item.querySelector('[itemprop="text"], [itemprop="acceptedAnswer"]')?.textContent?.trim();
            if (question && answer) {
                qaItems.push({ question, answer });
            }
        });
        
        // Method 2: Look for common FAQ patterns
        const faqContainers = doc.querySelectorAll('.faq, #faq, .qa, .qanda, .questions, dl');
        faqContainers.forEach(container => {
            // Check for dt/dd pattern
            const dts = container.querySelectorAll('dt');
            dts.forEach((dt, index) => {
                const dd = dt.nextElementSibling;
                if (dd && dd.tagName === 'DD') {
                    qaItems.push({
                        question: dt.textContent?.trim(),
                        answer: dd.textContent?.trim()
                    });
                }
            });
            
            // Check for h3/h4 followed by div/p pattern
            const headings = container.querySelectorAll('h3, h4, h5');
            headings.forEach(heading => {
                const nextEl = heading.nextElementSibling;
                if (nextEl && (nextEl.tagName === 'P' || nextEl.tagName === 'DIV')) {
                    const questionText = heading.textContent?.trim();
                    if (questionText && questionText.includes('?')) {
                        qaItems.push({
                            question: questionText,
                            answer: nextEl.textContent?.trim()
                        });
                    }
                }
            });
        });
        
        return qaItems;
    }
    
    extractHeadingStructure(doc) {
        const structure = [];
        const headings = doc.querySelectorAll('h1, h2, h3, h4, h5, h6');
        
        headings.forEach(heading => {
            structure.push({
                level: parseInt(heading.tagName.substring(1)),
                text: heading.textContent?.trim(),
                tag: heading.tagName
            });
        });
        
        return {
            hierarchy: structure,
            h1: doc.querySelectorAll('h1').length,
            h2: doc.querySelectorAll('h2').length,
            h3: doc.querySelectorAll('h3').length
        };
    }
    
    extractImageData(doc) {
        const images = [];
        const imgElements = doc.querySelectorAll('img');
        
        imgElements.forEach(img => {
            const altText = img.getAttribute('alt')?.trim();
            const src = img.getAttribute('src');
            if (altText) {
                images.push({ src, altText });
            }
        });
        
        return {
            count: imgElements.length,
            withAltText: images.length,
            images: images
        };
    }
    
    extractStructuredData(doc) {
        const tables = [];
        const lists = [];
        
        // Extract tables
        doc.querySelectorAll('table').forEach(table => {
            const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent?.trim());
            const rows = Array.from(table.querySelectorAll('tr')).map(tr => 
                Array.from(tr.querySelectorAll('td')).map(td => td.textContent?.trim())
            ).filter(row => row.length > 0);
            
            if (headers.length > 0 || rows.length > 0) {
                tables.push({ headers, rows });
            }
        });
        
        // Extract lists
        doc.querySelectorAll('ul, ol').forEach(list => {
            const items = Array.from(list.querySelectorAll('li')).map(li => li.textContent?.trim());
            if (items.length > 0) {
                lists.push({
                    type: list.tagName.toLowerCase(),
                    items: items
                });
            }
        });
        
        return { tables, lists };
    }
    
    extractSchemaData(doc) {
        const schemaScripts = doc.querySelectorAll('script[type="application/ld+json"]');
        const schemas = [];
        
        schemaScripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                schemas.push(data);
            } catch {}
        });
        
        return schemas;
    }
    
    calculateQualityScore(content, headings, qaItems, pageType) {
        let score = 0;
        
        // Content length score (longer content usually more informative)
        if (content.text.length > 500) score += 20;
        if (content.text.length > 1500) score += 20;
        if (content.text.length > 3000) score += 10;
        
        // Structure score (well-organized content)
        if (headings.hierarchy.length > 3) score += 15;
        if (headings.h2 > 2) score += 10;
        
        // Q&A content score (valuable for customer service)
        if (qaItems.length > 0) score += 25;
        if (qaItems.length > 5) score += 15;
        
        // Page type bonus
        const valuableTypes = ['FAQ', 'Documentation', 'Guide', 'Support', 'Help'];
        if (valuableTypes.includes(pageType)) score += 20;
        
        // Normalize to 0-100
        return Math.min(100, score);
    }
    
    classifyPageType(url, doc) {
        const urlLower = url.toLowerCase();
        const title = doc.querySelector('title')?.textContent?.toLowerCase() || '';
        const bodyText = doc.body?.textContent?.toLowerCase() || '';
        
        // High priority customer service pages
        if (urlLower.includes('/faq') || urlLower.includes('/faqs') || 
            title.includes('frequently asked') || title.includes('faq')) {
            return 'FAQ';
        }
        
        if (urlLower.includes('/help') || urlLower.includes('/support') || 
            urlLower.includes('/customer-service') || urlLower.includes('/assistance')) {
            return 'Support';
        }
        
        if (urlLower.includes('/documentation') || urlLower.includes('/docs') || 
            urlLower.includes('/manual') || urlLower.includes('/user-guide')) {
            return 'Documentation';
        }
        
        if (urlLower.includes('/guide') || urlLower.includes('/how-to') || 
            urlLower.includes('/tutorial') || urlLower.includes('/getting-started')) {
            return 'Guide';
        }
        
        if (urlLower.includes('/troubleshoot') || urlLower.includes('/problem') || 
            urlLower.includes('/solution') || urlLower.includes('/fix')) {
            return 'Troubleshooting';
        }
        
        if (urlLower.includes('/api') || urlLower.includes('/developer') || 
            urlLower.includes('/reference')) {
            return 'API Documentation';
        }
        
        if (urlLower.includes('/knowledge') || urlLower.includes('/kb') || 
            urlLower.includes('/resources')) {
            return 'Knowledge Base';
        }
        
        if (urlLower.includes('/policy') || urlLower.includes('/terms') || 
            urlLower.includes('/privacy') || urlLower.includes('/legal')) {
            return 'Legal/Policy';
        }
        
        // Standard page types
        if (urlLower.includes('/product') || urlLower.includes('/shop') || 
            urlLower.includes('/store') || urlLower.includes('/catalog')) {
            return 'Product';
        }
        
        if (urlLower.includes('/service') || urlLower.includes('/offering')) {
            return 'Service';
        }
        
        if (urlLower.includes('/contact') || urlLower.includes('/reach-us')) {
            return 'Contact';
        }
        
        if (urlLower.includes('/about') || urlLower.includes('/company')) {
            return 'About';
        }
        
        if (urlLower.includes('/blog') || urlLower.includes('/post') || 
            urlLower.includes('/article') || urlLower.includes('/news')) {
            return 'Blog/Article';
        }
        
        if (urlLower.includes('/review') || urlLower.includes('/testimonial') || 
            urlLower.includes('/feedback')) {
            return 'Reviews';
        }
        
        if (urlLower === this.startUrl || urlLower === this.startUrl + '/') {
            return 'Homepage';
        }
        
        // Check meta tags
        const ogType = doc.querySelector('meta[property="og:type"]')?.content;
        if (ogType) {
            if (ogType.includes('article')) return 'Blog/Article';
            if (ogType.includes('product')) return 'Product';
            if (ogType.includes('faq')) return 'FAQ';
        }
        
        // Content-based classification
        if (bodyText.includes('frequently asked questions') || 
            doc.querySelectorAll('[itemtype*="FAQPage"]').length > 0) {
            return 'FAQ';
        }
        
        return 'Other';
    }
    
    async crawl() {
        this.scanning = true;
        this.visited.clear();
        this.siteMap.clear();
        this.edges = [];
        this.pageRelationships.clear();
        this.pagesScanned = 0;
        
        this.startUrl = this.normalizeUrl(document.getElementById('urlInput').value);
        if (!this.startUrl) {
            alert('Please enter a valid URL');
            return;
        }
        
        this.baseDomain = this.getBaseDomain(this.startUrl);
        this.maxPages = parseInt(document.getElementById('maxPages').value);
        this.maxDepth = parseInt(document.getElementById('maxDepth').value);
        this.delay = parseInt(document.getElementById('delay').value);
        // Proxy selection removed - handled automatically by ProxyManager
        
        // Initialize UI
        document.getElementById('progressSection').style.display = 'block';
        document.getElementById('resultsSection').style.display = 'none';
        document.getElementById('scanButton').disabled = true;
        document.getElementById('stopButton').style.display = 'inline-block';
        
        // Start with the initial URL
        this.queue.push({ url: this.startUrl, depth: 0, parent: null });
        
        while (this.queue.length > 0 && this.scanning && this.pagesScanned < this.maxPages) {
            const { url, depth, parent } = this.queue.shift();
            
            if (this.visited.has(url) || depth > this.maxDepth) {
                continue;
            }
            
            this.visited.add(url);
            this.pagesScanned++;
            
            // Track parent-child relationship
            if (parent) {
                if (!this.pageRelationships.has(parent)) {
                    this.pageRelationships.set(parent, []);
                }
                this.pageRelationships.get(parent).push(url);
            }
            
            // Update progress
            this.updateProgress(url);
            
            // Fetch and parse page
            const html = await this.fetchPage(url);
            if (html) {
                const pageData = this.parseHtml(html, url);
                pageData.depth = depth;
                pageData.parent = parent;
                this.siteMap.set(url, pageData);
                
                // Log scanning details for debugging
                console.log(`[${this.pagesScanned}/${this.maxPages}] Scanned: ${url}`);
                console.log(`  Found ${pageData.links.length} links, Depth: ${depth}, Type: ${pageData.pageType}`);
                
                // Add links to queue
                let addedToQueue = 0;
                let skippedLinks = 0;
                for (const link of pageData.links) {
                    if (this.shouldCrawl(link)) {
                        this.queue.push({ url: link, depth: depth + 1, parent: url });
                        addedToQueue++;
                        
                        // Track edge for network graph
                        this.edges.push({ from: url, to: link });
                    } else {
                        skippedLinks++;
                    }
                }
                console.log(`  Added ${addedToQueue} to queue, Skipped ${skippedLinks}, Queue size: ${this.queue.length}`);
            } else {
                console.log(`[${this.pagesScanned}/${this.maxPages}] Failed to fetch: ${url}`);
            }
            
            // Delay between requests
            await new Promise(resolve => setTimeout(resolve, this.delay));
        }
        
        this.finishScanning();
    }
    
    updateProgress(url) {
        const progress = Math.round((this.pagesScanned / this.maxPages) * 100);
        document.getElementById('progressFill').style.width = progress + '%';
        document.getElementById('progressFill').textContent = progress + '%';
        document.getElementById('statusText').textContent = `Scanned ${this.pagesScanned} of ${this.maxPages} pages`;
        document.getElementById('currentUrl').textContent = `Current: ${url.substring(0, 80)}...`;
    }
    
    finishScanning() {
        this.scanning = false;
        document.getElementById('scanButton').disabled = false;
        document.getElementById('stopButton').style.display = 'none';
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('resultsSection').style.display = 'block';
        
        // Ensure sitemap container is visible
        const sitemapContainer = document.querySelector('.sitemap-container');
        if (sitemapContainer) {
            sitemapContainer.style.display = 'block';
        }
        
        this.displayResults();
    }
    
    displayResults() {
        // Calculate statistics
        let totalLinks = 0;
        let totalQA = 0;
        let totalWords = 0;
        let faqPages = 0;
        let docsPages = 0;
        let avgQualityScore = 0;
        
        for (const [url, data] of this.siteMap) {
            totalLinks += data.links.length;
            totalWords += data.wordCount;
            totalQA += data.qaItems?.length || 0;
            avgQualityScore += data.qualityScore || 0;
            
            // Count specific page types
            if (data.pageType === 'FAQ') faqPages++;
            if (data.pageType === 'Documentation' || data.pageType === 'Guide' || 
                data.pageType === 'Support' || data.pageType === 'Help') docsPages++;
        }
        
        const avgWords = Math.round(totalWords / this.siteMap.size) || 0;
        avgQualityScore = Math.round(avgQualityScore / this.siteMap.size) || 0;
        
        // Update statistics cards (with null checks)
        const totalPagesEl = document.getElementById('totalPages');
        if (totalPagesEl) totalPagesEl.textContent = this.siteMap.size;
        
        const totalQAEl = document.getElementById('totalQA');
        if (totalQAEl) totalQAEl.textContent = totalQA;
        
        const docsPagesEl = document.getElementById('docsPages');
        if (docsPagesEl) docsPagesEl.textContent = docsPages + faqPages;
        
        const avgQualityEl = document.getElementById('avgQuality');
        if (avgQualityEl) avgQualityEl.textContent = avgQualityScore + '%';
        
        // Also update alternative elements that exist in HTML
        const totalLinksEl = document.getElementById('totalLinks');
        if (totalLinksEl) totalLinksEl.textContent = this.totalLinks;
        
        const maxDepthEl = document.getElementById('maxDepthResult');
        if (maxDepthEl) maxDepthEl.textContent = this.maxDepth;
        
        const topPageRankEl = document.getElementById('topPageRank');
        if (topPageRankEl) topPageRankEl.textContent = '1.000';
        
        // Create network visualization
        this.createNetworkVisualization();
        
        // Build and display sitemap tree
        console.log('Calling buildSitemapTree...');
        this.buildSitemapTree();
        
        // Populate pages table
        this.populatePagesTable();
    }
    
    createNetworkVisualization() {
        const nodes = [];
        const edges = [];
        const nodeMap = new Map();
        let nodeId = 0;
        
        // Create nodes
        for (const [url, data] of this.siteMap) {
            const node = {
                id: nodeId,
                label: data.title.substring(0, 30) + (data.title.length > 30 ? '...' : ''),
                title: `${data.title}\n${url}\nWords: ${data.wordCount}`,
                color: {
                    background: data.pageType === 'Homepage' ? '#667eea' : 
                               data.pageType === 'Blog/Article' ? '#764ba2' :
                               data.pageType === 'Product' ? '#f093fb' :
                               data.pageType === 'Service' ? '#4facfe' :
                               '#43e97b',
                    border: '#333'
                },
                size: Math.min(Math.max(10, data.links.length * 2), 40)
            };
            nodes.push(node);
            nodeMap.set(url, nodeId);
            nodeId++;
        }
        
        // Create edges
        for (const edge of this.edges) {
            if (nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
                edges.push({
                    from: nodeMap.get(edge.from),
                    to: nodeMap.get(edge.to),
                    color: { color: '#999', opacity: 0.3 },
                    arrows: 'to'
                });
            }
        }
        
        // Create network
        const container = document.getElementById('network');
        const data = { nodes: new vis.DataSet(nodes), edges: new vis.DataSet(edges) };
        const options = {
            physics: {
                enabled: true,
                solver: 'forceAtlas2Based',
                stabilization: {
                    iterations: 100
                }
            },
            interaction: {
                hover: true,
                zoomView: true,
                dragView: true
            },
            edges: {
                smooth: {
                    type: 'continuous'
                }
            }
        };
        
        new vis.Network(container, data, options);
    }
    
    populatePagesTable() {
        const tbody = document.getElementById('pagesTableBody');
        tbody.innerHTML = '';
        
        // Sort by quality score descending
        const sortedPages = Array.from(this.siteMap.entries()).sort((a, b) => {
            return (b[1].qualityScore || 0) - (a[1].qualityScore || 0);
        });
        
        for (const [url, data] of sortedPages) {
            const row = document.createElement('tr');
            
            // Color code quality score
            const qualityColor = data.qualityScore >= 70 ? '#43e97b' : 
                               data.qualityScore >= 40 ? '#feca57' : '#fa709a';
            
            // Color code page type based on value for RAG
            const typeColor = ['FAQ', 'Documentation', 'Guide', 'Support', 'Help'].includes(data.pageType) 
                            ? '#667eea' : '#999';
            
            row.innerHTML = `
                <td><a href="${url}" target="_blank" style="color: #667eea;">${url.substring(0, 50)}...</a></td>
                <td>${data.title.substring(0, 40)}${data.title.length > 40 ? '...' : ''}</td>
                <td><span style="padding: 4px 8px; background: ${typeColor}20; color: ${typeColor}; border-radius: 4px; font-size: 12px; font-weight: 600;">${data.pageType}</span></td>
                <td><span style="color: ${qualityColor}; font-weight: bold;">${data.qualityScore || 0}%</span></td>
                <td>${data.qaItems?.length || 0}</td>
                <td>${data.wordCount}</td>
            `;
            tbody.appendChild(row);
        }
    }
    
    exportData() {
        const data = [];
        for (const [url, pageData] of this.siteMap) {
            data.push({
                url,
                title: pageData.title,
                type: pageData.pageType,
                wordCount: pageData.wordCount,
                links: pageData.links.length,
                images: pageData.images,
                depth: pageData.depth
            });
        }
        return data;
    }
    
    // Content chunking for RAG
    chunkContent(text, chunkSize = 500, overlap = 50) {
        const words = text.split(/\s+/);
        const chunks = [];
        
        for (let i = 0; i < words.length; i += chunkSize - overlap) {
            const chunk = words.slice(i, i + chunkSize).join(' ');
            if (chunk.trim().length > 50) { // Minimum chunk size
                chunks.push(chunk);
            }
        }
        
        return chunks;
    }
    
    // Export for RAG systems
    exportForRAG() {
        const documents = [];
        
        for (const [url, pageData] of this.siteMap) {
            // Skip low quality content
            if (pageData.qualityScore < 30) continue;
            
            // Create chunks from paragraphs
            const chunks = [];
            if (pageData.content && pageData.content.paragraphs) {
                pageData.content.paragraphs.forEach(paragraph => {
                    if (paragraph.length > 100) {
                        chunks.push(paragraph);
                    }
                });
            }
            
            // Add Q&A items as separate chunks
            if (pageData.qaItems && pageData.qaItems.length > 0) {
                pageData.qaItems.forEach(qa => {
                    chunks.push(`Question: ${qa.question}\nAnswer: ${qa.answer}`);
                });
            }
            
            const doc = {
                id: `${this.baseDomain}_${url.replace(/[^a-zA-Z0-9]/g, '_')}`,
                url: url,
                title: pageData.title,
                type: pageData.pageType,
                content: pageData.content?.text || '',
                chunks: chunks,
                metadata: {
                    description: pageData.metaDescription,
                    keywords: pageData.metaKeywords,
                    pageType: pageData.pageType,
                    qualityScore: pageData.qualityScore,
                    wordCount: pageData.wordCount,
                    depth: pageData.depth,
                    qaCount: pageData.qaItems?.length || 0,
                    headings: pageData.headings?.hierarchy?.map(h => h.text) || [],
                    tables: pageData.structuredData?.tables?.length || 0,
                    lists: pageData.structuredData?.lists?.length || 0,
                    schemaTypes: pageData.schemaData?.map(s => s['@type']).filter(Boolean) || []
                }
            };
            
            documents.push(doc);
        }
        
        const ragData = {
            source: this.startUrl,
            domain: this.baseDomain,
            crawlDate: new Date().toISOString(),
            totalPages: documents.length,
            documents: documents
        };
        
        const blob = new Blob([JSON.stringify(ragData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rag-data-${this.baseDomain}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // Export as Markdown for documentation
    exportMarkdown() {
        let markdown = `# ${this.baseDomain} Content Export\n\n`;
        markdown += `Generated: ${new Date().toISOString()}\n\n`;
        markdown += `## Table of Contents\n\n`;
        
        // Group by page type
        const pagesByType = {};
        for (const [url, pageData] of this.siteMap) {
            const type = pageData.pageType;
            if (!pagesByType[type]) pagesByType[type] = [];
            pagesByType[type].push({ url, data: pageData });
        }
        
        // Create TOC
        Object.keys(pagesByType).forEach(type => {
            markdown += `- [${type}](#${type.toLowerCase().replace(/\s+/g, '-')})\n`;
        });
        
        markdown += '\n---\n\n';
        
        // Add content for each page type
        Object.entries(pagesByType).forEach(([type, pages]) => {
            markdown += `## ${type}\n\n`;
            
            pages.forEach(({ url, data }) => {
                markdown += `### ${data.title}\n\n`;
                markdown += `**URL:** ${url}\n`;
                markdown += `**Quality Score:** ${data.qualityScore}/100\n\n`;
                
                if (data.metaDescription) {
                    markdown += `**Description:** ${data.metaDescription}\n\n`;
                }
                
                // Add Q&A items
                if (data.qaItems && data.qaItems.length > 0) {
                    markdown += `#### Q&A Items\n\n`;
                    data.qaItems.forEach(qa => {
                        markdown += `**Q:** ${qa.question}\n`;
                        markdown += `**A:** ${qa.answer}\n\n`;
                    });
                }
                
                // Add content preview
                if (data.content && data.content.paragraphs && data.content.paragraphs.length > 0) {
                    markdown += `#### Content Preview\n\n`;
                    markdown += data.content.paragraphs.slice(0, 3).join('\n\n');
                    markdown += '\n\n';
                }
                
                markdown += '---\n\n';
            });
        });
        
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `content-${this.baseDomain}-${new Date().toISOString().split('T')[0]}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // Export for vector databases
    exportVectorDB() {
        const vectors = [];
        
        for (const [url, pageData] of this.siteMap) {
            // Skip low quality content
            if (pageData.qualityScore < 30) continue;
            
            // Create vector entries from content chunks
            if (pageData.content && pageData.content.paragraphs) {
                pageData.content.paragraphs.forEach((paragraph, idx) => {
                    if (paragraph.length > 100) {
                        vectors.push({
                            id: `${url}_chunk_${idx}`,
                            text: paragraph,
                            metadata: {
                                url: url,
                                title: pageData.title,
                                pageType: pageData.pageType,
                                chunkIndex: idx,
                                totalChunks: pageData.content.paragraphs.length
                            }
                        });
                    }
                });
            }
            
            // Create vector entries from Q&A
            if (pageData.qaItems && pageData.qaItems.length > 0) {
                pageData.qaItems.forEach((qa, idx) => {
                    vectors.push({
                        id: `${url}_qa_${idx}`,
                        text: `${qa.question} ${qa.answer}`,
                        metadata: {
                            url: url,
                            title: pageData.title,
                            pageType: 'FAQ',
                            isQA: true,
                            question: qa.question,
                            answer: qa.answer
                        }
                    });
                });
            }
        }
        
        const vectorData = {
            source: this.startUrl,
            domain: this.baseDomain,
            exportDate: new Date().toISOString(),
            totalVectors: vectors.length,
            vectors: vectors
        };
        
        const blob = new Blob([JSON.stringify(vectorData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vectors-${this.baseDomain}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    buildSitemapTree() {
        const container = document.getElementById('sitemapTree');
        if (!container) {
            console.error('Sitemap tree container not found');
            return;
        }
        
        container.innerHTML = '';
        
        // Check if we have data
        if (this.siteMap.size === 0) {
            container.innerHTML = '<p style="color: #666; padding: 20px;">No pages scanned yet.</p>';
            return;
        }
        
        console.log('Building sitemap tree with', this.siteMap.size, 'pages');
        console.log('Page relationships:', this.pageRelationships);
        
        // Build tree structure starting from root URL
        const tree = this.buildTreeNode(this.startUrl, new Set());
        
        // Render the tree
        if (tree) {
            console.log('Tree built successfully:', tree);
            container.appendChild(this.renderTreeNode(tree));
        } else {
            // If no tree could be built, show all pages as a flat list
            const flatList = document.createElement('div');
            for (const [url, pageData] of this.siteMap) {
                const item = document.createElement('div');
                item.className = 'tree-node';
                item.innerHTML = `
                    <div class="tree-item">
                        <span class="tree-toggle">•</span>
                        <div class="tree-content">
                            <a href="${url}" target="_blank" class="tree-url">${this.getRelativeUrl(url)}</a>
                            <div class="tree-info">
                                <span class="tree-badge depth">Depth: ${pageData.depth}</span>
                                <span class="tree-badge links">${pageData.links.length} links</span>
                                <span class="tree-badge type">${pageData.pageType}</span>
                            </div>
                        </div>
                    </div>
                `;
                flatList.appendChild(item);
            }
            container.appendChild(flatList);
        }
    }
    
    buildTreeNode(url, visited) {
        if (visited.has(url)) return null;
        visited.add(url);
        
        const pageData = this.siteMap.get(url);
        if (!pageData) return null;
        
        const children = [];
        const childUrls = this.pageRelationships.get(url) || [];
        
        // Only add unique children that haven't been visited
        const uniqueChildren = [...new Set(childUrls)];
        for (const childUrl of uniqueChildren) {
            const childNode = this.buildTreeNode(childUrl, visited);
            if (childNode) {
                children.push(childNode);
            }
        }
        
        return {
            url,
            data: pageData,
            children
        };
    }
    
    renderTreeNode(node, isRoot = true) {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = isRoot ? 'tree-node' : 'tree-node child';
        
        const itemDiv = document.createElement('div');
        itemDiv.className = 'tree-item';
        
        // Add toggle button if has children
        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'tree-toggle';
        if (node.children.length > 0) {
            toggleSpan.textContent = '▼';
            toggleSpan.style.cursor = 'pointer';
            toggleSpan.onclick = (e) => {
                e.stopPropagation();
                const childrenDiv = nodeDiv.querySelector('.tree-children');
                if (childrenDiv) {
                    childrenDiv.classList.toggle('expanded');
                    toggleSpan.textContent = childrenDiv.classList.contains('expanded') ? '▼' : '▶';
                }
            };
        } else {
            toggleSpan.textContent = '•';
        }
        itemDiv.appendChild(toggleSpan);
        
        // Add content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'tree-content';
        
        const urlLink = document.createElement('a');
        urlLink.className = 'tree-url';
        urlLink.href = node.url;
        urlLink.target = '_blank';
        urlLink.textContent = this.getRelativeUrl(node.url);
        contentDiv.appendChild(urlLink);
        
        // Add info badges
        const infoDiv = document.createElement('div');
        infoDiv.className = 'tree-info';
        
        const depthBadge = document.createElement('span');
        depthBadge.className = 'tree-badge depth';
        depthBadge.textContent = `Depth: ${node.data.depth}`;
        infoDiv.appendChild(depthBadge);
        
        const linksBadge = document.createElement('span');
        linksBadge.className = 'tree-badge links';
        linksBadge.textContent = `${node.data.links.length} links`;
        infoDiv.appendChild(linksBadge);
        
        const typeBadge = document.createElement('span');
        typeBadge.className = 'tree-badge type';
        typeBadge.textContent = node.data.pageType;
        infoDiv.appendChild(typeBadge);
        
        contentDiv.appendChild(infoDiv);
        itemDiv.appendChild(contentDiv);
        nodeDiv.appendChild(itemDiv);
        
        // Add children
        if (node.children.length > 0) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-children expanded';
            
            for (const child of node.children) {
                childrenDiv.appendChild(this.renderTreeNode(child, false));
            }
            
            nodeDiv.appendChild(childrenDiv);
        }
        
        return nodeDiv;
    }
    
    getRelativeUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.pathname + urlObj.search;
        } catch {
            return url;
        }
    }
    
    exportXMLSitemap() {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
        
        const today = new Date().toISOString().split('T')[0];
        
        for (const [url, pageData] of this.siteMap) {
            xml += '  <url>\n';
            xml += `    <loc>${this.escapeXML(url)}</loc>\n`;
            xml += `    <lastmod>${today}</lastmod>\n`;
            
            // Set priority based on depth
            const priority = Math.max(0.1, 1.0 - (pageData.depth * 0.2));
            xml += `    <priority>${priority.toFixed(1)}</priority>\n`;
            
            // Set change frequency based on page type
            let changefreq = 'monthly';
            if (pageData.pageType === 'Homepage') changefreq = 'daily';
            else if (pageData.pageType === 'Blog/Article') changefreq = 'weekly';
            xml += `    <changefreq>${changefreq}</changefreq>\n`;
            
            xml += '  </url>\n';
        }
        
        xml += '</urlset>';
        
        const blob = new Blob([xml], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sitemap-${new Date().toISOString().split('T')[0]}.xml`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    escapeXML(str) {
        return str.replace(/[<>&'"]/g, (c) => {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }
}

// Global scanner instance
let scanner = new WebsiteScanner();

// UI Functions
async function startScan() {
    const url = document.getElementById('urlInput').value.trim();
    
    if (!url) {
        alert('Please enter a valid URL');
        return;
    }
    
    // Normalize and validate URL
    let normalizedUrl;
    try {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            normalizedUrl = 'https://' + url;
        } else {
            normalizedUrl = url;
        }
        new URL(normalizedUrl); // Validate URL format
    } catch {
        alert('Please enter a valid URL');
        return;
    }
    
    // Update the URL input with normalized URL
    document.getElementById('urlInput').value = normalizedUrl;
    
    // Show progress section
    document.getElementById('progressSection').style.display = 'block';
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('scanButton').disabled = true;
    document.getElementById('stopButton').style.display = 'inline-block';
    
    // Create scanner instance and start crawling
    scanner = new WebsiteScanner();
    window.currentScanner = scanner; // Store globally for stop functionality
    
    try {
        // Use the WebsiteScanner crawl method directly
        await scanner.crawl();
    } catch (error) {
        console.error('Scan failed:', error);
        alert('Scan failed: ' + error.message);
        finishScanning();
    }
}

async function runComprehensiveAnalysis(url) {
    try {
        updateProgress(10, 'Starting comprehensive analysis...');
        
        const options = {
            maxPages: parseInt(document.getElementById('maxPages').value) || 50,
            maxDepth: parseInt(document.getElementById('maxDepth').value) || 3,
            timeout: 15000
        };
        
        updateProgress(20, 'Discovery phase: robots.txt, sitemaps, RSS feeds...');
        
        // Make request to comprehensive mapping API
        const response = await fetch('/api/generate-comprehensive-map', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url, options })
        });
        
        if (!response.ok) {
            // Fallback to client-side scanning if API not available
            console.warn('API not available, falling back to client-side scanning');
            updateProgress(30, 'API unavailable, using fallback method...');
            scanner.crawl();
            return;
        }
        
        updateProgress(50, 'Crawling phase: processing all discovered pages...');
        
        comprehensiveMapData = await response.json();
        
        updateProgress(70, 'Analysis phase: PageRank, HITS, technology detection...');
        
        displayComprehensiveResults(comprehensiveMapData);
        
        updateProgress(100, 'Complete! All 42+ methods executed successfully!');
        
        // Show results after a brief delay
        setTimeout(() => {
            document.getElementById('progressSection').style.display = 'none';
            document.getElementById('resultsSection').style.display = 'block';
            document.getElementById('advancedResults').style.display = 'block';
            finishScanning();
        }, 1000);
        
    } catch (error) {
        console.error('Comprehensive analysis failed:', error);
        updateProgress(0, 'Analysis failed: ' + error.message);
        finishScanning();
    }
}

async function runQuickSitemap(url) {
    try {
        updateProgress(20, 'Generating quick sitemap...');
        
        const response = await fetch('/api/generate-sitemap', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                url, 
                maxPages: 100,
                format: 'json'
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate sitemap');
        }
        
        const sitemapData = await response.json();
        
        updateProgress(80, 'Processing sitemap...');
        
        displaySitemapResults(sitemapData);
        
        updateProgress(100, 'Sitemap generated!');
        
        setTimeout(() => {
            document.getElementById('progressSection').style.display = 'none';
            document.getElementById('resultsSection').style.display = 'block';
            finishScanning();
        }, 1000);
        
    } catch (error) {
        console.error('Sitemap generation failed:', error);
        updateProgress(0, 'Sitemap generation failed: ' + error.message);
        finishScanning();
    }
}

function updateProgress(percent, message) {
    document.getElementById('progressFill').style.width = percent + '%';
    document.getElementById('progressFill').textContent = percent + '%';
    document.getElementById('statusText').textContent = message;
}

function finishScanning() {
    document.getElementById('scanButton').disabled = false;
    document.getElementById('stopButton').style.display = 'none';
}

function stopScan() {
    if (window.currentScanner) {
        window.currentScanner.scanning = false;
        window.currentScanner.finishScanning();
    }
    scanner.scanning = false;
    scanner.finishScanning();
}

function exportJSON() {
    const data = scanner.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `website-scan-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportCSV() {
    const data = scanner.exportData();
    if (data.length === 0) {
        alert('No data to export');
        return;
    }
    
    // Create CSV header
    const headers = Object.keys(data[0]);
    let csv = headers.join(',') + '\n';
    
    // Add data rows
    for (const row of data) {
        const values = headers.map(header => {
            const value = row[header];
            // Escape quotes and wrap in quotes if contains comma
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        });
        csv += values.join(',') + '\n';
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `website-scan-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function expandAllSitemap() {
    const treeNodes = document.querySelectorAll('.tree-children');
    const toggles = document.querySelectorAll('.tree-toggle');
    
    treeNodes.forEach(node => {
        node.classList.add('expanded');
    });
    
    toggles.forEach(toggle => {
        if (toggle.textContent !== '•') {
            toggle.textContent = '▼';
        }
    });
}

function collapseAllSitemap() {
    const treeNodes = document.querySelectorAll('.tree-children');
    const toggles = document.querySelectorAll('.tree-toggle');
    
    treeNodes.forEach(node => {
        node.classList.remove('expanded');
    });
    
    toggles.forEach(toggle => {
        if (toggle.textContent !== '•') {
            toggle.textContent = '▶';
        }
    });
}

function exportXMLSitemap() {
    scanner.exportXMLSitemap();
}

function exportForRAG() {
    scanner.exportForRAG();
}

function exportMarkdown() {
    scanner.exportMarkdown();
}

function exportVectorDB() {
    scanner.exportVectorDB();
}

// Display comprehensive mapping results
function displayComprehensiveResults(mapData) {
    if (!mapData) return;
    
    // Update main statistics (with null checks)
    const totalPagesEl = document.getElementById('totalPages');
    if (totalPagesEl) totalPagesEl.textContent = mapData.pages.length;
    
    const totalQAEl = document.getElementById('totalQA');
    if (totalQAEl) totalQAEl.textContent = mapData.pages.reduce((sum, p) => sum + (p.qaItems?.length || 0), 0);
    
    const docsPagesEl = document.getElementById('docsPages');
    if (docsPagesEl) docsPagesEl.textContent = mapData.pages.filter(p => 
        ['FAQ', 'Documentation', 'Guide', 'Support', 'Help'].includes(p.pageType)
    ).length;
    
    const avgQualityEl = document.getElementById('avgQuality');
    if (avgQualityEl) avgQualityEl.textContent = mapData.contentAnalysis.averageQualityScore.toFixed(1) + '%';
    
    // Display discovery methods
    const discoveryContainer = document.getElementById('discoveryMethods');
    if (discoveryContainer && mapData.analysisSummary.discoveryMethods) {
        const methods = mapData.analysisSummary.discoveryMethods;
        discoveryContainer.innerHTML = `
            <div class="discovery-item">
                <span class="discovery-label">robots.txt:</span>
                <span class="discovery-value">${methods.robotsTxt}</span>
            </div>
            <div class="discovery-item">
                <span class="discovery-label">Sitemaps:</span>
                <span class="discovery-value">${methods.sitemaps} found</span>
            </div>
            <div class="discovery-item">
                <span class="discovery-label">RSS Feeds:</span>
                <span class="discovery-value">${methods.rssFeeds} found</span>
            </div>
            <div class="discovery-item">
                <span class="discovery-label">API Endpoints:</span>
                <span class="discovery-value">${methods.apiEndpoints} found</span>
            </div>
        `;
    }
    
    // Display authority analysis
    const authorityContainer = document.getElementById('authorityAnalysis');
    if (authorityContainer && mapData.authorityAnalysis) {
        const auth = mapData.authorityAnalysis;
        let authorityHTML = '<h4>Top Pages by PageRank:</h4><ul>';
        auth.topPagesByRank.slice(0, 5).forEach((page, i) => {
            const url = new URL(page.url);
            authorityHTML += `<li>${i + 1}. ${url.pathname} (${page.score.toFixed(3)})</li>`;
        });
        authorityHTML += '</ul>';
        
        if (auth.communities) {
            authorityHTML += `<p><strong>Communities:</strong> ${auth.communities} detected</p>`;
        }
        
        authorityContainer.innerHTML = authorityHTML;
    }
    
    // Display technical analysis
    const techContainer = document.getElementById('technicalAnalysis');
    if (techContainer && mapData.technicalAnalysis) {
        const tech = mapData.technicalAnalysis;
        let techHTML = '<div class="tech-grid">';
        
        if (tech.technologies.cms && tech.technologies.cms.length > 0) {
            techHTML += `<div class="tech-item"><strong>CMS:</strong> ${tech.technologies.cms.join(', ')}</div>`;
        }
        if (tech.technologies.frameworks && tech.technologies.frameworks.length > 0) {
            techHTML += `<div class="tech-item"><strong>Frameworks:</strong> ${tech.technologies.frameworks.join(', ')}</div>`;
        }
        if (tech.technologies.analytics && tech.technologies.analytics.length > 0) {
            techHTML += `<div class="tech-item"><strong>Analytics:</strong> ${tech.technologies.analytics.join(', ')}</div>`;
        }
        if (tech.technologies.cdn && tech.technologies.cdn.length > 0) {
            techHTML += `<div class="tech-item"><strong>CDN:</strong> ${tech.technologies.cdn.join(', ')}</div>`;
        }
        
        techHTML += '</div>';
        
        if (tech.performanceMetrics) {
            const perf = tech.performanceMetrics;
            techHTML += `
                <div class="performance-metrics">
                    <h5>Performance Metrics:</h5>
                    <p><strong>Average Load Time:</strong> ${perf.avgLoadTime}ms</p>
                    <p><strong>Error Rate:</strong> ${perf.errorRate}%</p>
                </div>
            `;
        }
        
        techContainer.innerHTML = techHTML;
    }
    
    // Populate pages table with comprehensive data
    populateComprehensiveTable(mapData.pages);
    
    // Create visualizations if data available
    if (mapData.visualizations && mapData.visualizations.networkGraph) {
        createComprehensiveNetwork(mapData.visualizations.networkGraph);
    }
}

// Display sitemap results (quick mode)
function displaySitemapResults(sitemapData) {
    if (!sitemapData) return;
    
    // Update statistics (with null checks)
    const totalPagesEl = document.getElementById('totalPages');
    if (totalPagesEl) totalPagesEl.textContent = sitemapData.pages?.length || 0;
    
    const totalQAEl = document.getElementById('totalQA');
    if (totalQAEl) totalQAEl.textContent = 0; // Quick mode doesn't extract content
    
    const docsPagesEl = document.getElementById('docsPages');
    if (docsPagesEl) docsPagesEl.textContent = 0;
    
    const avgQualityEl = document.getElementById('avgQuality');
    if (avgQualityEl) avgQualityEl.textContent = 'N/A';
    
    // Hide advanced analysis sections
    const advancedSections = document.querySelectorAll('.advanced-only');
    advancedSections.forEach(section => {
        section.style.display = 'none';
    });
    
    // Show basic sitemap
    if (sitemapData.pages && sitemapData.pages.length > 0) {
        populateBasicSitemapTable(sitemapData.pages);
    }
}

// Populate comprehensive results table
function populateComprehensiveTable(pages) {
    const tbody = document.getElementById('pagesTableBody');
    tbody.innerHTML = '';
    
    // Sort by PageRank or quality score descending
    pages.sort((a, b) => (b.pageRank || b.qualityScore || 0) - (a.pageRank || a.qualityScore || 0));
    
    pages.forEach(page => {
        const row = document.createElement('tr');
        
        // Color code quality score
        const quality = page.qualityScore || 0;
        const qualityColor = quality >= 70 ? '#43e97b' : quality >= 40 ? '#feca57' : '#fa709a';
        
        // Color code page type
        const typeColor = ['FAQ', 'Documentation', 'Guide', 'Support', 'Help'].includes(page.pageType) 
                        ? '#667eea' : '#999';
        
        row.innerHTML = `
            <td><a href="${page.url}" target="_blank" style="color: #667eea;">${page.url.substring(0, 50)}...</a></td>
            <td>${(page.title || 'Untitled').substring(0, 40)}${page.title && page.title.length > 40 ? '...' : ''}</td>
            <td><span style="padding: 4px 8px; background: ${typeColor}20; color: ${typeColor}; border-radius: 4px; font-size: 12px; font-weight: 600;">${page.pageType || 'Other'}</span></td>
            <td><span style="color: ${qualityColor}; font-weight: bold;">${quality}%</span></td>
            <td>${(page.qaItems && page.qaItems.length) || 0}</td>
            <td>${page.wordCount || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Populate basic sitemap table (quick mode)
function populateBasicSitemapTable(pages) {
    const tbody = document.getElementById('pagesTableBody');
    tbody.innerHTML = '';
    
    pages.forEach(page => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><a href="${page.url}" target="_blank" style="color: #667eea;">${page.url.substring(0, 50)}...</a></td>
            <td>${(page.title || 'Untitled').substring(0, 40)}${page.title && page.title.length > 40 ? '...' : ''}</td>
            <td><span style="padding: 4px 8px; background: #99920; color: #999; border-radius: 4px; font-size: 12px;">Sitemap</span></td>
            <td><span style="color: #999;">N/A</span></td>
            <td>0</td>
            <td>${page.wordCount || 0}</td>
        `;
        tbody.appendChild(row);
    });
}

// Create network visualization for comprehensive results
function createComprehensiveNetwork(networkData) {
    if (!networkData || !networkData.nodes || !networkData.edges) return;
    
    const container = document.getElementById('network');
    const data = {
        nodes: new vis.DataSet(networkData.nodes),
        edges: new vis.DataSet(networkData.edges)
    };
    
    const options = {
        physics: {
            enabled: true,
            solver: 'forceAtlas2Based',
            stabilization: {
                iterations: 100
            }
        },
        interaction: {
            hover: true,
            zoomView: true,
            dragView: true
        },
        edges: {
            smooth: {
                type: 'continuous'
            }
        }
    };
    
    new vis.Network(container, data, options);
}

// Export comprehensive map data
function exportComprehensiveMap() {
    if (!comprehensiveMapData) {
        alert('No comprehensive map data available to export');
        return;
    }
    
    const blob = new Blob([JSON.stringify(comprehensiveMapData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprehensive-map-${comprehensiveMapData.domain}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Set default URL if localhost or testing
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        document.getElementById('urlInput').value = 'https://example.com';
    }
});