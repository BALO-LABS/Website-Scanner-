// Netlify Function: Simple Page Extraction
// Path: /.netlify/functions/api-extract-simple
// Uses built-in fetch API - no external dependencies

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

const API_KEY = process.env.API_KEY || 'test-api-key';

// Extract content without dependencies
async function extractPage(url, extractors = ['content', 'metadata']) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAGCollectorBot/1.0)'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    const result = { url };
    
    // Extract metadata
    if (extractors.includes('metadata')) {
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      result.title = titleMatch ? titleMatch[1].trim() : '';
      
      const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
      result.description = descMatch ? descMatch[1].trim() : '';
      
      const keywordsMatch = html.match(/<meta\s+name=["']keywords["']\s+content=["']([^"']+)["']/i);
      result.keywords = keywordsMatch ? keywordsMatch[1].trim() : '';
    }
    
    // Extract content
    if (extractors.includes('content')) {
      // Remove scripts and styles
      const cleanHtml = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, '');
      
      // Extract headings
      const headings = [];
      const h1Matches = cleanHtml.match(/<h1[^>]*>([^<]+)<\/h1>/gi) || [];
      const h2Matches = cleanHtml.match(/<h2[^>]*>([^<]+)<\/h2>/gi) || [];
      const h3Matches = cleanHtml.match(/<h3[^>]*>([^<]+)<\/h3>/gi) || [];
      
      [...h1Matches, ...h2Matches, ...h3Matches].forEach(match => {
        const text = match.replace(/<[^>]+>/g, '').trim();
        if (text) headings.push(text);
      });
      
      // Extract paragraphs
      const paragraphs = [];
      const pMatches = cleanHtml.match(/<p[^>]*>([^<]+)<\/p>/gi) || [];
      pMatches.forEach(match => {
        const text = match.replace(/<[^>]+>/g, '').trim();
        if (text && text.length > 30) paragraphs.push(text);
      });
      
      // Get text content
      const textContent = cleanHtml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000);
      
      result.content = {
        headings: headings.slice(0, 10),
        paragraphs: paragraphs.slice(0, 10),
        text: textContent
      };
    }
    
    // Extract Q&A pairs
    if (extractors.includes('qa')) {
      const qaPairs = [];
      
      // Look for FAQ patterns
      const faqMatches = html.match(/<h[2-4][^>]*>([^<]*\?[^<]*)<\/h[2-4]>\s*<[^>]+>([^<]+)</gi) || [];
      faqMatches.forEach(match => {
        const parts = match.split(/<\/h[2-4]>/i);
        if (parts.length === 2) {
          const question = parts[0].replace(/<[^>]+>/g, '').trim();
          const answer = parts[1].replace(/<[^>]+>/g, '').trim();
          if (question && answer) {
            qaPairs.push({ question, answer });
          }
        }
      });
      
      result.qaPairs = qaPairs.slice(0, 10);
    }
    
    // Calculate quality score
    let qualityScore = 0;
    if (result.title) qualityScore += 20;
    if (result.description) qualityScore += 20;
    if (result.content?.headings?.length > 0) qualityScore += 20;
    if (result.content?.paragraphs?.length > 2) qualityScore += 20;
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