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
  // Simply return all sites without checking if URLs work
  // This is much faster!
  return sites.map(site => ({
    name: site.name,
    url: site.url ? buildSearchUrl(site.url, query) : null,
    type: site.type || 'direct'
  })).filter(site => site.url || site.type === 'name_only');
}

// API
