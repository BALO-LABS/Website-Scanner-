/**
 * RAG Collector API Client
 * JavaScript client library for interacting with the RAG Collector API
 */

class RAGCollectorClient {
  constructor(apiKey, baseUrl = 'http://localhost:3000') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey
    };
  }
  
  /**
   * Start a website scan
   * @param {string} url - The URL to scan
   * @param {object} options - Scan options
   * @returns {Promise<object>} Scan initiation response
   */
  async scan(url, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/scan`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ url, options })
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get scan status
   * @param {string} scanId - The scan ID
   * @returns {Promise<object>} Scan status
   */
  async getStatus(scanId) {
    const response = await fetch(`${this.baseUrl}/api/scan/${scanId}/status`, {
      headers: this.headers
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get scan results
   * @param {string} scanId - The scan ID
   * @returns {Promise<object>} Scan results
   */
  async getResults(scanId) {
    const response = await fetch(`${this.baseUrl}/api/scan/${scanId}/results`, {
      headers: this.headers
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Wait for scan completion
   * @param {string} scanId - The scan ID
   * @param {number} pollInterval - Polling interval in milliseconds
   * @returns {Promise<object>} Completed scan results
   */
  async waitForCompletion(scanId, pollInterval = 5000) {
    while (true) {
      const status = await this.getStatus(scanId);
      
      if (status.status === 'completed') {
        return this.getResults(scanId);
      }
      
      if (status.status === 'failed') {
        throw new Error('Scan failed: ' + (status.error || 'Unknown error'));
      }
      
      console.log(`Scan progress: ${status.progress}% - ${status.message}`);
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  /**
   * Scan and wait for results
   * @param {string} url - The URL to scan
   * @param {object} options - Scan options
   * @returns {Promise<object>} Completed scan results
   */
  async scanAndWait(url, options = {}) {
    const { scanId } = await this.scan(url, options);
    console.log(`Scan started with ID: ${scanId}`);
    return this.waitForCompletion(scanId);
  }
  
  /**
   * Extract content from a single URL
   * @param {string} url - The URL to extract from
   * @param {array} extractors - Extractors to use
   * @returns {Promise<object>} Extracted content
   */
  async extract(url, extractors = ['qa', 'content', 'metadata']) {
    const response = await fetch(`${this.baseUrl}/api/extract`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ url, extractors })
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Export scan results
   * @param {string} scanId - The scan ID
   * @param {string} format - Export format (rag, markdown, vectordb, csv, xml, json)
   * @returns {Promise<string|object>} Exported data
   */
  async export(scanId, format = 'rag') {
    const response = await fetch(`${this.baseUrl}/api/export`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ scanId, format })
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    if (format === 'json' || format === 'rag' || format === 'vectordb') {
      return response.json();
    }
    
    return response.text();
  }
  
  /**
   * Batch scan multiple URLs
   * @param {array} urls - Array of URLs to scan
   * @param {object} options - Scan options
   * @returns {Promise<object>} Batch scan response
   */
  async batchScan(urls, options = {}) {
    const response = await fetch(`${this.baseUrl}/api/batch`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ urls, options })
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Get batch scan status
   * @param {string} batchId - The batch ID
   * @returns {Promise<object>} Batch status
   */
  async getBatchStatus(batchId) {
    const response = await fetch(`${this.baseUrl}/api/batch/${batchId}/status`, {
      headers: this.headers
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  /**
   * Wait for batch completion
   * @param {string} batchId - The batch ID
   * @param {number} pollInterval - Polling interval in milliseconds
   * @returns {Promise<array>} Array of completed scan results
   */
  async waitForBatchCompletion(batchId, pollInterval = 5000) {
    while (true) {
      const status = await this.getBatchStatus(batchId);
      
      if (status.completed === status.totalJobs) {
        // Get all individual results
        const results = [];
        for (const job of status.jobs) {
          if (job.status === 'completed') {
            const result = await this.getResults(job.jobId);
            results.push(result);
          }
        }
        return results;
      }
      
      console.log(`Batch progress: ${status.completed}/${status.totalJobs} completed`);
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }
  
  /**
   * Health check
   * @returns {Promise<object>} Health status
   */
  async health() {
    const response = await fetch(`${this.baseUrl}/api/health`);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }
    
    return response.json();
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RAGCollectorClient;
}

// Example usage
if (typeof window === 'undefined') {
  // Node.js example
  async function example() {
    const client = new RAGCollectorClient('your-api-key');
    
    try {
      // Check health
      const health = await client.health();
      console.log('API Health:', health);
      
      // Single page extraction
      const extracted = await client.extract('https://example.com/faq');
      console.log('Extracted Q&A:', extracted.qaItems);
      
      // Full site scan
      const results = await client.scanAndWait('https://example.com', {
        maxPages: 50,
        pageTypes: ['FAQ', 'Documentation'],
        minQualityScore: 40
      });
      
      console.log('Scan completed!');
      console.log('Statistics:', results.statistics);
      console.log('Total pages:', results.pages.length);
      
      // Export for RAG
      const ragData = await client.export(results.scanId, 'rag');
      console.log('RAG export ready:', ragData.documents.length, 'documents');
      
      // Batch scan
      const batch = await client.batchScan([
        'https://example1.com',
        'https://example2.com'
      ], {
        maxPages: 30
      });
      
      const batchResults = await client.waitForBatchCompletion(batch.batchId);
      console.log('Batch completed:', batchResults.length, 'sites scanned');
      
    } catch (error) {
      console.error('Error:', error);
    }
  }
  
  // Run example if called directly
  if (require.main === module) {
    example();
  }
}