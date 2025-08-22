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
        
        const skipExtensions = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', 
                              '.zip', '.rar', '.jpg', '.jpeg', '.png', '.gif', '.svg', 
                              '.mp3', '.mp4', '.avi', '.mov'];
        
        return !skipExtensions.some(ext => url.toLowerCase().includes(ext));
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
        
        // Extract text content
        const textElements = doc.querySelectorAll('p, div, article, section, main');
        let textContent = '';
        textElements.forEach(el => {
            const text = el.textContent?.trim();
            if (text) textContent += text + ' ';
        });
        const wordCount = textContent.split(/\s+/).filter(word => word.length > 0).length;
        
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
        
        // Extract images
        const images = doc.querySelectorAll('img').length;
        
        // Extract headings
        const headings = {
            h1: doc.querySelectorAll('h1').length,
            h2: doc.querySelectorAll('h2').length,
            h3: doc.querySelectorAll('h3').length
        };
        
        // Classify page type
        const pageType = this.classifyPageType(currentUrl, doc);
        
        return {
            url: currentUrl,
            title,
            wordCount,
            links,
            images,
            headings,
            pageType,
            depth: 0
        };
    }
    
    classifyPageType(url, doc) {
        const urlLower = url.toLowerCase();
        
        if (urlLower.includes('/blog') || urlLower.includes('/post') || urlLower.includes('/article')) {
            return 'Blog/Article';
        }
        if (urlLower.includes('/product') || urlLower.includes('/shop') || urlLower.includes('/store')) {
            return 'Product';
        }
        if (urlLower.includes('/about')) {
            return 'About';
        }
        if (urlLower.includes('/contact')) {
            return 'Contact';
        }
        if (urlLower.includes('/service')) {
            return 'Service';
        }
        if (urlLower === this.startUrl || urlLower === this.startUrl + '/') {
            return 'Homepage';
        }
        
        // Check meta tags
        const ogType = doc.querySelector('meta[property="og:type"]')?.content;
        if (ogType) {
            if (ogType.includes('article')) return 'Blog/Article';
            if (ogType.includes('product')) return 'Product';
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
        
        this.displayResults();
    }
    
    displayResults() {
        // Calculate statistics
        let totalLinks = 0;
        let totalImages = 0;
        let totalWords = 0;
        const pageTypes = {};
        
        for (const [url, data] of this.siteMap) {
            totalLinks += data.links.length;
            totalImages += data.images;
            totalWords += data.wordCount;
            
            pageTypes[data.pageType] = (pageTypes[data.pageType] || 0) + 1;
        }
        
        const avgWords = Math.round(totalWords / this.siteMap.size) || 0;
        
        // Update statistics cards
        document.getElementById('totalPages').textContent = this.siteMap.size;
        document.getElementById('totalLinks').textContent = totalLinks;
        document.getElementById('totalImages').textContent = totalImages;
        document.getElementById('avgWords').textContent = avgWords;
        
        // Create page types chart
        this.createPageTypesChart(pageTypes);
        
        // Create network visualization
        this.createNetworkVisualization();
        
        // Build and display sitemap tree
        this.buildSitemapTree();
        
        // Populate pages table
        this.populatePagesTable();
    }
    
    createPageTypesChart(pageTypes) {
        const ctx = document.getElementById('pageTypesChart').getContext('2d');
        
        // Destroy existing chart if it exists
        if (window.pageTypesChartInstance) {
            window.pageTypesChartInstance.destroy();
        }
        
        window.pageTypesChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(pageTypes),
                datasets: [{
                    data: Object.values(pageTypes),
                    backgroundColor: [
                        '#667eea',
                        '#764ba2',
                        '#f093fb',
                        '#4facfe',
                        '#43e97b',
                        '#fa709a',
                        '#feca57'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            }
                        }
                    }
                }
            }
        });
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
        
        for (const [url, data] of this.siteMap) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><a href="${url}" target="_blank" style="color: #667eea;">${url.substring(0, 50)}...</a></td>
                <td>${data.title.substring(0, 40)}${data.title.length > 40 ? '...' : ''}</td>
                <td><span style="padding: 4px 8px; background: #f0f0f0; border-radius: 4px; font-size: 12px;">${data.pageType}</span></td>
                <td>${data.wordCount}</td>
                <td>${data.links.length}</td>
                <td>${data.images}</td>
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
    
    buildSitemapTree() {
        const container = document.getElementById('sitemapTree');
        container.innerHTML = '';
        
        // Build tree structure starting from root URL
        const tree = this.buildTreeNode(this.startUrl, new Set());
        
        // Render the tree
        if (tree) {
            container.appendChild(this.renderTreeNode(tree));
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Set default URL if localhost or testing
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        document.getElementById('urlInput').value = 'https://example.com';
    }
});