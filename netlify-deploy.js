#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const NETLIFY_TOKEN = process.env.NETLIFY_AUTH_TOKEN;
const SITE_ID = 'c4d18623-7afa-4044-ab3f-7249dcc6b4b7'; // websitescanner site

async function triggerDeploy() {
    console.log('🚀 Triggering Netlify deployment...\n');
    
    const headers = {
        'Authorization': `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json'
    };
    
    try {
        // Trigger a new build
        console.log('Requesting new build...');
        const response = await axios.post(
            `https://api.netlify.com/api/v1/sites/${SITE_ID}/builds`,
            { clear_cache: false },
            { headers }
        );
        
        console.log('✅ Build triggered successfully!');
        console.log(`Build ID: ${response.data.id}`);
        console.log(`State: ${response.data.state}`);
        console.log('\nMonitor progress at:');
        console.log(`https://app.netlify.com/sites/websitescanner/deploys/${response.data.id}`);
        console.log('\nOr check status with: node check-netlify-api.js');
        
    } catch (error) {
        if (error.response?.status === 404) {
            console.error('❌ Site not found. The site may not be connected to a git repository.');
            console.log('\nFor manual deploys without git, use Netlify CLI:');
            console.log('1. Install: npm install -g netlify-cli');
            console.log('2. Login: netlify login');
            console.log('3. Deploy: netlify deploy --dir=dist --prod');
        } else if (error.response?.status === 401) {
            console.error('❌ Authentication failed. Token may be invalid.');
        } else {
            console.error('❌ Error:', error.response?.data?.message || error.message);
        }
    }
}

// Check command line arguments
const command = process.argv[2];

if (command === 'deploy') {
    triggerDeploy();
} else {
    console.log('Netlify Deployment Tool\n');
    console.log('Usage:');
    console.log('  node netlify-deploy.js deploy  - Trigger a new deployment');
    console.log('  node check-netlify-api.js      - Check deployment status');
}