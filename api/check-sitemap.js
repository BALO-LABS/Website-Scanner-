const axios = require('axios');
const cheerio = require('cheerio');

async function checkSitemap(url) {
    console.log(`\n=== Fetching sitemap from: ${url} ===\n`);
    
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; RAGCollector/1.0)',
            },
            timeout: 10000
        });
        
        // Check if it's XML sitemap
        if (response.headers['content-type']?.includes('xml')) {
            const $ = cheerio.load(response.data, { xmlMode: true });
            const urls = [];
            
            // Standard sitemap format
            $('url > loc').each((i, elem) => {
                urls.push($(elem).text());
            });
            
            // Sitemap index format
            $('sitemap > loc').each((i, elem) => {
                urls.push($(elem).text());
            });
            
            console.log(`Found ${urls.length} URLs in sitemap:\n`);
            urls.slice(0, 50).forEach(u => console.log(`  ${u}`));
            if (urls.length > 50) {
                console.log(`  ... and ${urls.length - 50} more`);
            }
            
            // Group by path pattern
            const patterns = {};
            urls.forEach(u => {
                try {
                    const urlObj = new URL(u);
                    const pathParts = urlObj.pathname.split('/').filter(p => p);
                    const pattern = pathParts[0] || '/';
                    patterns[pattern] = (patterns[pattern] || 0) + 1;
                } catch (e) {
                    // Invalid URL
                }
            });
            
            console.log(`\n📊 URL Patterns:`);
            Object.entries(patterns).sort((a, b) => b[1] - a[1]).forEach(([pattern, count]) => {
                console.log(`  /${pattern}: ${count} pages`);
            });
            
        } else if (response.headers['content-type']?.includes('html')) {
            // HTML sitemap
            const $ = cheerio.load(response.data);
            const links = [];
            $('a[href]').each((i, elem) => {
                const href = $(elem).attr('href');
                if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
                    links.push(href);
                }
            });
            console.log(`HTML sitemap with ${links.length} links`);
        } else {
            console.log(`Unknown content type: ${response.headers['content-type']}`);
            console.log(response.data.substring(0, 500));
        }
        
    } catch (error) {
        console.error(`❌ Error fetching sitemap:`, error.message);
    }
}

// Check chatbase.co sitemap
checkSitemap('https://www.chatbase.co/sitemap.xml')
    .then(() => console.log('\n=== Sitemap check complete ==='))
    .catch(console.error);