/**
 * Real-time Booking.com Scraper — 2026 Edition
 *
 * Key fixes vs previous version:
 *   - Removed nflt=room_facility filter (caused 0 results for 3+ adults)
 *   - Stylesheets are NO LONGER blocked (needed for Booking.com layout + bot-check bypass)
 *   - Multi-fallback selectors for all property card fields
 *   - Added page-dump debug on 0 results
 *   - Human-like delays + stealth plugin
 *   - Occupancy inferred from adults param when scrape text is unavailable
 *
 * Requirements: npm install puppeteer-extra puppeteer-extra-plugin-stealth
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const randomDelay = (min, max) =>
    new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min)));

// Multiple sort orders for broad coverage
const SORT_ORDERS = ['popularity', 'price', 'class', 'bayesian_review_score'];

// Only block heavy media — DO NOT block stylesheets (breaks Booking.com render)
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font', 'ping']);

const BLOCKED_DOMAINS = [
    'google-analytics.com', 'googletagmanager.com', 'doubleclick.net',
    'facebook.net', 'hotjar.com', 'amplitude.com', 'criteo.com',
    'booking-ext.com', 'bizographics.com'
];

// ─── Browser Configuration ───────────────────────────────────────────────────

async function configurePage(page, priceMap) {
    const UAs = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    ];
    await page.setUserAgent(UAs[Math.floor(Math.random() * UAs.length)]);
    await page.setViewport({ width: 1440, height: 900 });

    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0',
    });

    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
        window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {} };
    });

    await page.setRequestInterception(true);
    page.on('request', req => {
        const type = req.resourceType();
        const url = req.url();
        if (BLOCKED_RESOURCE_TYPES.has(type)) { req.abort(); return; }
        if (BLOCKED_DOMAINS.some(d => url.includes(d))) { req.abort(); return; }
        req.continue();
    });

    // Intercept XHR/fetch responses that contain price data
    if (priceMap) {
        page.on('response', async (response) => {
            try {
                const url = response.url();
                const ct = response.headers()['content-type'] || '';
                // Booking.com's price API responses are JSON
                if (!ct.includes('json')) return;
                if (!url.includes('booking.com')) return;
                // Only look at likely price/search endpoints
                if (!(
                    url.includes('searchresults') ||
                    url.includes('graphql') ||
                    url.includes('price') ||
                    url.includes('availability') ||
                    url.includes('accommodations')
                )) return;

                const body = await response.text().catch(() => '');
                if (!body || body.length < 50) return;

                // Parse JSON safely
                let data;
                try { data = JSON.parse(body); } catch { return; }

                // Walk the JSON tree looking for price + hotel name pairs
                function walk(obj, depth = 0) {
                    if (!obj || depth > 8) return;
                    if (typeof obj === 'object') {
                        // Look for patterns like { name: 'Hotel X', price: 12345 }
                        const name = obj.name || obj.hotel_name || obj.title;
                        const price = obj.price || obj.min_price || obj.composite_price_breakdown?.gross_amount?.value;
                        if (name && typeof name === 'string' && price) {
                            const numPrice = typeof price === 'object'
                                ? (price.value || price.amount)
                                : parseFloat(price);
                            if (numPrice > 100) {
                                priceMap.set(name.trim().slice(0, 80), numPrice);
                            }
                        }
                        for (const val of Object.values(obj)) walk(val, depth + 1);
                    } else if (Array.isArray(obj)) {
                        obj.forEach(item => walk(item, depth + 1));
                    }
                }
                walk(data);
            } catch { /* ignore */ }
        });
    }
}

// ─── URL Builder ─────────────────────────────────────────────────────────────

function buildSearchUrl(params, sortOrder, offset = 0) {
    const base = 'https://www.booking.com/searchresults.html';
    const adults = parseInt(params.adults || 2);
    const rooms  = parseInt(params.rooms  || 1);

    // Calculate rooms needed: one room per 2.5 adults (round up), minimum 1
    const calcRooms = Math.max(rooms, Math.ceil(adults / 2.5));

    const p = new URLSearchParams({
        ss:              params.city || 'Lahore',
        ssne:            params.city || 'Lahore',
        ssne_untouched:  params.city || 'Lahore',
        dest_id:         params.dest_id  || '-2767043',
        dest_type:       params.dest_type || 'city',
        checkin:         params.checkin  || '',
        checkout:        params.checkout || '',
        group_adults:    adults,
        no_rooms:        calcRooms,
        group_children:  params.children || 0,
        lang:            'en-us',
        sb:              1,
        src_elem:        'sb',
        src:             'index',
        // NOTE: No nflt filter — it caused 0 results for 3-adult searches in Lahore
        order:           sortOrder,
        // Booking.com paginates via offset (multiples of 25)
        offset:          offset,
        rows:            25,
    });

    return `${base}?${p.toString()}`;
}

// ─── Scroll & Wait ────────────────────────────────────────────────────────────

async function scrollToLoadAll(page) {
    // First: wait for at least one property card
    try {
        await page.waitForSelector(
            '[data-testid="property-card"], .sr_property_block, [class*="PropertyCard"]',
            { timeout: 15000 }
        );
    } catch {
        // Cards didn't appear — will try anyway
    }

    // Then wait for prices to lazy-load
    try {
        await page.waitForSelector(
            '[data-testid="price-and-discounted-price"], [data-testid="price"], .bui-price-display__value, [class*="Price"]',
            { timeout: 10000 }
        );
    } catch {
        // Prices may not exist (sold-out pages)
    }

    let lastCount = 0;
    let stable = 0;

    for (let i = 0; i < 20; i++) {
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
        await randomDelay(400, 800);

        const count = await page.evaluate(() => {
            const primary = document.querySelectorAll('[data-testid="property-card"]').length;
            if (primary > 0) return primary;
            return Math.max(
                document.querySelectorAll('[data-testid="property-card-container"]').length,
                document.querySelectorAll('.sr_property_block').length,
                document.querySelectorAll('[class*="PropertyCard"]').length
            );
        });

        if (count > lastCount) { stable = 0; lastCount = count; }
        else { stable++; }

        if (stable >= 5 && count >= 10) break;

        if (i % 7 === 0 && i > 0) {
            await page.evaluate(() => window.scrollBy(0, -300));
            await randomDelay(200, 400);
        }
    }

    // Extra wait after scrolling for any lazy price fetches
    await randomDelay(1000, 2000);
    return lastCount;
}

// ─── Data Extraction ──────────────────────────────────────────────────────────

async function extractHotelsFromPage(page, searchParams) {
    await scrollToLoadAll(page);

    return await page.evaluate((params) => {
        const adults    = parseInt(params.adults || 2);
        const checkin   = params.checkin;
        const checkout  = params.checkout;
        const nights    = (checkin && checkout)
            ? Math.max(1, Math.round((new Date(checkout) - new Date(checkin)) / 86400000))
            : 1;

        // ── Helpers ──────────────────────────────────────────────────────────

        function text(el) { return el ? el.textContent.trim() : null; }

        function qs(root, ...selectors) {
            for (const sel of selectors) {
                const el = root.querySelector(sel);
                if (el) return el;
            }
            return null;
        }

        function qsa(root, ...selectors) {
            for (const sel of selectors) {
                const els = root.querySelectorAll(sel);
                if (els.length > 0) return Array.from(els);
            }
            return [];
        }

        function parseMoney(t) {
            if (!t) return null;
            // Remove currency symbols, PKR, Rs, USD, non-breaking space (\u00a0), commas
            const cleaned = String(t)
                .replace(/\u00a0/g, ' ')          // non-breaking space → regular space
                .replace(/PKR|RS\.?|USD|\$|€|£/gi, '')
                .replace(/,/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            const m = cleaned.match(/(\d{1,10}(?:\.\d{1,2})?)/);
            if (!m) return null;
            const val = parseFloat(m[1]);
            return val > 100 && val < 10000000 ? val : null;
        }

        function parseRating(t) {
            if (!t) return null;
            const m = String(t).match(/(\d+[\.,]\d+|\d+)/);
            return m ? parseFloat(m[1].replace(',', '.')) : null;
        }

        function parseStars(card) {
            // Count aria-label="N stars" or actual star icons
            const starEl = qs(card,
                '[data-testid="rating-stars"]',
                '.bui-rating',
                '[class*="Stars"]',
                '[aria-label*="stars"]'
            );
            if (starEl) {
                const label = starEl.getAttribute('aria-label') || '';
                const m = label.match(/(\d)/);
                if (m) return parseInt(m[1]);
                return starEl.querySelectorAll('[aria-hidden]').length || null;
            }
            return null;
        }

        function parseRoomInfo(card) {
            const roomEl = qs(card,
                '[data-testid="recommended-units"]',
                '[data-testid="property-card-unit-configuration"]',
                '.recommended-units',
                '[class*="RoomInfo"]',
                '[class*="room-info"]',
                '.e2e-hp-roomtype-name',
                '.room_link',
            );
            if (roomEl) return roomEl.textContent.trim();

            // Try combining all small-text spans as a fallback
            const spans = qsa(card, '.top_info_row span', '.sr_item_main_block span');
            return spans.map(s => s.textContent.trim()).filter(Boolean).join(' ') || null;
        }

        function inferRoomType(roomText, adultCnt) {
            if (!roomText) {
                if (adultCnt >= 4) return 'Family / Quad Room';
                if (adultCnt === 3) return 'Triple Room';
                return 'Double Room';
            }
            const l = roomText.toLowerCase();
            if (l.includes('family') || l.includes('connecting')) return 'Family Room';
            if (l.includes('quad') || l.includes('quadruple') || l.includes('4-bed') || l.includes('4 bed')) return 'Quad Room';
            if (l.includes('triple') || l.includes('3-bed') || l.includes('3 bed')) return 'Triple Room';
            if (l.includes('suite')) return 'Suite';
            if (l.includes('deluxe')) return 'Deluxe Room';
            if (l.includes('single') || l.includes('dorm')) return 'Single Room';
            if (l.includes('twin')) return 'Twin Room';
            if (l.includes('double') || l.includes('king') || l.includes('queen') || l.includes('studio')) return 'Double Room';
            // If room text exists but no match → show it as-is
            return roomText.split('\n')[0].trim().slice(0, 50) || 'Standard Room';
        }

        function inferOccupancy(roomText, adultCnt) {
            if (!roomText) return Math.max(adultCnt, 2);
            const t = roomText;
            const sleeps = t.match(/sleeps\s*(\d+)/i);
            if (sleeps) return parseInt(sleeps[1]);
            const adultsM = t.match(/(\d+)\s*adult/i);
            if (adultsM) return parseInt(adultsM[1]);
            const guests = t.match(/(\d+)\s*guest/i);
            if (guests) return parseInt(guests[1]);
            const persons = t.match(/(\d+)\s*person/i);
            if (persons) return parseInt(persons[1]);
            const beds = t.match(/(\d+)[- ]bed/i);
            if (beds) return Math.min(parseInt(beds[1]) * 2, 6);
            const l = t.toLowerCase();
            if (l.includes('quad') || l.includes('4-bed') || l.includes('family')) return 4;
            if (l.includes('triple') || l.includes('3-bed')) return 3;
            if (l.includes('single') || l.includes('dorm')) return 1;
            return Math.max(adultCnt, 2);
        }

        function parseMealPlan(t) {
            if (!t) return null;
            const l = t.toLowerCase();
            if (l.includes('all inclusive')) return 'All Inclusive';
            if (l.includes('full board')) return 'Full Board';
            if (l.includes('half board')) return 'Half Board';
            if (l.includes('breakfast included') || l.includes('free breakfast')) return 'Breakfast Included';
            if (l.includes('breakfast')) return 'Breakfast Available';
            return null;
        }

        function parseCancellation(t) {
            if (!t) return null;
            const l = t.toLowerCase();
            if (l.includes('free cancellation')) return 'Free Cancellation';
            if (l.includes('non-refundable') || l.includes('nonrefundable')) return 'Non-Refundable';
            if (l.includes('no prepayment')) return 'No Prepayment Needed';
            return null;
        }

        // ── Find property cards — try all known selectors ─────────────────────

        let cards = Array.from(document.querySelectorAll('[data-testid="property-card"]'));

        if (cards.length === 0) {
            // Fallback selectors for different Booking.com page layouts
            cards = Array.from(document.querySelectorAll('[data-testid="property-card-container"]'));
        }
        if (cards.length === 0) {
            cards = Array.from(document.querySelectorAll('.sr_property_block'));
        }
        if (cards.length === 0) {
            // Very broad fallback — any large block with a price
            cards = Array.from(document.querySelectorAll('[class*="PropertyCard"], [class*="property-card"]'));
        }

        const results = [];

        cards.forEach(card => {
            try {
                // ── Name ─────────────────────────────────────────────────────
                const nameEl = qs(card,
                    '[data-testid="title"]',
                    '.sr-hotel__name',
                    'h3.t073ce8 a',
                    '[class*="hotel-name"]',
                    'h3 a',
                    'h3',
                    'h2'
                );
                const name = text(nameEl);
                if (!name) return; // Skip cards without a name

                // ── URL ───────────────────────────────────────────────────────
                const linkEl = qs(card,
                    'a[data-testid="title-link"]',
                    'a[data-testid="property-card-desktop-single-image"]',
                    'h3 a',
                    'a.hotel_name_link',
                    'a[href*="/hotel/"]'
                );
                const url = linkEl ? linkEl.href : null;

                // ── Price ─────────────────────────────────────────────────────
                // PRIMARY: Extract from sr_pri_blocks param embedded in card HTML
                // Booking.com always encodes per-night price × 100 in the block ID
                // e.g. sr_pri_blocks=....__900000 → PKR 9,000 total
                let totalPrice = null;
                let priceText = null;
                let originalPrice = null;

                // Search entire card HTML for the sr_pri_blocks price parameter
                const cardHtml = card.outerHTML;
                const priMatch = cardHtml.match(/sr_pri_blocks=[^"&\s]*?__(\d{4,})/);
                if (priMatch) {
                    totalPrice = parseInt(priMatch[1]) / 100;
                    priceText = `PKR ${Math.round(totalPrice).toLocaleString()}`;
                }

                // Method 2: DOM selector fallback (works when not bot-detected)
                if (!totalPrice) {
                    const priceEl = qs(card,
                        '[data-testid="price-and-discounted-price"]',
                        '[data-testid="price"]',
                        '.prco-valign-middle-helper',
                        '.bui-price-display__value',
                        '[class*="Price"]',
                        '[class*="price"]',
                        '.sr_price_wrap span',
                    );
                    const rawText = text(priceEl);
                    const parsed = parseMoney(rawText);
                    if (parsed) { totalPrice = parsed; priceText = rawText; }
                }

                // Method 3: any span containing PKR + numbers in the card
                if (!totalPrice) {
                    const spans = Array.from(card.querySelectorAll('span'));
                    for (const sp of spans) {
                        const t2 = sp.textContent.trim();
                        if (/PKR[\s\u00a0][\d,]+/.test(t2)) {
                            const parsed = parseMoney(t2);
                            if (parsed) { totalPrice = parsed; priceText = t2; break; }
                        }
                    }
                }

                const pricePerNight = totalPrice ? Math.round(totalPrice / nights) : null;

                // Original price (strikethrough / was-price)
                const origPriceEl = qs(card,
                    '[data-testid="price-before-discount"]',
                    '.bui-price-display__original',
                    '.fff1944c52.d68334ea31',
                    '[class*="original-price"]',
                    'del',
                    's'
                );
                originalPrice = parseMoney(text(origPriceEl));
                const hasDiscount = originalPrice && totalPrice && originalPrice > totalPrice;
                    if (m) {
                        totalPrice = parseInt(m[1]) / 100;  // paise → PKR
                        priceText = `PKR ${totalPrice.toLocaleString('en-PK')}`;
                        break;
                    }
                    // Also check highlighted_blocks
                    const m2 = href.match(/__(\d{5,})\b/);
                    if (!totalPrice && m2) {
                        const candidate = parseInt(m2[1]) / 100;
                        if (candidate > 500 && candidate < 500000) {
                            totalPrice = candidate;
                            priceText = `PKR ${totalPrice.toLocaleString('en-PK')}`;
                        }
                    }
                }

                // Method 2: DOM selector fallback (works when bot detection not active)
                if (!totalPrice) {
                    const priceEl = qs(card,
                        '[data-testid="price-and-discounted-price"]',
                        '[data-testid="price"]',
                        '.prco-valign-middle-helper',
                        '.bui-price-display__value',
                        '[class*="Price"]',
                        '[class*="price"]',
                        '.sr_price_wrap span',
                    );
                    const rawText = text(priceEl);
                    totalPrice = parseMoney(rawText);
                    if (totalPrice) priceText = rawText;
                }

                const pricePerNight = totalPrice ? Math.round(totalPrice / nights) : null;

                // Original price (strikethrough / was-price)
                const origPriceEl = qs(card,
                    '[data-testid="price-before-discount"]',
                    '.bui-price-display__original',
                    '.fff1944c52.d68334ea31',  // identified from debug dump
                    '[class*="original-price"]',
                    'del',
                    's'
                );
                originalPrice = parseMoney(text(origPriceEl));
                // Also try to find strikethrough via sr_pri_blocks original (not currently encoded)
                const hasDiscount = originalPrice && totalPrice && originalPrice > totalPrice;

                // ── Rating ────────────────────────────────────────────────────
                const ratingEl = qs(card,
                    '[data-testid="review-score"] > div:first-child',
                    '.bui-review-score__badge',
                    '[class*="ReviewScore"] [class*="score"]',
                    '[aria-label*="Scored"]',
                    '[class*="score-badge"]'
                );
                let rating = null;
                if (ratingEl) {
                    const ratingLabel = ratingEl.getAttribute('aria-label') || '';
                    rating = ratingLabel
                        ? parseRating(ratingLabel)
                        : parseRating(text(ratingEl));
                }

                const ratingLabelEl = qs(card,
                    '[data-testid="review-score"] [class*="label"]',
                    '.bui-review-score__title',
                    '[class*="review-word"]'
                );
                const ratingLabel = text(ratingLabelEl);

                // Review count
                const reviewCountEl = qs(card,
                    '[data-testid="review-score"] > div:nth-child(2)',
                    '.bui-review-score__text',
                    '[class*="review-count"]',
                    '[class*="ReviewCount"]'
                );
                const reviewCountText = text(reviewCountEl) || '';
                const reviewCountM = reviewCountText.replace(/,/g, '').match(/(\d+)/);
                const reviewCount = reviewCountM ? parseInt(reviewCountM[1]) : null;

                // ── Location ──────────────────────────────────────────────────
                const locationEl = qs(card,
                    '[data-testid="address"]',
                    '.sr-hotel__address',
                    '[class*="address"]',
                    '[class*="location"]',
                    '.address'
                );
                const location = text(locationEl);

                // Distance from center
                const distanceEl = qs(card,
                    '[data-testid="distance"]',
                    '[class*="distance"]',
                    '.sr_card_address_line span',
                );
                const distance = text(distanceEl);

                // ── Property Type ─────────────────────────────────────────────
                const propTypeEl = qs(card,
                    '[data-testid="property-type"]',
                    '[class*="property-type"]',
                    '[class*="PropertyType"]',
                    '.hotel_class_text'
                );
                const propertyType = text(propTypeEl);

                // ── Star Rating ───────────────────────────────────────────────
                const stars = parseStars(card);

                // ── Room Info ─────────────────────────────────────────────────
                const roomInfoRaw = parseRoomInfo(card);
                const roomType = inferRoomType(roomInfoRaw, adults);
                const maxOccupancy = inferOccupancy(roomInfoRaw, adults);
                const mealPlan = parseMealPlan(roomInfoRaw);
                const cancellationPolicy = parseCancellation(roomInfoRaw);

                // ── Amenities ─────────────────────────────────────────────────
                const amenityEls = qsa(card,
                    '[data-testid="property-card-unit-configuration"] span',
                    '[class*="facilities"] [class*="item"]',
                    '.b5cd09854e',
                    '[class*="amenity"]'
                );
                const amenities = amenityEls.map(a => a.textContent.trim()).filter(Boolean);

                // ── WiFi / Parking ────────────────────────────────────────────
                const allText = card.textContent.toLowerCase();
                const hasWifi    = allText.includes('wifi') || allText.includes('wi-fi') || allText.includes('internet');
                const hasParking = allText.includes('parking');
                const hasPool    = allText.includes('pool') || allText.includes('swimming');
                const hasBreakfast = allText.includes('breakfast');

                // ── Availability / Rooms left ─────────────────────────────────
                let roomsLeft = null;
                let isLimited = false;
                let availabilityStatus = 'Available';

                const urgEls = qsa(card,
                    '[data-testid="urgency-message"]',
                    '[class*="urgency"]',
                    '[class*="availability"]',
                    '.sr_card_badge'
                );
                for (const el of urgEls) {
                    const t2 = el.textContent.trim();
                    const leftM = t2.match(/Only\s*(\d+)\s*(room|left)/i);
                    if (leftM) {
                        roomsLeft = parseInt(leftM[1]);
                        isLimited = true;
                        availabilityStatus = `Only ${roomsLeft} left!`;
                        break;
                    }
                    if (t2.toLowerCase().includes('last') || t2.toLowerCase().includes('hurry')) {
                        isLimited = true;
                        availabilityStatus = t2;
                        break;
                    }
                }

                // ── Image ─────────────────────────────────────────────────────
                const imgEl = qs(card,
                    'img[data-testid="image"]',
                    'img[loading="lazy"]',
                    '.hotel_image img',
                    'img.b_lazy',
                    'img'
                );
                const image = imgEl
                    ? (imgEl.getAttribute('data-src') || imgEl.src || imgEl.getAttribute('data-lazy-src'))
                    : null;

                // ── Compose hotel record ──────────────────────────────────────
                const hotel = {
                    name,
                    url,
                    image:               image || null,
                    image_url:           image || null,
                    location:            location || 'Lahore, Pakistan',
                    address:             location || null,
                    distance_from_center: distance || null,
                    property_type:       propertyType || null,
                    stars:               stars || null,
                    rating:              rating || null,
                    rating_label:        ratingLabel || null,
                    review_count:        reviewCount || null,

                    // Pricing
                    price:               priceText || null,
                    price_per_night:     pricePerNight || null,
                    double_bed_price_per_day: pricePerNight || null,  // for HotelCard
                    total_stay_price:    totalPrice || null,
                    original_price:      originalPrice || null,
                    has_deal:            hasDiscount,
                    currency:            'PKR',
                    nights,

                    // Room details
                    room_info:           roomInfoRaw || null,
                    room_type:           roomType,
                    max_occupancy:       maxOccupancy,
                    occupancy_match:     maxOccupancy >= adults,
                    meal_plan:           mealPlan || null,
                    cancellation_policy: cancellationPolicy || null,

                    // Amenities
                    amenities:           amenities.slice(0, 8),
                    wifi_available:      hasWifi,
                    parking_available:   hasParking,
                    pool_available:      hasPool,
                    breakfast_available: hasBreakfast,

                    // Availability
                    is_limited:          isLimited,
                    rooms_left:          roomsLeft,
                    availability_status: availabilityStatus,

                    // Rooms[] array for booking
                    rooms: [{
                        room_type:           roomType,
                        max_occupancy:       maxOccupancy,
                        price_per_night:     pricePerNight,
                        total_price:         totalPrice,
                        cancellation_policy: cancellationPolicy,
                        meal_plan:           mealPlan,
                        availability:        availabilityStatus,
                        occupancy_match:     maxOccupancy >= adults,
                    }],

                    source:      'booking.com',
                    is_real_time: true,
                    scraped_at:  new Date().toISOString(),
                };

                results.push(hotel);

            } catch (e) {
                // Skip malformed cards silently
            }
        });

        return results;

    }, searchParams);
}

// ─── Get reported property count ──────────────────────────────────────────────

async function getReportedCount(page) {
    try {
        return await page.evaluate(() => {
            // Try multiple locations where Booking.com shows total count
            const selectors = [
                '[data-testid="breadcrumbs"] span',
                'h1[aria-live]',
                'h1',
                '[class*="results-header"]',
                '.sr_header',
                '.sorth1',
                'title',
            ];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (!el) continue;
                const t = el.textContent || el.innerText || '';
                const m = t.replace(/,/g, '').match(/(\d{1,5})\s*(properties|homes|places|results|hotel)/i);
                if (m) return parseInt(m[1]);
            }
            return 0;
        });
    } catch {
        return 0;
    }
}

// ─── Debug: dump when 0 results ───────────────────────────────────────────────

async function debugPageState(page) {
    try {
        const info = await page.evaluate(() => ({
            title:    document.title,
            url:      location.href,
            bodyLen:  document.body ? document.body.innerHTML.length : 0,
            h1:       document.querySelector('h1')?.textContent?.trim()?.slice(0, 200) || 'none',
            cards_primary: document.querySelectorAll('[data-testid="property-card"]').length,
            cards_fallback1: document.querySelectorAll('.sr_property_block').length,
            cards_fallback2: document.querySelectorAll('[class*="PropertyCard"]').length,
            has_captcha: !!(document.querySelector('[id*="captcha"], [class*="captcha"], [id*="human"]')),
            has_maintenance: document.title.toLowerCase().includes('maintenance') || document.title.toLowerCase().includes('error'),
        }));
        process.stderr.write('DEBUG_PAGE: ' + JSON.stringify(info) + '\n');
    } catch (e) {
        process.stderr.write('DEBUG_PAGE_ERROR: ' + e.message + '\n');
    }
}

// ─── Scrape one sort order ────────────────────────────────────────────────────

async function scrapeSortOrder(browser, searchParams, sortOrder, maxHotels) {
    const page = await browser.newPage();

    // priceMap captures prices from XHR/API responses (Booking.com lazy-loads prices)
    const priceMap = new Map();
    await configurePage(page, priceMap);

    const hotels = new Map();
    const MAX_PAGES = 4; // offset 0, 25, 50, 75
    const nights = searchParams.checkin && searchParams.checkout
        ? Math.max(1, Math.round((new Date(searchParams.checkout) - new Date(searchParams.checkin)) / 86400000))
        : 1;

    try {
        for (let page_i = 0; page_i < MAX_PAGES; page_i++) {
            priceMap.clear(); // fresh price data per page
            const offset = page_i * 25;
            const url = buildSearchUrl(searchParams, sortOrder, offset);
            process.stderr.write(`[${sortOrder}] offset=${offset} fetching...\n`);

            await page.goto(url, { waitUntil: 'networkidle2', timeout: 50000 });
            // Extra settle time for price XHR to complete
            await randomDelay(3000, 4500);

            // Handle cookie consent popup
            try {
                const cookieBtn = await page.$(
                    '#onetrust-accept-btn-handler, [data-testid="accept-cookies"], button[id*="cookie"]'
                );
                if (cookieBtn) {
                    await cookieBtn.click();
                    await randomDelay(600, 1200);
                }
            } catch { /* ignore */ }

            const batch = await extractHotelsFromPage(page, searchParams);

            // Merge XHR-intercepted prices into hotels where DOM price is missing
            process.stderr.write(`[price-map] captured ${priceMap.size} prices from XHR\n`);
            for (const h of batch) {
                if (!h.price_per_night && !h.total_stay_price) {
                    // Try exact name match first
                    let interceptedTotal = priceMap.get(h.name?.slice(0, 80));
                    // Try partial name match
                    if (!interceptedTotal) {
                        for (const [key, val] of priceMap.entries()) {
                            if (h.name && (h.name.includes(key.slice(0, 20)) || key.includes(h.name.slice(0, 20)))) {
                                interceptedTotal = val;
                                break;
                            }
                        }
                    }
                    if (interceptedTotal && interceptedTotal > 100) {
                        h.total_stay_price = interceptedTotal;
                        h.price_per_night = Math.round(interceptedTotal / nights);
                        h.double_bed_price_per_day = h.price_per_night;
                        h.price = `PKR ${interceptedTotal.toLocaleString()}`;
                    }
                }
            }

            if (batch.length === 0 && page_i === 0) {
                await debugPageState(page);
            }

            let added = 0;
            for (const h of batch) {
                if (h.name && !hotels.has(h.name)) {
                    hotels.set(h.name, h);
                    added++;
                }
            }

            process.stderr.write(`[${sortOrder}] offset=${offset} → got ${batch.length}, new ${added}, total unique ${hotels.size}\n`);

            // Stop conditions
            if (hotels.size >= maxHotels) break;  // enough hotels
            if (added === 0 && page_i >= 1) break; // offset pages returning same hotels
            if (batch.length < 10) break;           // last page (sparse)

            await randomDelay(1200, 2500);
        }
    } catch (e) {
        process.stderr.write(`[${sortOrder}] ERROR: ${e.message}\n`);
    } finally {
        await page.close().catch(() => {});
    }

    return Array.from(hotels.values());
}

// ─── Main entry point ─────────────────────────────────────────────────────────

async function scrapeBookingHotels(searchParams) {
    const startTime = Date.now();
    const maxSeconds = 80;
    const maxHotels  = parseInt(searchParams.max_results || 200);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--window-size=1440,900',
                '--lang=en-US,en',
                '--disable-infobars',
                '--ignore-certificate-errors',
            ],
            ignoreHTTPSErrors: true,
        });
    } catch (e) {
        return { success: false, error: `Browser launch failed: ${e.message}`, hotels: [] };
    }

    const allHotels = new Map();

    try {
        // Limited to 2 sort orders for speed; use 4 if time allows
        const sortsToUse = Date.now() - startTime < 20000 ? SORT_ORDERS : SORT_ORDERS.slice(0, 2);

        for (const sort of sortsToUse) {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed > maxSeconds - 20) {
                process.stderr.write(`Time limit approaching (${elapsed.toFixed(1)}s), stopping sort orders\n`);
                break;
            }

            const batch = await scrapeSortOrder(browser, searchParams, sort, maxHotels);
            for (const h of batch) {
                if (h.name && !allHotels.has(h.name)) {
                    allHotels.set(h.name, h);
                }
            }

            process.stderr.write(`After sort=${sort}: ${allHotels.size} unique hotels\n`);

            if (allHotels.size >= maxHotels) break;
        }

        const hotels = Array.from(allHotels.values());
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        // Post-process: assign IDs, normalize
        hotels.forEach((h, i) => {
            h.id = h.id || `booking_${i + 1}_${Date.now()}`;
            // Ensure double_bed_price_per_day for HotelCard compatibility
            h.double_bed_price_per_day = h.price_per_night || h.double_bed_price_per_day;
            // Ensure rating is a number
            if (typeof h.rating === 'string') h.rating = parseFloat(h.rating) || null;
        });

        process.stderr.write(`DONE: ${hotels.length} hotels in ${elapsed}s\n`);

        return {
            success: true,
            hotels,
            meta: {
                total_scraped:  hotels.length,
                elapsed_seconds: parseFloat(elapsed),
                search_params:   searchParams,
                source:          'booking.com',
            }
        };

    } catch (e) {
        return { success: false, error: e.message, hotels: Array.from(allHotels.values()) };
    } finally {
        await browser.close().catch(() => {});
    }
}

// ─── CLI entry ────────────────────────────────────────────────────────────────

(async () => {
    let searchParams;
    try {
        searchParams = JSON.parse(process.argv[2] || '{}');
    } catch {
        searchParams = {};
    }

    if (!searchParams.city) searchParams.city = 'Lahore';
    if (!searchParams.dest_id) searchParams.dest_id = '-2767043';

    const result = await scrapeBookingHotels(searchParams);
    process.stdout.write(JSON.stringify(result));
})();
