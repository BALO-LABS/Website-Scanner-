# 🔗 RAG Data Collector API Endpoints

## 📋 **Current API Endpoints**

### **Base URL:** `http://localhost:3000` (Development)

---

## 🔐 **Authentication**
All protected endpoints require an API key in the request headers:
```http
X-API-Key: your-api-key-here
```

**Rate Limiting:** 100 requests per hour per IP

---

## 📊 **Core Endpoints**

### 1. **Health Check**
- **Endpoint:** `GET /api/health`
- **Authentication:** None required
- **Description:** Check API server status and uptime

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptime": 3600
}
```

---

### 2. **Start Website Scan**
- **Endpoint:** `POST /api/scan`
- **Authentication:** Required
- **Description:** Initiate a comprehensive website crawl and analysis

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

**Response:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "queued",
  "estimatedTime": 120,
  "message": "Scan queued for processing"
}
```

---

### 3. **Get Scan Status**
- **Endpoint:** `GET /api/scan/{scanId}/status`
- **Authentication:** Required
- **Description:** Check the progress of a running scan

**Response:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "progress": 75,
  "pagesScanned": 37,
  "message": "Scanning in progress",
  "url": "https://example.com"
}
```

**Status Values:** `queued`, `processing`, `completed`, `failed`

---

### 4. **Get Scan Results**
- **Endpoint:** `GET /api/scan/{scanId}/results`
- **Authentication:** Required
- **Description:** Retrieve completed scan results

**Response:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "domain": "example.com",
  "scanDate": "2024-08-26T10:30:00Z",
  "statistics": {
    "totalPages": 50,
    "avgQualityScore": 78,
    "pageTypes": {
      "FAQ": 12,
      "Documentation": 8,
      "Support": 6
    }
  },
  "pages": [...],
  "siteMap": {...}
}
```

---

### 5. **Extract Single URL**
- **Endpoint:** `POST /api/extract`
- **Authentication:** Required
- **Description:** Extract content from a single URL

**Request Body:**
```json
{
  "url": "https://example.com/faq",
  "extractors": ["qa", "content", "metadata"]
}
```

**Response:**
```json
{
  "url": "https://example.com/faq",
  "pageType": "FAQ",
  "qualityScore": 95,
  "content": "...",
  "qaPairs": [...],
  "metadata": {...}
}
```

---

### 6. **Export Scan Data**
- **Endpoint:** `POST /api/export`
- **Authentication:** Required
- **Description:** Export scan results in various formats

**Request Body:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "format": "json"
}
```

**Supported Formats:** `json`, `csv`, `markdown`, `xml`

**Response:** File download with appropriate content type

---

### 7. **Batch Scan**
- **Endpoint:** `POST /api/batch`
- **Authentication:** Required
- **Description:** Scan multiple URLs simultaneously (max 10)

**Request Body:**
```json
{
  "urls": [
    "https://example1.com",
    "https://example2.com",
    "https://example3.com"
  ],
  "options": {
    "maxPages": 20,
    "maxDepth": 2
  }
}
```

**Response:**
```json
{
  "batchId": "batch-550e8400-e29b-41d4-a716-446655440000",
  "jobs": [
    {
      "jobId": "job1-uuid",
      "url": "https://example1.com",
      "status": "queued"
    }
  ],
  "message": "Batch scan initiated for 3 URLs"
}
```

---

### 8. **Get Batch Status**
- **Endpoint:** `GET /api/batch/{batchId}/status`
- **Authentication:** Required
- **Description:** Check progress of batch scan jobs

**Response:**
```json
{
  "batchId": "batch-550e8400-e29b-41d4-a716-446655440000",
  "totalJobs": 3,
  "completed": 1,
  "failed": 0,
  "inProgress": 2,
  "jobs": [...]
}
```

---

## 🚀 **Proposed New Endpoints (Advanced Mapping Methods)**

Based on our advanced mapper implementation, here are additional endpoints that should be added:

### 9. **Advanced Analysis**
- **Endpoint:** `POST /api/analyze/advanced`
- **Description:** Run comprehensive analysis with all 42+ mapping methods

**Request Body:**
```json
{
  "url": "https://example.com",
  "methods": [
    "pagerank",
    "hits", 
    "community_detection",
    "broken_links",
    "redirect_chains",
    "technology_detection",
    "seo_analysis"
  ],
  "options": {
    "maxPages": 100,
    "timeout": 10000
  }
}
```

---

### 10. **JavaScript Rendering**
- **Endpoint:** `POST /api/render/javascript`
- **Description:** Extract dynamic content using Puppeteer

**Request Body:**
```json
{
  "url": "https://example.com",
  "waitFor": "networkidle2",
  "screenshot": true
}
```

---

### 11. **Technology Detection**
- **Endpoint:** `POST /api/detect/technology`
- **Description:** Identify CMS, frameworks, analytics

**Request Body:**
```json
{
  "url": "https://example.com"
}
```

**Response:**
```json
{
  "cms": "WordPress",
  "frameworks": ["React", "jQuery"],
  "analytics": ["Google Analytics"],
  "cdn": "Cloudflare",
  "server": "nginx"
}
```

---

### 12. **SEO Analysis**
- **Endpoint:** `POST /api/analyze/seo`
- **Description:** Comprehensive SEO audit

**Request Body:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000"
}
```

---

### 13. **Broken Links Check**
- **Endpoint:** `POST /api/check/broken-links`
- **Description:** Validate all links and find broken ones

---

### 14. **Performance Metrics**
- **Endpoint:** `GET /api/scan/{scanId}/performance`
- **Description:** Get detailed performance analysis

**Response:**
```json
{
  "totalPages": 50,
  "avgLoadTime": 1250,
  "slowestPages": [...],
  "fastestPages": [...],
  "errorRate": 2.5,
  "totalBytes": 15728640
}
```

---

### 15. **Visualization Data**
- **Endpoint:** `GET /api/scan/{scanId}/visualization`
- **Description:** Get data for charts and graphs

**Query Parameters:**
- `type`: `network`, `treemap`, `sunburst`, `heatmap`, `sankey`

**Response:**
```json
{
  "type": "network",
  "nodes": [...],
  "edges": [...],
  "metadata": {...}
}
```

---

### 16. **Change Detection**
- **Endpoint:** `POST /api/detect/changes`
- **Description:** Compare current content with previous scan

**Request Body:**
```json
{
  "url": "https://example.com",
  "previousScanId": "previous-scan-uuid"
}
```

---

### 17. **Community Detection**
- **Endpoint:** `GET /api/scan/{scanId}/communities`
- **Description:** Get page communities/clusters

---

### 18. **PageRank Scores**
- **Endpoint:** `GET /api/scan/{scanId}/pagerank`
- **Description:** Get PageRank analysis results

**Response:**
```json
{
  "topPages": [
    {
      "url": "https://example.com/",
      "score": 0.85
    }
  ],
  "algorithm": "pagerank",
  "iterations": 10
}
```

---

### 19. **HITS Analysis**
- **Endpoint:** `GET /api/scan/{scanId}/hits`
- **Description:** Get Hub and Authority scores

---

### 20. **Duplicate Content**
- **Endpoint:** `GET /api/scan/{scanId}/duplicates`
- **Description:** Find duplicate or similar content

---

## 📝 **Request/Response Examples**

### **Successful Response Format:**
```json
{
  "success": true,
  "data": {...},
  "timestamp": "2024-08-26T10:30:00Z"
}
```

### **Error Response Format:**
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2024-08-26T10:30:00Z"
}
```

---

## 🔧 **Implementation Status**

### ✅ **Currently Available (8 endpoints):**
- Health Check
- Start Scan
- Get Scan Status  
- Get Scan Results
- Extract Single URL
- Export Data
- Batch Scan
- Get Batch Status

### 🚧 **Should Be Added (12+ endpoints):**
- Advanced Analysis
- JavaScript Rendering
- Technology Detection
- SEO Analysis
- Broken Links Check
- Performance Metrics
- Visualization Data
- Change Detection
- Community Detection
- PageRank Scores
- HITS Analysis
- Duplicate Content Detection

---

## 💡 **Usage Examples**

### **Start a Scan:**
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "url": "https://example.com",
    "options": {
      "maxPages": 50,
      "maxDepth": 3
    }
  }'
```

### **Check Status:**
```bash
curl -X GET http://localhost:3000/api/scan/scan-id/status \
  -H "X-API-Key: your-api-key"
```

### **Get Results:**
```bash
curl -X GET http://localhost:3000/api/scan/scan-id/results \
  -H "X-API-Key: your-api-key"
```

---

## 🎯 **Summary**

**Current API:** 8 core endpoints for basic scanning and data export  
**Potential Expansion:** 20+ endpoints covering all advanced mapping methods  
**Architecture:** RESTful design with async job processing  
**Authentication:** API key-based with rate limiting  
**Data Formats:** JSON, CSV, Markdown, XML export support