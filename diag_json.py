import json
import sys

path = r'd:\loksewa-portal\New folder\New folder\Geographical Divesity, Climatic Condition & Cultures.json'
with open(path, 'r', encoding='utf-8-sig') as f:
    data = f.read()

# First: check if it's valid JSON as-is (with newlines intact)
try:
    parsed = json.loads(data)
    print("VALID JSON as-is. Questions:", len(parsed['questions']))
    sys.exit(0)
except json.JSONDecodeError as e:
    print("AS-IS PARSE FAILED:", e)
    print("Position:", e.pos, "Line/col:", e.lineno, e.colno)
    start = max(0, e.pos - 150)
    end = min(len(data), e.pos + 150)
    print("Context:")
    print(repr(data[start:end]))
    print("---")

# Second: check after collapsing newlines (like the PowerShell script does)
data_flat = data.replace('\r', ' ').replace('\n', ' ')
import re
data_flat = re.sub(r',\s*(?=[}\]])', '', data_flat)
try:
    parsed = json.loads(data_flat)
    print("VALID JSON after flattening. Questions:", len(parsed['questions']))
    sys.exit(0)
except json.JSONDecodeError as e:
    print("FLATTENED PARSE FAILED:", e)
    print("Position:", e.pos)
    start = max(0, e.pos - 150)
    end = min(len(data_flat), e.pos + 150)
    print("Context:")
    print(repr(data_flat[start:end]))
