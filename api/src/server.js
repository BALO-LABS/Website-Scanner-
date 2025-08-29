const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const Queue = require('bull');
const Redis = require('redis');
require('dotenv').config();

const WebsiteScanner = require('./scanner');
const { validateScanRequest, validateExportRequest } = require('./validators');
const sitemapRoutes = require('./sitemap-routes');
const comprehensiveMapRoutes = require('./comprehensive-map');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Redis client for caching (disabled for testing)
let redisClient = null;
let scanQueue = null;

if (process.env.ENABLE_REDIS === 'true') {
  redisClient = Redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });

  redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
  });

  // Job queue for async processing
  scanQueue = new Queue('website-scans', {
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    }
  });
}

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10000, // 10000 requests per hour (increased for testing)
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// In-memory storage for demo (use database in production)
const scanResults = new Map();

// Use sitemap routes
sitemapRoutes.setScanResults(scanResults);
app.use('/api', sitemapRoutes);

// Use comprehensive map routes
comprehensiveMapRoutes.setScanResults(scanResults);
app.use('/api', comprehensiveMapRoutes);

// API Key authentication middleware
const authenticateAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  // In production, validate against database
  if (process.env.NODE_ENV === 'production' && !apiKey) {
    return res.status(401).json({ error: 'API key required' });
  }
  
  // For development, allow requests without API key
  if (process.env.NODE_ENV !== 'production' || apiKey === process.env.API_KEY) {
    next();
  } else {
    res.status(401).json({ error: 'Invalid API key' });
  }
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Start a website scan
app.post('/api/scan', authenticateAPIKey, async (req, res) => {
  try {
    const { url, maxPages, maxDepth, crawlDelay, delay, includeMetadata, extractQA, ...otherOptions } = req.body;
    const options = {
      maxPages: maxPages || otherOptions.maxPages,
      maxDepth: maxDepth || otherOptions.maxDepth,
      delay: delay || crawlDelay || otherOptions.delay,
      ...otherOptions
    };
    
    // Validate input
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const scanId = uuidv4();
    const scanOptions = {
      maxPages: options.maxPages || 50,
      maxDepth: options.maxDepth || 3,
      delay: options.delay || 500,
      minQualityScore: options.minQualityScore || 30,
      pageTypes: options.pageTypes || null,
      includeContent: options.includeContent !== false
    };
    
    // Add job to queue for async processing (if available)
    let jobId = null;
    if (scanQueue) {
      const job = await scanQueue.add({
        scanId,
        url,
        options: scanOptions
      });
      jobId = job.id;
      
      // Store initial scan status
      scanResults.set(scanId, {
        scanId,
        status: 'queued',
        progress: 0,
        url,
        jobId: jobId,
        createdAt: new Date().toISOString()
      });
      
      logger.info(`Scan initiated: ${scanId} for ${url}`);
      
      res.json({
        scanId,
        status: 'queued',
        estimatedTime: Math.ceil((scanOptions.maxPages * scanOptions.delay) / 1000),
        message: 'Scan queued for processing'
      });
    } else {
      // No Redis/queue available - process immediately in background
      scanResults.set(scanId, {
        scanId,
        status: 'processing',
        progress: 0,
        url,
        createdAt: new Date().toISOString()
      });
      
      logger.info(`Scan initiated (direct processing): ${scanId} for ${url}`);
      
      // Process scan in background
      processScanDirectly(scanId, url, scanOptions);
      
      res.json({
        scanId,
        status: 'processing',
        estimatedTime: Math.ceil((scanOptions.maxPages * scanOptions.delay) / 1000),
        message: 'Scan started (direct processing)'
      });
    }
  } catch (error) {
    logger.error('Error initiating scan:', error);
    res.status(500).json({ error: 'Failed to initiate scan' });
  }
});

// Get scan status
app.get('/api/scan/:scanId/status', authenticateAPIKey, async (req, res) => {
  const { scanId } = req.params;
  const scan = scanResults.get(scanId);
  
  if (!scan) {
    return res.status(404).json({ error: 'Scan not found' });
  }
  
  res.json({
    scanId: scan.scanId,
    status: scan.status,
    progress: scan.progress || 0,
    pagesScanned: scan.pagesScanned || 0,
    message: scan.message || '',
    url: scan.url
  });
});

// Get scan results
app.get('/api/scan/:scanId/results', authenticateAPIKey, async (req, res) => {
  const { scanId } = req.params;
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
  
  res.json({
    scanId: scan.scanId,
    domain: scan.domain,
    scanDate: scan.completedAt,
    statistics: scan.statistics,
    pages: scan.pages || [],
    siteMap: scan.siteMap || {}
  });
});

// Extract content from a single URL
app.post('/api/extract', authenticateAPIKey, async (req, res) => {
  try {
    const { url, extractors = ['qa', 'content', 'metadata'] } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    const scanner = new WebsiteScanner();
    const result = await scanner.extractFromUrl(url, extractors);
    
    res.json(result);
  } catch (error) {
    logger.error('Error extracting content:', error);
    res.status(500).json({ error: 'Failed to extract content' });
  }
});

// Export scan results in various formats
app.post('/api/export', authenticateAPIKey, async (req, res) => {
  try {
    const { scanId, format = 'json' } = req.body;
    
    if (!scanId) {
      return res.status(400).json({ error: 'Scan ID is required' });
    }
    
    const scan = scanResults.get(scanId);
    
    if (!scan || scan.status !== 'completed') {
      return res.status(404).json({ error: 'Completed scan not found' });
    }
    
    const scanner = new WebsiteScanner();
    const exportData = await scanner.exportData(scan.pages, format, scan.domain);
    
    // Send appropriate content type based on format
    const contentTypes = {
      json: 'application/json',
      csv: 'text/csv',
      markdown: 'text/markdown',
      xml: 'application/xml'
    };
    
    res.setHeader('Content-Type', contentTypes[format] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="rag-data-${scan.domain}-${Date.now()}.${format}"`);
    res.send(exportData);
  } catch (error) {
    logger.error('Error exporting data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

// Batch scan multiple URLs
app.post('/api/batch', authenticateAPIKey, async (req, res) => {
  try {
    const { urls, options = {} } = req.body;
    
    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'URLs array is required' });
    }
    
    if (urls.length > 10) {
      return res.status(400).json({ error: 'Maximum 10 URLs per batch' });
    }
    
    const batchId = uuidv4();
    const jobs = [];
    
    for (const url of urls) {
      const jobId = uuidv4();
      const job = await scanQueue.add({
        scanId: jobId,
        url,
        options,
        batchId
      });
      
      jobs.push({
        jobId,
        url,
        status: 'queued'
      });
      
      scanResults.set(jobId, {
        scanId: jobId,
        status: 'queued',
        progress: 0,
        url,
        batchId,
        jobId: job.id,
        createdAt: new Date().toISOString()
      });
    }
    
    res.json({
      batchId,
      jobs,
      message: `Batch scan initiated for ${urls.length} URLs`
    });
  } catch (error) {
    logger.error('Error initiating batch scan:', error);
    res.status(500).json({ error: 'Failed to initiate batch scan' });
  }
});

// Get batch status
app.get('/api/batch/:batchId/status', authenticateAPIKey, async (req, res) => {
  const { batchId } = req.params;
  const jobs = [];
  
  for (const [scanId, scan] of scanResults) {
    if (scan.batchId === batchId) {
      jobs.push({
        jobId: scan.scanId,
        url: scan.url,
        status: scan.status,
        progress: scan.progress || 0
      });
    }
  }
  
  if (jobs.length === 0) {
    return res.status(404).json({ error: 'Batch not found' });
  }
  
  const completed = jobs.filter(j => j.status === 'completed').length;
  const failed = jobs.filter(j => j.status === 'failed').length;
  
  res.json({
    batchId,
    totalJobs: jobs.length,
    completed,
    failed,
    inProgress: jobs.length - completed - failed,
    jobs
  });
});

// Function to process scan directly without queue
async function processScanDirectly(scanId, url, options) {
  try {
    logger.info(`Processing scan ${scanId} for ${url}`);
    
    // Get scan object
    const scan = scanResults.get(scanId);
    if (!scan) {
      logger.error(`Scan ${scanId} not found`);
      return;
    }
    
    const scanner = new WebsiteScanner(options);
    
    // Set up progress reporting
    scanner.on('progress', (data) => {
      if (scan) {
        scan.progress = data.progress;
        scan.pagesScanned = data.pagesScanned;
        scan.message = data.message;
      }
    });
    
    // Execute the scan
    const results = await scanner.crawl(url);
    
    // Store results
    if (scan) {
      scan.status = 'completed';
      scan.completedAt = new Date().toISOString();
      scan.domain = results.domain;
      scan.statistics = results.statistics;
      scan.pages = results.pages;
      scan.siteMap = results.siteMap;
      scan.message = 'Scan completed successfully';
      scan.progress = 100;
    }
    
    logger.info(`Scan completed: ${scanId}`);
    return results;
  } catch (error) {
    logger.error(`Scan failed for ${scanId}:`, error);
    
    const scan = scanResults.get(scanId);
    if (scan) {
      scan.status = 'failed';
      scan.error = error.message;
      scan.message = 'Scan failed: ' + error.message;
    }
    
    throw error;
  }
}

// Process scan jobs (if queue is available)
if (scanQueue) {
scanQueue.process(async (job) => {
  const { scanId, url, options } = job.data;
  
  try {
    logger.info(`Processing scan ${scanId} for ${url}`);
    
    // Update status to processing
    const scan = scanResults.get(scanId);
    if (scan) {
      scan.status = 'processing';
      scan.message = 'Scan in progress';
    }
    
    const scanner = new WebsiteScanner(options);
    
    // Set up progress reporting
    scanner.on('progress', (data) => {
      if (scan) {
        scan.progress = data.progress;
        scan.pagesScanned = data.pagesScanned;
        scan.message = data.message;
      }
      job.progress(data.progress);
    });
    
    // Execute the scan
    const results = await scanner.crawl(url);
    
    // Store results
    if (scan) {
      scan.status = 'completed';
      scan.completedAt = new Date().toISOString();
      scan.domain = results.domain;
      scan.statistics = results.statistics;
      scan.pages = results.pages;
      scan.siteMap = results.siteMap;
      scan.message = 'Scan completed successfully';
    }
    
    logger.info(`Scan completed: ${scanId}`);
    return results;
  } catch (error) {
    logger.error(`Scan failed for ${scanId}:`, error);
    
    const scan = scanResults.get(scanId);
    if (scan) {
      scan.status = 'failed';
      scan.error = error.message;
      scan.message = 'Scan failed';
    }
    
    throw error;
  }
});
}

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
async function startServer() {
  try {
    // Try to connect to Redis, but don't fail if it's not available
    if (redisClient) {
      try {
        await redisClient.connect();
        logger.info('Connected to Redis');
      } catch (redisError) {
        logger.warn('Redis not available, running without caching:', redisError.message);
      }
    } else {
      logger.info('Running without Redis (disabled)');
    }
    
    // Start Express server
    app.listen(PORT, () => {
      logger.info(`RAG Collector API running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (scanQueue) await scanQueue.close();
  if (redisClient) await redisClient.quit();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;