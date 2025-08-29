// Netlify Function: Extract Single Page
// Path: /.netlify/functions/api-extract

const axios = require('axios');
const cheerio = require('cheerio');

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

// Simple API key check
const API_KEY = process.env.API_KEY || 'test-api-key';

// Extract content from a single page
async function extractPage(url, extractors = ['content', 'metadata']) {
  try {
    // Fetch the page
    const response = await axios.get(url, {
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGCollectorBot/1.0)'
      }
    });
    
    const html = response.data;
    const $ = cheerio.load(html);
    
    // Remove unwanted elements
    $('script, style, noscript').remove();
    
    const result = { url };
    
    // Extract metadata
    if (extractors.includes('metadata')) {
      result.title = $('title').text().trim() || $('h1').first().text().trim() || '';
      result.description = $('meta[name="description"]').attr('content') || 
                          $('meta[property="og:description"]').attr('content') || '';
      result.keywords = $('meta[name="keywords"]').attr('content') || '';
      result.author = $('meta[name="author"]').attr('content') || '';
      result.ogImage = $('meta[property="og:image"]').attr('content') || '';
    }
    
    // Extract content
    if (extractors.includes('content')) {
      const headings = [];
      $('h1, h2, h3, h4').each((i, elem) => {
        const text = $(elem).text().trim();
        if (text) {
          headings.push({
            level: elem.name,
            text: text
          });
        }
      });
      
      const paragraphs = [];
      $('p').each((i, elem) => {
        const text = $(elem).text().trim();
        if (text && text.length > 30) {
          paragraphs.push(text);
        }
      });
      
      const lists = [];
      $('ul, ol').each((i, elem) => {
        const items = [];
        $(elem).find('li').each((j, li) => {
          const text = $(li).text().trim();
          if (text) items.push(text);
        });
        if (items.length > 0) {
          lists.push({
            type: elem.name,
            items: items
          });
        }
      });
      
      result.content = {
        headings,
        paragraphs,
        lists,
        text: paragraphs.join('\n\n')
      };
    }
    
    // Extract Q&A pairs (for FAQ pages)
    if (extractors.includes('qa')) {
      const qaPairs = [];
      
      // Look for common FAQ patterns
      // Pattern 1: Adjacent headings and paragraphs
      $('h2, h3, h4').each((i, elem) => {
        const question = $(elem).text().trim();
        const answer = $(elem).next('p, div').text().trim();
        if (question && answer && question.includes('?')) {
          qaPairs.push({ question, answer });
        }
      });
      
      // Pattern 2: Definition lists
      $('dt').each((i, elem) => {
        const question = $(elem).text().trim();
        const answer = $(elem).next('dd').text().trim();
        if (question && answer) {
          qaPairs.push({ question, answer });
        }
      });
      
      // Pattern 3: FAQ schema markup
      $('[itemtype*="FAQPage"] [itemtype*="Question"]').each((i, elem) => {
        const question = $(elem).find('[itemprop="name"]').text().trim();
        const answer = $(elem).find('[itemprop="text"]').text().trim();
        if (question && answer) {
          qaPairs.push({ question, answer });
        }
      });
      
      result.qaPairs = qaPairs;
    }
    
    // Calculate quality score
    let qualityScore = 0;
    if (result.title) qualityScore += 20;
    if (result.description) qualityScore += 15;
    if (result.content?.headings?.length > 0) qualityScore += 20;
    if (result.content?.paragraphs?.length > 2) qualityScore += 25;
    if (result.content?.text?.length > 500) qualityScore += 20;
    
    result.qualityScore = qualityScore;
    
    // Determine page type
    const urlLower = url.toLowerCase();
    const titleLower = (result.title || '').toLowerCase();
    
    if (urlLower.includes('faq') || titleLower.includes('faq')) {
      result.pageType = 'FAQ';
    } else if (urlLower.includes('doc') || titleLower.includes('doc')) {
      result.pageType = 'Documentation';
    } else if (urlLower.includes('support') || titleLower.includes('support')) {
      result.pageType = 'Support';
    } else if (urlLower.includes('about')) {
      result.pageType = 'About';
    } else if (urlLower.includes('contact')) {
      result.pageType = 'Contact';
    } else if (urlLower.includes('pricing')) {
      result.pageType = 'Pricing';
    } else if (urlLower.includes('blog')) {
      result.pageType = 'Blog';
    } else {
      result.pageType = 'Other';
    }
    
    return result;
    
  } catch (error) {
    throw new Error(`Failed to extract content: ${error.message}`);
  }
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
    const { url, extractors = ['content', 'metadata'] } = body;
    
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
    
    // Extract content
    const result = await extractPage(url, extractors);
    
    // Return results
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ...result,
        extractedAt: new Date().toISOString(),
        serverless: true
      })
    };
    
  } catch (error) {
    console.error('Extract error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Extraction failed', 
        message: error.message,
        serverless: true 
      })
    };
  }
};