const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    console.log('Starting...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    // Page 1
    let url = 'https://www.booking.com/searchresults.html?ss=Lahore&dest_id=-2767043&dest_type=city&checkin=2026-05-03&checkout=2026-05-06&group_adults=4&no_rooms=1&group_children=0&sb=1&src_elem=sb&src=index&offset=0';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000));
    let t1 = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="title"]')).map(e => e.innerText));

    // Page 2
    let url2 = 'https://www.booking.com/searchresults.html?ss=Lahore&dest_id=-2767043&dest_type=city&checkin=2026-05-03&checkout=2026-05-06&group_adults=4&no_rooms=1&group_children=0&sb=1&src_elem=sb&src=index&offset=25';
    await page.goto(url2, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 4000));
    let t2 = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="title"]')).map(e => e.innerText));

    let sameCount = 0;
    for (let t of t2) {
        if (t1.includes(t)) sameCount++;
    }

    console.log(`t1 size: ${t1.length}`);
    console.log(`t2 size: ${t2.length}`);
    console.log(`Same titles: ${sameCount}`);

    await browser.close();
})();
