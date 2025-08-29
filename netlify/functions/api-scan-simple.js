// Netlify Function: Simple Website Scan
// Path: /.netlify/functions/api-scan-simple
// Uses built-in fetch instead of axios to avoid bundling issues

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const API_KEY = process.env.API_KEY || 'test-api-key';

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
  let pageType = 'Other';
  
  if (urlLower.includes('faq')) pageType = 'FAQ';
  else if (urlLower.includes('doc')) pageType = 'Documentation';
  else if (urlLower.includes('support')) pageType = 'Support';
  else if (urlLower.includes('about')) pageType = 'About';
  else if (urlLower.includes('contact')) pageType = 'Contact';
  else if (urlLower.includes('pricing')) pageType = 'Pricing';
  else if (urlLower.includes('blog')) pageType = 'Blog';
  
  return {
    url,
    title,
    description,
    pageType,
    qualityScore,
    contentLength: textContent.length,
    content: {
      text: textContent.substring(0, 500) + (textContent.length > 500 ? '...' : '')
    }
  };
}

// Quick scan using fetch
async function quickScan(startUrl, options = {}) {
  const maxPages = Math.min(options.maxPages || 3, 5); // Max 5 for serverless
  const results = [];
  
  try {
    // Fetch the main page
    const response = await fetch(startUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGCollectorBot/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const pageData = extractContent(html, startUrl);
    results.push(pageData);
    
    // Extract a few links for additional pages
    const linkMatches = html.match(/href=["']([^"']+)["']/gi) || [];
    const baseUrl = new URL(startUrl);
    const uniqueLinks = new Set();
    
    for (const match of linkMatches.slice(0, 20)) {
      const href = match.match(/href=["']([^"']+)["']/i)?.[1];
      if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
        try {
          const linkUrl = new URL(href, startUrl);
          if (linkUrl.hostname === baseUrl.hostname && linkUrl.href !== startUrl) {
            uniqueLinks.add(linkUrl.href);
            if (uniqueLinks.size >= maxPages - 1) break;
          }
        } catch (e) {
          // Invalid URL
        }
      }
    }
    
    // Fetch a few more pages
    for (const link of Array.from(uniqueLinks).slice(0, maxPages - 1)) {
      try {
        const linkResponse = await fetch(link, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; RAGCollectorBot/1.0)'
          }
        });
        
        if (linkResponse.ok) {
          const linkHtml = await linkResponse.text();
          const linkData = extractContent(linkHtml, link);
          results.push(linkData);
        }
      } catch (e) {
        console.error(`Error fetching ${link}:`, e.message);
      }
    }
    
  } catch (error) {
    console.error('Scan error:', error);
    throw error;
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
    try {
      new URL(url);
    } catch (e) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid URL format' })
      };
    }
    
    // Perform scan
    const startTime = Date.now();
    const pages = await quickScan(url, options);
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
        domain: new URL(url).hostname,
        scanDate: new Date().toISOString(),
        status: 'completed',
        statistics,
        pages,
        serverless: true,
        message: `Quick scan completed. Found ${pages.length} pages in ${scanTime}ms`
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