const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    console.log('Starting...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    let url = 'https://www.booking.com/searchresults.html?ss=Lahore&dest_id=-2767043&dest_type=city&checkin=2026-05-03&checkout=2026-05-06&group_adults=4&no_rooms=1&group_children=0&sb=1&src_elem=sb&src=index';

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 6000));

    // Check for captcha/bot
    const content = await page.content();
    if (content.includes('unusual traffic') || content.includes('CAPTCHA')) {
        console.log('Bot detection!');
    }

    let titles1 = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="title"]')).map(el => el.textContent));
    console.log(`Page 1 fetched ${titles1.length} titles.`);

    // Try click next button
    const clickNext = await page.evaluate(() => {
        let buttons = Array.from(document.querySelectorAll('button'));
        let nextBtn = buttons.find(b => {
            let aria = (b.getAttribute('aria-label') || '').toLowerCase();
            return aria.includes('next page') || aria.includes('next');
        });
        if (nextBtn && !nextBtn.disabled) {
            nextBtn.click();
            return true;
        }
        return false;
    });

    console.log('Clicked next button:', clickNext);

    if (clickNext) {
        await new Promise(r => setTimeout(r, 6000));
        let titles2 = await page.evaluate(() => Array.from(document.querySelectorAll('[data-testid="title"]')).map(el => el.textContent));
        console.log(`Page 2 fetched ${titles2.length} titles.`);
        let same = 0;
        for (let t of titles2) {
            if (titles1.includes(t)) same++;
        }
        console.log(`Same: ${same}`);
    }

    await browser.close();
})();
