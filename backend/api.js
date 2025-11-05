const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

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

// Filter sites - NO URL CHECKING, JUST RETURN ALL
function filterSites(sites, query) {
  return sites.map(site => ({
    name: site.name,
    url: site.url ? buildSearchUrl(site.url, query) : null,
    type: site.type || 'direct'
  })).filter(site => site.url || site.type === 'name_only');
}

// API Endpoint: Search
app.post('/api/search', (req, res) => {
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

    // Filter sites - INSTANT RESPONSE
    console.log('📤 Returning all available sites...');
    const legalSites = filterSites(sourceData.legal || [], query);
    const illegalSites = filterSites(sourceData.illegal || [], query);
    const adultSites = adult ? filterSites(sourceData.adult || [], query) : [];

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

// Error handler
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({ error: err.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Node.js API running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📂 Categories: http://localhost:${PORT}/api/categories`);
  console.log(`📋 Supported categories: ${SUPPORTED_CATEGORIES.join(', ')}`);
});
