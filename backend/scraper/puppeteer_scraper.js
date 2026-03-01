/**
 * High-Performance Booking.com Scraper — PRODUCTION v3
 *
 * Architecture:
 *   1. Single browser, single reusable tab
 *   2. Multi-filter × multi-sort strategy (no pagination needed)
 *   3. Aggressive resource blocking (images, fonts, analytics)
 *   4. 4 sort orders × star/review filters = 25+ search passes
 *   5. Strict URL-based deduplication
 *   6. Targets 200-500+ unique hotels in 60-120 seconds
 *
 * Booking.com blocks pagination for headless browsers but returns
 * different results for different sort/filter combos. We exploit
 * this to gather a large set of unique properties.
 */

'use strict';

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// ── Configuration ──────────────────────────────────────────────────────────

const PAGE_SIZE = 25;
const MAX_CONSECUTIVE_EMPTY = 3;      // Stop after 3 consecutive 0-new-hotel searches
const MAX_RETRY_PER_PAGE = 2;
const PRICE_WAIT_MS = 800;            // Quick price XHR wait (most load fast)
const NAV_TIMEOUT = 20000;            // 20s navigation timeout
const DEFAULT_MAX_SECONDS = 120;      // Total budget
const SORT_ORDERS = ['price', 'popularity', 'distance', 'review_score'];

// ── Search Combinations: sort × filter (ordered by expected yield) ──
// Booking.com blocks pagination for bots but serves different first-page
// results for different sort/filter combos. Each combo yields ~20-25 hotels.
const SEARCH_COMBOS = [
  // Tier 1: Base sorts (no filter) — highest unique yield
  { sort: 'price',        nflt: '' },
  { sort: 'popularity',   nflt: '' },
  { sort: 'distance',     nflt: '' },
  { sort: 'review_score', nflt: '' },

  // Tier 2: Star rating filters × price sort — very high differentiation
  { sort: 'price', nflt: 'class%3D5' },
  { sort: 'price', nflt: 'class%3D4' },
  { sort: 'price', nflt: 'class%3D3' },
  { sort: 'price', nflt: 'class%3D2' },
  { sort: 'price', nflt: 'class%3D1' },

  // Tier 3: Star rating filters × popularity sort
  { sort: 'popularity', nflt: 'class%3D5' },
  { sort: 'popularity', nflt: 'class%3D4' },
  { sort: 'popularity', nflt: 'class%3D3' },
  { sort: 'popularity', nflt: 'class%3D2' },

  // Tier 4: Review score filters × price sort
  { sort: 'price', nflt: 'review_score%3D90' },
  { sort: 'price', nflt: 'review_score%3D80' },
  { sort: 'price', nflt: 'review_score%3D70' },
  { sort: 'price', nflt: 'review_score%3D60' },

  // Tier 5: Review score filters × popularity sort
  { sort: 'popularity', nflt: 'review_score%3D90' },
  { sort: 'popularity', nflt: 'review_score%3D80' },

  // Tier 6: Star rating × distance/review sorts (lower priority)
  { sort: 'distance',     nflt: 'class%3D5' },
  { sort: 'distance',     nflt: 'class%3D4' },
  { sort: 'distance',     nflt: 'class%3D3' },
  { sort: 'review_score', nflt: 'class%3D5' },
  { sort: 'review_score', nflt: 'class%3D4' },
  { sort: 'review_score', nflt: 'class%3D3' },

  // Tier 7: Cross-filter combos for extra coverage
  { sort: 'distance',     nflt: 'review_score%3D80' },
  { sort: 'review_score', nflt: 'review_score%3D70' },
  { sort: 'popularity',   nflt: 'class%3D1' },
  { sort: 'distance',     nflt: 'class%3D2' },
  { sort: 'price',        nflt: 'review_score%3D50' },
  { sort: 'popularity',   nflt: 'review_score%3D60' },
  { sort: 'distance',     nflt: 'class%3D1' },
  { sort: 'review_score', nflt: 'class%3D2' },
  { sort: 'review_score', nflt: 'class%3D1' },
  { sort: 'distance',     nflt: 'review_score%3D60' },

  // Tier 8: Property type filters (hotels, apartments, guest houses, hostels)
  { sort: 'price',        nflt: 'ht_id%3D204' },    // Hotel
  { sort: 'price',        nflt: 'ht_id%3D201' },    // Apartment
  { sort: 'price',        nflt: 'ht_id%3D216' },    // Guest house
  { sort: 'price',        nflt: 'ht_id%3D203' },    // Hostel
  { sort: 'popularity',   nflt: 'ht_id%3D204' },    // Hotel
  { sort: 'popularity',   nflt: 'ht_id%3D201' },    // Apartment
  { sort: 'popularity',   nflt: 'ht_id%3D216' },    // Guest house
  { sort: 'distance',     nflt: 'ht_id%3D204' },    // Hotel
  { sort: 'distance',     nflt: 'ht_id%3D201' },    // Apartment
  { sort: 'review_score', nflt: 'ht_id%3D204' },    // Hotel

  // Tier 9: Combined star + review filters for deep mining
  { sort: 'price',        nflt: 'class%3D3%3Breview_score%3D80' },
  { sort: 'price',        nflt: 'class%3D4%3Breview_score%3D80' },
  { sort: 'popularity',   nflt: 'class%3D3%3Breview_score%3D70' },
  { sort: 'popularity',   nflt: 'class%3D5%3Breview_score%3D80' },
  { sort: 'distance',     nflt: 'class%3D3%3Breview_score%3D70' },
  { sort: 'distance',     nflt: 'class%3D5%3Breview_score%3D90' },

  // Tier 10: Additional property types + sort combos
  { sort: 'distance',     nflt: 'ht_id%3D216' },    // Guest house × distance
  { sort: 'review_score', nflt: 'ht_id%3D201' },    // Apartment × review
  { sort: 'review_score', nflt: 'ht_id%3D216' },    // Guest house × review
  { sort: 'distance',     nflt: 'ht_id%3D203' },    // Hostel × distance
  { sort: 'price',        nflt: 'ht_id%3D219' },    // B&B × price
  { sort: 'price',        nflt: 'ht_id%3D208' },    // Lodge × price
  { sort: 'popularity',   nflt: 'ht_id%3D203' },    // Hostel × popularity

  // Tier 11: class_asc and class sort variants
  { sort: 'class',        nflt: '' },                // Star rating desc
  { sort: 'class_asc',    nflt: '' },                // Star rating asc
  { sort: 'class',        nflt: 'review_score%3D80' },
  { sort: 'class_asc',    nflt: 'review_score%3D70' },
];

const BROWSER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--disable-software-rasterizer',
  '--window-size=1440,900',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--disable-features=TranslateUI,BlinkGenPropertyTrees',
  '--disable-ipc-flooding-protection',
  '--disable-hang-monitor',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-default-apps',
  '--disable-sync',
  '--disable-translate',
  '--disable-extensions',
  '--metrics-recording-only',
  '--no-first-run',
  '--no-default-browser-check',
  '--lang=en-US,en',
  '--js-flags=--max-old-space-size=512',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
];

// ── Helpers ────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);
const randomDelay = (min, max) => sleep(rand(min, max));
const pickUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
const log = msg => process.stderr.write(msg + '\n');

function hotelKey(url, name) {
  if (url) {
    try {
      const u = new URL(url);
      // Use pathname only (strip query params) for dedup
      return u.pathname.toLowerCase().replace(/\/+$/, '');
    } catch { /* fall through */ }
    const cleaned = url.toLowerCase().split('?')[0].replace(/\/+$/, '');
    return cleaned;
  }
  return name ? name.toLowerCase().trim().replace(/\s+/g, ' ') : null;
}

function buildUrl(params, sort, nflt) {
  const base = 'https://www.booking.com/searchresults.html';

  // Ensure dates are in the future — Booking.com rejects past dates
  let checkin = params.checkin || '';
  let checkout = params.checkout || '';
  if (checkin) {
    const checkinDate = new Date(checkin);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (checkinDate < today) {
      // Shift to tomorrow/day-after
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(today);
      dayAfter.setDate(dayAfter.getDate() + 2);
      checkin = tomorrow.toISOString().split('T')[0];
      checkout = dayAfter.toISOString().split('T')[0];
      log(`  [WARN] Dates were in the past — shifted to ${checkin} / ${checkout}`);
    }
  }

  const p = new URLSearchParams({
    ss: params.city || 'Lahore',
    ssne: params.city || 'Lahore',
    ssne_untouched: params.city || 'Lahore',
    dest_id: params.dest_id || '-2767043',
    dest_type: params.dest_type || 'city',
    checkin,
    checkout,
    group_adults: String(parseInt(params.adults || 2)),
    no_rooms: String(parseInt(params.rooms || 1)),
    group_children: String(parseInt(params.children || 0)),
    lang: 'en-us',
    selected_currency: 'PKR',
    order: sort,
    rows: String(PAGE_SIZE),
    sb: '1',
    src_elem: 'sb',
    src: 'index',
    sb_price_type: 'total',
  });
  // Add filter if specified (already URL-encoded)
  if (nflt) p.set('nflt', decodeURIComponent(nflt));
  return `${base}?${p.toString()}`;
}

// ── Browser & Page Setup ───────────────────────────────────────────────────

async function launchBrowser() {
  return puppeteer.launch({
    headless: 'new',
    args: BROWSER_ARGS,
    ignoreHTTPSErrors: true,
    defaultViewport: { width: 1440, height: 900 },
  });
}

async function setupPage(browser) {
  const page = await browser.newPage();
  const ua = pickUA();
  await page.setUserAgent(ua);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Upgrade-Insecure-Requests': '1',
    'sec-ch-ua': '"Chromium";v="131", "Google Chrome";v="131", "Not_A Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'none',
    'sec-fetch-user': '?1',
  });

  // Anti-detection
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    Object.defineProperty(navigator, 'plugins', {
      get: () => {
        const arr = [
          { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
          { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
          { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
        ];
        arr.length = 3;
        return arr;
      }
    });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 0 });
    window.chrome = {
      runtime: { id: undefined, connect: () => {}, sendMessage: () => {} },
      loadTimes: () => ({}), csi: () => ({}),
    };
    const origQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (params) => {
      if (params.name === 'notifications') return Promise.resolve({ state: Notification.permission });
      return origQuery(params);
    };
    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (param) {
      if (param === 37445) return 'Intel Inc.';
      if (param === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, param);
    };
  });

  // ── AGGRESSIVE resource blocking for speed ──
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    const url = req.url();

    // Block: images, fonts, media (keep stylesheets — CSSOM needed for JS rendering)
    if (['image', 'font', 'media', 'texttrack', 'manifest'].includes(type)) {
      return req.abort();
    }

    // Block tracking / analytics scripts
    if (type === 'script' && (
      url.includes('google-analytics') ||
      url.includes('googletagmanager') ||
      url.includes('facebook') ||
      url.includes('hotjar') ||
      url.includes('criteo') ||
      url.includes('doubleclick') ||
      url.includes('adservice') ||
      url.includes('tiqcdn') ||
      url.includes('sentry')
    )) {
      return req.abort();
    }

    req.continue();
  });

  return page;
}

// ── Dismiss Cookie / Popup Overlays ────────────────────────────────────────

async function dismissOverlays(page) {
  try {
    const selectors = [
      '#onetrust-accept-btn-handler',
      '[data-testid="accept-cookies"]',
      'button[id*="cookie"]',
      'button[aria-label*="Accept"]',
      'button[aria-label*="Dismiss"]',
    ];
    for (const sel of selectors) {
      try {
        const btn = await page.$(sel);
        if (btn) { await btn.click(); await sleep(500); }
      } catch { /* ignore */ }
    }
    try {
      const closeBtn = await page.$('[aria-label="Dismiss sign-in info."]');
      if (closeBtn) { await closeBtn.click(); await sleep(300); }
    } catch { /* ignore */ }
  } catch { /* ignore */ }
}

// ── Wait For Cards + Scroll ────────────────────────────────────────────────

async function waitForCards(page, isFirst = false) {
  try {
    await page.waitForSelector('[data-testid="property-card"]', { timeout: isFirst ? 15000 : 8000 });
  } catch { /* page may have no results */ }

  // Quick scroll to trigger lazy-load (3 short scrolls)
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, window.innerHeight * 1.5));
    await sleep(100);
  }

  // Brief wait for price XHR
  await sleep(PRICE_WAIT_MS);

  await page.evaluate(() => window.scrollTo(0, 0));
}

// ── Check If Blocked / CAPTCHA ─────────────────────────────────────────────

async function isBlocked(page) {
  try {
    const content = await page.content();
    const lower = content.toLowerCase();
    if (
      lower.includes('are you a robot') ||
      lower.includes('verify you are human') ||
      lower.includes('captcha') ||
      lower.includes('access denied') ||
      (lower.includes('blocked') && lower.includes('request')) ||
      lower.includes('unusual traffic')
    ) {
      return true;
    }
    const title = await page.title();
    if (title.toLowerCase().includes('challenge') || title.toLowerCase().includes('just a moment')) {
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

// ── Get Reported Property Count ────────────────────────────────────────────

async function getReportedCount(page) {
  try {
    return await page.evaluate(() => {
      for (const sel of ['h1', '[data-testid="results-count"]', '.d3a14d00da', '.e1f827110f']) {
        const el = document.querySelector(sel);
        if (el) {
          const match = el.textContent.replace(/,/g, '').match(/(\d+)\s*propert/i);
          if (match) return parseInt(match[1]);
        }
      }
      const match = document.body.innerText.replace(/,/g, '').match(/(\d+)\s*propert(?:y|ies)\s*found/i);
      return match ? parseInt(match[1]) : null;
    });
  } catch { return null; }
}

// ── Extract ALL Hotel Cards from a Page ────────────────────────────────────

async function extractCards(page, nights) {
  return page.evaluate((nightCount) => {
    const text = el => el ? el.textContent.trim() : null;
    function qs(root, ...sels) {
      for (const s of sels) { const el = root.querySelector(s); if (el) return el; }
      return null;
    }
    function qsa(root, ...sels) {
      for (const s of sels) {
        const els = root.querySelectorAll(s);
        if (els.length > 0) return Array.from(els);
      }
      return [];
    }

    function parseMoney(t) {
      if (!t) return null;
      const c = String(t)
        .replace(/[\u00a0\u202f\u2009\u2007]+/g, ' ')
        .replace(/PKR|RS\.?|USD|\$|€|£|INR/gi, '')
        .replace(/,/g, '').replace(/\s+/g, ' ').trim();
      const nums = [...c.matchAll(/(\d{3,10}(?:\.\d{1,2})?)/g)]
        .map(m => parseFloat(m[1])).filter(v => v > 50 && v < 50000000);
      return nums.length ? Math.min(...nums) : null;
    }

    function parseRating(el) {
      if (!el) return null;
      const s = el.getAttribute('aria-label') || el.textContent.trim();
      const m = s.match(/(?:Scored\s*)?(\d+\.?\d*)\s*(?:out of)?/);
      return m ? parseFloat(m[1]) : null;
    }

    function parseStars(card) {
      const el = qs(card, '[data-testid="rating-stars"]', '.bui-rating', '[aria-label*="stars"]', '[aria-label*="star"]');
      if (!el) return null;
      const ariaLabel = el.getAttribute('aria-label') || '';
      const m = ariaLabel.match(/(\d)/);
      if (m) return parseInt(m[1]);
      const svgs = el.querySelectorAll('svg, span[aria-hidden]');
      return svgs.length || null;
    }

    function classifyRoom(t) {
      if (!t) return { room_type: 'Standard Room', room_type_key: 'double', max_occupancy: 2 };
      const l = t.toLowerCase();

      if (l.includes('quint') || l.includes('five-bed') || l.includes('5-bed') || l.includes('5 bed'))
        return { room_type: 'Quint Room', room_type_key: 'family', max_occupancy: 5 };
      if (l.includes('family'))
        return { room_type: 'Family Room', room_type_key: 'family', max_occupancy: 4 };
      if (l.includes('suite') || l.includes('presidential') || l.includes('penthouse'))
        return { room_type: 'Suite', room_type_key: 'suite', max_occupancy: 2 };
      if (l.includes('quad') || l.includes('four-bed') || l.includes('4-bed') || l.includes('4 bed') || l.includes('quadruple'))
        return { room_type: 'Quad Room', room_type_key: 'quad', max_occupancy: 4 };
      if (l.includes('triple') || l.includes('three-bed') || l.includes('3-bed') || l.includes('3 bed'))
        return { room_type: 'Triple Room', room_type_key: 'triple', max_occupancy: 3 };
      if (l.includes('double') || l.includes('twin') || l.includes('king') || l.includes('queen') || l.includes('2-bed') || l.includes('2 bed'))
        return { room_type: 'Double Room', room_type_key: 'double', max_occupancy: 2 };
      if (l.includes('single') || l.includes('1-bed') || l.includes('1 bed') || l.includes('studio'))
        return { room_type: 'Single Room', room_type_key: 'single', max_occupancy: 1 };
      if (l.includes('deluxe'))
        return { room_type: 'Deluxe Room', room_type_key: 'deluxe', max_occupancy: 2 };
      if (l.includes('dorm') || l.includes('bed in') || l.includes('bunk') || l.includes('shared'))
        return { room_type: 'Dormitory', room_type_key: 'single', max_occupancy: 1 };
      if (l.includes('entire') || l.includes('apartment') || l.includes('flat') || l.includes('house') || l.includes('villa'))
        return { room_type: 'Entire Property', room_type_key: 'family', max_occupancy: 4 };

      return { room_type: 'Standard Room', room_type_key: 'double', max_occupancy: 2 };
    }

    function detectMealPlan(t) {
      if (!t) return null;
      const l = t.toLowerCase();
      if (l.includes('all inclusive') || l.includes('all-inclusive')) return 'All Inclusive';
      if (l.includes('full board')) return 'Full Board';
      if (l.includes('half board')) return 'Half Board';
      if (l.includes('breakfast included') || l.includes('free breakfast') || l.includes('complimentary breakfast')) return 'Breakfast Included';
      if (l.includes('breakfast')) return 'Breakfast Available';
      return 'Room Only';
    }

    function detectCancellation(t) {
      if (!t) return null;
      const l = t.toLowerCase();
      if (l.includes('free cancellation') || l.includes('no prepayment')) return 'Free Cancellation';
      if (l.includes('non-refundable') || l.includes('no refund') || l.includes('non refundable')) return 'Non-Refundable';
      return null;
    }

    function parseRoomTypes(card) {
      const rooms = [];
      const unitEls = qsa(card,
        '[data-testid="recommended-units"] > div',
        '[data-testid="availability-single"]',
        '[data-testid="property-card-unit-configuration"]',
      );

      if (unitEls.length > 0) {
        for (const unitEl of unitEls) {
          const roomText = text(unitEl);
          if (!roomText) continue;
          const room = classifyRoom(roomText);
          room.raw_text = roomText;
          room.meal_plan = detectMealPlan(roomText);
          room.cancellation_policy = detectCancellation(roomText);
          rooms.push(room);
        }
      }

      if (rooms.length === 0) {
        const roomInfoEl = qs(card,
          '[data-testid="recommended-units"]',
          '[data-testid="availability-single"]',
          '[data-testid="property-card-unit-configuration"]',
        );
        const roomInfoText = text(roomInfoEl);
        if (roomInfoText) {
          const room = classifyRoom(roomInfoText);
          room.raw_text = roomInfoText;
          room.meal_plan = detectMealPlan(roomInfoText);
          room.cancellation_policy = detectCancellation(roomInfoText);
          rooms.push(room);
        }
      }

      if (rooms.length === 0) {
        rooms.push({
          room_type: 'Standard Room',
          room_type_key: 'double',
          max_occupancy: 2,
          raw_text: null,
          meal_plan: null,
          cancellation_policy: null,
        });
      }

      return rooms;
    }

    // ── Main extraction loop ───────────────────────────────────────────────
    const cards = Array.from(document.querySelectorAll('[data-testid="property-card"]'));
    const results = [];

    for (const card of cards) {
      try {
        const nameEl = qs(card, '[data-testid="title"]');
        const name = text(nameEl);
        if (!name) continue;

        const linkEl = qs(card, '[data-testid="title-link"] a', '[data-testid="title-link"]', 'a[href*="/hotel/"]');
        const rawUrl = linkEl ? (linkEl.href || linkEl.getAttribute('href') || '') : '';
        const url = rawUrl ? rawUrl.split('?')[0] + '?aid=304142' : null;

        let image = null;
        const imgEl = qs(card, '[data-testid="image"] img', 'img[src*="bstatic"]', 'img[src*="booking"]', 'img');
        if (imgEl) {
          image = imgEl.src || imgEl.getAttribute('data-src') || imgEl.getAttribute('src') || null;
          if (image && (image.startsWith('data:') || image.length < 20)) image = null;
        }

        const locEl = qs(card, '[data-testid="address-text"]', '[data-testid="address"]');
        const location = text(locEl) || 'Lahore, Pakistan';
        const distEl = qs(card, '[data-testid="distance"]');
        const distance_from_center = text(distEl) || null;

        const ratingEl = qs(card, '[data-testid="review-score-link"]', '[data-testid="review-score"]');
        const rating = parseRating(ratingEl);
        const revCountEl = qs(card,
          '[data-testid="review-score-link"] span:last-child',
          '.bui-review-score__count',
          '[data-testid="review-score"] + div',
        );
        let review_count = null;
        const revText = text(revCountEl) || '';
        const revTextClean = revText.replace(/,/g, '');
        const revM = revTextClean.match(/\d+/);
        if (revM) review_count = parseInt(revM[0]);

        const ratingLabelEl = qs(card,
          '[data-testid="review-score-link"] span:first-child',
          '[data-testid="review-score-word"]',
        );
        const rating_label = text(ratingLabelEl) || null;

        const stars = parseStars(card);
        const propTypeEl = qs(card, '[data-testid="property-type"]');
        const property_type = text(propTypeEl) || null;

        const roomTypes = parseRoomTypes(card);
        const primaryRoom = roomTypes[0];

        const urgencyEl = qs(card, '[data-testid="urgency-message"]');
        const urgency = text(urgencyEl);
        let rooms_left = null, is_limited = false;
        if (urgency) {
          const m = urgency.match(/(\d+)/);
          if (m) { rooms_left = parseInt(m[1]); is_limited = true; }
          else { is_limited = true; }
        }

        const dealEl = qs(card, '[data-testid="property-card-deal"]', '[data-testid="deal-badge"]');
        const has_deal = !!dealEl && !!text(dealEl);
        const deal_label = has_deal ? text(dealEl) : null;

        const geniusEl = qs(card, '[data-testid="genius-badge"]', '.genius-badge');
        const is_genius = !!geniusEl;

        const sustainEl = qs(card, '[data-testid="sustainability-badge"]');
        const sustainability_badge = text(sustainEl) || null;

        // ── Price Extraction (multiple strategies) ──
        let totalPrice = null, priceText = null;

        // Strategy 1: Direct price element
        const priceEl = qs(card,
          '[data-testid="price-and-discounted-price"]',
          '[data-testid="availability-rate-information"]',
        );
        if (priceEl) {
          const p = parseMoney(text(priceEl));
          if (p) { totalPrice = p; priceText = text(priceEl); }
        }

        // Strategy 2: Search spans for PKR prices
        if (!totalPrice) {
          for (const sp of Array.from(card.querySelectorAll('span'))) {
            const t2 = sp.textContent.trim();
            if (/PKR[\s\u00a0\u202f]+\d/.test(t2) && t2.length < 40) {
              const p = parseMoney(t2);
              if (p) { totalPrice = p; priceText = t2; break; }
            }
          }
        }

        // Strategy 3: Rate wrapper
        if (!totalPrice) {
          const rw = qs(card, '[data-testid="availability-rate-wrapper"]');
          if (rw) { const p = parseMoney(text(rw)); if (p) { totalPrice = p; priceText = text(rw); } }
        }

        // Strategy 4: Any price-related class
        if (!totalPrice) {
          const priceEls = card.querySelectorAll('[class*="price"], [class*="Price"]');
          for (const pe of priceEls) {
            const p = parseMoney(text(pe));
            if (p) { totalPrice = p; priceText = text(pe); break; }
          }
        }

        const price_per_night = totalPrice ? Math.round(totalPrice / nightCount) : null;
        const total_stay_price = totalPrice ? Math.round(totalPrice) : null;

        const origEl = qs(card, '[data-testid="price-before-discount"]', 'del', 's');
        const original_price = parseMoney(text(origEl));

        const taxEl = qs(card, '[data-testid="taxes-and-charges"]');
        const taxes_text = text(taxEl) || null;

        // ── Amenities ──
        const amenities = [];
        const amenityBadges = qsa(card, '[data-testid="facility-badge"]', '.facility-badge');
        for (const badge of amenityBadges) {
          const t = text(badge);
          if (t) amenities.push(t);
        }
        const fullCardText = (primaryRoom.raw_text || '').toLowerCase();
        if (fullCardText.includes('wifi') || fullCardText.includes('wi-fi')) amenities.push('WiFi');
        if (fullCardText.includes('parking')) amenities.push('Parking');
        if (fullCardText.includes('pool') || fullCardText.includes('swimming')) amenities.push('Pool');
        if (fullCardText.includes('gym') || fullCardText.includes('fitness')) amenities.push('Gym');
        if (fullCardText.includes('spa')) amenities.push('Spa');
        if (fullCardText.includes('kitchen')) amenities.push('Kitchen');
        if (fullCardText.includes('balcony') || fullCardText.includes('terrace')) amenities.push('Balcony');
        if (fullCardText.includes('air') || fullCardText.includes('a/c') || fullCardText.includes('conditioning')) amenities.push('Air Conditioning');
        if (fullCardText.includes('private bathroom') || fullCardText.includes('en suite')) amenities.push('Private Bathroom');
        if (fullCardText.includes('tv') || fullCardText.includes('television')) amenities.push('TV');
        if (fullCardText.includes('restaurant')) amenities.push('Restaurant');
        const uniqueAmenities = [...new Set(amenities)];

        // ── Build rooms array ──
        const rooms = roomTypes.map((rt) => ({
          room_type: rt.room_type,
          room_type_key: rt.room_type_key,
          max_occupancy: rt.max_occupancy,
          price_per_night: price_per_night,
          total_price: total_stay_price,
          cancellation_policy: rt.cancellation_policy,
          meal_plan: rt.meal_plan,
          availability: is_limited ? `Only ${rooms_left || 'few'} rooms left!` : 'Available',
          raw_text: rt.raw_text,
        }));

        results.push({
          name,
          url,
          image_url: image,
          image: image,
          location,
          address: location,
          distance_from_center,
          rating,
          rating_label,
          review_count,
          stars,
          property_type,
          room_type: primaryRoom.room_type,
          room_type_key: primaryRoom.room_type_key,
          room_info: primaryRoom.raw_text,
          max_occupancy: primaryRoom.max_occupancy,
          meal_plan: primaryRoom.meal_plan,
          cancellation_policy: primaryRoom.cancellation_policy,
          rooms,
          room_types_count: rooms.length,
          price: priceText,
          price_per_night,
          total_stay_price,
          original_price,
          taxes_text,
          currency: 'PKR',
          nights: nightCount,
          has_deal,
          deal_label,
          is_genius,
          sustainability_badge,
          availability_status: is_limited ? `Only ${rooms_left || 'few'} rooms left!` : 'Available',
          rooms_left,
          is_limited,
          amenities: uniqueAmenities,
          wifi_available: uniqueAmenities.some(a => a.toLowerCase().includes('wifi')),
          parking_available: uniqueAmenities.some(a => a.toLowerCase().includes('parking')),
          pool_available: uniqueAmenities.some(a => a.toLowerCase().includes('pool')),
          breakfast_available: primaryRoom.meal_plan ? primaryRoom.meal_plan.toLowerCase().includes('breakfast') : false,
          source: 'booking.com',
          is_real_time: true,
          scraped_at: new Date().toISOString(),
        });
      } catch (e) { /* skip broken card */ }
    }
    return results;
  }, nights);
}

// ── Main Scraping Logic ────────────────────────────────────────────────────

// ── Scrape one search combination (sort × filter) using a reusable page ───

async function scrapeOneSearch(page, searchParams, combo, nights, seenKeys, allHotels, comboIndex) {
  const label = combo.nflt ? `${combo.sort}+${decodeURIComponent(combo.nflt)}` : combo.sort;

  try {
    const url = buildUrl(searchParams, combo.sort, combo.nflt);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: NAV_TIMEOUT,
    });

    // Detect redirect to homepage (blocked or invalid search)
    const currentUrl = page.url();
    if (!currentUrl.includes('searchresults') && !currentUrl.includes('search')) {
      log(`  [${label}] Redirected — skipping`);
      return { label, total: 0, newCount: 0 };
    }

    if (comboIndex < 3 && await isBlocked(page)) {
      log(`  [${label}] BOT DETECTED — skipping`);
      return { label, total: 0, newCount: 0 };
    }

    if (comboIndex < 2) await dismissOverlays(page);
    await waitForCards(page, comboIndex === 0);

    // Get reported count from first search only
    let reportedCount = null;
    if (comboIndex === 0) {
      reportedCount = await getReportedCount(page);
      if (reportedCount) log(`  Booking.com reports ${reportedCount} properties`);
    }

    const batch = await extractCards(page, nights);

    let newCount = 0;
    for (const h of batch) {
      const key = hotelKey(h.url, h.name);
      if (!key || seenKeys.has(key)) continue;
      seenKeys.add(key);
      h.id = `booking_${seenKeys.size}_${Date.now()}`;
      h.sort_discovered_by = combo.sort;
      h.filter_used = combo.nflt ? decodeURIComponent(combo.nflt) : 'none';
      allHotels.push(h);
      newCount++;
    }

    log(`  [${label}] ${batch.length} cards, ${newCount} NEW → total: ${seenKeys.size}`);

    return { label, total: batch.length, newCount, reportedCount };
  } catch (e) {
    log(`  [${label}] Error: ${e.message.slice(0, 80)}`);
    return { label, total: 0, newCount: 0 };
  }
}

async function main(searchParams) {
  const startTime = Date.now();
  const maxSeconds = parseInt(searchParams.max_seconds || DEFAULT_MAX_SECONDS);
  const maxResults = parseInt(searchParams.max_results || 600);

  const nights = (searchParams.checkin && searchParams.checkout)
    ? Math.max(1, Math.round((new Date(searchParams.checkout) - new Date(searchParams.checkin)) / 86400000))
    : 1;

  // Select how many combos based on time budget
  let maxCombos;
  if (maxSeconds >= 90)      maxCombos = SEARCH_COMBOS.length;  // All combos
  else if (maxSeconds >= 60) maxCombos = 20;                     // Top 20
  else                       maxCombos = 8;                      // Minimal

  const combos = SEARCH_COMBOS.slice(0, maxCombos);

  log(`\n${'='.repeat(60)}`);
  log(`BOOKING.COM PRODUCTION SCRAPER v3 — MULTI-FILTER STRATEGY`);
  log(`City: ${searchParams.city}, Dates: ${searchParams.checkin} -> ${searchParams.checkout}`);
  log(`Nights: ${nights}, Search combos: ${combos.length}, Time limit: ${maxSeconds}s`);
  log(`Strategy: ${combos.length} sort×filter combinations, ~25 hotels each`);
  log(`${'='.repeat(60)}\n`);

  const seenKeys = new Set();
  const allHotels = [];
  let reportedCount = null;
  let browser = null;
  let consecutiveEmpty = 0;
  const comboResults = [];

  try {
    browser = await launchBrowser();
    log(`Browser launched — warming up cookies...\n`);

    // ── WARM-UP: Navigate to Booking.com to establish session cookies ──
    // Cookie warm-up on first page
    const pageA = await setupPage(browser);
    try {
      await pageA.goto('https://www.booking.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await sleep(2000);
      await dismissOverlays(pageA);
      log(`Cookie warm-up complete — URL: ${pageA.url().slice(0, 60)}`);
    } catch (e) {
      log(`Cookie warm-up failed (non-fatal): ${e.message.slice(0, 60)}`);
    }

    // Second page for parallel execution
    const pageB = await setupPage(browser);

    log(`\nRunning ${combos.length} search combinations (2-page parallel)...\n`);

    // ── PARALLEL PAIRS: Two pages processing combos concurrently ──
    let i = 0;
    while (i < combos.length) {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed > maxSeconds - 8) {
        log(`\nTime budget exhausted (${elapsed.toFixed(0)}s/${maxSeconds}s) — stopping at combo ${i + 1}/${combos.length}`);
        break;
      }

      if (allHotels.length >= maxResults) {
        log(`\nReached ${maxResults} hotel limit — stopping at combo ${i + 1}/${combos.length}`);
        break;
      }

      // Run 2 combos concurrently (if available)
      const promises = [];
      const comboA = combos[i];
      promises.push(scrapeOneSearch(pageA, searchParams, comboA, nights, seenKeys, allHotels, i));

      if (i + 1 < combos.length) {
        const comboB = combos[i + 1];
        promises.push(scrapeOneSearch(pageB, searchParams, comboB, nights, seenKeys, allHotels, i + 1));
      }

      const results = await Promise.allSettled(promises);
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          comboResults.push(r.value);
          if (r.value.reportedCount && !reportedCount) reportedCount = r.value.reportedCount;
          if (r.value.newCount === 0 && r.value.total === 0) {
            consecutiveEmpty++;
          } else {
            consecutiveEmpty = 0;
          }
        }
      }

      if (consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY * 2) {
        log(`\n${consecutiveEmpty} consecutive empty results — possible block, stopping`);
        break;
      }

      i += promises.length;

      // Brief stagger every 10 combos
      if (i < combos.length && i % 10 < 2) {
        await randomDelay(800, 1500);
      } else if (i < combos.length) {
        await randomDelay(100, 300);
      }
    }

    try { await pageA.close(); } catch {}
    try { await pageB.close(); } catch {}
  } finally {
    try { if (browser) await browser.close(); } catch {}
  }

  // ── Build Final Output ───────────────────────────────────────────────────

  const withPrice = allHotels.filter(h => h.price_per_night).length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  for (const h of allHotels) {
    h.double_bed_price_per_day = h.price_per_night;
    h.review_rating = h.rating;
    h.review_count_num = h.review_count;
  }

  const coveragePct = reportedCount ? Math.round((allHotels.length / reportedCount) * 100) : null;
  const sortDistribution = {};
  for (const h of allHotels) {
    sortDistribution[h.sort_discovered_by] = (sortDistribution[h.sort_discovered_by] || 0) + 1;
  }

  log(`\n${'='.repeat(60)}`);
  log(`DONE: ${allHotels.length} unique hotels, ${withPrice} with prices`);
  log(`Combos run: ${comboResults.length}/${combos.length}`);
  log(`Sort distribution: ${JSON.stringify(sortDistribution)}`);
  log(`Reported by Booking.com: ${reportedCount || 'unknown'}`);
  log(`Elapsed: ${elapsed}s`);
  if (coveragePct) log(`Coverage: ${coveragePct}%`);
  log(`${'='.repeat(60)}`);

  const verification_notes = [];
  if (reportedCount) {
    verification_notes.push(`Showing ${allHotels.length} of ${reportedCount} properties (${coveragePct}% coverage — multi-filter strategy)`);
  }

  return {
    success: true,
    hotels: allHotels,
    meta: {
      total_scraped: allHotels.length,
      with_price: withPrice,
      elapsed_seconds: parseFloat(elapsed),
      reported_count: reportedCount,
      coverage_pct: coveragePct,
      verified: true,
      verification_notes,
      combos_run: comboResults.length,
      combos_total: combos.length,
      sort_distribution: sortDistribution,
      search_params: {
        city: searchParams.city,
        dest_id: searchParams.dest_id,
        checkin: searchParams.checkin,
        checkout: searchParams.checkout,
        adults: searchParams.adults,
        rooms: searchParams.rooms,
        nights,
      },
      source: 'booking.com',
      strategy: `multi_filter_${comboResults.length}combos`,
    },
  };
}

// ── CLI Entry ──────────────────────────────────────────────────────────────

(async () => {
  let searchParams = {};
  try {
    searchParams = JSON.parse(process.argv[2] || '{}');
  } catch (e) {
    log(`Invalid JSON: ${e.message}`);
    process.stdout.write(JSON.stringify({ success: false, error: 'Invalid JSON', hotels: [] }));
    process.exit(1);
  }

  if (!searchParams.city) searchParams.city = 'Lahore';
  if (!searchParams.dest_id) searchParams.dest_id = '-2767043';

  try {
    const result = await main(searchParams);
    process.stdout.write(JSON.stringify(result));
  } catch (e) {
    log(`Fatal: ${e.message}\n${e.stack}`);
    process.stdout.write(JSON.stringify({ success: false, error: e.message, hotels: [] }));
    process.exit(1);
  }
})();
