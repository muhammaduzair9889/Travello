import re

with open('page_dump.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Dump all buttons
btns = re.findall(r'(<button[^>]*>)(.*?)(</button>)', text, flags=re.IGNORECASE | re.DOTALL)
for i, b in enumerate(btns):
    start = b[0]
    inner = b[1]
    aria_match = re.search(r'aria-label="([^"]*)"', start, flags=re.IGNORECASE)
    aria = aria_match.group(1) if aria_match else ""
    # strip tags from inner
    inner_text = re.sub(r'<[^>]*>', ' ', inner).strip()
    print(f"[{i}] aria:'{aria}' text:'{inner_text}'")

