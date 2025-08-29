# 🧪 API Testing Guide

## 📦 Testing Methods Overview

### 1. **Postman** (Recommended for GUI Testing)
### 2. **cURL** (Command Line)
### 3. **Node.js Test Script**
### 4. **Thunder Client** (VS Code Extension)
### 5. **Insomnia** (Alternative to Postman)

---

## 🚀 Quick Start

### Prerequisites
```bash
# 1. Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# 2. Install dependencies
cd api
npm install

# 3. Create .env file
echo "PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
API_KEY=test-api-key-123
RATE_LIMIT_MAX_REQUESTS=100
DEFAULT_MAX_PAGES=50
DEFAULT_MAX_DEPTH=3
DEFAULT_DELAY=500" > .env

# 4. Start the API server
npm run dev
```

---

## 📮 Postman Testing

### Setup Postman Collection

1. **Create New Collection**: "RAG Collector API"

2. **Add Variables** (Collection Variables):
```
baseUrl: http://localhost:3000
apiKey: test-api-key-123
scanId: (will be set dynamically)
```

3. **Add Pre-request Script** (Collection Level):
```javascript
// Add API key to all requests
pm.request.headers.add({
    key: 'X-API-Key',
    value: pm.collectionVariables.get('apiKey')
});

// Add Content-Type for POST requests
if (pm.request.method === 'POST') {
    pm.request.headers.add({
        key: 'Content-Type',
        value: 'application/json'
    });
}
```

### Postman Test Requests

#### 1. Health Check
```
Method: GET
URL: {{baseUrl}}/api/health

Tests:
pm.test("Status is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has required fields", function () {
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('status');
    pm.expect(jsonData.status).to.eql('healthy');
});
```

#### 2. Start Scan
```
Method: POST
URL: {{baseUrl}}/api/scan

Body (raw JSON):
{
    "url": "https://example.com",
    "options": {
        "maxPages": 10,
        "maxDepth": 2,
        "delay": 500,
        "minQualityScore": 30,
        "includeContent": true
    }
}

Tests:
pm.test("Scan initiated successfully", function () {
    pm.response.to.have.status(200);
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('scanId');
    // Save scanId for next requests
    pm.collectionVariables.set("scanId", jsonData.scanId);
});
```

#### 3. Check Scan Status
```
Method: GET
URL: {{baseUrl}}/api/scan/{{scanId}}/status

Tests:
pm.test("Status retrieved successfully", function () {
    pm.response.to.have.status(200);
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('status');
    console.log("Scan status:", jsonData.status);
});
```

#### 4. Get Scan Results
```
Method: GET
URL: {{baseUrl}}/api/scan/{{scanId}}/results

Tests:
pm.test("Results retrieved successfully", function () {
    pm.response.to.have.status(200);
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('pages');
    pm.expect(jsonData.pages).to.be.an('array');
});
```

#### 5. Extract Single URL
```
Method: POST
URL: {{baseUrl}}/api/extract

Body:
{
    "url": "https://example.com/faq",
    "extractors": ["qa", "content", "metadata"]
}

Tests:
pm.test("Content extracted successfully", function () {
    pm.response.to.have.status(200);
    const jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('content');
});
```

#### 6. Export Data
```
Method: POST
URL: {{baseUrl}}/api/export

Body:
{
    "scanId": "{{scanId}}",
    "format": "json"
}

Tests:
pm.test("Export successful", function () {
    pm.response.to.have.status(200);
});
```

---

## 🖥️ cURL Examples

### Basic Health Check
```bash
curl http://localhost:3000/api/health
```

### Start a Scan
```bash
curl -X POST http://localhost:3000/api/scan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key-123" \
  -d '{
    "url": "https://example.com",
    "options": {
      "maxPages": 10,
      "maxDepth": 2
    }
  }'
```

### Check Status (replace SCAN_ID)
```bash
curl http://localhost:3000/api/scan/SCAN_ID/status \
  -H "X-API-Key: test-api-key-123"
```

### Get Results
```bash
curl http://localhost:3000/api/scan/SCAN_ID/results \
  -H "X-API-Key: test-api-key-123"
```

### Extract Single Page
```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -H "X-API-Key: test-api-key-123" \
  -d '{
    "url": "https://example.com/about",
    "extractors": ["content", "metadata"]
  }'
```

---

## 📝 Node.js Test Script

Create `test-api.js`:

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000';
const API_KEY = 'test-api-key-123';

// Create axios instance with default headers
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
  }
});

async function runTests() {
  try {
    console.log('🧪 Starting API Tests\n');
    
    // 1. Health Check
    console.log('1. Testing Health Check...');
    const health = await api.get('/api/health');
    console.log('✅ Health:', health.data);
    
    // 2. Start Scan
    console.log('\n2. Starting Website Scan...');
    const scanResponse = await api.post('/api/scan', {
      url: 'https://example.com',
      options: {
        maxPages: 5,
        maxDepth: 1
      }
    });
    const scanId = scanResponse.data.scanId;
    console.log('✅ Scan ID:', scanId);
    
    // 3. Check Status (with retry)
    console.log('\n3. Checking Scan Status...');
    let status;
    let attempts = 0;
    do {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const statusResponse = await api.get(`/api/scan/${scanId}/status`);
      status = statusResponse.data.status;
      console.log(`   Attempt ${++attempts}: ${status}`);
    } while (status === 'processing' && attempts < 10);
    
    // 4. Get Results
    if (status === 'completed') {
      console.log('\n4. Getting Results...');
      const results = await api.get(`/api/scan/${scanId}/results`);
      console.log('✅ Pages found:', results.data.pages.length);
      console.log('   Statistics:', results.data.statistics);
    }
    
    // 5. Test Single URL Extraction
    console.log('\n5. Testing Single URL Extraction...');
    const extracted = await api.post('/api/extract', {
      url: 'https://example.com',
      extractors: ['content', 'metadata']
    });
    console.log('✅ Extracted:', {
      title: extracted.data.title,
      contentLength: extracted.data.content?.text?.length
    });
    
    console.log('\n✨ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

runTests();
```

Run with:
```bash
node test-api.js
```

---

## ⚡ Thunder Client (VS Code)

### Installation
1. Install Thunder Client extension in VS Code
2. Create New Collection: "RAG Collector"

### Environment Variables
```json
{
  "baseUrl": "http://localhost:3000",
  "apiKey": "test-api-key-123",
  "scanId": ""
}
```

### Sample Requests

#### Health Check
```
GET {{baseUrl}}/api/health
```

#### Start Scan
```
POST {{baseUrl}}/api/scan
Headers:
  X-API-Key: {{apiKey}}
  Content-Type: application/json

Body:
{
  "url": "https://example.com",
  "options": {
    "maxPages": 10
  }
}
```

---

## 🔄 Automated Testing Script

Create `run-all-tests.sh`:

```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000"
API_KEY="test-api-key-123"

echo "🧪 RAG Collector API Test Suite"
echo "================================"

# 1. Health Check
echo -e "\n${GREEN}Test 1: Health Check${NC}"
curl -s "$API_URL/api/health" | jq '.'

# 2. Start Scan
echo -e "\n${GREEN}Test 2: Start Scan${NC}"
SCAN_RESPONSE=$(curl -s -X POST "$API_URL/api/scan" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","options":{"maxPages":5}}')

SCAN_ID=$(echo $SCAN_RESPONSE | jq -r '.scanId')
echo "Scan ID: $SCAN_ID"

# 3. Check Status
echo -e "\n${GREEN}Test 3: Check Status${NC}"
sleep 2
curl -s "$API_URL/api/scan/$SCAN_ID/status" \
  -H "X-API-Key: $API_KEY" | jq '.'

# 4. Extract Single URL
echo -e "\n${GREEN}Test 4: Extract Single URL${NC}"
curl -s -X POST "$API_URL/api/extract" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","extractors":["content"]}' | jq '.title'

echo -e "\n✅ All tests completed!"
```

Make executable and run:
```bash
chmod +x run-all-tests.sh
./run-all-tests.sh
```

---

## 🐛 Common Issues & Solutions

### Issue 1: Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**Solution**: Ensure API server is running with `npm run dev`

### Issue 2: Redis Connection Error
```
Error: Redis connection to localhost:6379 failed
```
**Solution**: Start Redis with Docker or install locally

### Issue 3: API Key Invalid
```
Error: Invalid API key
```
**Solution**: Check .env file has correct API_KEY value

### Issue 4: Rate Limit Exceeded
```
Error: Too many requests
```
**Solution**: Wait or increase RATE_LIMIT_MAX_REQUESTS in .env

---

## 📊 Load Testing

### Using Apache Bench (ab)
```bash
# Test 100 requests with 10 concurrent
ab -n 100 -c 10 -H "X-API-Key: test-api-key-123" http://localhost:3000/api/health
```

### Using Artillery
```yaml
# artillery.yml
config:
  target: "http://localhost:3000"
  phases:
    - duration: 60
      arrivalRate: 10
  defaults:
    headers:
      X-API-Key: "test-api-key-123"

scenarios:
  - name: "Health Check"
    flow:
      - get:
          url: "/api/health"
```

Run with:
```bash
npm install -g artillery
artillery run artillery.yml
```

---

## 🎯 Testing Checklist

- [ ] API server starts without errors
- [ ] Redis connection established
- [ ] Health endpoint returns 200
- [ ] Scan can be initiated
- [ ] Scan status updates correctly
- [ ] Results are retrievable
- [ ] Single URL extraction works
- [ ] Export functionality works
- [ ] Rate limiting enforced
- [ ] API key authentication works
- [ ] Error responses are proper JSON
- [ ] Concurrent requests handled
- [ ] Large website scan completes

---

## 📚 Additional Resources

- [Postman Documentation](https://learning.postman.com/docs/)
- [Thunder Client Guide](https://github.com/rangav/thunder-client-support)
- [cURL Manual](https://curl.se/docs/manual.html)
- [Artillery Load Testing](https://artillery.io/docs/)