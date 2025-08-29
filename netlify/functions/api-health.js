// Netlify Function: Health Check Endpoint
// Path: /.netlify/functions/api-health

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Return health status
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'healthy',
      version: '2.0.0',
      serverless: true,
      provider: 'Netlify Functions',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/.netlify/functions/api-health',
        scan: '/.netlify/functions/api-scan',
        extract: '/.netlify/functions/api-extract'
      }
    })
  };
};