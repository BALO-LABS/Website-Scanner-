#!/usr/bin/env node

const axios = require('axios');
const cheerio = require('cheerio');

async function debugBaloLabs() {
    console.log('🔍 Debugging BALO LABS Website Structure\n');
    console.log('═'.repeat(60));
    
    const testUrl = 'https://www.balolabs.com/';
    
    // Try different proxy methods
    const proxies = [
        {
            name: 'CorsProxy.io',
            url: `https://corsproxy.io/?${encodeURIComponent(testUrl)}`,
            processResponse: (data) => data
        },
        {
            name: 'AllOrigins Raw',
            url: `https://api.allorigins.win/raw?url=${encodeURIComponent(testUrl)}`,
            processResponse: (data) => data
        }
    ];
    
    for (const proxy of proxies) {
        console.log(`\nTesting with ${proxy.name}:`);
        console.log('-'.repeat(40));
        
        try {
            const response = await axios.get(proxy.url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });
            
            const html = proxy.processResponse(response.data);
            const $ = cheerio.load(html);
            
            console.log(`✓ Got HTML (${html.length} bytes)`);
            
            // Analyze the page structure
            console.log('\n📊 Page Analysis:');
            
            // Check for common Wix patterns
            const wixElements = {
                'Wix data-uri': $('[data-uri]').length,
                'Wix pages': $('[data-page-id]').length,
                'Wix links': $('a[data-anchor]').length,
                'Regular links': $('a[href]').length,
                'Nav elements': $('nav').length,
                'Menu items': $('[role="menuitem"]').length
            };
            
            Object.entries(wixElements).forEach(([name, count]) => {
                console.log(`  ${name}: ${count}`);
            });
            
            // Extract all types of links
            console.log('\n🔗 Link Extraction:');
            
            // 1. Standard href links
            const hrefLinks = new Set();
            $('a[href]').each((i, el) => {
                const href = $(el).attr('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                    hrefLinks.add(href);
                }
            });
            
            console.log(`\nStandard <a href> links (${hrefLinks.size}):`);
            Array.from(hrefLinks).slice(0, 10).forEach(link => {
                console.log(`  - ${link}`);
            });
            
            // 2. Look for Wix-specific navigation
            const dataUris = new Set();
            $('[data-uri]').each((i, el) => {
                const uri = $(el).attr('data-uri');
                if (uri) dataUris.add(uri);
            });
            
            if (dataUris.size > 0) {
                console.log(`\nWix data-uri links (${dataUris.size}):`);
                Array.from(dataUris).forEach(uri => {
                    console.log(`  - ${uri}`);
                });
            }
            
            // 3. Check for JavaScript-based links
            const scripts = $('script').map((i, el) => $(el).html()).get();
            let jsLinks = new Set();
            
            scripts.forEach(script => {
                if (!script) return;
                
                // Look for URLs in JavaScript
                const urlPatterns = [
                    /["']\/[a-zA-Z0-9\-_\/]+["']/g,  // Relative paths
                    /https?:\/\/[^"'\s]+/g,          // Full URLs
                    /pages\/[a-zA-Z0-9\-_]+/g,       // Page references
                ];
                
                urlPatterns.forEach(pattern => {
                    const matches = script.match(pattern);
                    if (matches) {
                        matches.forEach(match => {
                            const cleaned = match.replace(/["']/g, '');
                            if (!cleaned.includes('.js') && !cleaned.includes('.css')) {
                                jsLinks.add(cleaned);
                            }
                        });
                    }
                });
            });
            
            if (jsLinks.size > 0) {
                console.log(`\nJavaScript-referenced paths (${jsLinks.size}):`);
                Array.from(jsLinks).slice(0, 10).forEach(link => {
                    console.log(`  - ${link}`);
                });
            }
            
            // 4. Try to find navigation menu structure
            const navLinks = [];
            $('nav a, [role="navigation"] a, .menu a, .nav a').each((i, el) => {
                const text = $(el).text().trim();
                const href = $(el).attr('href') || $(el).attr('data-uri') || '';
                if (text && href) {
                    navLinks.push({ text, href });
                }
            });
            
            if (navLinks.length > 0) {
                console.log(`\nNavigation menu items (${navLinks.length}):`);
                navLinks.forEach(item => {
                    console.log(`  - "${item.text}" -> ${item.href}`);
                });
            }
            
            // 5. Check for sitemap or robots.txt
            console.log('\n📄 Checking for sitemap...');
            try {
                const sitemapUrls = [
                    'https://www.balolabs.com/sitemap.xml',
                    'https://www.balolabs.com/sitemap_index.xml',
                    'https://www.balolabs.com/robots.txt'
                ];
                
                for (const sitemapUrl of sitemapUrls) {
                    try {
                        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(sitemapUrl)}`;
                        const sitemapResponse = await axios.get(proxyUrl, { timeout: 5000 });
                        
                        if (sitemapResponse.data) {
                            console.log(`  ✓ Found: ${sitemapUrl}`);
                            
                            // Extract URLs from sitemap
                            if (sitemapUrl.includes('.xml')) {
                                const urlMatches = sitemapResponse.data.match(/<loc>([^<]+)<\/loc>/g);
                                if (urlMatches) {
                                    console.log(`    Found ${urlMatches.length} URLs in sitemap`);
                                    urlMatches.slice(0, 5).forEach(match => {
                                        const url = match.replace(/<\/?loc>/g, '');
                                        console.log(`    - ${url}`);
                                    });
                                }
                            }
                        }
                    } catch (e) {
                        // Sitemap not found
                    }
                }
            } catch (e) {
                console.log('  ✗ No sitemap found');
            }
            
            // Summary
            console.log('\n📊 SUMMARY:');
            console.log(`Total unique links found: ${hrefLinks.size + dataUris.size}`);
            console.log(`Standard HTML links: ${hrefLinks.size}`);
            console.log(`Wix-specific links: ${dataUris.size}`);
            console.log(`Navigation items: ${navLinks.length}`);
            
            // Identify the issue
            console.log('\n⚠️  POTENTIAL ISSUES:');
            if (hrefLinks.size < 5) {
                console.log('- Very few standard HTML links found');
                console.log('- Site likely uses JavaScript routing (SPA)');
            }
            if (dataUris.size > 0) {
                console.log('- Site uses Wix-specific navigation');
                console.log('- Links may not be in standard <a href> format');
            }
            if (jsLinks.size > hrefLinks.size) {
                console.log('- More links in JavaScript than HTML');
                console.log('- Dynamic content generation detected');
            }
            
            break; // Only test with first working proxy
            
        } catch (error) {
            console.log(`✗ Failed: ${error.message}`);
        }
    }
    
    console.log('\n' + '═'.repeat(60));
    console.log('💡 RECOMMENDATIONS:');
    console.log('1. Scanner needs to handle Wix-specific link formats');
    console.log('2. May need to extract links from JavaScript');
    console.log('3. Check for data-uri attributes in addition to href');
    console.log('4. Consider using sitemap.xml if available');
    console.log('═'.repeat(60) + '\n');
}

debugBaloLabs();