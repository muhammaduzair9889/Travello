import re

with open('page_dump.html', 'r', encoding='utf-8', errors='ignore') as f:
    text = f.read()

# Look for properties found text
found = re.findall(r'(\d+)\s+properties found', text)
print("Properties Found matches:", found)

# Count property cards
cards = text.count('data-testid="property-card"')
print("Property cards:", cards)

# Look for pagination 
next_matches = re.findall(r'<button[^>]*aria-label="[^"]*Next[^"]*"[^>]*>', text, flags=re.IGNORECASE)
print("Next buttons:", next_matches)

# Or any buttons at all
btns = re.findall(r'<button[^>]*>.*?</button>', text, flags=re.IGNORECASE | re.DOTALL)
print("Total buttons:", len(btns))
for b in btns:
    if 'next' in b.lower():
        print("Btn with 'next':", b[:200])

