# 🗺️ Website Map & Sitemap API Endpoints

## 📋 **Website Map Retrieval Endpoints**

Here are all the ways to retrieve website maps, sitemaps, and site structure data from the API:

---

## **1. Get Complete Scan Results (Includes Sitemap)**
```http
GET /api/scan/{scanId}/results
```
**Headers:** `X-API-Key: your-api-key`

**Response:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "domain": "example.com",
  "scanDate": "2024-08-26T10:30:00Z",
  "statistics": {
    "totalPages": 50,
    "maxDepth": 3,
    "totalLinks": 127
  },
  "pages": [
    {
      "url": "https://example.com/",
      "title": "Homepage",
      "links": ["https://example.com/about", "https://example.com/products"],
      "depth": 0,
      "pageType": "Home"
    }
  ],
  "siteMap": {
    "structure": {
      "/": {
        "title": "Homepage",
        "children": ["/about", "/products", "/support"]
      },
      "/support": {
        "title": "Support Center", 
        "children": ["/support/faq", "/support/docs"]
      }
    }
  }
}
```

---

## **2. Get Dedicated Sitemap Data**
```http
GET /api/scan/{scanId}/sitemap?format={format}
```
**Headers:** `X-API-Key: your-api-key`  
**Query Params:** 
- `format`: `json` (default), `xml`, `txt`, `tree`

**JSON Response:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "domain": "example.com",
  "generatedAt": "2024-08-26T10:30:00Z",
  "structure": { ... },
  "pages": [ ... ],
  "statistics": {
    "totalPages": 50,
    "totalLinks": 127,
    "maxDepth": 3,
    "pageTypes": {
      "FAQ": 12,
      "Documentation": 8
    }
  }
}
```

**XML Response (format=xml):**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-08-26</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/about</loc>
    <lastmod>2024-08-26</lastmod>
    <priority>0.8</priority>
  </url>
</urlset>
```

---

## **3. Get Network Graph Data**
```http
GET /api/scan/{scanId}/network
```
**Headers:** `X-API-Key: your-api-key`

**Response:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "network",
  "nodes": [
    {
      "id": "https://example.com/",
      "label": "/",
      "pagerank": 0.85,
      "hub": 0.75,
      "authority": 0.90
    }
  ],
  "edges": [
    {
      "source": "https://example.com/",
      "target": "https://example.com/about"
    }
  ],
  "statistics": {
    "nodeCount": 50,
    "edgeCount": 127,
    "avgDegree": 2.54
  }
}
```

---

## **4. Get Hierarchical Tree Structure**
```http
GET /api/scan/{scanId}/tree
```
**Headers:** `X-API-Key: your-api-key`

**Response:**
```json
{
  "scanId": "550e8400-e29b-41d4-a716-446655440000",
  "type": "tree",
  "data": {
    "name": "root",
    "children": [
      {
        "name": "support",
        "children": [
          { "name": "faq", "value": 5 },
          { "name": "docs", "value": 8 }
        ]
      }
    ]
  },
  "statistics": {
    "totalNodes": 50,
    "maxDepth": 4,
    "branches": 8
  }
}
```

---

## **5. Generate Live Sitemap (No Full Scan Required)**
```http
POST /api/generate-sitemap
```
**Headers:** `X-API-Key: your-api-key`

**Request Body:**
```json
{
  "url": "https://example.com",
  "maxPages": 100,
  "format": "json"
}
```

**Response:**
```json
{
  "domain": "example.com",
  "generatedAt": "2024-08-26T10:30:00Z",
  "source": "sitemap",
  "urls": [
    {
      "url": "https://example.com/",
      "lastmod": "2024-08-26T10:30:00Z",
      "priority": 1.0
    },
    {
      "url": "https://example.com/about",
      "lastmod": "2024-08-26T10:30:00Z", 
      "priority": 0.8
    }
  ],
  "totalUrls": 47
}
```

---

## 🎯 **Usage Examples**

### **1. Get JSON Sitemap:**
```bash
curl -X GET "http://localhost:3000/api/scan/YOUR_SCAN_ID/sitemap" \
  -H "X-API-Key: your-api-key"
```

### **2. Download XML Sitemap:**
```bash
curl -X GET "http://localhost:3000/api/scan/YOUR_SCAN_ID/sitemap?format=xml" \
  -H "X-API-Key: your-api-key" \
  -o sitemap.xml
```

### **3. Get Tree View:**
```bash
curl -X GET "http://localhost:3000/api/scan/YOUR_SCAN_ID/sitemap?format=tree" \
  -H "X-API-Key: your-api-key"
```

### **4. Generate Quick Sitemap:**
```bash
curl -X POST "http://localhost:3000/api/generate-sitemap" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "url": "https://example.com",
    "maxPages": 50,
    "format": "xml"
  }'
```

### **5. Get Network Graph Data:**
```bash
curl -X GET "http://localhost:3000/api/scan/YOUR_SCAN_ID/network" \
  -H "X-API-Key: your-api-key"
```

---

## 📊 **Supported Formats**

| Format | Description | Use Case |
|--------|-------------|----------|
| `json` | Structured JSON data | APIs, web apps |
| `xml` | Standard XML sitemap | SEO, search engines |
| `txt` | Plain text URL list | Simple processing |
| `tree` | ASCII tree structure | Human-readable |

---

## 🛠️ **Implementation Status**

### ✅ **Available Endpoints:**
1. `GET /api/scan/{scanId}/results` - Complete scan data with sitemap
2. `GET /api/scan/{scanId}/sitemap` - Dedicated sitemap endpoint  
3. `GET /api/scan/{scanId}/network` - Network graph data
4. `GET /api/scan/{scanId}/tree` - Hierarchical tree structure
5. `POST /api/generate-sitemap` - Live sitemap generation

### 📈 **Data Formats:**
- **JSON** - Structured data with metadata
- **XML** - Standard sitemap.xml format
- **TXT** - Simple URL list
- **Tree** - ASCII tree visualization
- **Network Graph** - Nodes and edges for visualization

---

## 💡 **Quick Start Workflow**

1. **Start a scan:**
   ```bash
   curl -X POST http://localhost:3000/api/scan \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your-key" \
     -d '{"url": "https://example.com"}'
   ```

2. **Wait for completion:**
   ```bash
   curl -X GET http://localhost:3000/api/scan/SCAN_ID/status \
     -H "X-API-Key: your-key"
   ```

3. **Get website map:**
   ```bash
   curl -X GET http://localhost:3000/api/scan/SCAN_ID/sitemap \
     -H "X-API-Key: your-key"
   ```

**Alternative for quick sitemap:**
```bash
curl -X POST http://localhost:3000/api/generate-sitemap \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"url": "https://example.com", "format": "xml"}'
```

---

## 🎉 **Summary**

You now have **5 different endpoints** to retrieve website maps and sitemaps:

1. **Full scan results** (includes everything)
2. **Dedicated sitemap** (multiple formats) 
3. **Network graph** (for visualizations)
4. **Tree structure** (hierarchical view)
5. **Live generation** (quick sitemap without full scan)

All endpoints support JSON format, with additional XML, TXT, and Tree formats available for sitemaps!