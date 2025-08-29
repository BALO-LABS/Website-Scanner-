#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

const NETLIFY_TOKEN = process.env.NETLIFY_AUTH_TOKEN;

async function checkNetlifyStatus() {
    console.log('🔍 Checking Netlify deployment via API...\n');
    
    const headers = {
        'Authorization': `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json'
    };
    
    try {
        // Get all sites
        console.log('1. Finding Website Scanner site...');
        const sitesResponse = await axios.get('https://api.netlify.com/api/v1/sites', { headers });
        
        // Find our website scanner site
        const site = sitesResponse.data.find(s => 
            s.url?.includes('websitescanner') || 
            s.name?.includes('websitescanner') ||
            s.custom_domain === 'websitescanner.netlify.app'
        );
        
        if (!site) {
            console.log('Site not found. Available sites:');
            sitesResponse.data.forEach(s => {
                console.log(`  - ${s.name}: ${s.url}`);
            });
            return;
        }
        
        console.log(`   ✓ Found site: ${site.name}`);
        console.log(`   URL: ${site.url}`);
        console.log(`   Site ID: ${site.id}`);
        
        // Get latest deploys
        console.log('\n2. Checking latest deployments...');
        const deploysResponse = await axios.get(
            `https://api.netlify.com/api/v1/sites/${site.id}/deploys?per_page=5`,
            { headers }
        );
        
        const latestDeploy = deploysResponse.data[0];
        if (latestDeploy) {
            console.log(`\n   Latest Deploy:`);
            console.log(`   ✓ Status: ${latestDeploy.state}`);
            console.log(`   ✓ Created: ${new Date(latestDeploy.created_at).toLocaleString()}`);
            console.log(`   ✓ Deploy URL: ${latestDeploy.deploy_ssl_url}`);
            console.log(`   ✓ Branch: ${latestDeploy.branch}`);
            
            if (latestDeploy.context) {
                console.log(`   ✓ Context: ${latestDeploy.context}`);
            }
            
            if (latestDeploy.commit_ref) {
                console.log(`   ✓ Commit: ${latestDeploy.commit_ref.substring(0, 7)}`);
            }
            
            if (latestDeploy.title) {
                console.log(`   ✓ Title: ${latestDeploy.title}`);
            }
            
            // Check build status
            if (latestDeploy.state === 'ready') {
                console.log('\n✅ DEPLOYMENT IS LIVE AND READY!');
                console.log(`🌐 Visit: https://websitescanner.netlify.app`);
            } else if (latestDeploy.state === 'building') {
                console.log('\n⏳ DEPLOYMENT IS BUILDING...');
                console.log('Check again in a minute.');
            } else if (latestDeploy.state === 'error') {
                console.log('\n❌ DEPLOYMENT FAILED');
                if (latestDeploy.error_message) {
                    console.log(`Error: ${latestDeploy.error_message}`);
                }
            }
        }
        
        // Show recent deploy history
        console.log('\n3. Recent Deploy History:');
        deploysResponse.data.slice(0, 3).forEach((deploy, i) => {
            const time = new Date(deploy.created_at).toLocaleString();
            const commit = deploy.commit_ref ? deploy.commit_ref.substring(0, 7) : 'unknown';
            console.log(`   ${i + 1}. ${deploy.state.padEnd(8)} | ${time} | ${commit}`);
        });
        
        // Get build settings
        console.log('\n4. Build Settings:');
        console.log(`   ✓ Build command: ${site.build_settings?.cmd || 'Not set'}`);
        console.log(`   ✓ Publish directory: ${site.build_settings?.dir || 'Not set'}`);
        console.log(`   ✓ Repository: ${site.repo?.repo || 'Not connected'}`);
        
    } catch (error) {
        if (error.response?.status === 401) {
            console.error('❌ Authentication failed. Token may be invalid or expired.');
        } else {
            console.error('❌ Error:', error.message);
        }
    }
}

checkNetlifyStatus();