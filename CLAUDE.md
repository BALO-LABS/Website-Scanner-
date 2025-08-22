# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WebsiteMapper application - a pure JavaScript web application that crawls and analyzes websites. It's a defensive security/analysis tool for website auditing, content analysis, and site structure mapping that runs entirely in the browser.

## Commands

### Running the application locally
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

### Deployment
The application is configured for automatic deployment to Netlify. Simply push changes to the GitHub repository and Netlify will deploy automatically.

## Architecture

The application is a single-page web application with the following structure:

### Files
- **dist/index.html**: Main HTML file with UI structure and styling
- **dist/app.js**: JavaScript application logic  
- **build_site.py**: Build script for Netlify deployment
- **netlify.toml**: Netlify configuration

### Core JavaScript Classes and Functions (app.js)

1. **WebsiteScanner class**:
   - **Constructor**: Initializes crawler state, visited URLs, queue, settings
   - **URL handling methods**: 
     - `normalizeUrl()`: Handles URL normalization and fragment removal
     - `getBaseDomain()`: Strips www prefix for domain comparison
     - `isInternalLink()`: Checks if URLs belong to same domain (ignoring www)
     - `shouldCrawl()`: Filtering logic for crawlable URLs
   - **Content extraction**:
     - `fetchPage()`: Fetches pages using CORS proxy services
     - `parseHtml()`: Parses HTML using browser's DOMParser
     - `classifyPageType()`: URL pattern-based page classification
   - **Crawling engine**:
     - `crawl()`: Main crawling loop with BFS traversal
     - `displayResults()`: Aggregates and displays results

2. **Visualization functions**:
   - `createPageTypesChart()`: Generates Chart.js doughnut chart
   - `createNetworkVisualization()`: Creates vis.js network graph
   - `populatePagesTable()`: Populates results table

3. **Export functions**:
   - `exportJSON()`: Exports scan data as JSON
   - `exportCSV()`: Exports scan data as CSV

### Key Design Patterns

- **Client-side crawling**: Uses CORS proxy services (AllOrigins, CorsProxy.io) to bypass browser CORS restrictions
- **BFS traversal**: Breadth-first crawling with depth tracking
- **Rate limiting**: Configurable delay between requests (100-5000ms)
- **Progress tracking**: Real-time progress bars during crawling
- **Domain normalization**: Handles www/non-www variations automatically
- **Content filtering**: Skips non-HTML resources (PDFs, images, etc.)
- **Responsive design**: Mobile-friendly interface

### URL Processing Logic

- **Domain matching**: Base domain extraction ignores www prefix for internal link detection
- **URL normalization**: Handles scheme addition, fragment removal, trailing slash cleanup
- **Skip patterns**: File extensions (.pdf, .doc, images), non-HTTP schemes, external domains
- **Duplicate prevention**: Visited URLs tracking to prevent cycles

## Browser Dependencies

The application uses CDN-hosted libraries:
- **Chart.js**: For page type distribution charts
- **vis.js**: For network graph visualization
- **No build process required**: Pure JavaScript, HTML, and CSS

## Limitations

Due to browser security (CORS policy), the scanner:
- Requires CORS proxy services for cross-origin requests
- May not work with all websites (some block proxy requests)
- Cannot access sites requiring authentication
- Limited by browser memory for very large crawls