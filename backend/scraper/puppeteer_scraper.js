/**
 * Real-time Booking.com Scraper with Enhanced Bot Detection Bypass
 * Scrolls to load 100+ hotels with live prices
 * 
 * Requirements:
 * npm install puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

// Utility to add random delay (human-like behavior)
const randomDelay = (min, max) => new Promise(resolve => 
    setTimeout(resolve, Math.floor(Math.random() * (max - min + 1) + min))
);

async function scrapeBookingHotels(searchParams) {
    let browser;
    const startTime = Date.now();
    
    try {
        console.error('🚀 Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: process.env.CHROME_PATH || undefined,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-web-security',
                '--disable-features=CrossSiteDocumentBlockingIfIsolating',
                '--disable-site-isolation-trials',
                '--lang=en-US,en'
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            timeout: 60000
        });
    } catch (error) {
        console.error('Failed to launch browser:', error.message);
        console.log(JSON.stringify([]));
        process.exit(0);
    }

    try {
        const page = await browser.newPage();
        
        // Enhanced stealth settings
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Set extra headers to appear more like a real browser
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        });

        // Override navigator properties to bypass detection
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => false });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
            window.chrome = { runtime: {} };
        });
        
        // Build URL with parameters for more results
        const baseUrl = 'https://www.booking.com/searchresults.html';
        const params = new URLSearchParams({
            ss: searchParams.city || 'Lahore',
            ssne: searchParams.city || 'Lahore',
            ssne_untouched: searchParams.city || 'Lahore',
            dest_id: searchParams.dest_id || '-2767043',
            dest_type: searchParams.dest_type || 'city',
            checkin: searchParams.checkin || '2026-02-02',
            checkout: searchParams.checkout || '2026-02-07',
            group_adults: searchParams.adults || 2,
            no_rooms: searchParams.rooms || 1,
            group_children: searchParams.children || 0,
            lang: 'en-us',
            sb: 1,
            src_elem: 'sb',
            src: 'index',
            nflt: '', // No filters for more results
            order: 'popularity' // Sort by popularity
        });
        
        const url = `${baseUrl}?${params.toString()}`;
        console.error('📍 Navigating to:', url);
        
        // Navigate with extended timeout
        await page.goto(url, { 
            waitUntil: 'domcontentloaded',
            timeout: 45000 
        });
        
        // Wait a bit for initial content
        await randomDelay(2000, 3000);
        
        // Check for bot detection
        const pageContent = await page.content();
        if (pageContent.includes('unusual traffic') || pageContent.includes('CAPTCHA') || pageContent.includes('challenge-running')) {
            console.error('⚠️ Bot detection encountered, waiting...');
            await randomDelay(5000, 8000);
        }
        
        // Wait for hotel cards to load
        console.error('⏳ Waiting for hotel listings...');
        try {
            await page.waitForSelector('[data-testid="property-card"], .sr_property_block, .sr_item', { 
                timeout: 20000 
            });
            console.error('✅ Hotel cards found!');
        } catch (error) {
            console.error('⚠️ Timeout waiting for standard selectors, trying alternative...');
            // Try waiting for any hotel content
            await randomDelay(3000, 5000);
        }
        
        // SCROLL TO LOAD MORE HOTELS (Booking.com lazy loads content)
        console.error('📜 Scrolling to load more hotels...');
        
        let previousHeight = 0;
        let scrollAttempts = 0;
        let previousHotelCount = 0;
        let sameCountAttempts = 0;
        const maxScrollAttempts = 25; // More scroll attempts for 100+ hotels
        const targetHotels = 100;
        
        while (scrollAttempts < maxScrollAttempts) {
            // Scroll down smoothly
            await page.evaluate(async () => {
                const scrollStep = window.innerHeight;
                const scrollDelay = 100;
                for (let i = 0; i < 3; i++) {
                    window.scrollBy(0, scrollStep);
                    await new Promise(r => setTimeout(r, scrollDelay));
                }
            });
            await randomDelay(1000, 2000);
            
            // Check current hotel count
            const hotelCount = await page.evaluate(() => {
                return document.querySelectorAll('[data-testid="property-card"]').length;
            });
            
            console.error(`📊 Scroll ${scrollAttempts + 1}/${maxScrollAttempts} - Hotels: ${hotelCount}`);
            
            // Try clicking "Load more" or pagination buttons
            try {
                const loadMoreSelectors = [
                    'button[data-testid="pagination-load-more"]',
                    'button.show-more-button',
                    '[class*="load-more"]',
                    'a[data-page-next]'
                ];
                
                for (const selector of loadMoreSelectors) {
                    const btn = await page.$(selector);
                    if (btn) {
                        const isVisible = await page.evaluate(el => {
                            const rect = el.getBoundingClientRect();
                            return rect.width > 0 && rect.height > 0;
                        }, btn);
                        
                        if (isVisible) {
                            await btn.click();
                            await randomDelay(2000, 3000);
                            console.error('📥 Clicked load more button');
                            break;
                        }
                    }
                }
            } catch (e) {}
            
            // Check if we've reached target or no new hotels loading
            if (hotelCount >= targetHotels) {
                console.error(`✅ Target reached: ${hotelCount} hotels`);
                break;
            }
            
            if (hotelCount === previousHotelCount) {
                sameCountAttempts++;
                if (sameCountAttempts >= 5) {
                    console.error(`⚠️ No new hotels loading after ${sameCountAttempts} attempts`);
                    break;
                }
            } else {
                sameCountAttempts = 0;
            }
            
            previousHotelCount = hotelCount;
            scrollAttempts++;
        }
        
        // Final wait for any remaining content
        await randomDelay(1000, 2000);
        
        // Extract all hotel data
        console.error('🔍 Extracting hotel data...');
        
        const hotels = await page.evaluate(() => {
            const hotelCards = document.querySelectorAll('[data-testid="property-card"]');
            const results = [];
            
            hotelCards.forEach((card, index) => {
                try {
                    const hotel = {
                        scraped_at: new Date().toISOString(),
                        source: 'booking.com',
                        is_real_time: true
                    };
                    
                    // Hotel Name
                    const nameElem = card.querySelector('[data-testid="title"]');
                    hotel.name = nameElem ? nameElem.textContent.trim() : null;
                    
                    // URL
                    const linkElem = card.querySelector('a[data-testid="title-link"]');
                    hotel.url = linkElem ? linkElem.href : null;
                    
                    // Price - Try multiple selectors
                    let priceElem = card.querySelector('[data-testid="price-and-discounted-price"]');
                    if (!priceElem) priceElem = card.querySelector('.prco-valign-middle-helper');
                    if (!priceElem) priceElem = card.querySelector('[class*="price"]');
                    if (!priceElem) priceElem = card.querySelector('.bui-price-display__value');
                    hotel.price = priceElem ? priceElem.textContent.trim() : null;
                    
                    // Original price (if discounted)
                    const originalPriceElem = card.querySelector('[data-testid="price-before-discount"]');
                    hotel.original_price = originalPriceElem ? originalPriceElem.textContent.trim() : null;
                    
                    // Rating score
                    const ratingElem = card.querySelector('[data-testid="review-score"] > div:first-child');
                    if (!ratingElem) {
                        const altRating = card.querySelector('.bui-review-score__badge');
                        hotel.rating = altRating ? altRating.textContent.trim() : null;
                    } else {
                        hotel.rating = ratingElem.textContent.trim();
                    }
                    
                    // Review count - try multiple selectors
                    let reviewCount = null;
                    const reviewSelectors = [
                        '[data-testid="review-score"] .abf093bdfe',
                        '[data-testid="review-score"] div:nth-child(2)',
                        '.bui-review-score__text',
                        '[class*="review"] span',
                        '[data-testid="review-score"]'
                    ];
                    for (const selector of reviewSelectors) {
                        const elem = card.querySelector(selector);
                        if (elem) {
                            const text = elem.textContent.trim();
                            // Look for patterns like "1,234 reviews" or "Excellent · 500 reviews"
                            const match = text.match(/(\d[\d,]*)\s*review/i);
                            if (match) {
                                reviewCount = match[1].replace(/,/g, '') + ' reviews';
                                break;
                            }
                            // If contains a number, might be rating text like "Excellent"
                            if (text && !reviewCount) {
                                reviewCount = text;
                            }
                        }
                    }
                    hotel.review_count = reviewCount;
                    
                    // Location/Address
                    const locationElem = card.querySelector('[data-testid="address"]');
                    hotel.location = locationElem ? locationElem.textContent.trim() : null;
                    
                    // Distance from center
                    const distanceElem = card.querySelector('[data-testid="distance"]');
                    hotel.distance = distanceElem ? distanceElem.textContent.trim() : null;
                    
                    // Amenities/Facilities
                    const amenityElems = card.querySelectorAll('[data-testid="property-card-unit-configuration"] span');
                    hotel.amenities = Array.from(amenityElems).map(a => a.textContent.trim()).filter(a => a.length > 0);
                    
                    // If no amenities found, try facility badges
                    if (hotel.amenities.length === 0) {
                        const facilityBadges = card.querySelectorAll('.b5cd09854e');
                        hotel.amenities = Array.from(facilityBadges).map(a => a.textContent.trim()).filter(a => a.length > 0);
                    }
                    
                    // Image URL
                    const imgElem = card.querySelector('img[data-testid="image"]');
                    if (imgElem) {
                        hotel.image_url = imgElem.src || imgElem.getAttribute('data-src');
                    } else {
                        const altImg = card.querySelector('.hotel_image, img');
                        hotel.image_url = altImg ? (altImg.src || altImg.getAttribute('data-src')) : null;
                    }
                    
                    // Room info
                    const roomInfoElem = card.querySelector('[data-testid="recommended-units"]');
                    hotel.room_info = roomInfoElem ? roomInfoElem.textContent.trim() : null;
                    
                    // Extract rooms left from room_info (e.g., "Only 5 left at this price")
                    let roomsLeftCount = null;
                    let availabilityText = null;
                    let isLimited = false;
                    
                    // Check room_info for "X left" pattern
                    if (hotel.room_info) {
                        // Match patterns like "Only 5 left", "Only 3 rooms left", etc.
                        const leftMatch = hotel.room_info.match(/Only\s*(\d+)\s*(left|room)/i);
                        if (leftMatch) {
                            roomsLeftCount = parseInt(leftMatch[1]);
                            availabilityText = `Only ${roomsLeftCount} left at this price!`;
                            isLimited = true;
                        }
                        // Also check for general scarcity keywords
                        if (hotel.room_info.toLowerCase().includes('only') || 
                            hotel.room_info.toLowerCase().includes('left') ||
                            hotel.room_info.toLowerCase().includes('last') ||
                            hotel.room_info.toLowerCase().includes('limited')) {
                            isLimited = true;
                            if (!availabilityText) {
                                availabilityText = 'Limited availability';
                            }
                        }
                    }
                    
                    // Also look for urgency messages in other places
                    const urgencySelectors = [
                        '[data-testid="availability-rate-information"]',
                        '.sr_room_reinforcement',
                        '.urgency_message_red',
                        '.urgency_message',
                        '[class*="urgent"]',
                        '[class*="scarcity"]'
                    ];
                    
                    for (const selector of urgencySelectors) {
                        const elem = card.querySelector(selector);
                        if (elem) {
                            const text = elem.textContent.trim();
                            if (text && !roomsLeftCount) {
                                const match = text.match(/(\d+)\s*(left|remaining|room)/i);
                                if (match) {
                                    roomsLeftCount = parseInt(match[1]);
                                    availabilityText = text;
                                    isLimited = true;
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Check for deal badges
                    const dealBadge = card.querySelector('[data-testid="deal-badge"], .deal-badge, [class*="deal"]');
                    hotel.has_deal = dealBadge ? dealBadge.textContent.trim() : null;
                    
                    hotel.rooms_left = roomsLeftCount;
                    hotel.availability = availabilityText || (isLimited ? 'Limited availability' : 'Available');
                    hotel.is_limited = isLimited;
                    
                    // Only add if we have a name
                    if (hotel.name) {
                        results.push(hotel);
                    }
                } catch (error) {
                    // Skip this hotel if error
                }
            });
            
            return results;
        });
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.error(`✅ Extracted ${hotels.length} hotels in ${elapsed}s`);
        
        if (hotels.length === 0) {
            console.error('⚠️ No hotels extracted, page might be blocked');
            // Take screenshot for debugging
            try {
                await page.screenshot({ path: 'debug_screenshot.png', fullPage: true });
                console.error('📸 Debug screenshot saved');
            } catch (e) {}
        }
        
        // Output the results as JSON (stdout)
        console.log(JSON.stringify(hotels));
        return hotels;
        
    } catch (error) {
        console.error('❌ Scraping error:', error.message);
        console.log(JSON.stringify([]));
        return [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Command line interface
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error('Usage: node puppeteer_scraper.js \'{"city":"Lahore","dest_id":"-2767043",...}\'');
        console.log(JSON.stringify([]));
        process.exit(1);
    }
    
    let searchParams;
    try {
        searchParams = JSON.parse(args[0]);
    } catch (e) {
        console.error('Invalid JSON:', e.message);
        console.log(JSON.stringify([]));
        process.exit(1);
    }
    
    scrapeBookingHotels(searchParams).then(() => {
        process.exit(0);
    }).catch(error => {
        console.error('Fatal error:', error.message);
        console.log(JSON.stringify([]));
        process.exit(1);
    });
}

module.exports = { scrapeBookingHotels };
