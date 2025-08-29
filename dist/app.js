// RAG Collector API Testing Interface
// Main JavaScript file for API endpoint testing

// Configuration
const DEFAULT_API_BASE = 'http://localhost:3000';
let API_BASE = DEFAULT_API_BASE;
let currentScanId = null;
let autoRefreshInterval = null;
let startTime = null;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkAPIStatus();
    loadSavedSettings();
});

// Setup event listeners
function setupEventListeners() {
    // Endpoint navigation
    document.querySelectorAll('.endpoint-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const endpoint = btn.dataset.endpoint;
            switchEndpoint(endpoint);
        });
    });

    // Enter key handlers for inputs
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const section = input.closest('.endpoint-section');
                const button = section.querySelector('.btn-primary');
                if (button) button.click();
            }
        });
    });
}

// Switch between endpoints
function switchEndpoint(endpoint) {
    // Update navigation
    document.querySelectorAll('.endpoint-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-endpoint="${endpoint}"]`).classList.add('active');

    // Update content
    document.querySelectorAll('.endpoint-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(`${endpoint}-section`).classList.add('active');
}

// Check API server status
async function checkAPIStatus() {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    
    try {
        const response = await fetch(`${API_BASE}/api/health`);
        if (response.ok) {
            indicator.classList.add('online');
            text.textContent = 'API Server Online';
        } else {
            indicator.classList.remove('online');
            text.textContent = 'API Server Offline';
        }
    } catch (error) {
        indicator.classList.remove('online');
        text.textContent = 'API Server Unreachable';
    }
}

// Load saved settings from localStorage
function loadSavedSettings() {
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
        document.querySelectorAll('[id$="-apikey"]').forEach(input => {
            input.value = savedApiKey;
        });
    }

    const savedServer = localStorage.getItem('apiServer');
    if (savedServer) {
        API_BASE = savedServer;
        document.getElementById('health-server').value = savedServer;
    }

    const savedScanId = localStorage.getItem('lastScanId');
    if (savedScanId) {
        currentScanId = savedScanId;
        document.getElementById('status-scanid').value = savedScanId;
        document.getElementById('results-scanid').value = savedScanId;
        document.getElementById('export-scanid').value = savedScanId;
    }
}

// Save settings to localStorage
function saveSettings() {
    const apiKey = document.getElementById('scan-apikey').value;
    if (apiKey) {
        localStorage.setItem('apiKey', apiKey);
    }

    const server = document.getElementById('health-server').value;
    if (server) {
        localStorage.setItem('apiServer', server);
        API_BASE = server;
    }
}

// Helper function to make API calls
async function makeAPICall(method, endpoint, headers = {}, body = null) {
    const startTime = Date.now();
    
    const options = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            ...headers
        }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const elapsed = Date.now() - startTime;
        
        let data;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        return {
            ok: response.ok,
            status: response.status,
            data: data,
            elapsed: elapsed
        };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            data: { error: error.message },
            elapsed: Date.now() - startTime
        };
    }
}

// Format JSON for display
function formatJSON(data) {
    return JSON.stringify(data, null, 2);
}

// Display response
function displayResponse(sectionId, response, statusId, bodyId, timeId) {
    const section = document.getElementById(sectionId);
    const statusEl = document.getElementById(statusId);
    const bodyEl = document.getElementById(bodyId);
    const timeEl = document.getElementById(timeId);

    section.style.display = 'block';

    // Update status
    if (response.ok) {
        statusEl.className = 'response-status success';
        statusEl.textContent = `✓ ${response.status} OK`;
    } else {
        statusEl.className = 'response-status error';
        statusEl.textContent = `✗ ${response.status || 'Error'}`;
    }

    // Update time
    if (timeEl) {
        timeEl.textContent = `${response.elapsed}ms`;
    }

    // Update body
    bodyEl.textContent = formatJSON(response.data);

    // Syntax highlighting for JSON
    if (window.Prism) {
        bodyEl.innerHTML = Prism.highlight(formatJSON(response.data), Prism.languages.json, 'json');
    }
}

// === ENDPOINT FUNCTIONS ===

// 1. Health Check
async function testHealth() {
    const server = document.getElementById('health-server').value;
    API_BASE = server;
    saveSettings();

    const response = await makeAPICall('GET', '/api/health');
    displayResponse('health-response', response, 'health-status', 'health-body', 'health-time');
    
    // Update global status
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    if (response.ok) {
        indicator.classList.add('online');
        text.textContent = 'API Server Online';
    } else {
        indicator.classList.remove('online');
        text.textContent = 'API Server Offline';
    }
}

// 2. Start Scan
async function startScan() {
    const apiKey = document.getElementById('scan-apikey').value;
    const url = document.getElementById('scan-url').value;
    
    if (!url) {
        alert('Please enter a URL to scan');
        return;
    }

    // Collect page types
    const pageTypes = [];
    if (document.getElementById('type-faq').checked) pageTypes.push('FAQ');
    if (document.getElementById('type-docs').checked) pageTypes.push('Documentation');
    if (document.getElementById('type-support').checked) pageTypes.push('Support');
    if (document.getElementById('type-about').checked) pageTypes.push('About');
    if (document.getElementById('type-product').checked) pageTypes.push('Product');
    if (document.getElementById('type-blog').checked) pageTypes.push('Blog');

    const body = {
        url: url,
        options: {
            maxPages: parseInt(document.getElementById('scan-maxpages').value),
            maxDepth: parseInt(document.getElementById('scan-maxdepth').value),
            delay: parseInt(document.getElementById('scan-delay').value),
            minQualityScore: parseInt(document.getElementById('scan-quality').value),
            pageTypes: pageTypes.length > 0 ? pageTypes : undefined,
            includeContent: true
        }
    };

    saveSettings();
    const response = await makeAPICall('POST', '/api/scan', { 'X-API-Key': apiKey }, body);
    displayResponse('scan-response', response, 'scan-status', 'scan-body', 'scan-time');

    if (response.ok && response.data.scanId) {
        currentScanId = response.data.scanId;
        localStorage.setItem('lastScanId', currentScanId);
        
        // Auto-fill scan ID in other sections
        document.getElementById('status-scanid').value = currentScanId;
        document.getElementById('results-scanid').value = currentScanId;
        document.getElementById('export-scanid').value = currentScanId;
        
        // Show notification
        showNotification('Scan started! ID copied to other sections.', 'success');
    }
}

// 3. Check Status
async function checkStatus() {
    const apiKey = document.getElementById('status-apikey').value;
    const scanId = document.getElementById('status-scanid').value;
    
    if (!scanId) {
        alert('Please enter a Scan ID');
        return;
    }

    const response = await makeAPICall('GET', `/api/scan/${scanId}/status`, { 'X-API-Key': apiKey });
    displayResponse('status-response', response, 'status-status', 'status-body', 'status-time');

    if (response.ok) {
        // Update progress visualization
        const progressSection = document.getElementById('status-progress');
        progressSection.style.display = 'block';
        
        const progress = response.data.progress || 0;
        const progressFill = document.getElementById('progress-fill');
        progressFill.style.width = `${progress}%`;
        progressFill.textContent = `${progress}%`;
        
        document.getElementById('stat-pages').textContent = response.data.pagesScanned || 0;
        document.getElementById('stat-status').textContent = response.data.status || '-';
        
        // Calculate elapsed time
        if (!startTime && response.data.status === 'processing') {
            startTime = Date.now();
        }
        if (startTime) {
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            document.getElementById('stat-time').textContent = `${elapsed}s`;
        }
        
        // Reset timer if completed
        if (response.data.status === 'completed' || response.data.status === 'failed') {
            startTime = null;
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
                document.getElementById('status-auto').checked = false;
            }
        }
    }
}

// Toggle auto-refresh for status
function toggleAutoRefresh() {
    const checkbox = document.getElementById('status-auto');
    
    if (checkbox.checked) {
        checkStatus(); // Check immediately
        autoRefreshInterval = setInterval(checkStatus, 2000);
    } else {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }
}

// 4. Get Results
async function getResults() {
    const apiKey = document.getElementById('results-apikey').value;
    const scanId = document.getElementById('results-scanid').value;
    
    if (!scanId) {
        alert('Please enter a Scan ID');
        return;
    }

    const response = await makeAPICall('GET', `/api/scan/${scanId}/results`, { 'X-API-Key': apiKey });
    
    if (response.ok) {
        const data = response.data;
        
        // Show response section
        document.getElementById('results-response').style.display = 'block';
        
        // Update raw JSON tab
        const bodyEl = document.getElementById('results-body');
        bodyEl.textContent = formatJSON(data);
        if (window.Prism) {
            bodyEl.innerHTML = Prism.highlight(formatJSON(data), Prism.languages.json, 'json');
        }
        
        // Update summary tab
        const statsHtml = `
            <div class="stat-card">
                <div class="stat-value">${data.statistics?.totalPages || 0}</div>
                <div class="stat-label">Total Pages</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.statistics?.avgQualityScore || 0}%</div>
                <div class="stat-label">Avg Quality</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${data.domain || '-'}</div>
                <div class="stat-label">Domain</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${new Date(data.scanDate).toLocaleDateString()}</div>
                <div class="stat-label">Scan Date</div>
            </div>
        `;
        document.getElementById('results-stats').innerHTML = statsHtml;
        
        // Update pages tab
        if (data.pages && data.pages.length > 0) {
            const pagesHtml = data.pages.map(page => `
                <div style="padding: 15px; background: var(--light); border-radius: 10px; margin-bottom: 10px;">
                    <div style="font-weight: bold; margin-bottom: 5px;">${page.url}</div>
                    <div style="display: flex; gap: 15px; color: #6b7280; font-size: 0.9rem;">
                        <span>Type: ${page.pageType || 'Unknown'}</span>
                        <span>Quality: ${page.qualityScore || 0}%</span>
                        <span>Depth: ${page.depth || 0}</span>
                    </div>
                </div>
            `).join('');
            document.getElementById('pages-list').innerHTML = pagesHtml;
        }
    } else {
        displayResponse('results-response', response, null, 'results-body', null);
    }
}

// Show results tab
function showResultsTab(tab) {
    // Update tab buttons
    document.querySelectorAll('#results-section .tab').forEach(t => {
        t.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update content
    document.getElementById('results-summary').style.display = tab === 'summary' ? 'block' : 'none';
    document.getElementById('results-pages').style.display = tab === 'pages' ? 'block' : 'none';
    document.getElementById('results-raw').style.display = tab === 'raw' ? 'block' : 'none';
}

// 5. Extract Page
async function extractPage() {
    const apiKey = document.getElementById('extract-apikey').value;
    const url = document.getElementById('extract-url').value;
    
    if (!url) {
        alert('Please enter a URL to extract');
        return;
    }

    const extractors = [];
    if (document.getElementById('extract-content').checked) extractors.push('content');
    if (document.getElementById('extract-metadata').checked) extractors.push('metadata');
    if (document.getElementById('extract-qa').checked) extractors.push('qa');

    const body = {
        url: url,
        extractors: extractors
    };

    const response = await makeAPICall('POST', '/api/extract', { 'X-API-Key': apiKey }, body);
    displayResponse('extract-response', response, 'extract-status', 'extract-body', 'extract-time');
}

// 6. Export Data
async function exportData() {
    const apiKey = document.getElementById('export-apikey').value;
    const scanId = document.getElementById('export-scanid').value;
    const format = document.getElementById('export-format').value;
    
    if (!scanId) {
        alert('Please enter a Scan ID');
        return;
    }

    const body = {
        scanId: scanId,
        format: format
    };

    const response = await makeAPICall('POST', '/api/export', { 'X-API-Key': apiKey }, body);
    displayResponse('export-response', response, 'export-status', 'export-body', 'export-time');
    
    if (response.ok) {
        // Offer download
        const blob = new Blob([typeof response.data === 'string' ? response.data : JSON.stringify(response.data)], 
            { type: format === 'json' ? 'application/json' : 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scan-${scanId}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        
        showNotification(`Export downloaded as scan-${scanId}.${format}`, 'success');
    }
}

// 7. Batch Scan
async function batchScan() {
    const apiKey = document.getElementById('batch-apikey').value;
    const urlsText = document.getElementById('batch-urls').value;
    
    if (!urlsText) {
        alert('Please enter URLs to scan');
        return;
    }

    const urls = urlsText.split('\n').filter(url => url.trim()).map(url => url.trim());
    
    if (urls.length === 0) {
        alert('Please enter at least one URL');
        return;
    }
    
    if (urls.length > 10) {
        alert('Maximum 10 URLs allowed per batch');
        return;
    }

    const body = {
        urls: urls,
        options: {
            maxPages: parseInt(document.getElementById('batch-maxpages').value),
            maxDepth: parseInt(document.getElementById('batch-maxdepth').value)
        }
    };

    const response = await makeAPICall('POST', '/api/batch', { 'X-API-Key': apiKey }, body);
    displayResponse('batch-response', response, 'batch-status', 'batch-body', 'batch-time');
    
    if (response.ok && response.data.batchId) {
        showNotification(`Batch scan started with ID: ${response.data.batchId}`, 'success');
    }
}

// === HELPER FUNCTIONS ===

// Set URL helpers
function setScanUrl(url) {
    document.getElementById('scan-url').value = url;
}

function setExtractUrl(url) {
    document.getElementById('extract-url').value = url;
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--info)'};
        color: white;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Show documentation
function showDocs() {
    alert('Documentation coming soon! For now, check the API endpoints in the sidebar.');
}

// Add animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Periodic API status check
setInterval(checkAPIStatus, 30000); // Check every 30 seconds