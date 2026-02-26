const fs = require('fs');
const html = fs.readFileSync('page_dump.html', 'utf8');
const { JSDOM } = require('jsdom'); // oh I might not have jsdom installed, wait I'll use cheerio.

