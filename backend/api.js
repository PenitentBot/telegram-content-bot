const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Load sites database - FIXED PATH
let sitesDB = {};
try {
  let dbPath = path.join(__dirname, 'sites.json');
  
  // If not found, try parent directory
  if (!fs.existsSync(dbPath)) {
    dbPath = path.join(__dirname, '..', 'database', 'sites.json');
  }
  
  console.log('📂 Looking for sites.json at:', dbPath);
  
  if (fs.existsSync(dbPath)) {
    const data = fs.readFileSync(dbPath, 'utf8');
    sitesDB = JSON.parse(data);
    console.log('✅ Sites database loaded');
    console.log('📋 Available categories:', Object.keys(sitesDB).join(', '));
  } else {
    console.warn('⚠️ sites.json not found, using empty database');
  }
} catch (error) {
  console.error('❌ Error loading sites.json:', error.message);
}

// Constants
const URL_CHECK_TIMEOUT = 8000;
const MAX_CONCURRENT = 3;

// Supported categories
const SUPPORTED_CATEGORIES = [
  'live_action',
  'cartoon',
  'anime',
  'games',
  'books',
  'music',
  'desi_webseries',
  'hentai',
  'jav',
  'adult',
  'onlyfans_leak'
];

// Default subcategories for each category
const DEFAULT_SUBCATEGORIES = {
  'live_action': 'movies',
  'cartoon': 'movies',
  'anime': 'movies',
  'games': 'classic',
  'books': 'fiction',
  'music': 'songs',
  'desi_webseries': 'movies',
  'hentai': 'movies',
  'jav': 'actress',
  'adult': 'movies',
  'onlyfans_leak': 'creator'
};

// Check if URL has actual results (scrape and verify)
async function checkUrlHasResults(url) {
  try {
    const response = await axios.get(url, {
      timeout: URL_CHECK_TIMEOUT,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      maxRedirects: 5
    });

    const html = response.data;

    // Check if page has actual content indicators
    const hasContent = 
      html.length > 5000 && // Page has substantial content
      !html.includes('404') && 
      !html.includes('not found') &&
      !html.includes('No results') &&
      !html.includes('no results');

    if (hasContent) {
      console.log(`✅ ${url} - Has results`);
      return true;
    } else {
      console.log(`❌ ${url} - No results found`);
      return false;
    }
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      console.log(`⏱️ ${url} - Timeout`);
    } else if (error.code === 'ENOTFOUND') {
      console.log(`❌ ${url} - DNS error`);
    } else if (error.response && error.response.status === 404) {
      console.log(`❌ ${url} - 404 Not Found`);
    } else {
      console.log(`❌ ${url} - Error: ${error.message}`);
    }
    return false;
  }
}

// Build search URL
function buildSearchUrl(siteUrl, query) {
  if (!siteUrl) return null;

  let url = siteUrl;

  if (url.includes('?q=')) {
    url += encodeURIComponent(query);
  } else if (url.includes('?search=')) {
    url += encodeURIComponent(query);
  } else if (url.includes('?query=')) {
    url += encodeURIComponent(query);
  } else if (url.includes('?keyword=')) {
    url += encodeURIComponent(query);
  } else if (url.includes('?s=')) {
    url += encodeURIComponent(query);
  } else if (url.includes('?text=')) {
    url += encodeURIComponent(query);
  } else if (url.endsWith('=')) {
    url += encodeURIComponent(query);
  } else if (url.endsWith('/')) {
    url += encodeURIComponent(query);
  }

  return url;
}

// Filter sites by checking actual content
async function filterSites(sites, query) {
  const validSites = [];

  // Check sites concurrently (with concurrency limit)
  for (let i = 0; i < sites.length; i += MAX_CONCURRENT) {
    const batch = sites.slice(i, i + MAX_CONCURRENT);

    const promises = batch.map(async (site) => {
      if (!site.url) {
        // Sites without URLs are always included
        return { site, hasResults: true };
      }

      const searchUrl = buildSearchUrl(site.url, query);
      if (!searchUrl) return { site, hasResults: false };

      const hasResults = await checkUrlHasResults(searchUrl);
      return { site, hasResults };
    });

    const results = await Promise.all(promises);

    results.forEach(({ site, hasResults }) => {
      if (hasResults) {
        validSites.push(site);
      }
    });
  }

  return validSites;
}

// API Endpoint: Search
app.post('/api/search', async (req, res) => {
  try {
    const { query, category = 'live_action', subcategory = 'all', adult = false } = req.body;

    console.log(`🔍 Searching: ${query} | Category: ${category} | Subcategory: ${subcategory}`);

    // Validate category
    if (!SUPPORTED_CATEGORIES.includes(category)) {
      console.log(`❌ Category not supported: ${category}`);
      return res.status(400).json({ error: 'Category not supported', category });
    }

    // Get category data
    const categoryData = sitesDB[category];
    if (!categoryData) {
      console.log(`❌ Category data not found: ${category}`);
      return res.json({ legal: [], illegal: [], adult: [] });
    }

    // Get subcategory data
    let sourceData = null;
    const defaultSubcategory = DEFAULT_SUBCATEGORIES[category] || 'movies';

    if (subcategory !== 'all' && categoryData[subcategory]) {
      sourceData = categoryData[subcategory];
      console.log(`📂 Using requested subcategory: ${subcategory}`);
    } else if (categoryData[defaultSubcategory]) {
      sourceData = categoryData[defaultSubcategory];
      console.log(`📂 Using default subcategory: ${defaultSubcategory}`);
    } else {
      const keys = Object.keys(categoryData);
      if (keys.length > 0) {
        sourceData = categoryData[keys[0]];
        console.log(`📂 Using first available subcategory: ${keys[0]}`);
      } else {
        console.log(`❌ No subcategories found for ${category}`);
        return res.json({ legal: [], illegal: [], adult: [] });
      }
    }

    // Filter sites - NOW WITH ACTUAL CONTENT CHECK
    console.log('🔍 Checking sites for actual results...');
    const legalSites = await filterSites(sourceData.legal || [], query);
    const illegalSites = await filterSites(sourceData.illegal || [], query);
    const adultSites = adult ? await filterSites(sourceData.adult || [], query) : [];

    console.log(`✅ Found: ${legalSites.length} legal, ${illegalSites.length} illegal, ${adultSites.length} adult`);

    res.json({
      legal: legalSites,
      illegal: illegalSites,
      adult: adultSites
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// API Endpoint: Get categories
app.get('/api/categories', (req, res) => {
  res.json({
    supported: SUPPORTED_CATEGORIES,
    defaults: DEFAULT_SUBCATEGORIES,
    total: SUPPORTED_CATEGORIES.length
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    categories: Object.keys(sitesDB).length,
    supported: SUPPORTED_CATEGORIES
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Node.js API running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📂 Categories: http://localhost:${PORT}/api/categories`);
  console.log(`📋 Supported categories: ${SUPPORTED_CATEGORIES.join(', ')}`);
});
