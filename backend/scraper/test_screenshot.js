const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    console.log('Starting...');
    const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1280, height: 800 } });
    const page = await browser.newPage();

    let url = 'https://www.booking.com/searchresults.html?ss=Lahore&dest_id=-2767043&dest_type=city&checkin=2026-05-03&checkout=2026-05-06&group_adults=4&no_rooms=1&group_children=0&sb=1&src_elem=sb&src=index';

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 6000));

    // Scroll to bottom
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 2000));

    // Take screenshot
    await page.screenshot({ path: 'page_bottom.png', fullPage: true });
    console.log('Screenshot saved to page_bottom.png');

    await browser.close();
})();
