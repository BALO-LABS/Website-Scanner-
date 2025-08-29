// Comprehensive Website Map Generator using ALL mapping methods

const express = require('express');
const AdvancedWebsiteMapper = require('./advanced-mapper');

const router = express.Router();

// This will be set by the main server
let scanResults;

// Generate comprehensive website map using ALL mapping methods
router.post('/generate-comprehensive-map', async (req, res) => {
  try {
    const { url, options = {} } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log(`🔬 Starting comprehensive mapping for ${url}...`);
    
    const mapper = new AdvancedWebsiteMapper({
      maxPages: options.maxPages || 100,
      maxDepth: options.maxDepth || 4,
      timeout: options.timeout || 15000,
      userAgent: 'ComprehensiveWebMapper/1.0'
    });
    
    // Phase 1: Run comprehensive analysis (all methods)
    const analysisResults = await mapper.runComprehensiveAnalysis(url);
    
    // Phase 2: Extract additional data for complete website map
    const pageDetailsMap = new Map();
    
    // Process each discovered page with full analysis
    for (const [pageUrl, pageData] of mapper.pageData.entries()) {
      console.log(`📄 Processing page: ${pageUrl}`);
      
      try {
        // Get page HTML for detailed analysis
        const html = await mapper.fetchPage(pageUrl);
        if (!html) continue;
        
        // Extract comprehensive data
        const structuredData = mapper.extractStructuredData(html);
        const socialData = mapper.extractSocialMediaMeta(html, pageUrl);
        const technologies = await mapper.detectTechnology(pageUrl, html);
        
        // Calculate page metrics
        const pageRank = mapper.pageRankScores.get(pageUrl) || 0;
        const hubScore = mapper.hubScores.get(pageUrl) || 0;
        const authorityScore = mapper.authorityScores.get(pageUrl) || 0;
        
        // Classify page content
        const pageType = classifyPageType(pageUrl, html);
        const qualityScore = calculateQualityScore(html, structuredData);
        
        // Extract links and their context
        const linkDetails = extractLinkDetails(html, pageUrl);
        
        pageDetailsMap.set(pageUrl, {
          // Basic info
          url: pageUrl,
          title: pageData.title || extractTitle(html),
          description: extractDescription(html),
          
          // Page classification
          pageType,
          qualityScore,
          
          // Links and relationships
          outboundLinks: linkDetails.outbound,
          inboundLinks: getInboundLinks(pageUrl, mapper.linkGraph),
          totalLinks: linkDetails.total,
          
          // Content analysis
          wordCount: countWords(html),
          headings: extractHeadings(html),
          images: extractImages(html),
          forms: structuredData.forms || [],
          tables: structuredData.tables || [],
          
          // Technical data
          loadTime: pageData.loadTime || 0,
          size: pageData.size || 0,
          
          // SEO data
          metaTags: extractMetaTags(html),
          openGraph: socialData.openGraph,
          twitterCards: socialData.twitter,
          canonical: socialData.canonical,
          
          // Structured data
          jsonLd: structuredData.jsonLd || [],
          microformats: structuredData.microformats || {},
          
          // Authority metrics
          pageRank,
          hubScore,
          authorityScore,
          
          // Technology stack
          technologies,
          
          // Crawl metadata
          depth: pageData.depth || 0,
          crawlDate: new Date().toISOString(),
          lastModified: getLastModified(html)
        });
        
      } catch (error) {
        console.error(`Error processing ${pageUrl}:`, error.message);
        
        // Add basic info even on error
        pageDetailsMap.set(pageUrl, {
          url: pageUrl,
          title: pageData.title || 'Error loading page',
          error: error.message,
          pageType: 'Unknown',
          qualityScore: 0,
          outboundLinks: mapper.linkGraph.get(pageUrl) || [],
          inboundLinks: [],
          totalLinks: (mapper.linkGraph.get(pageUrl) || []).length,
          depth: pageData.depth || 0,
          crawlDate: new Date().toISOString()
        });
      }
    }
    
    // Phase 3: Build comprehensive website map
    const comprehensiveMap = {
      // Basic information
      domain: new URL(url).hostname,
      rootUrl: url,
      generatedAt: new Date().toISOString(),
      
      // Analysis summary
      analysisSummary: {
        totalPages: mapper.visitedUrls.size,
        totalLinks: Array.from(mapper.linkGraph.values()).reduce((sum, links) => sum + links.length, 0),
        maxDepth: Math.max(...Array.from(pageDetailsMap.values()).map(p => p.depth)),
        crawlDuration: analysisResults.stats.endTime - analysisResults.stats.startTime,
        pagesPerSecond: analysisResults.stats.pagesPerSecond,
        discoveryMethods: {
          robotsTxt: mapper.robotsTxtData ? 'found' : 'not_found',
          sitemaps: mapper.sitemapUrls.size,
          rssFeeds: mapper.rssFeeds.size,
          apiEndpoints: mapper.apiEndpoints.size
        }
      },
      
      // Page details with all data
      pages: Array.from(pageDetailsMap.values()).sort((a, b) => b.pageRank - a.pageRank),
      
      // Site structure and relationships
      structure: {
        hierarchy: generateHierarchy(pageDetailsMap),
        communities: analysisResults.communities,
        linkGraph: Object.fromEntries(mapper.linkGraph),
        redirectChains: await mapper.detectRedirectChains()
      },
      
      // Authority analysis
      authorityAnalysis: {
        topPagesByRank: analysisResults.pageRankTop10,
        topHubs: analysisResults.hubsTop10,
        topAuthorities: analysisResults.authoritiesTop10,
        communities: analysisResults.communities
      },
      
      // Content analysis
      contentAnalysis: {
        pageTypes: calculatePageTypesDistribution(pageDetailsMap),
        qualityDistribution: calculateQualityDistribution(pageDetailsMap),
        averageQualityScore: calculateAverageQuality(pageDetailsMap),
        totalWords: Array.from(pageDetailsMap.values()).reduce((sum, p) => sum + (p.wordCount || 0), 0),
        totalImages: Array.from(pageDetailsMap.values()).reduce((sum, p) => sum + (p.images?.length || 0), 0),
        totalForms: Array.from(pageDetailsMap.values()).reduce((sum, p) => sum + (p.forms?.length || 0), 0)
      },
      
      // Technical analysis
      technicalAnalysis: {
        technologies: await detectSiteTechnologies(pageDetailsMap),
        performanceMetrics: await mapper.analyzePerformanceMetrics(),
        seoAnalysis: await mapper.analyzeSEO(),
        brokenLinks: analysisResults.brokenLinks || 0
      },
      
      // Visualization data
      visualizations: analysisResults.visualizations,
      
      // Advanced metrics
      advancedMetrics: {
        duplicateContent: await findDuplicateContent(mapper, pageDetailsMap),
        deepLinkAnalysis: analyzeDeepLinks(pageDetailsMap),
        contentQualityByType: analyzeContentQualityByType(pageDetailsMap),
        linkDistribution: analyzeLinkDistribution(pageDetailsMap)
      }
    };
    
    console.log(`✅ Comprehensive mapping completed for ${url}`);
    console.log(`📊 Mapped ${comprehensiveMap.pages.length} pages with ${comprehensiveMap.analysisSummary.totalLinks} links`);
    
    res.json(comprehensiveMap);
    
  } catch (error) {
    console.error('Error generating comprehensive map:', error);
    res.status(500).json({ 
      error: 'Failed to generate comprehensive website map',
      details: error.message 
    });
  }
});

// Get comprehensive map from existing scan
router.get('/scan/:scanId/comprehensive-map', async (req, res) => {
  try {
    const { scanId } = req.params;
    const scan = scanResults.get(scanId);
    
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    if (scan.status !== 'completed') {
      return res.status(400).json({ 
        error: 'Scan not completed',
        status: scan.status 
      });
    }
    
    console.log(`🔬 Generating comprehensive map from scan ${scanId}...`);
    
    // Create mapper and populate with scan data
    const mapper = new AdvancedWebsiteMapper();
    
    // Reconstruct the mapper state from scan results
    if (scan.pages) {
      scan.pages.forEach(page => {
        mapper.visitedUrls.add(page.url);
        mapper.linkGraph.set(page.url, page.links || []);
        mapper.pageData.set(page.url, page);
      });
    }
    
    // Generate comprehensive analysis
    const comprehensiveMap = await generateComprehensiveMapFromScan(mapper, scan);
    
    res.json(comprehensiveMap);
    
  } catch (error) {
    console.error('Error generating comprehensive map from scan:', error);
    res.status(500).json({ 
      error: 'Failed to generate comprehensive map from scan',
      details: error.message 
    });
  }
});

// Helper functions

function classifyPageType(url, html) {
  const urlLower = url.toLowerCase();
  const htmlLower = html.toLowerCase();
  
  // URL-based classification
  if (urlLower.includes('/faq')) return 'FAQ';
  if (urlLower.includes('/help')) return 'Help';
  if (urlLower.includes('/support')) return 'Support';
  if (urlLower.includes('/doc')) return 'Documentation';
  if (urlLower.includes('/api')) return 'API Reference';
  if (urlLower.includes('/tutorial')) return 'Tutorial';
  if (urlLower.includes('/guide')) return 'Guide';
  if (urlLower.includes('/about')) return 'About';
  if (urlLower.includes('/contact')) return 'Contact';
  if (urlLower.includes('/blog')) return 'Blog';
  if (urlLower.includes('/news')) return 'News';
  if (urlLower.includes('/product')) return 'Product';
  if (urlLower.includes('/service')) return 'Service';
  if (urlLower.includes('/pricing')) return 'Pricing';
  
  // Content-based classification
  if (htmlLower.includes('frequently asked') || htmlLower.includes('questions and answers')) return 'FAQ';
  if (htmlLower.includes('documentation')) return 'Documentation';
  if (htmlLower.includes('tutorial')) return 'Tutorial';
  if (htmlLower.includes('api reference')) return 'API Reference';
  
  // Default classification
  if (url.endsWith('/') || url.split('/').length <= 4) return 'Home';
  
  return 'Content';
}

function calculateQualityScore(html, structuredData) {
  let score = 0;
  
  // Content length (0-25 points)
  const textLength = html.replace(/<[^>]*>/g, '').trim().length;
  score += Math.min(25, textLength / 100);
  
  // Structured data (0-20 points)
  if (structuredData.jsonLd.length > 0) score += 10;
  if (structuredData.tables.length > 0) score += 5;
  if (structuredData.forms.length > 0) score += 5;
  
  // Headings structure (0-15 points)
  const headings = (html.match(/<h[1-6][^>]*>/gi) || []).length;
  score += Math.min(15, headings * 2);
  
  // Images with alt text (0-10 points)
  const images = html.match(/<img[^>]*>/gi) || [];
  const imagesWithAlt = images.filter(img => img.includes('alt=')).length;
  score += Math.min(10, (imagesWithAlt / Math.max(1, images.length)) * 10);
  
  // Meta tags (0-15 points)
  if (html.includes('<meta name="description"')) score += 5;
  if (html.includes('<meta name="keywords"')) score += 3;
  if (html.includes('<title>')) score += 7;
  
  // Links quality (0-15 points)
  const links = (html.match(/<a[^>]*href=/gi) || []).length;
  const internalLinks = (html.match(/<a[^>]*href="\/[^"]*"/gi) || []).length;
  score += Math.min(15, (internalLinks / Math.max(1, links)) * 15);
  
  return Math.min(100, Math.round(score));
}

function extractTitle(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : '';
}

function extractDescription(html) {
  const descMatch = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
  return descMatch ? descMatch[1].trim() : '';
}

function extractLinkDetails(html, baseUrl) {
  const linkRegex = /<a[^>]*href=["\']([^"\']+)["\'][^>]*>([^<]*)<\/a>/gi;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const url = new URL(match[1], baseUrl).href;
      const text = match[2].trim();
      links.push({ url, text });
    } catch (error) {
      // Invalid URL, skip
    }
  }
  
  return {
    outbound: links,
    total: links.length
  };
}

function getInboundLinks(targetUrl, linkGraph) {
  const inbound = [];
  for (const [sourceUrl, links] of linkGraph.entries()) {
    if (links.includes(targetUrl)) {
      inbound.push(sourceUrl);
    }
  }
  return inbound;
}

function countWords(html) {
  const text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  return text ? text.split(' ').length : 0;
}

function extractHeadings(html) {
  const headings = [];
  const headingRegex = /<h([1-6])[^>]*>([^<]+)<\/h[1-6]>/gi;
  let match;
  
  while ((match = headingRegex.exec(html)) !== null) {
    headings.push({
      level: parseInt(match[1]),
      text: match[2].trim()
    });
  }
  
  return headings;
}

function extractImages(html) {
  const images = [];
  const imgRegex = /<img[^>]*src=["\']([^"\']+)["\'][^>]*>/gi;
  let match;
  
  while ((match = imgRegex.exec(html)) !== null) {
    const altMatch = match[0].match(/alt=["\']([^"\']*)["\']?/i);
    images.push({
      src: match[1],
      alt: altMatch ? altMatch[1] : ''
    });
  }
  
  return images;
}

function extractMetaTags(html) {
  const metaTags = {};
  const metaRegex = /<meta[^>]*name=["\']([^"\']+)["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/gi;
  let match;
  
  while ((match = metaRegex.exec(html)) !== null) {
    metaTags[match[1]] = match[2];
  }
  
  return metaTags;
}

function getLastModified(html) {
  const lastModMatch = html.match(/<meta[^>]*name=["\']last-modified["\'][^>]*content=["\']([^"\']+)["\'][^>]*>/i);
  return lastModMatch ? lastModMatch[1] : null;
}

function generateHierarchy(pageDetailsMap) {
  const hierarchy = {};
  
  for (const page of pageDetailsMap.values()) {
    const path = new URL(page.url).pathname;
    const segments = path.split('/').filter(Boolean);
    
    let current = hierarchy;
    let currentPath = '';
    
    for (const segment of segments) {
      currentPath += '/' + segment;
      if (!current[segment]) {
        current[segment] = {
          path: currentPath,
          title: segment,
          children: {},
          pages: []
        };
      }
      current = current[segment].children;
    }
    
    // Add page to the appropriate level
    const parent = segments.length > 0 ? 
      segments.reduce((obj, seg) => obj[seg].children, hierarchy) :
      hierarchy;
    
    if (!parent.pages) parent.pages = [];
    parent.pages.push(page);
  }
  
  return hierarchy;
}

function calculatePageTypesDistribution(pageDetailsMap) {
  const distribution = {};
  for (const page of pageDetailsMap.values()) {
    distribution[page.pageType] = (distribution[page.pageType] || 0) + 1;
  }
  return distribution;
}

function calculateQualityDistribution(pageDetailsMap) {
  const ranges = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
  
  for (const page of pageDetailsMap.values()) {
    const score = page.qualityScore;
    if (score <= 20) ranges['0-20']++;
    else if (score <= 40) ranges['21-40']++;
    else if (score <= 60) ranges['41-60']++;
    else if (score <= 80) ranges['61-80']++;
    else ranges['81-100']++;
  }
  
  return ranges;
}

function calculateAverageQuality(pageDetailsMap) {
  const scores = Array.from(pageDetailsMap.values()).map(p => p.qualityScore);
  return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
}

async function detectSiteTechnologies(pageDetailsMap) {
  const allTechnologies = {
    cms: new Set(),
    frameworks: new Set(),
    analytics: new Set(),
    cdn: new Set()
  };
  
  for (const page of pageDetailsMap.values()) {
    if (page.technologies) {
      if (page.technologies.cms) allTechnologies.cms.add(page.technologies.cms);
      page.technologies.frameworks?.forEach(f => allTechnologies.frameworks.add(f));
      page.technologies.analytics?.forEach(a => allTechnologies.analytics.add(a));
      if (page.technologies.cdn) allTechnologies.cdn.add(page.technologies.cdn);
    }
  }
  
  return {
    cms: Array.from(allTechnologies.cms),
    frameworks: Array.from(allTechnologies.frameworks),
    analytics: Array.from(allTechnologies.analytics),
    cdn: Array.from(allTechnologies.cdn)
  };
}

async function findDuplicateContent(mapper, pageDetailsMap) {
  const duplicates = [];
  const pages = Array.from(pageDetailsMap.values());
  
  for (let i = 0; i < pages.length; i++) {
    for (let j = i + 1; j < pages.length; j++) {
      const similarity = mapper.detectDuplicateContent(
        pages[i].title + ' ' + (pages[i].description || ''),
        pages[j].title + ' ' + (pages[j].description || '')
      );
      
      if (similarity > 0.8) {
        duplicates.push({
          page1: pages[i].url,
          page2: pages[j].url,
          similarity: similarity
        });
      }
    }
  }
  
  return duplicates;
}

function analyzeDeepLinks(pageDetailsMap) {
  const analysis = {};
  for (const page of pageDetailsMap.values()) {
    analysis[page.url] = {
      inboundCount: page.inboundLinks.length,
      outboundCount: page.outboundLinks.length,
      ratio: page.inboundLinks.length / Math.max(1, page.outboundLinks.length)
    };
  }
  return analysis;
}

function analyzeContentQualityByType(pageDetailsMap) {
  const analysis = {};
  
  for (const page of pageDetailsMap.values()) {
    if (!analysis[page.pageType]) {
      analysis[page.pageType] = {
        count: 0,
        totalQuality: 0,
        averageQuality: 0
      };
    }
    
    analysis[page.pageType].count++;
    analysis[page.pageType].totalQuality += page.qualityScore;
  }
  
  for (const type in analysis) {
    analysis[type].averageQuality = analysis[type].totalQuality / analysis[type].count;
  }
  
  return analysis;
}

function analyzeLinkDistribution(pageDetailsMap) {
  const distribution = {
    totalLinks: 0,
    averageLinksPerPage: 0,
    topLinkedPages: [],
    orphanPages: []
  };
  
  for (const page of pageDetailsMap.values()) {
    distribution.totalLinks += page.totalLinks;
    
    if (page.inboundLinks.length === 0 && page.url !== page.url.split('/').slice(0, 3).join('/')) {
      distribution.orphanPages.push(page.url);
    }
  }
  
  distribution.averageLinksPerPage = distribution.totalLinks / pageDetailsMap.size;
  
  distribution.topLinkedPages = Array.from(pageDetailsMap.values())
    .sort((a, b) => b.inboundLinks.length - a.inboundLinks.length)
    .slice(0, 10)
    .map(p => ({
      url: p.url,
      inboundLinks: p.inboundLinks.length
    }));
  
  return distribution;
}

async function generateComprehensiveMapFromScan(mapper, scan) {
  // This would implement comprehensive map generation from existing scan data
  // Similar to the main function but working with stored scan results
  return {
    message: 'Comprehensive map generation from existing scan not yet implemented',
    scanId: scan.scanId,
    domain: scan.domain
  };
}

// Function to set the scanResults reference from main server
router.setScanResults = (results) => {
  scanResults = results;
};

module.exports = router;