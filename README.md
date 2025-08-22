# Website Scanner 🕷️

A browser-based website analysis tool for crawling, analyzing, and visualizing website structure and content. Built as a defensive security tool for website auditing and site mapping.

## Features

- 🔍 **Website Crawling**: Crawl websites with configurable depth and page limits
- 🌐 **CORS Proxy Support**: Built-in support for cross-origin requests via proxy services
- 📊 **Data Visualization**: Interactive charts and network graphs
- 📈 **Content Analysis**: Extract and analyze page content, links, and media
- 💾 **Export Options**: Download results as JSON or CSV
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Live Demo

Visit the deployed application at your Netlify URL.

## Local Development

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

## Usage

1. Enter a website URL in the input field
2. Configure scanning parameters:
   - **Max Pages**: Maximum number of pages to scan (1-500)
   - **Max Depth**: Maximum crawl depth from the start page (1-10)
   - **Delay**: Time delay between requests in milliseconds (100-5000)
   - **CORS Proxy**: Select a proxy service for cross-origin requests
3. Click "Start Scanning" to begin analysis
4. View results in real-time:
   - Statistics cards showing total pages, links, images, and word counts
   - Page type distribution chart
   - Interactive network visualization of site structure
   - Detailed table of all scanned pages
5. Export results as JSON or CSV for further analysis

## Technology Stack

- **Pure JavaScript**: No framework dependencies
- **Chart.js**: Data visualization
- **vis.js**: Network graph visualization
- **HTML5/CSS3**: Modern web standards
- **Netlify**: Automatic deployment

## Deployment

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

## Project Structure

```
Website-Scanner-/
├── dist/
│   ├── index.html    # Main application HTML
│   └── app.js        # JavaScript application logic
├── build_site.py     # Netlify build script
├── netlify.toml      # Netlify configuration
├── CLAUDE.md         # Developer documentation
└── README.md         # This file
```

## License

This project is designed for defensive security analysis and website auditing purposes only.

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.