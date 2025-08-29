# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RAG Data Collector - A dual-mode application for collecting and structuring website content for AI customer service agents. Available as both a browser-based web application and a RESTful API server. This is a defensive security/analysis tool for website auditing, content extraction, and RAG system training data collection.

## Commands

### Browser Application (dist/)
```bash
# Navigate to the dist folder
cd dist

# Start a local web server (Python 3)
python3 -m http.server 8000

# Or using Node.js
npx http-server -p 8000

# Or using PHP
php -S localhost:8000
```

### API Server (api/)
```bash
# Install dependencies
cd api
npm install

# Development with auto-reload
npm run dev

# Production server
npm start

# Run tests (if configured)
npm test
```

### Redis Setup (Required for API)
```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or install locally
brew install redis  # macOS
sudo apt-get install redis-server  # Ubuntu
```

### Docker Deployment
```bash
# Build and run with Docker Compose
docker-compose up

# Build manually
docker build -t rag-collector .
docker run -p 3000:3000 rag-collector
```

## Architecture

### Two Main Components

1. **Browser Application (dist/)**: Pure JavaScript web app that runs entirely client-side
2. **RESTful API Server (api/)**: Node.js/Express backend with Redis job queue

### Browser Application Structure

**Core Files:**
- `dist/index.html`: Main UI with embedded styles
- `dist/app.js`: Complete scanner logic with WebsiteScanner class
- `build_site.py`: Netlify deployment script
- `netlify.toml`: Netlify configuration

**WebsiteScanner Class (dist/app.js):**
- URL normalization and domain handling (handles www/non-www)
- Content extraction via CORS proxy services
- BFS crawling with depth tracking
- Page type classification (15+ categories for customer service content)
- Quality scoring for RAG suitability
- Visualization with Chart.js and vis.js
- Export to multiple formats (JSON, CSV, RAG, Markdown)

### API Server Structure

**Core Files:**
- `api/src/server.js`: Express server with routes and middleware
- `api/src/scanner.js`: Core scanning logic with content extraction
- `api/src/validators.js`: Input validation with Joi

**Key Components:**
- Bull job queue for async processing
- Redis for caching and job management
- Rate limiting (100 requests/hour by default)
- API key authentication
- Compression and security middleware (Helmet)

**API Endpoints:**
- `GET /api/health`: Health check
- `POST /api/scan`: Start website scan
- `GET /api/scan/:scanId/status`: Check scan status
- `GET /api/scan/:scanId/results`: Get scan results
- `POST /api/export`: Export in various formats

### Shared Design Patterns

- **Content Focus**: Prioritizes FAQ, documentation, support pages
- **Quality Scoring**: 0-100% score for RAG suitability
- **Smart Filtering**: Skips login, cart, user-specific pages
- **Rate Limiting**: Configurable delays to respect target servers
- **Export Formats**: RAG-optimized JSON, vector DB format, Markdown, CSV, XML

## Key Algorithms

### URL Processing
- Base domain extraction ignores www prefix
- Fragment removal and trailing slash normalization
- Skip patterns for files (.pdf, .jpg) and transactional pages (/cart, /login)
- Priority patterns for support content (/help, /faq, /docs)

### Content Extraction
- Q&A pair detection from FAQ pages
- Heading and paragraph structure preservation
- Metadata extraction (title, description, keywords)
- Quality scoring based on content length, structure, and relevance

### Page Classification
15+ categories including: FAQ, Documentation, Support, Tutorial, API Reference, Troubleshooting, Product Info, Pricing, About, Contact, Blog, Legal, Home, Unknown

## Dependencies

### Browser Application
- Chart.js (CDN): Doughnut charts for page distribution
- vis.js (CDN): Network graph visualization
- No build process required

### API Server
- express: Web framework
- axios: HTTP client
- cheerio: HTML parsing
- bull: Job queue
- redis: Caching and queue backend
- joi: Input validation
- helmet: Security headers
- winston: Logging
- dotenv: Environment configuration

## Environment Configuration (.env)

```bash
PORT=3000
NODE_ENV=development
REDIS_URL=redis://localhost:6379
API_KEY=your-api-key-here
RATE_LIMIT_MAX_REQUESTS=100
DEFAULT_MAX_PAGES=50
DEFAULT_MAX_DEPTH=3
DEFAULT_DELAY=500
```

## Testing

### Manual Testing Files
- `api/test-server.js`: API server tests
- `api/test-client.js`: Client integration tests
- `api/debug-crawler.js`: Crawler debugging
- `api/debug-extraction.js`: Content extraction tests
- `test-crawler-direct.js`: Direct crawler tests
- `test-chatbase.js`: Chatbase integration tests

## Deployment

### Netlify (Browser App)
Automatic deployment on git push. Configuration in `netlify.toml`.

### API Deployment Options
- Heroku: Use Heroku Redis addon
- Railway: Direct GitHub deployment
- Docker: Use docker-compose.yml
- AWS/GCP/Azure: Container with managed Redis

## Client Libraries

JavaScript client available at `client/api-client.js` with RAGCollectorClient class for easy API integration.

## Limitations

### Browser Application
- Requires CORS proxy for cross-origin requests
- Limited by browser memory (~50-100 pages)
- Cannot access authenticated content

### API Server
- Requires Redis for job processing
- Rate limited by default
- No built-in database (uses in-memory storage)