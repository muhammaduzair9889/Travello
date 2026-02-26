const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    console.log('Starting...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    let url = 'https://www.booking.com/searchresults.html?ss=Lahore&dest_id=-2767043&dest_type=city&checkin=2026-05-03&checkout=2026-05-06&group_adults=4&no_rooms=1&group_children=0&sb=1&src_elem=sb&src=index';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000));

    for (let i = 0; i < 15; i++) {
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await new Promise(r => setTimeout(r, 3000));
        let titles = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="title"]')).length);
        console.log(`Scroll ${i}: ${titles} titles found`);
    }

    await browser.close();
})();
