import subprocess
import json

params = {"city":"Lahore","dest_id":"-2767043","checkin":"2026-05-03","checkout":"2026-05-06","adults":4,"rooms":1,"children":0}
out = subprocess.run(['node', 'puppeteer_scraper.js', json.dumps(params)], capture_output=True, text=True, encoding='utf-8', errors='replace')
with open('test_run_out.json', 'w', encoding='utf-8') as f:
    f.write(out.stdout)
with open('test_run_err.txt', 'w', encoding='utf-8') as f:
    f.write(out.stderr)
print("Done. Wrote data to test_run_out.json and test_run_err.txt")
