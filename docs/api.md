# RAG Collector API Documentation

## Overview

The RAG Collector API provides endpoints for crawling websites and extracting structured content optimized for Retrieval-Augmented Generation (RAG) systems and AI customer service training.

## Base URL

```
https://api.ragcollector.com
```

For local development:
```
http://localhost:3000
```

## Authentication

All API requests require an API key to be included in the request headers:

```
X-API-Key: your-api-key-here
```

## Rate Limiting

- **Default:** 100 requests per hour per API key
- **Response Headers:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Time when the limit resets (Unix timestamp)

## Endpoints

### 1. Health Check

Check API health status.

**Endpoint:** `GET /api/health`

**Authentication:** Not required

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600
}
```

### 2. Start Website Scan

Initiate a crawl of a website.

**Endpoint:** `POST /api/scan`

**Request Body:**
```json
{
  "url": "https://example.com",
  "options": {
    "maxPages": 50,
    "maxDepth": 3,
    "delay": 500,
    "minQualityScore": 30,
    "pageTypes": ["FAQ", "Documentation", "Support"],
    "includeContent": true
  }
}
```

**Parameters:**
- `url` (required): The website URL to scan
- `options` (optional):
  - `maxPages`: Maximum number of pages to scan (1-500, default: 50)
  - `maxDepth`: Maximum crawl depth (1-10, default: 3)
  - `delay`: Delay between requests in milliseconds (100-5000, default: 500)
  - `minQualityScore`: Minimum quality score to include pages (0-100, default: 30)
  - `pageTypes`: Array of page types to prioritize (optional)
  - `includeContent`: Include full content in results (default: true)

**Response:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "estimatedTime": 120,
  "message": "Scan queued for processing"
}
```

### 3. Get Scan Status

Check the status of a running or completed scan.

**Endpoint:** `GET /api/scan/:scanId/status`

**Response:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 45,
  "pagesScanned": 23,
  "message": "Scanning: https://example.com/docs/...",
  "url": "https://example.com"
}
```

**Status Values:**
- `queued`: Scan is waiting to be processed
- `processing`: Scan is currently running
- `completed`: Scan finished successfully
- `failed`: Scan encountered an error

### 4. Get Scan Results

Retrieve the results of a completed scan.

**Endpoint:** `GET /api/scan/:scanId/results`

**Response:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "domain": "example.com",
  "scanDate": "2024-01-15T10:30:00Z",
  "statistics": {
    "totalPages": 45,
    "totalQA": 125,
    "totalWords": 45000,
    "avgQualityScore": 75,
    "faqPages": 5,
    "docsPages": 12,
    "avgWordsPerPage": 1000
  },
  "pages": [
    {
      "url": "https://example.com/faq",
      "title": "Frequently Asked Questions",
      "pageType": "FAQ",
      "qualityScore": 95,
      "wordCount": 2500,
      "qaItems": [
        {
          "question": "What is your return policy?",
          "answer": "We offer a 30-day return policy..."
        }
      ],
      "content": {
        "text": "Full page text content...",
        "paragraphs": ["paragraph1", "paragraph2"]
      },
      "metadata": {
        "description": "Common questions about our service",
        "keywords": "faq, help, support"
      }
    }
  ],
  "siteMap": {
    "https://example.com": { /* page data */ }
  }
}
```

### 5. Extract Content from Single URL

Extract content from a single URL without full crawling.

**Endpoint:** `POST /api/extract`

**Request Body:**
```json
{
  "url": "https://example.com/faq",
  "extractors": ["qa", "content", "metadata", "schema", "structure"]
}
```

**Parameters:**
- `url` (required): The URL to extract content from
- `extractors` (optional): Array of extractors to use
  - `qa`: Extract Q&A pairs
  - `content`: Extract full text content
  - `metadata`: Extract meta tags
  - `schema`: Extract schema.org data
  - `structure`: Extract headings and structured data

**Response:**
```json
{
  "url": "https://example.com/faq",
  "title": "FAQ - Example Company",
  "qaItems": [
    {
      "question": "Question text",
      "answer": "Answer text"
    }
  ],
  "content": {
    "text": "Full page text",
    "paragraphs": ["paragraph1", "paragraph2"]
  },
  "metadata": {
    "description": "Page description",
    "keywords": "keywords"
  }
}
```

### 6. Export Scan Results

Export scan results in various formats.

**Endpoint:** `POST /api/export`

**Request Body:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "format": "rag"
}
```

**Parameters:**
- `scanId` (required): The scan ID to export
- `format` (optional): Export format
  - `rag`: Optimized JSON for RAG systems (default)
  - `markdown`: Markdown documentation
  - `vectordb`: Format for vector databases
  - `csv`: CSV spreadsheet
  - `xml`: XML sitemap
  - `json`: Raw JSON data

**Response:**
Returns the exported data with appropriate content-type header and file download.

### 7. Batch Scan

Scan multiple URLs in a batch.

**Endpoint:** `POST /api/batch`

**Request Body:**
```json
{
  "urls": [
    "https://example1.com",
    "https://example2.com",
    "https://example3.com"
  ],
  "options": {
    "maxPages": 30,
    "maxDepth": 2
  }
}
```

**Parameters:**
- `urls` (required): Array of URLs to scan (max 10)
- `options` (optional): Same as single scan options

**Response:**
```json
{
  "batchId": "batch-550e8400",
  "jobs": [
    {
      "jobId": "job-1",
      "url": "https://example1.com",
      "status": "queued"
    },
    {
      "jobId": "job-2",
      "url": "https://example2.com",
      "status": "queued"
    }
  ],
  "message": "Batch scan initiated for 2 URLs"
}
```

### 8. Get Batch Status

Check the status of a batch scan.

**Endpoint:** `GET /api/batch/:batchId/status`

**Response:**
```json
{
  "batchId": "batch-550e8400",
  "totalJobs": 3,
  "completed": 2,
  "failed": 0,
  "inProgress": 1,
  "jobs": [
    {
      "jobId": "job-1",
      "url": "https://example1.com",
      "status": "completed",
      "progress": 100
    },
    {
      "jobId": "job-2",
      "url": "https://example2.com",
      "status": "processing",
      "progress": 45
    }
  ]
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message",
  "details": "Additional error details (in development mode)"
}
```

**Common HTTP Status Codes:**
- `200 OK`: Request successful
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid API key
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Export Formats

### RAG Format

Optimized for AI/ML systems with pre-chunked content:

```json
{
  "source": "example.com",
  "crawlDate": "2024-01-15T10:30:00Z",
  "totalPages": 45,
  "documents": [
    {
      "id": "example_com_faq",
      "url": "https://example.com/faq",
      "title": "FAQ",
      "type": "FAQ",
      "content": "Full text content",
      "chunks": [
        "Chunk 1 text",
        "Chunk 2 text",
        "Question: Q1\nAnswer: A1"
      ],
      "metadata": {
        "description": "Page description",
        "keywords": "keywords",
        "pageType": "FAQ",
        "qualityScore": 95,
        "wordCount": 2500,
        "qaCount": 10
      }
    }
  ]
}
```

### Vector Database Format

Ready for embedding generation:

```json
{
  "source": "example.com",
  "exportDate": "2024-01-15T10:30:00Z",
  "totalVectors": 150,
  "vectors": [
    {
      "id": "url_chunk_0",
      "text": "Text content for embedding",
      "metadata": {
        "url": "https://example.com/page",
        "title": "Page Title",
        "pageType": "Documentation",
        "chunkIndex": 0
      }
    }
  ]
}
```

## Usage Examples

### cURL

```bash
# Start a scan
curl -X POST https://api.ragcollector.com/api/scan \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://example.com",
    "options": {
      "maxPages": 50,
      "pageTypes": ["FAQ", "Documentation"]
    }
  }'

# Check status
curl https://api.ragcollector.com/api/scan/550e8400/status \
  -H "X-API-Key: your-api-key"

# Get results
curl https://api.ragcollector.com/api/scan/550e8400/results \
  -H "X-API-Key: your-api-key"

# Export for RAG
curl -X POST https://api.ragcollector.com/api/export \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "scanId": "550e8400",
    "format": "rag"
  }' \
  -o rag-data.json
```

### JavaScript

```javascript
const apiKey = 'your-api-key';
const baseUrl = 'https://api.ragcollector.com';

// Start scan
async function startScan(url) {
  const response = await fetch(`${baseUrl}/api/scan`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      url,
      options: {
        maxPages: 50,
        pageTypes: ['FAQ', 'Documentation']
      }
    })
  });
  
  return response.json();
}

// Poll for results
async function waitForResults(scanId) {
  let status;
  
  do {
    const response = await fetch(`${baseUrl}/api/scan/${scanId}/status`, {
      headers: { 'X-API-Key': apiKey }
    });
    status = await response.json();
    
    console.log(`Progress: ${status.progress}%`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  } while (status.status === 'processing');
  
  if (status.status === 'completed') {
    const response = await fetch(`${baseUrl}/api/scan/${scanId}/results`, {
      headers: { 'X-API-Key': apiKey }
    });
    return response.json();
  }
  
  throw new Error('Scan failed');
}

// Usage
startScan('https://example.com')
  .then(({ scanId }) => waitForResults(scanId))
  .then(results => console.log(results))
  .catch(error => console.error(error));
```

### Python

```python
import requests
import time

API_KEY = 'your-api-key'
BASE_URL = 'https://api.ragcollector.com'

headers = {'X-API-Key': API_KEY}

# Start scan
response = requests.post(
    f'{BASE_URL}/api/scan',
    headers=headers,
    json={
        'url': 'https://example.com',
        'options': {
            'maxPages': 50,
            'pageTypes': ['FAQ', 'Documentation']
        }
    }
)

scan_data = response.json()
scan_id = scan_data['scanId']

# Poll for completion
while True:
    response = requests.get(
        f'{BASE_URL}/api/scan/{scan_id}/status',
        headers=headers
    )
    status = response.json()
    
    print(f"Progress: {status['progress']}%")
    
    if status['status'] == 'completed':
        break
    elif status['status'] == 'failed':
        raise Exception('Scan failed')
    
    time.sleep(5)

# Get results
response = requests.get(
    f'{BASE_URL}/api/scan/{scan_id}/results',
    headers=headers
)
results = response.json()

# Export for RAG
response = requests.post(
    f'{BASE_URL}/api/export',
    headers=headers,
    json={
        'scanId': scan_id,
        'format': 'rag'
    }
)

with open('rag-data.json', 'w') as f:
    f.write(response.text)
```

## Best Practices

1. **Rate Limiting**: Respect rate limits to avoid being blocked
2. **Delay Configuration**: Use appropriate delays (500-1000ms) to avoid overwhelming target servers
3. **Page Limits**: Start with smaller page limits for testing
4. **Quality Filtering**: Use minQualityScore to filter out low-value content
5. **Page Type Targeting**: Specify pageTypes to focus on relevant content
6. **Batch Processing**: Use batch endpoint for multiple sites
7. **Error Handling**: Implement proper error handling and retries
8. **Progress Monitoring**: Poll status endpoint to track long-running scans

## Support

For issues, questions, or feature requests, please contact support or open an issue on GitHub.