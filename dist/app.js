// Website Scanner Application
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
        
        // Skip user-specific and transactional pages
        const skipPatterns = [
            '/login', '/logout', '/signin', '/signup', '/register',
            '/cart', '/checkout', '/payment', '/account', '/profile',
            '/admin', '/dashboard', '/settings', '/preferences',
            '/search?', '/filter?', '?sort=', '?page=',
            '/download/', '/print/'
        ];
        
        if (skipPatterns.some(pattern => urlLower.includes(pattern))) {
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
                return `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            case 'corsproxy':
                return `https://corsproxy.io/?${encodeURIComponent(url)}`;
            default:
                return url;
        }
    }
    
    async fetchPage(url) {
        try {
            const proxyUrl = this.getProxyUrl(url);
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            let html;
            if (this.proxyType === 'allorigins') {
                const data = await response.json();
                html = data.contents;
            } else {
                html = await response.text();
            }
            
            return html;
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
        
        // Extract links
        const links = [];
        const linkElements = doc.querySelectorAll('a[href]');
        linkElements.forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                try {
                    const absoluteUrl = new URL(href, currentUrl).href;
                    const normalized = this.normalizeUrl(absoluteUrl);
                    if (normalized) {
                        links.push(normalized);
                    }
                } catch {}
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
            links,
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
        this.proxyType = document.getElementById('proxy').value;
        
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
                
                // Add links to queue
                for (const link of pageData.links) {
                    if (this.shouldCrawl(link)) {
                        this.queue.push({ url: link, depth: depth + 1, parent: url });
                        
                        // Track edge for network graph
                        this.edges.push({ from: url, to: link });
                    }
                }
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
        
        // Update statistics cards
        document.getElementById('totalPages').textContent = this.siteMap.size;
        document.getElementById('totalQA').textContent = totalQA;
        document.getElementById('docsPages').textContent = docsPages + faqPages;
        document.getElementById('avgQuality').textContent = avgQualityScore + '%';
        
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
function startScan() {
    scanner.crawl();
}

function stopScan() {
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Set default URL if localhost or testing
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        document.getElementById('urlInput').value = 'https://example.com';
    }
});