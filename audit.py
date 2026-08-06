import re
import os

js_path = r'C:\Users\Ahmet Piç\.gemini\antigravity\scratch\financial-bot\app.js'
html_path = r'C:\Users\Ahmet Piç\.gemini\antigravity\scratch\financial-bot\index.html'

with open(js_path, 'r', encoding='utf-8') as f:
    js_content = f.read()

with open(html_path, 'r', encoding='utf-8') as f:
    html_content = f.read()

js_ids = set(re.findall(r'document\.getElementById\([\'"]([^\'"]+)[\'"]\)', js_content))
html_ids = set(re.findall(r'id=[\'"]([^\'"]+)[\'"]', html_content))

missing = js_ids - html_ids

print("=== DOM AUDIT RESULTS ===")
print("IDs requested in JS:", js_ids)
print("IDs defined in HTML:", html_ids)
print("\n!!! MISSING IN HTML !!!:", missing)
