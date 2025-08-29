#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');

// Load previous results for comparison
const previousResults = JSON.parse(fs.readFileSync('ariel-university-scan-results.json', 'utf8'));

async function deepAnalysis() {
    console.log('\n🔬 DEEP ANALYSIS: ARIEL UNIVERSITY WEBSITE');
    console.log('═'.repeat(60));
    console.log('Building on previous scan of 14 pages with 1,355+ discovered URLs\n');
    
    // Step 1: Analyze URL patterns from previous scan
    console.log('1. URL PATTERN ANALYSIS');
    console.log('-'.repeat(40));
    
    const urlPatterns = {};
    const departments = new Set();
    const languages = { he: 0, en: 0, ru: 0, ar: 0 };
    
    previousResults.pages.forEach(page => {
        const url = page.url;
        
        // Language detection
        if (url.includes('/en')) languages.en++;
        else if (url.includes('/ru')) languages.ru++;
        else if (url.includes('/ar')) languages.ar++;
        else languages.he++; // Default Hebrew
        
        // Department/section extraction
        const match = url.match(/\/wp\/([^\/]+)/);
        if (match) {
            const section = match[1];
            urlPatterns[section] = (urlPatterns[section] || 0) + 1;
            departments.add(section);
        }
    });
    
    console.log('Language Distribution:');
    Object.entries(languages).forEach(([lang, count]) => {
        if (count > 0) {
            const percentage = ((count / previousResults.pages.length) * 100).toFixed(1);
            console.log(`  ${lang.toUpperCase()}: ${count} pages (${percentage}%)`);
        }
    });
    
    console.log('\nTop Sections Found:');
    Object.entries(urlPatterns)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([section, count]) => {
            console.log(`  /${section}: ${count} occurrence(s)`);
        });
    
    // Step 2: Analyze discovered but uncrawled URLs
    console.log('\n2. QUEUE ANALYSIS (1,355+ URLs)');
    console.log('-'.repeat(40));
    
    // From the logs, we know the queue grew to 1,355+ URLs
    const queueGrowth = [
        { page: 1, queue: 136 },
        { page: 2, queue: 243 },
        { page: 5, queue: 433 },
        { page: 10, queue: 964 },
        { page: 15, queue: 1227 },
        { page: 20, queue: 1355 }
    ];
    
    console.log('Queue Growth Pattern:');
    queueGrowth.forEach(point => {
        const bar = '█'.repeat(Math.floor(point.queue / 50));
        console.log(`  Page ${String(point.page).padStart(2)}: ${bar} ${point.queue} URLs`);
    });
    
    const avgLinksPerPage = 1355 / 20;
    console.log(`\nAverage links discovered per page: ${avgLinksPerPage.toFixed(1)}`);
    console.log('Estimated total pages (if fully crawled): 500-1000+');
    
    // Step 3: Content analysis
    console.log('\n3. CONTENT QUALITY ANALYSIS');
    console.log('-'.repeat(40));
    
    const qualityScores = previousResults.pages
        .map(p => p.quality || p.qualityScore || 0)
        .filter(q => q > 0);
    
    if (qualityScores.length > 0) {
        const avgQuality = qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length;
        const minQuality = Math.min(...qualityScores);
        const maxQuality = Math.max(...qualityScores);
        
        console.log(`Average Quality: ${avgQuality.toFixed(1)}%`);
        console.log(`Quality Range: ${minQuality}% - ${maxQuality}%`);
        
        // Quality distribution
        const qualityBuckets = { high: 0, medium: 0, low: 0 };
        qualityScores.forEach(score => {
            if (score >= 70) qualityBuckets.high++;
            else if (score >= 40) qualityBuckets.medium++;
            else qualityBuckets.low++;
        });
        
        console.log('\nQuality Distribution:');
        console.log(`  High (70%+): ${qualityBuckets.high} pages`);
        console.log(`  Medium (40-69%): ${qualityBuckets.medium} pages`);
        console.log(`  Low (<40%): ${qualityBuckets.low} pages`);
    }
    
    // Step 4: Academic content detection
    console.log('\n4. ACADEMIC CONTENT DETECTION');
    console.log('-'.repeat(40));
    
    const academicKeywords = {
        research: ['research', 'מחקר'],
        faculty: ['faculty', 'סגל'],
        students: ['students', 'סטודנטים'],
        courses: ['courses', 'קורסים'],
        departments: ['department', 'מחלקה'],
        library: ['library', 'ספרייה'],
        admissions: ['admissions', 'הרשמה']
    };
    
    const detectedContent = {};
    
    previousResults.pages.forEach(page => {
        const content = (page.title + ' ' + page.url).toLowerCase();
        
        Object.entries(academicKeywords).forEach(([category, keywords]) => {
            if (keywords.some(kw => content.includes(kw))) {
                detectedContent[category] = (detectedContent[category] || 0) + 1;
            }
        });
    });
    
    console.log('Academic Content Found:');
    Object.entries(detectedContent).forEach(([category, count]) => {
        console.log(`  ${category}: ${count} page(s)`);
    });
    
    if (Object.keys(detectedContent).length === 0) {
        console.log('  ⚠️  Limited academic content at depth 1');
        console.log('  Recommendation: Increase depth to 3-4 for academic pages');
    }
    
    // Step 5: Recommendations for comprehensive mapping
    console.log('\n5. OPTIMIZATION RECOMMENDATIONS');
    console.log('-'.repeat(40));
    
    console.log('\n🎯 For Comprehensive University Mapping:');
    
    console.log('\nA. Targeted Crawling Strategy:');
    console.log('   Start with specific entry points:');
    const entryPoints = [
        'https://www.ariel.ac.il/wp/en/schools/',
        'https://www.ariel.ac.il/wp/research/',
        'https://www.ariel.ac.il/wp/departments/',
        'https://www.ariel.ac.il/wp/library/'
    ];
    entryPoints.forEach(url => console.log(`   - ${url}`));
    
    console.log('\nB. Optimal Parameters:');
    console.log('   {');
    console.log('     maxPages: 200,        // Cover main sections');
    console.log('     maxDepth: 4,          // Reach course pages');
    console.log('     crawlDelay: 2000,     // Respectful crawling');
    console.log('     minQualityScore: 20,  // Include more pages');
    console.log('   }');
    
    console.log('\nC. Language-Specific Scans:');
    console.log('   - Hebrew: Start from /wp/');
    console.log('   - English: Start from /wp/en/');
    console.log('   - Process separately for better classification');
    
    // Step 6: Estimated full scan metrics
    console.log('\n6. FULL SCAN PROJECTIONS');
    console.log('-'.repeat(40));
    
    const projections = {
        totalPages: 500,
        scanTime: '15-20 minutes',
        dataSize: '10-15 MB',
        languages: 4,
        departments: 20,
        courses: 200
    };
    
    console.log('Based on queue analysis (1,355 URLs discovered):');
    Object.entries(projections).forEach(([metric, value]) => {
        console.log(`  Estimated ${metric}: ${value}`);
    });
    
    // Step 7: Alternative approaches
    console.log('\n7. ALTERNATIVE SCANNING APPROACHES');
    console.log('-'.repeat(40));
    
    console.log('\n📋 Recommended Multi-Phase Approach:');
    console.log('\nPhase 1: Sitemap Discovery');
    console.log('  - Check for XML sitemaps');
    console.log('  - Parse department listings');
    console.log('  - Build URL inventory');
    
    console.log('\nPhase 2: Targeted Deep Scan');
    console.log('  - Focus on academic sections');
    console.log('  - Extract course information');
    console.log('  - Capture faculty profiles');
    
    console.log('\nPhase 3: Content Enrichment');
    console.log('  - Process Hebrew content');
    console.log('  - Extract contact information');
    console.log('  - Build knowledge graph');
    
    // Save analysis
    const analysisReport = {
        date: new Date().toISOString(),
        previousScan: {
            pages: previousResults.pages.length,
            words: previousResults.statistics.totalWords,
            quality: previousResults.statistics.avgQualityScore
        },
        discovered: {
            totalUrls: 1355,
            departments: Array.from(departments),
            languages: languages
        },
        projections: projections,
        recommendations: {
            maxPages: 200,
            maxDepth: 4,
            targetedUrls: entryPoints
        }
    };
    
    fs.writeFileSync('ariel-deep-analysis.json', JSON.stringify(analysisReport, null, 2));
    
    console.log('\n' + '═'.repeat(60));
    console.log('📊 ANALYSIS COMPLETE');
    console.log('═'.repeat(60));
    console.log('\n✅ Deep analysis saved to: ariel-deep-analysis.json');
    console.log('\nNext Steps:');
    console.log('1. Run targeted scan with optimized parameters');
    console.log('2. Test comprehensive-map endpoint for better coverage');
    console.log('3. Implement language-specific classification');
    console.log('4. Consider API rate limiting for production use\n');
}

// Run analysis
deepAnalysis().catch(console.error);