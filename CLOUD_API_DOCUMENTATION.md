# 🌐 Cloud API Documentation

## ✅ **API Server URL: https://websitescanner.netlify.app**

The RAG Collector API is now **fully deployed on Netlify** as serverless functions! No local server required.

---

## 🚀 **Live Endpoints**

### Base URL
```
https://websitescanner.netlify.app
```

### Available Endpoints

#### 1. **Health Check**
```bash
GET https://websitescanner.netlify.app/api/health
```

**Example:**
```bash
curl https://websitescanner.netlify.app/api/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "serverless": true,
  "provider": "Netlify Functions",
  "endpoints": {
    "health": "/.netlify/functions/api-health",
    "scan": "/.netlify/functions/api-scan",
    "extract": "/.netlify/functions/api-extract"
  }
}
```

---

#### 2. **Scan Website**
```bash
POST https://websitescanner.netlify.app/api/scan
```

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: test-api-key`

**Body:**
```json
{
  "url": "https://balolabs.com",
  "options": {
    "maxPages": 5,
    "maxDepth": 1
  }
}
```

**Example:**
```bash
curl -X POST https://websitescanner.netlify.app/api/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key" \
  -d '{
    "url": "https://balolabs.com",
    "options": {"maxPages": 3}
  }'
```

**Response:**
```json
{
  "success": true,
  "scanId": "scan-1756493269170-5y0kg6k9f",
  "domain": "balolabs.com",
  "status": "completed",
  "statistics": {
    "totalPages": 3,
    "avgQualityScore": 75
  },
  "pages": [...]
}
```

---

#### 3. **Extract Page Content**
```bash
POST https://websitescanner.netlify.app/api/extract
```

**Headers:**
- `Content-Type: application/json`
- `X-API-Key: test-api-key`

**Body:**
```json
{
  "url": "https://example.com/about",
  "extractors": ["content", "metadata", "qa"]
}
```

**Example:**
```bash
curl -X POST https://websitescanner.netlify.app/api/extract \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key" \
  -d '{
    "url": "https://balolabs.com/about-us",
    "extractors": ["content", "metadata"]
  }'
```

---

## 🔑 **Authentication**

Default API Key: `test-api-key`

To use a custom API key:
1. Set environment variable in Netlify dashboard
2. Go to Site Settings → Environment Variables
3. Add: `API_KEY = your-custom-key`

---

## ⚡ **Serverless Limitations**

Due to Netlify Functions constraints:
- **10-second timeout**: Scans are limited to quick operations
- **Max pages**: 5 pages per scan (optimized for speed)
- **No Redis**: Uses in-memory processing (stateless)
- **Synchronous only**: Results returned immediately

---

## 🎯 **Testing with Different URLs**

### Quick Test Script
```javascript
// test-cloud-api.js
const API_BASE = 'https://websitescanner.netlify.app';
const API_KEY = 'test-api-key';

async function testAPI(url) {
  const response = await fetch(`${API_BASE}/api/scan`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      url: url,
      options: { maxPages: 3 }
    })
  });
  
  const data = await response.json();
  console.log(`Scanned ${url}:`, data.statistics);
}

// Test multiple sites
testAPI('https://balolabs.com');
testAPI('https://example.com');
testAPI('https://nodejs.org');
```

### Using the Web Interface
1. Visit: https://websitescanner.netlify.app
2. The interface auto-detects Netlify deployment
3. All endpoints work without local server
4. Try different URLs in the "Start Scan" section

---

## 📊 **Comparison: Local vs Cloud**

| Feature | Local API | Cloud API (Netlify) |
|---------|-----------|-------------------|
| **URL** | `http://localhost:3000` | `https://websitescanner.netlify.app` |
| **Setup Required** | Redis + Node.js | None |
| **Max Pages** | Unlimited | 5 pages |
| **Timeout** | None | 10 seconds |
| **Async Jobs** | ✅ Yes | ❌ No |
| **Cost** | Free (self-hosted) | Free (100GB/month) |
| **Availability** | When running locally | 24/7 |
| **CORS** | May need config | ✅ Enabled |

---

## 🌟 **Benefits of Cloud Deployment**

1. **Zero Setup**: Works immediately, no installation
2. **Always Available**: 24/7 uptime on Netlify CDN
3. **Global Access**: Available from anywhere
4. **HTTPS Secure**: SSL certificate included
5. **Auto-scaling**: Handles traffic automatically
6. **Free Tier**: 125,000 function requests/month

---

## 🛠️ **Advanced Configuration**

### Custom Environment Variables
In Netlify Dashboard → Site Settings → Environment Variables:
```
API_KEY=your-secure-key
MAX_PAGES=10
DEFAULT_TIMEOUT=8000
```

### Rate Limiting
Netlify automatically handles rate limiting:
- 125,000 requests/month (free tier)
- ~4,000 requests/day
- ~170 requests/hour

---

## 📈 **Usage Examples**

### Python
```python
import requests

response = requests.post(
    'https://websitescanner.netlify.app/api/scan',
    headers={'X-API-Key': 'test-api-key'},
    json={'url': 'https://balolabs.com'}
)
print(response.json())
```

### Node.js
```javascript
const axios = require('axios');

axios.post('https://websitescanner.netlify.app/api/scan', {
  url: 'https://balolabs.com'
}, {
  headers: { 'X-API-Key': 'test-api-key' }
}).then(res => console.log(res.data));
```

### cURL
```bash
curl -X POST https://websitescanner.netlify.app/api/scan \
  -H "X-API-Key: test-api-key" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://balolabs.com"}'
```

---

## ✅ **Summary**

The API is now **fully cloud-hosted** on Netlify at:

**`https://websitescanner.netlify.app`**

- No local setup required
- Works directly from the browser
- Serverless architecture
- Free to use
- Perfect for testing and development

Visit https://websitescanner.netlify.app to start using the API immediately!