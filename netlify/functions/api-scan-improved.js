// Netlify Function: Improved Website Scan
// Path: /.netlify/functions/api-scan-improved
// Better handling for Wix sites and common page patterns

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const API_KEY = process.env.API_KEY || 'test-api-key';

// Common page paths to check on websites
const COMMON_PAGES = [
  '/about',
  '/about-us',
  '/services',
  '/solutions',
  '/products',
  '/contact',
  '/contact-us',
  '/faq',
  '/help',
  '/support',
  '/pricing',
  '/pricing-plans',
  '/blog',
  '/news',
  '/team',
  '/careers',
  '/privacy',
  '/terms',
  '/portfolio',
  '/gallery'
];

// Simple HTML parser without dependencies
function extractContent(html, url) {
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';
  
  // Extract description
  const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const description = descMatch ? descMatch[1].trim() : '';
  
  // Remove scripts and styles
  const cleanHtml = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Extract text content (first 1000 chars)
  const textContent = cleanHtml.substring(0, 1000);
  
  // Calculate quality score
  let qualityScore = 0;
  if (title) qualityScore += 25;
  if (description) qualityScore += 25;
  if (textContent.length > 200) qualityScore += 25;
  if (textContent.length > 500) qualityScore += 25;
  
  // Determine page type
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  let pageType = 'Other';
  
  if (urlLower.includes('about') || titleLower.includes('about')) pageType = 'About';
  else if (urlLower.includes('service') || titleLower.includes('service')) pageType = 'Services';
  else if (urlLower.includes('solution') || titleLower.includes('solution')) pageType = 'Solutions';
  else if (urlLower.includes('product') || titleLower.includes('product')) pageType = 'Products';
  else if (urlLower.includes('contact') || titleLower.includes('contact')) pageType = 'Contact';
  else if (urlLower.includes('faq') || titleLower.includes('faq')) pageType = 'FAQ';
  else if (urlLower.includes('support') || titleLower.includes('support')) pageType = 'Support';
  else if (urlLower.includes('pricing') || titleLower.includes('pricing')) pageType = 'Pricing';
  else if (urlLower.includes('blog') || titleLower.includes('blog')) pageType = 'Blog';
  else if (urlLower.includes('privacy')) pageType = 'Legal';
  else if (urlLower.includes('terms')) pageType = 'Legal';
  else if (urlLower === url || urlLower.endsWith('/')) pageType = 'Home';
  
  return {
    url,
    title: title || 'Untitled Page',
    description,
    pageType,
    qualityScore,
    contentLength: textContent.length,
    content: {
      text: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : '')
    }
  };
}

// Extract links from HTML
function extractLinks(html, baseUrl) {
  const links = new Set();
  const base = new URL(baseUrl);
  
  // Find all href attributes
  const hrefMatches = html.matchAll(/href=["']([^"']+)["']/gi);
  for (const match of hrefMatches) {
    const href = match[1];
    if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:')) {
      try {
        const linkUrl = new URL(href, baseUrl);
        // Only include links from same domain
        if (linkUrl.hostname === base.hostname) {
          // Clean up the URL (remove fragments, normalize)
          linkUrl.hash = '';
          const cleanUrl = linkUrl.href;
          if (cleanUrl !== baseUrl) {
            links.add(cleanUrl);
          }
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
  }
  
  return Array.from(links);
}

// Improved scan function
async function improvedScan(startUrl, options = {}) {
  const maxPages = Math.min(options.maxPages || 5, 5); // Max 5 for serverless
  const results = [];
  const visited = new Set();
  const toVisit = new Set([startUrl]);
  
  // Parse base URL
  const baseUrl = new URL(startUrl);
  const baseUrlClean = `${baseUrl.protocol}//${baseUrl.hostname}`;
  
  // Add common pages to check (for sites like Wix that hide links)
  if (options.checkCommonPages !== false) {
    for (const path of COMMON_PAGES.slice(0, 10)) {
      toVisit.add(baseUrlClean + path);
    }
  }
  
  // Visit pages
  while (toVisit.size > 0 && results.length < maxPages) {
    const url = toVisit.values().next().value;
    toVisit.delete(url);
    
    if (visited.has(url)) continue;
    visited.add(url);
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RAGCollectorBot/1.0)'
        },
        redirect: 'follow'
      });
      
      if (response.ok) {
        const html = await response.text();
        const pageData = extractContent(html, url);
        
        // Only add pages with content
        if (pageData.contentLength > 100) {
          results.push(pageData);
          
          // Extract links from this page
          if (results.length < maxPages) {
            const pageLinks = extractLinks(html, url);
            for (const link of pageLinks.slice(0, 5)) {
              if (!visited.has(link) && results.length + toVisit.size < maxPages * 2) {
                toVisit.add(link);
              }
            }
          }
        }
      }
    } catch (e) {
      // Page not accessible, skip
      console.log(`Could not fetch ${url}: ${e.message}`);
    }
  }
  
  // If we only found the homepage, try harder with common paths
  if (results.length === 1 && options.checkCommonPages !== false) {
    const additionalPaths = ['/about-us', '/services', '/contact', '/solutions'];
    for (const path of additionalPaths) {
      if (results.length >= maxPages) break;
      
      const url = baseUrlClean + path;
      if (!visited.has(url)) {
        try {
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; RAGCollectorBot/1.0)'
            }
          });
          
          if (response.ok) {
            const html = await response.text();
            const pageData = extractContent(html, url);
            if (pageData.contentLength > 100) {
              results.push(pageData);
            }
          }
        } catch (e) {
          // Skip
        }
      }
    }
  }
  
  return results;
}

exports.handler = async (event, context) => {
  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  
  // Check API key
  const apiKey = event.headers['x-api-key'] || event.headers['X-API-Key'];
  if (apiKey !== API_KEY) {
    return {
      statusCode: 401,
      headers,
      body: JSON.stringify({ error: 'Invalid API key' })
    };
  }
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { url, options = {} } = body;
    
    if (!url) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'URL is required' })
      };
    }
    
    // Validate URL
    let cleanUrl;
    try {
      const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
      cleanUrl = parsedUrl.href;
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid URL format' })
      };
    }
    
    // Perform improved scan
    const startTime = Date.now();
    const pages = await improvedScan(cleanUrl, options);
    const scanTime = Date.now() - startTime;
    
    // Calculate statistics
    const statistics = {
      totalPages: pages.length,
      scanTime: scanTime,
      avgQualityScore: pages.length > 0 
        ? Math.round(pages.reduce((sum, p) => sum + p.qualityScore, 0) / pages.length)
        : 0,
      pageTypes: pages.reduce((acc, p) => {
        acc[p.pageType] = (acc[p.pageType] || 0) + 1;
        return acc;
      }, {})
    };
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        scanId: `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        domain: new URL(cleanUrl).hostname,
        scanDate: new Date().toISOString(),
        status: 'completed',
        statistics,
        pages,
        serverless: true,
        version: 'improved',
        message: `Scan completed. Found ${pages.length} pages in ${scanTime}ms`
      })
    };
    
  } catch (error) {
    console.error('Scan error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Scan failed', 
        message: error.message,
        serverless: true 
      })
    };
  }
};