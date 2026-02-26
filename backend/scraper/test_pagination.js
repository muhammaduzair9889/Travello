const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const fs = require('fs');

(async () => {
    console.log('Starting...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    let url = 'https://www.booking.com/searchresults.html?ss=Lahore&dest_id=-2767043&dest_type=city&checkin=2026-05-03&checkout=2026-05-06&group_adults=4&no_rooms=1&group_children=0&sb=1&src_elem=sb&src=index';

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000));

    let html = await page.evaluate(() => {
        let pagination = document.querySelector('[data-testid="pagination"]') ||
            document.querySelector('.bui-pagination') ||
            document.querySelector('nav[aria-label*="agination"]');
        return pagination ? pagination.outerHTML : 'No pagination found';
    });

    let buttons = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, a')).filter(el => {
            let t = el.innerText || '';
            let a = el.getAttribute('aria-label') || '';
            return t.toLowerCase().includes('next') || a.toLowerCase().includes('next');
        }).map(el => ({
            tag: el.tagName,
            text: el.innerText,
            aria: el.getAttribute('aria-label'),
            className: el.className
        }));
    });

    fs.writeFileSync('pagination_debug.txt', JSON.stringify({ html, buttons }, null, 2));
    console.log('Wrote pagination details');

    await browser.close();
})();
