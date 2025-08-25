const axios = require('axios');
const cheerio = require('cheerio');
const { EventEmitter } = require('events');
const { URL } = require('url');

class WebsiteScanner extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxPages: options.maxPages || 50,
      maxDepth: options.maxDepth || 3,
      delay: options.delay || 500,
      minQualityScore: options.minQualityScore || 30,
      pageTypes: options.pageTypes || null,
      includeContent: options.includeContent !== false,
      userAgent: options.userAgent || 'RAG-Collector/1.0 (AI Training Data Collection)'
    };
    
    this.visited = new Set();
    this.queue = [];
    this.siteMap = new Map();
    this.pageRelationships = new Map();
    this.pagesScanned = 0;
    this.startUrl = '';
    this.baseDomain = '';
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
    const skipExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.zip', '.rar', '.jpg', '.jpeg', '.png', '.gif', '.svg',
      '.mp3', '.mp4', '.avi', '.mov', '.css', '.js'
    ];
    
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
    
    // If page types filter is specified, prioritize those
    if (this.options.pageTypes && this.options.pageTypes.length > 0) {
      const priorityPatterns = {
        'FAQ': ['/faq', '/faqs', '/questions'],
        'Documentation': ['/docs', '/documentation', '/manual'],
        'Support': ['/support', '/help', '/assistance'],
        'Guide': ['/guide', '/tutorial', '/how-to'],
        'API': ['/api', '/developer', '/reference']
      };
      
      for (const pageType of this.options.pageTypes) {
        const patterns = priorityPatterns[pageType];
        if (patterns && patterns.some(pattern => urlLower.includes(pattern))) {
          return true;
        }
      }
    }
    
    return true;
  }
  
  async fetchPage(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': this.options.userAgent,
          'Accept': 'text/html,application/xhtml+xml'
        },
        timeout: 10000,
        maxRedirects: 5
      });
      
      return response.data;
    } catch (error) {
      console.error(`Failed to fetch ${url}:`, error.message);
      return null;
    }
  }
  
  parseHtml(html, currentUrl) {
    const $ = cheerio.load(html);
    
    // Extract title
    const title = $('title').text().trim() || 'Untitled';
    
    // Extract meta information
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    const metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    
    // Extract structured content
    const fullContent = this.extractFullContent($);
    const wordCount = fullContent.text.split(/\s+/).filter(word => word.length > 0).length;
    
    // Extract Q&A pairs
    const qaItems = this.extractQAPairs($);
    
    // Extract heading hierarchy
    const headingStructure = this.extractHeadingStructure($);
    
    // Extract links
    const links = [];
    $('a[href]').each((i, elem) => {
      const href = $(elem).attr('href');
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
    
    // Extract images with alt text
    const imageData = this.extractImageData($);
    
    // Extract tables and lists
    const structuredData = this.extractStructuredData($);
    
    // Classify page type
    const pageType = this.classifyPageType(currentUrl, $);
    
    // Calculate content quality score
    const qualityScore = this.calculateQualityScore(fullContent, headingStructure, qaItems, pageType);
    
    // Extract schema.org data
    const schemaData = this.extractSchemaData($);
    
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
  
  extractFullContent($) {
    // Remove non-content elements
    $('script, style, nav, footer, header, .navigation, .menu, .sidebar, .advertisement').remove();
    
    // Find main content area
    const contentSelectors = ['main', 'article', '.content', '#content', '.main-content', '[role="main"]'];
    let mainContent = null;
    
    for (const selector of contentSelectors) {
      mainContent = $(selector);
      if (mainContent.length > 0) break;
    }
    
    // Fallback to body if no main content area found
    if (!mainContent || mainContent.length === 0) {
      mainContent = $('body');
    }
    
    // Extract paragraphs with context
    const paragraphs = [];
    mainContent.find('p, li, dd, td, blockquote').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text && text.length > 20) {
        paragraphs.push(text);
      }
    });
    
    // Extract all text for full context
    const fullText = mainContent.text().replace(/\s+/g, ' ').trim() || '';
    
    return {
      text: fullText,
      paragraphs: paragraphs,
      cleanedHtml: mainContent.html()
    };
  }
  
  extractQAPairs($) {
    const qaItems = [];
    
    // Method 1: Look for FAQ schema markup
    $('[itemtype*="FAQPage"], [itemtype*="Question"]').each((i, elem) => {
      const question = $(elem).find('[itemprop="name"]').text().trim();
      const answer = $(elem).find('[itemprop="text"], [itemprop="acceptedAnswer"]').text().trim();
      if (question && answer) {
        qaItems.push({ question, answer });
      }
    });
    
    // Method 2: Look for common FAQ patterns
    $('.faq, #faq, .qa, .qanda, .questions, dl').each((i, container) => {
      // Check for dt/dd pattern
      $(container).find('dt').each((j, dt) => {
        const dd = $(dt).next('dd');
        if (dd.length > 0) {
          qaItems.push({
            question: $(dt).text().trim(),
            answer: dd.text().trim()
          });
        }
      });
      
      // Check for h3/h4 followed by div/p pattern
      $(container).find('h3, h4, h5').each((j, heading) => {
        const nextEl = $(heading).next('p, div');
        const questionText = $(heading).text().trim();
        if (nextEl.length > 0 && questionText.includes('?')) {
          qaItems.push({
            question: questionText,
            answer: nextEl.text().trim()
          });
        }
      });
    });
    
    return qaItems;
  }
  
  extractHeadingStructure($) {
    const structure = [];
    $('h1, h2, h3, h4, h5, h6').each((i, heading) => {
      structure.push({
        level: parseInt(heading.name.substring(1)),
        text: $(heading).text().trim(),
        tag: heading.name
      });
    });
    
    return {
      hierarchy: structure,
      h1: $('h1').length,
      h2: $('h2').length,
      h3: $('h3').length
    };
  }
  
  extractImageData($) {
    const images = [];
    $('img').each((i, img) => {
      const altText = $(img).attr('alt')?.trim();
      const src = $(img).attr('src');
      if (altText) {
        images.push({ src, altText });
      }
    });
    
    return {
      count: $('img').length,
      withAltText: images.length,
      images: images
    };
  }
  
  extractStructuredData($) {
    const tables = [];
    const lists = [];
    
    // Extract tables
    $('table').each((i, table) => {
      const headers = [];
      $(table).find('th').each((j, th) => {
        headers.push($(th).text().trim());
      });
      
      const rows = [];
      $(table).find('tr').each((j, tr) => {
        const row = [];
        $(tr).find('td').each((k, td) => {
          row.push($(td).text().trim());
        });
        if (row.length > 0) {
          rows.push(row);
        }
      });
      
      if (headers.length > 0 || rows.length > 0) {
        tables.push({ headers, rows });
      }
    });
    
    // Extract lists
    $('ul, ol').each((i, list) => {
      const items = [];
      $(list).find('li').each((j, li) => {
        items.push($(li).text().trim());
      });
      if (items.length > 0) {
        lists.push({
          type: list.name,
          items: items
        });
      }
    });
    
    return { tables, lists };
  }
  
  extractSchemaData($) {
    const schemas = [];
    $('script[type="application/ld+json"]').each((i, script) => {
      try {
        const data = JSON.parse($(script).html());
        schemas.push(data);
      } catch {}
    });
    
    return schemas;
  }
  
  calculateQualityScore(content, headings, qaItems, pageType) {
    let score = 0;
    
    // Content length score
    if (content.text.length > 500) score += 20;
    if (content.text.length > 1500) score += 20;
    if (content.text.length > 3000) score += 10;
    
    // Structure score
    if (headings.hierarchy.length > 3) score += 15;
    if (headings.h2 > 2) score += 10;
    
    // Q&A content score
    if (qaItems.length > 0) score += 25;
    if (qaItems.length > 5) score += 15;
    
    // Page type bonus
    const valuableTypes = ['FAQ', 'Documentation', 'Guide', 'Support', 'Help'];
    if (valuableTypes.includes(pageType)) score += 20;
    
    return Math.min(100, score);
  }
  
  classifyPageType(url, $) {
    const urlLower = url.toLowerCase();
    const title = $('title').text().toLowerCase() || '';
    const bodyText = $('body').text().toLowerCase() || '';
    
    // High priority customer service pages
    if (urlLower.includes('/faq') || urlLower.includes('/faqs') ||
        title.includes('frequently asked') || title.includes('faq')) {
      return 'FAQ';
    }
    
    if (urlLower.includes('/help') || urlLower.includes('/support') ||
        urlLower.includes('/customer-service')) {
      return 'Support';
    }
    
    if (urlLower.includes('/documentation') || urlLower.includes('/docs') ||
        urlLower.includes('/manual')) {
      return 'Documentation';
    }
    
    if (urlLower.includes('/guide') || urlLower.includes('/how-to') ||
        urlLower.includes('/tutorial')) {
      return 'Guide';
    }
    
    if (urlLower.includes('/api') || urlLower.includes('/developer')) {
      return 'API Documentation';
    }
    
    if (urlLower.includes('/knowledge') || urlLower.includes('/kb')) {
      return 'Knowledge Base';
    }
    
    // Standard page types
    if (urlLower.includes('/product') || urlLower.includes('/shop')) {
      return 'Product';
    }
    
    if (urlLower.includes('/contact')) {
      return 'Contact';
    }
    
    if (urlLower.includes('/about')) {
      return 'About';
    }
    
    if (urlLower.includes('/blog') || urlLower.includes('/article')) {
      return 'Blog/Article';
    }
    
    // Content-based classification
    if (bodyText.includes('frequently asked questions') ||
        $('[itemtype*="FAQPage"]').length > 0) {
      return 'FAQ';
    }
    
    return 'Other';
  }
  
  async crawl(url) {
    this.visited.clear();
    this.siteMap.clear();
    this.pageRelationships.clear();
    this.pagesScanned = 0;
    
    this.startUrl = this.normalizeUrl(url);
    if (!this.startUrl) {
      throw new Error('Invalid URL provided');
    }
    
    this.baseDomain = this.getBaseDomain(this.startUrl);
    
    // Initialize queue with start URL
    this.queue = [{ url: this.startUrl, depth: 0, parent: null }];
    
    while (this.queue.length > 0 && this.pagesScanned < this.options.maxPages) {
      const { url: currentUrl, depth, parent } = this.queue.shift();
      
      if (this.visited.has(currentUrl) || depth > this.options.maxDepth) {
        continue;
      }
      
      this.visited.add(currentUrl);
      this.pagesScanned++;
      
      // Track parent-child relationship
      if (parent) {
        if (!this.pageRelationships.has(parent)) {
          this.pageRelationships.set(parent, []);
        }
        this.pageRelationships.get(parent).push(currentUrl);
      }
      
      // Emit progress event
      this.emit('progress', {
        progress: Math.round((this.pagesScanned / this.options.maxPages) * 100),
        pagesScanned: this.pagesScanned,
        currentUrl,
        message: `Scanning: ${currentUrl.substring(0, 50)}...`
      });
      
      // Fetch and parse page
      const html = await this.fetchPage(currentUrl);
      if (html) {
        const pageData = this.parseHtml(html, currentUrl);
        pageData.depth = depth;
        pageData.parent = parent;
        
        // Apply quality filter if specified
        if (pageData.qualityScore >= this.options.minQualityScore) {
          this.siteMap.set(currentUrl, pageData);
        }
        
        // Add links to queue
        for (const link of pageData.links) {
          if (this.shouldCrawl(link)) {
            this.queue.push({
              url: link,
              depth: depth + 1,
              parent: currentUrl
            });
          }
        }
      }
      
      // Delay between requests
      await this.delay(this.options.delay);
    }
    
    // Calculate statistics
    const statistics = this.calculateStatistics();
    
    return {
      domain: this.baseDomain,
      startUrl: this.startUrl,
      pagesScanned: this.pagesScanned,
      statistics,
      pages: Array.from(this.siteMap.values()),
      siteMap: Object.fromEntries(this.siteMap),
      pageRelationships: Object.fromEntries(this.pageRelationships)
    };
  }
  
  async extractFromUrl(url, extractors = ['qa', 'content', 'metadata']) {
    const html = await this.fetchPage(url);
    if (!html) {
      throw new Error('Failed to fetch URL');
    }
    
    const $ = cheerio.load(html);
    const result = { url };
    
    if (extractors.includes('content')) {
      result.content = this.extractFullContent($);
    }
    
    if (extractors.includes('qa')) {
      result.qaItems = this.extractQAPairs($);
    }
    
    if (extractors.includes('metadata')) {
      result.title = $('title').text().trim();
      result.metaDescription = $('meta[name="description"]').attr('content') || '';
      result.metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    }
    
    if (extractors.includes('schema')) {
      result.schemaData = this.extractSchemaData($);
    }
    
    if (extractors.includes('structure')) {
      result.headings = this.extractHeadingStructure($);
      result.structuredData = this.extractStructuredData($);
    }
    
    return result;
  }
  
  calculateStatistics() {
    let totalQA = 0;
    let totalWords = 0;
    let avgQualityScore = 0;
    let faqPages = 0;
    let docsPages = 0;
    
    for (const pageData of this.siteMap.values()) {
      totalWords += pageData.wordCount;
      totalQA += pageData.qaItems?.length || 0;
      avgQualityScore += pageData.qualityScore || 0;
      
      if (pageData.pageType === 'FAQ') faqPages++;
      if (['Documentation', 'Guide', 'Support', 'Help'].includes(pageData.pageType)) {
        docsPages++;
      }
    }
    
    return {
      totalPages: this.siteMap.size,
      totalQA,
      totalWords,
      avgQualityScore: Math.round(avgQualityScore / this.siteMap.size) || 0,
      faqPages,
      docsPages,
      avgWordsPerPage: Math.round(totalWords / this.siteMap.size) || 0
    };
  }
  
  async exportData(pages, format, domain) {
    switch (format) {
      case 'rag':
        return this.exportForRAG(pages, domain);
      case 'markdown':
        return this.exportMarkdown(pages, domain);
      case 'vectordb':
        return this.exportVectorDB(pages, domain);
      case 'csv':
        return this.exportCSV(pages);
      case 'xml':
        return this.exportXMLSitemap(pages, domain);
      default:
        return JSON.stringify(pages, null, 2);
    }
  }
  
  exportForRAG(pages, domain) {
    const documents = [];
    
    for (const pageData of pages) {
      if (pageData.qualityScore < 30) continue;
      
      const chunks = [];
      if (pageData.content && pageData.content.paragraphs) {
        pageData.content.paragraphs.forEach(paragraph => {
          if (paragraph.length > 100) {
            chunks.push(paragraph);
          }
        });
      }
      
      if (pageData.qaItems && pageData.qaItems.length > 0) {
        pageData.qaItems.forEach(qa => {
          chunks.push(`Question: ${qa.question}\nAnswer: ${qa.answer}`);
        });
      }
      
      documents.push({
        id: `${domain}_${pageData.url.replace(/[^a-zA-Z0-9]/g, '_')}`,
        url: pageData.url,
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
          qaCount: pageData.qaItems?.length || 0
        }
      });
    }
    
    return JSON.stringify({
      source: domain,
      crawlDate: new Date().toISOString(),
      totalPages: documents.length,
      documents: documents
    }, null, 2);
  }
  
  exportMarkdown(pages, domain) {
    let markdown = `# ${domain} Content Export\n\n`;
    markdown += `Generated: ${new Date().toISOString()}\n\n`;
    
    const pagesByType = {};
    for (const page of pages) {
      const type = page.pageType;
      if (!pagesByType[type]) pagesByType[type] = [];
      pagesByType[type].push(page);
    }
    
    Object.entries(pagesByType).forEach(([type, typePages]) => {
      markdown += `## ${type}\n\n`;
      
      typePages.forEach(page => {
        markdown += `### ${page.title}\n\n`;
        markdown += `**URL:** ${page.url}\n`;
        markdown += `**Quality Score:** ${page.qualityScore}/100\n\n`;
        
        if (page.metaDescription) {
          markdown += `**Description:** ${page.metaDescription}\n\n`;
        }
        
        if (page.qaItems && page.qaItems.length > 0) {
          markdown += `#### Q&A Items\n\n`;
          page.qaItems.forEach(qa => {
            markdown += `**Q:** ${qa.question}\n`;
            markdown += `**A:** ${qa.answer}\n\n`;
          });
        }
        
        markdown += '---\n\n';
      });
    });
    
    return markdown;
  }
  
  exportVectorDB(pages, domain) {
    const vectors = [];
    
    for (const pageData of pages) {
      if (pageData.qualityScore < 30) continue;
      
      if (pageData.content && pageData.content.paragraphs) {
        pageData.content.paragraphs.forEach((paragraph, idx) => {
          if (paragraph.length > 100) {
            vectors.push({
              id: `${pageData.url}_chunk_${idx}`,
              text: paragraph,
              metadata: {
                url: pageData.url,
                title: pageData.title,
                pageType: pageData.pageType,
                chunkIndex: idx
              }
            });
          }
        });
      }
      
      if (pageData.qaItems && pageData.qaItems.length > 0) {
        pageData.qaItems.forEach((qa, idx) => {
          vectors.push({
            id: `${pageData.url}_qa_${idx}`,
            text: `${qa.question} ${qa.answer}`,
            metadata: {
              url: pageData.url,
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
    
    return JSON.stringify({
      source: domain,
      exportDate: new Date().toISOString(),
      totalVectors: vectors.length,
      vectors: vectors
    }, null, 2);
  }
  
  exportCSV(pages) {
    const headers = ['URL', 'Title', 'Type', 'Quality Score', 'Word Count', 'Q&A Count'];
    let csv = headers.join(',') + '\n';
    
    for (const page of pages) {
      const row = [
        `"${page.url}"`,
        `"${page.title.replace(/"/g, '""')}"`,
        page.pageType,
        page.qualityScore,
        page.wordCount,
        page.qaItems?.length || 0
      ];
      csv += row.join(',') + '\n';
    }
    
    return csv;
  }
  
  exportXMLSitemap(pages, domain) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    
    const today = new Date().toISOString().split('T')[0];
    
    for (const page of pages) {
      xml += '  <url>\n';
      xml += `    <loc>${this.escapeXML(page.url)}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      
      const priority = Math.max(0.1, 1.0 - (page.depth * 0.2));
      xml += `    <priority>${priority.toFixed(1)}</priority>\n`;
      
      let changefreq = 'monthly';
      if (page.pageType === 'Homepage') changefreq = 'daily';
      else if (page.pageType === 'Blog/Article') changefreq = 'weekly';
      xml += `    <changefreq>${changefreq}</changefreq>\n`;
      
      xml += '  </url>\n';
    }
    
    xml += '</urlset>';
    return xml;
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
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = WebsiteScanner;