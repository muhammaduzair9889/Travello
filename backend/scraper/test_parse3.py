import re

with open('page_dump.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

out_lines = []
tags = re.findall(r'(<a[^>]*|button[^>]*>)(.*?)(</a>|</button>)', text, flags=re.IGNORECASE | re.DOTALL)
count = 0
for start, inner, end in tags:
    aria_match = re.search(r'aria-label="([^"]*)"', start, flags=re.IGNORECASE)
    aria = aria_match.group(1) if aria_match else ""
    inner_text = re.sub(r'<[^>]*>', ' ', inner).strip()
    inner_text = re.sub(r'\s+', ' ', inner_text)
    if 'next' in inner_text.lower() or 'next' in aria.lower() or 'more' in inner_text.lower() or 'load' in inner_text.lower():
        out_lines.append(f"[{count}] aria:'{aria}' text:'{inner_text}'")
        count += 1

with open('test_parse_out.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(out_lines))
    
print("Wrote output to test_parse_out.txt")
