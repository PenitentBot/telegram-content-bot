// Load sites database
let sitesDatabase = {};
let captchaCorrectAnswer = 0;

// API URL - Change this when deploying
const API_URL = "https://telegram-content-bot-backend.onrender.com"

async function loadSitesDatabase() {
  try {
    console.log('✅ Using backend API for sites database');
    // Don't load local sites.json - backend API will handle it
  } catch (error) {
    console.error('❌ Error:', error);
  }
}


// Generate Captcha
function generateCaptcha() {
  const num1 = Math.floor(Math.random() * 20);
  const num2 = Math.floor(Math.random() * 20);
  captchaCorrectAnswer = num1 + num2;

  const num1Elem = document.getElementById('num1');
  const num2Elem = document.getElementById('num2');
  if (num1Elem) num1Elem.textContent = num1;
  if (num2Elem) num2Elem.textContent = num2;

  console.log('🔐 Captcha generated: ' + num1 + ' + ' + num2 + ' = ' + captchaCorrectAnswer);
}

function verifyCaptcha() {
  const userAnswer = parseInt(document.getElementById('captchaAnswer').value);

  if (userAnswer === captchaCorrectAnswer) {
    console.log('✅ Captcha verified correctly');
    document.getElementById('captchaModal').style.display = 'none';

    // Check if need age verification
    const params = getUrlParams();
    if (needsAgeVerification(params.category)) {
      console.log('⚠️ Showing age verification');
      document.getElementById('ageModal').style.display = 'flex';
    } else {
      console.log('✅ Starting countdown');
      showAdSpace();
    }
  } else {
    console.log('❌ Wrong captcha answer');
    document.getElementById('captchaError').textContent = '❌ Wrong answer! Try again.';
    document.getElementById('captchaError').style.display = 'block';
    document.getElementById('captchaAnswer').value = '';
    generateCaptcha();

    setTimeout(() => {
      document.getElementById('captchaError').style.display = 'none';
    }, 3000);
  }
}

function confirmAge(isAdult) {
  const ageModal = document.getElementById('ageModal');
  if (!ageModal) {
    console.error('❌ Age modal not found');
    return;
  }

  if (isAdult) {
    console.log('✅ Age verified');
    ageModal.style.display = 'none';
    showAdSpace();
  } else {
    alert('❌ You must be 18+ to view this content.');
    window.location.href = 'https://t.me/YOUR_BOT_USERNAME_HERE';
  }
}

function showAdSpace() {
  const adSection = document.getElementById('adSection');
  if (!adSection) {
    console.error('❌ Ad section not found');
    startCountdown();
    return;
  }

  adSection.style.display = 'block';
  startCountdown();
}

function startCountdown() {
  let timeLeft = 15;

  const resultsSection = document.getElementById('resultsSection');
  if (!resultsSection) {
    console.error('❌ Results section not found');
    return;
  }

  resultsSection.style.display = 'block';

  const countdownHtml = `
    <div class="countdown-container">
      <div class="countdown-box">
        <h2>⏳ Checking available sources...</h2>
        <div class="countdown-timer">
          <span id="countdownNumber">15</span>
        </div>
        <p>Results will appear in <span id="countdownText">15</span> seconds</p>
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill"></div>
        </div>
      </div>
    </div>
  `;

  resultsSection.innerHTML = countdownHtml;

  const interval = setInterval(() => {
    timeLeft--;

    const countdownNum = document.getElementById('countdownNumber');
    const countdownTxt = document.getElementById('countdownText');
    const progressFill = document.getElementById('progressFill');

    if (countdownNum && countdownTxt && progressFill) {
      countdownNum.textContent = timeLeft;
      countdownTxt.textContent = timeLeft;
      progressFill.style.width = ((15 - timeLeft) / 15 * 100) + '%';
    }

    if (timeLeft < 0) {
      clearInterval(interval);
      checkAndShowResults();
    }
  }, 1000);
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    query: decodeURIComponent(params.get('q') || 'Unknown'),
    category: params.get('category') || 'live_action',
    subcategory: params.get('subcategory') || 'all',
    isAdult: params.get('adult') === 'true'
  };
}

function needsAgeVerification(category) {
  const adultCategories = ['hentai', 'jav', 'adult', 'onlyfans_leak', 'desi_webseries'];
  return adultCategories.includes(category);
}

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

// Call backend API to get filtered sites
async function checkAndShowResults() {
  const params = getUrlParams();

  const resultsSection = document.getElementById('resultsSection');
  if (!resultsSection) {
    console.error('❌ Results section not found');
    return;
  }

  // Show loading message
  resultsSection.innerHTML = `
    <div class="countdown-container">
      <div class="countdown-box">
        <h2>🔍 Checking sources...</h2>
        <p>Please wait while we verify available sites</p>
      </div>
    </div>
  `;

  try {
    // Call backend API
    console.log('📡 Calling API:', API_URL + '/api/search');

    const response = await fetch(API_URL + '/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: params.query,
        category: params.category,
        subcategory: params.subcategory,
        adult: params.isAdult
      })
    });

    if (!response.ok) {
      throw new Error('API error: ' + response.statusText);
    }

    const data = await response.json();
    console.log('✅ API response:', data);

    showResults(data, params);
  } catch (error) {
    console.error('❌ API error:', error);
    resultsSection.innerHTML = `
      <div class="no-results">
        ❌ Error checking sources: ${error.message}
        <br><small>Make sure backend API is running</small>
      </div>
    `;
  }
}

function showResults(sites, params) {
  const resultsSection = document.getElementById('resultsSection');
  if (!resultsSection) {
    console.error('❌ Results section not found');
    return;
  }

  let resultsHtml = `<h1>📺 Results for: <strong>${params.query}</strong></h1><div class="results-container">`;

  if (sites.legal.length > 0) {
    resultsHtml += '<div class="results-group"><h2>✅ Legal Sources (' + sites.legal.length + ')</h2><div>';
    resultsHtml += sites.legal.map(site => {
      const searchUrl = buildSearchUrl(site.url, params.query);
      return `
        <div class="result-item">
          <div class="result-name">${site.name}</div>
          <a href="${searchUrl}" target="_blank">👉 Open ${site.name}</a>
        </div>
      `;
    }).join('');
    resultsHtml += '</div></div>';
  }

  if (sites.illegal.length > 0) {
    resultsHtml += '<div class="results-group"><h2>⚠️ Illegal Sources (' + sites.illegal.length + ')</h2><div>';
    resultsHtml += sites.illegal.map(site => {
      const searchUrl = buildSearchUrl(site.url, params.query);
      return `
        <div class="result-item illegal">
          <div class="result-name">⚠️ ${site.name}</div>
          <a href="${searchUrl}" target="_blank">👉 Open ${site.name}</a>
        </div>
      `;
    }).join('');
    resultsHtml += '</div></div>';
  }

  const isAdultCategory = needsAgeVerification(params.category);
  if (sites.adult.length > 0 && isAdultCategory) {
    resultsHtml += '<div class="results-group"><h2>🔞 Adult Sources (' + sites.adult.length + ')</h2><div>';
    resultsHtml += sites.adult.map(site => {
      if (site.type === 'name_only' || !site.url) {
        return `
          <div class="result-item adult">
            <div class="result-name">🔞 ${site.name}</div>
          </div>
        `;
      }
      const searchUrl = buildSearchUrl(site.url, params.query);
      return `
        <div class="result-item adult">
          <div class="result-name">🔞 ${site.name}</div>
          <a href="${searchUrl}" target="_blank">👉 Open ${site.name}</a>
        </div>
      `;
    }).join('');
    resultsHtml += '</div></div>';
  }

  const hasResults = sites.legal.length > 0 || sites.illegal.length > 0 || sites.adult.length > 0;
  if (!hasResults) {
    resultsHtml += '<div class="no-results">😕 No available sources found for: <strong>' + params.query + '</strong></div>';
  }

  resultsHtml += '</div><div class="footer"><p>🔙 <a href="https://t.me/YOUR_BOT_USERNAME_HERE">Back to Telegram Bot</a></p></div>';

  resultsSection.innerHTML = resultsHtml;
}

// Main initialization
async function init() {
  console.log('🚀 App initializing...');

  await loadSitesDatabase();

  const params = getUrlParams();
  console.log('📍 URL Params:', params);

  const captchaModal = document.getElementById('captchaModal');
  const ageModal = document.getElementById('ageModal');
  const adSection = document.getElementById('adSection');
  const resultsSection = document.getElementById('resultsSection');

  if (!captchaModal || !ageModal || !adSection || !resultsSection) {
    console.error('❌ Some modal elements not found');
    return;
  }

  // Hide everything first
  captchaModal.style.display = 'none';
  ageModal.style.display = 'none';
  adSection.style.display = 'none';
  resultsSection.style.display = 'none';

  // Show captcha
  console.log('🔐 Showing captcha');
  captchaModal.style.display = 'flex';
  generateCaptcha();
}

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('✅ DOM loaded');
  init();

  // Captcha input Enter key
  const captchaInput = document.getElementById('captchaAnswer');
  if (captchaInput) {
    captchaInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        verifyCaptcha();
      }
    });
  }
});

console.log('✅ script.js loaded');
