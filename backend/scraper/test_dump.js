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
    await new Promise(r => setTimeout(r, 5000));

    let html = await page.evaluate(() => document.body.innerHTML);
    fs.writeFileSync('page_dump.html', html);
    console.log('Wrote page_dump.html');

    await browser.close();
})();
