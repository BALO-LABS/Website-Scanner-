// Netlify Function: Website Scan Endpoint
// Path: /.netlify/functions/api-scan

const axios = require('axios');
const cheerio = require('cheerio');
const { URL } = require('url');

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

// Simple API key check
const API_KEY = process.env.API_KEY || 'test-api-key';

// Extract content from HTML
function extractContent(html, url) {
  const $ = cheerio.load(html);
  
  // Remove script and style elements
  $('script, style, noscript').remove();
  
  // Extract text content
  const title = $('title').text().trim() || $('h1').first().text().trim() || '';
  const description = $('meta[name="description"]').attr('content') || 
                     $('meta[property="og:description"]').attr('content') || '';
  
  const headings = [];
  $('h1, h2, h3').each((i, elem) => {
    const text = $(elem).text().trim();
    if (text && headings.length < 10) {
      headings.push(text);
    }
  });
  
  const paragraphs = [];
  $('p').each((i, elem) => {
    const text = $(elem).text().trim();
    if (text && text.length > 50 && paragraphs.length < 10) {
      paragraphs.push(text);
    }
  });
  
  // Extract links for crawling
  const links = [];
  $('a[href]').each((i, elem) => {
    const href = $(elem).attr('href');
    if (href) {
      try {
        const linkUrl = new URL(href, url);
        if (linkUrl.hostname === new URL(url).hostname) {
          links.push(linkUrl.href);
        }
      } catch (e) {
        // Invalid URL, skip
      }
    }
  });
  
  // Calculate quality score
  let qualityScore = 0;
  if (title) qualityScore += 20;
  if (description) qualityScore += 20;
  if (headings.length > 0) qualityScore += 20;
  if (paragraphs.length > 0) qualityScore += 20;
  if (paragraphs.join(' ').length > 500) qualityScore += 20;
  
  // Determine page type
  const urlLower = url.toLowerCase();
  const titleLower = title.toLowerCase();
  let pageType = 'Other';
  
  if (urlLower.includes('faq') || titleLower.includes('faq')) pageType = 'FAQ';
  else if (urlLower.includes('doc') || titleLower.includes('doc')) pageType = 'Documentation';
  else if (urlLower.includes('support') || titleLower.includes('support')) pageType = 'Support';
  else if (urlLower.includes('about')) pageType = 'About';
  else if (urlLower.includes('contact')) pageType = 'Contact';
  else if (urlLower.includes('pricing')) pageType = 'Pricing';
  else if (urlLower.includes('blog')) pageType = 'Blog';
  else if (urlLower === url || urlLower.endsWith('/')) pageType = 'Home';
  
  return {
    url,
    title,
    description,
    pageType,
    qualityScore,
    content: {
      headings,
      paragraphs,
      text: paragraphs.join('\n\n')
    },
    links: [...new Set(links)].slice(0, 20) // Unique links, max 20
  };
}

// Quick scan function (limited by 10-second timeout)
async function quickScan(startUrl, options = {}) {
  const maxPages = Math.min(options.maxPages || 5, 10); // Max 10 pages for serverless
  const visited = new Set();
  const queue = [startUrl];
  const results = [];
  
  while (queue.length > 0 && results.length < maxPages) {
    const url = queue.shift();
    
    if (visited.has(url)) continue;
    visited.add(url);
    
    try {
      // Fetch the page with timeout
      const response = await axios.get(url, {
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; RAGCollectorBot/1.0)'
        }
      });
      
      // Extract content
      const pageData = extractContent(response.data, url);
      results.push(pageData);
      
      // Add new links to queue (only if we haven't reached limit)
      if (results.length < maxPages) {
        for (const link of pageData.links) {
          if (!visited.has(link) && queue.length < maxPages * 2) {
            queue.push(link);
          }
        }
      }
      
    } catch (error) {
      console.error(`Error scanning ${url}:`, error.message);
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
    // Parse request body
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
    
    // Perform quick scan (must complete within 10 seconds)
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
    
    // Return results
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