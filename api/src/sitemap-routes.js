// Dedicated sitemap and website map endpoints

const express = require('express');
const AdvancedWebsiteMapper = require('./advanced-mapper');

const router = express.Router();

// This will be set by the main server
let scanResults;

// Get website sitemap/structure from completed scan
router.get('/scan/:scanId/sitemap', async (req, res) => {
  try {
    const { scanId } = req.params;
    const { format = 'json' } = req.query;
    
    // Get scan from storage (assuming scanResults Map exists)
    const scan = scanResults.get(scanId);
    
    if (!scan) {
      return res.status(404).json({ error: 'Scan not found' });
    }
    
    if (scan.status !== 'completed') {
      return res.status(400).json({ 
        error: 'Scan not completed',
        status: scan.status 
      });
    }
    
    const sitemapData = {
      scanId: scan.scanId,
      domain: scan.domain,
      generatedAt: new Date().toISOString(),
      structure: scan.siteMap || {},
      pages: scan.pages || [],
      statistics: {
        totalPages: scan.pages?.length || 0,
        totalLinks: scan.statistics?.totalLinks || 0,
        maxDepth: scan.statistics?.maxDepth || 0,
        pageTypes: scan.statistics?.pageTypes || {}
      }
    };
    
    // Return in different formats
    switch (format.toLowerCase()) {
      case 'xml':
        const xmlSitemap = generateXMLSitemap(sitemapData);
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="sitemap-${scan.domain}.xml"`);
        return res.send(xmlSitemap);
        
      case 'txt':
        const txtSitemap = generateTxtSitemap(sitemapData);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="sitemap-${scan.domain}.txt"`);
        return res.send(txtSitemap);
        
      case 'tree':
        const treeSitemap = generateTreeSitemap(sitemapData);
        res.setHeader('Content-Type', 'text/plain');
        return res.send(treeSitemap);
        
      default: // json
        return res.json(sitemapData);
    }
    
  } catch (error) {
    console.error('Error retrieving sitemap:', error);
    res.status(500).json({ error: 'Failed to retrieve sitemap' });
  }
});

// Get network graph data for visualization
router.get('/scan/:scanId/network', async (req, res) => {
  try {
    const { scanId } = req.params;
    const scan = scanResults.get(scanId);
    
    if (!scan || scan.status !== 'completed') {
      return res.status(404).json({ error: 'Completed scan not found' });
    }
    
    // Generate network graph data
    const mapper = new AdvancedWebsiteMapper();
    
    // Reconstruct link graph from scan results
    if (scan.pages) {
      scan.pages.forEach(page => {
        if (page.links) {
          mapper.linkGraph.set(page.url, page.links);
          mapper.visitedUrls.add(page.url);
        }
      });
    }
    
    const networkData = mapper.generateNetworkGraph();
    
    res.json({
      scanId,
      type: 'network',
      nodes: networkData.nodes,
      edges: networkData.edges,
      statistics: {
        nodeCount: networkData.nodes.length,
        edgeCount: networkData.edges.length,
        avgDegree: networkData.edges.length / (networkData.nodes.length || 1)
      }
    });
    
  } catch (error) {
    console.error('Error generating network data:', error);
    res.status(500).json({ error: 'Failed to generate network data' });
  }
});

// Get hierarchical tree data
router.get('/scan/:scanId/tree', async (req, res) => {
  try {
    const { scanId } = req.params;
    const scan = scanResults.get(scanId);
    
    if (!scan || scan.status !== 'completed') {
      return res.status(404).json({ error: 'Completed scan not found' });
    }
    
    const mapper = new AdvancedWebsiteMapper();
    
    // Reconstruct data
    if (scan.pages) {
      scan.pages.forEach(page => {
        mapper.visitedUrls.add(page.url);
      });
    }
    
    const treeData = mapper.generateTreemap();
    
    res.json({
      scanId,
      type: 'tree',
      data: treeData,
      statistics: {
        totalNodes: countTreeNodes(treeData),
        maxDepth: getTreeDepth(treeData),
        branches: treeData.children?.length || 0
      }
    });
    
  } catch (error) {
    console.error('Error generating tree data:', error);
    res.status(500).json({ error: 'Failed to generate tree data' });
  }
});

// Generate live sitemap by crawling (without full scan)
router.post('/generate-sitemap', async (req, res) => {
  try {
    const { url, maxPages = 100, format = 'json' } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const mapper = new AdvancedWebsiteMapper({
      maxPages,
      maxDepth: 5,
      timeout: 10000
    });
    
    // Quick sitemap generation
    console.log(`Generating sitemap for ${url}...`);
    
    // Discover sitemaps
    await mapper.discoverFromRobotsTxt(url);
    
    // If sitemaps found, parse them
    const discoveredUrls = new Set();
    for (const sitemapUrl of mapper.sitemapUrls) {
      const sitemapData = await mapper.discoverFromSitemap(sitemapUrl);
      sitemapData.forEach(entry => discoveredUrls.add(entry.url));
    }
    
    // If no sitemaps, do light crawl
    if (discoveredUrls.size === 0) {
      await mapper.crawlDFS(url, 2); // Light 2-level crawl
      mapper.visitedUrls.forEach(pageUrl => discoveredUrls.add(pageUrl));
    }
    
    const sitemapData = {
      domain: new URL(url).hostname,
      generatedAt: new Date().toISOString(),
      source: mapper.sitemapUrls.size > 0 ? 'sitemap' : 'crawl',
      urls: Array.from(discoveredUrls).map(pageUrl => ({
        url: pageUrl,
        lastmod: new Date().toISOString(),
        priority: pageUrl === url ? 1.0 : 0.8
      })),
      totalUrls: discoveredUrls.size
    };
    
    // Return in requested format
    switch (format.toLowerCase()) {
      case 'xml':
        const xmlSitemap = generateXMLSitemapFromUrls(sitemapData);
        res.setHeader('Content-Type', 'application/xml');
        res.setHeader('Content-Disposition', `attachment; filename="generated-sitemap.xml"`);
        return res.send(xmlSitemap);
        
      case 'txt':
        const txtSitemap = sitemapData.urls.map(entry => entry.url).join('\n');
        res.setHeader('Content-Type', 'text/plain');
        return res.send(txtSitemap);
        
      default: // json
        return res.json(sitemapData);
    }
    
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({ error: 'Failed to generate sitemap' });
  }
});

// Helper functions
function generateXMLSitemap(sitemapData) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  if (sitemapData.pages) {
    sitemapData.pages.forEach(page => {
      xml += '  <url>\n';
      xml += `    <loc>${escapeXml(page.url)}</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
      xml += `    <priority>${page.url.endsWith('/') ? '1.0' : '0.8'}</priority>\n`;
      xml += '  </url>\n';
    });
  }
  
  xml += '</urlset>';
  return xml;
}

function generateXMLSitemapFromUrls(sitemapData) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  
  sitemapData.urls.forEach(entry => {
    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(entry.url)}</loc>\n`;
    xml += `    <lastmod>${entry.lastmod.split('T')[0]}</lastmod>\n`;
    xml += `    <priority>${entry.priority}</priority>\n`;
    xml += '  </url>\n';
  });
  
  xml += '</urlset>';
  return xml;
}

function generateTxtSitemap(sitemapData) {
  if (!sitemapData.pages) return '';
  return sitemapData.pages.map(page => page.url).join('\n');
}

function generateTreeSitemap(sitemapData) {
  let output = `Site Structure for ${sitemapData.domain}\n`;
  output += '='.repeat(50) + '\n\n';
  
  if (sitemapData.structure && typeof sitemapData.structure === 'object') {
    output += renderTreeStructure(sitemapData.structure, '', '/');
  } else if (sitemapData.pages) {
    // Fallback: simple list
    sitemapData.pages.forEach(page => {
      const depth = (page.url.match(/\//g) || []).length - 2;
      const indent = '  '.repeat(Math.max(0, depth));
      output += `${indent}${page.url}\n`;
    });
  }
  
  return output;
}

function renderTreeStructure(structure, indent = '', path = '') {
  let output = '';
  
  for (const [key, value] of Object.entries(structure)) {
    const currentPath = path === '/' ? key : `${path}${key}`;
    output += `${indent}├── ${key}\n`;
    
    if (value && typeof value === 'object' && value.children) {
      output += renderTreeStructure(value.children, indent + '│   ', currentPath + '/');
    }
  }
  
  return output;
}

function countTreeNodes(tree) {
  if (!tree || !tree.children) return 1;
  return 1 + tree.children.reduce((count, child) => count + countTreeNodes(child), 0);
}

function getTreeDepth(tree, currentDepth = 0) {
  if (!tree || !tree.children || tree.children.length === 0) {
    return currentDepth;
  }
  return Math.max(...tree.children.map(child => getTreeDepth(child, currentDepth + 1)));
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Function to set the scanResults reference from main server
router.setScanResults = (results) => {
  scanResults = results;
};

module.exports = router;