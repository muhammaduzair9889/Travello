/**
 * Debug script: open ONE page and dump property card HTML to find price elements
 */
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled','--disable-dev-shm-usage','--disable-gpu','--lang=en-US'],
        ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1440, height: 900 });
    await page.setExtraHTTPHeaders({'Accept-Language':'en-US,en;q=0.9'});
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
        window.chrome = { runtime: {} };
    });

    // Track ALL XHR/fetch response URLs
    const apiUrls = [];
    page.on('response', async (res) => {
        const url = res.url();
        const ct = res.headers()['content-type'] || '';
        if (ct.includes('json') && url.includes('booking.com')) {
            apiUrls.push(url.slice(0, 150));
            // Try to read price from this response
            try {
                const body = await res.text();
                if (body.includes('price') || body.includes('PKR')) {
                    process.stderr.write(`JSON_WITH_PRICE: ${url.slice(0,150)}\n`);
                    // Print first 500 chars
                    process.stderr.write(`  BODY_PREVIEW: ${body.slice(0,400)}\n`);
                }
            } catch {}
        }
    });

    const url = 'https://www.booking.com/searchresults.html?ss=Lahore&dest_id=-2767043&dest_type=city&checkin=2026-03-15&checkout=2026-03-17&group_adults=2&no_rooms=1&lang=en-us&order=popularity';
    process.stderr.write('Navigating...\n');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 50000 });
    await new Promise(r => setTimeout(r, 5000));

    // Dump first property card's full HTML + specific price selectors
    const info = await page.evaluate(() => {
        const card = document.querySelector('[data-testid="property-card"]');
        if (!card) return { error: 'no cards', title: document.title, bodySnippet: document.body.innerHTML.slice(0,500) };

        // Find ALL elements that might contain prices
        const priceSelectors = [
            '[data-testid="price-and-discounted-price"]',
            '[data-testid="price"]',
            '.prco-valign-middle-helper',
            '.bui-price-display__value',
            '[class*="price"]',
            '[class*="Price"]',
            '[class*="cost"]',
            '[class*="amount"]',
            '[class*="rate"]',
        ];
        
        const priceFindings = {};
        for (const sel of priceSelectors) {
            const els = card.querySelectorAll(sel);
            if (els.length > 0) {
                priceFindings[sel] = Array.from(els).map(e => ({
                    text: e.textContent.trim().slice(0,50),
                    html: e.outerHTML.slice(0,150),
                }));
            }
        }

        // Also grab all spans with numbers (likely prices)
        const spans = Array.from(card.querySelectorAll('span,div')).filter(el => {
            const t = el.textContent.trim();
            return /\d{3,}/.test(t) && t.length < 30;
        }).slice(0,10);

        return {
            name: card.querySelector('[data-testid="title"]')?.textContent?.trim(),
            priceFindings,
            numericSpans: spans.map(s => ({ cls: s.className.slice(0,60), text: s.textContent.trim().slice(0,30) })),
            htmlSnippet: card.innerHTML.slice(0, 2000),
        };
    });

    process.stderr.write('API URLs seen: ' + JSON.stringify(apiUrls.slice(0,10), null, 2) + '\n');
    process.stdout.write(JSON.stringify(info, null, 2));
    await browser.close();
})();
