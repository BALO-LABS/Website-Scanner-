# RAG Data Collector 🤖

A powerful tool for collecting and structuring website content for AI customer service agents. Available as both a browser-based application and a RESTful API.

## 🎯 Purpose

Extract FAQ, documentation, and support content from websites to train Retrieval-Augmented Generation (RAG) systems and AI customer service agents.

## 🚀 Two Ways to Use

### 1. Browser-Based Application
A fully client-side web application that runs in your browser.

### 2. RESTful API
A scalable Node.js API for programmatic access and integration.

## Features

- 🔍 **Smart Content Extraction**: Automatically identifies and extracts Q&A pairs, documentation, and support content
- 📊 **Quality Scoring**: Rates content quality (0-100%) for RAG suitability
- 🎯 **Page Classification**: 15+ categories focused on customer service content
- 💾 **Multiple Export Formats**: RAG-optimized JSON, Markdown, Vector DB, CSV, XML
- 🗺️ **Site Mapping**: Visual network graphs and hierarchical sitemaps
- ⚡ **Async Processing**: Queue-based architecture for handling large sites
- 🔒 **API Authentication**: Secure API access with rate limiting

## 📱 Browser Application

### Live Demo

Visit the deployed application at your Netlify URL.

### Local Development

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/BALO-LABS/Website-Scanner-.git
cd Website-Scanner-
```

2. Start a local web server:
```bash
cd dist
python3 -m http.server 8000
# Or use Node.js: npx http-server -p 8000
```

3. Open your browser and navigate to `http://localhost:8000`

## 🖥️ API Server

### Quick Start

1. Install dependencies:
```bash
cd api
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start Redis (required for job queue):
```bash
# Using Docker
docker run -d -p 6379:6379 redis:7-alpine

# Or install locally
brew install redis  # macOS
sudo apt-get install redis-server  # Ubuntu
```

4. Start the API server:
```bash
npm start  # Production
npm run dev  # Development with auto-reload
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up

# Or build manually
docker build -t rag-collector .
docker run -p 3000:3000 rag-collector
```

### API Usage

```javascript
const client = new RAGCollectorClient('your-api-key');

// Scan a website
const results = await client.scanAndWait('https://example.com', {
  maxPages: 50,
  pageTypes: ['FAQ', 'Documentation'],
  minQualityScore: 40
});

// Export for RAG
const ragData = await client.export(results.scanId, 'rag');
```

See [API Documentation](docs/api.md) for complete endpoint reference.

## 📊 Export Formats

### RAG Format (Optimized for AI)
```json
{
  "documents": [{
    "id": "unique_id",
    "url": "page_url",
    "content": "full_text",
    "chunks": ["paragraph1", "paragraph2"],
    "metadata": {
      "pageType": "FAQ",
      "qualityScore": 95,
      "qaCount": 10
    }
  }]
}
```

### Vector Database Format
Ready for embedding generation and similarity search.

### Markdown Format
Clean documentation format for human reading.

## 🛠️ Technology Stack

### Browser Application
- **Pure JavaScript**: No framework dependencies
- **vis.js**: Network graph visualization
- **HTML5/CSS3**: Modern web standards
- **Netlify**: Automatic deployment

### API Server
- **Node.js & Express**: RESTful API
- **Redis & Bull**: Job queue for async processing
- **Cheerio**: HTML parsing
- **Axios**: HTTP requests
- **Docker**: Containerization

## 📦 Deployment

The application is configured for automatic deployment to Netlify:

1. Fork or clone this repository
2. Connect your GitHub repository to Netlify
3. Netlify will automatically detect the configuration and deploy
4. Your site will be live at your Netlify URL

## Limitations

Due to browser security policies (CORS):
- Requires proxy services for cross-origin requests
- Some websites may block proxy requests
- Cannot access authenticated content
- Limited by browser memory for very large crawls

### API Deployment Options

#### Option 1: Heroku
```bash
heroku create rag-collector-api
heroku addons:create heroku-redis:hobby-dev
git push heroku main
```

#### Option 2: Railway
Deploy directly from GitHub with automatic Redis provisioning.

#### Option 3: AWS/GCP/Azure
Use Docker container with managed Redis service.

## 📁 Project Structure

```
Website-Scanner-/
├── api/                    # API backend
│   ├── src/
│   │   ├── server.js      # Express server
│   │   ├── scanner.js     # Core scanner logic
│   │   └── validators.js  # Input validation
│   ├── package.json       # Node dependencies
│   └── .env.example       # Environment template
├── client/                 # Client libraries
│   └── api-client.js      # JavaScript API client
├── dist/                   # Browser application
│   ├── index.html         # Web interface
│   └── app.js            # Browser scanner logic
├── docs/                   # Documentation
│   └── api.md            # API reference
├── docker-compose.yml     # Docker configuration
├── Dockerfile            # Container build
├── netlify.toml          # Netlify config
└── README.md             # This file
```

## 🎯 Use Cases

- **AI Training Data**: Collect high-quality Q&A pairs for training customer service chatbots
- **Knowledge Base Creation**: Extract and structure documentation for RAG systems
- **Content Auditing**: Analyze website content quality and structure
- **Support Content Migration**: Extract support content for migration to new platforms
- **Competitive Analysis**: Analyze competitor support and documentation strategies

## ⚡ Performance

- **Browser Version**: Limited by CORS and browser memory (~50-100 pages)
- **API Version**: Can handle 500+ pages with async processing
- **Processing Speed**: ~2-5 pages per second (configurable delay)
- **Quality Filtering**: Skip low-value content to reduce noise

## 🔒 Security & Compliance

- **Defensive Tool**: Designed for legitimate content analysis only
- **Rate Limiting**: Configurable delays to respect target servers
- **Authentication**: API key protection for production use
- **No PII Storage**: Processes content without storing personal data

## 📚 Documentation

- [API Documentation](docs/api.md) - Complete API reference
- [CLAUDE.md](CLAUDE.md) - Developer guidance for AI assistants
- [Client Library](client/api-client.js) - JavaScript API client

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## 📄 License

This project is designed for defensive security analysis and AI training data collection only. Use responsibly and respect website terms of service and robots.txt.

## 🆘 Support

For issues or questions:
- Open an issue on GitHub
- Check the [API Documentation](docs/api.md)
- Review example code in the client library

---

Built with ❤️ for the AI/ML community