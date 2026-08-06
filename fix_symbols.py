from pathlib import Path

path = Path(r"D:\loksewa-portal\questions\structural enginnering.json")
text = path.read_text(encoding='utf-8')

replacements = {
    'Ïƒ': 'σ',
    'Îµ': 'ε',
    'Î”': 'Δ',
    'Â°C': '°C',
    'Â²': '²',
    'Â³': '³',
    'Ã—': '×',
    'â€°': '°',
    'â€“': '–',
    'â€”': '—',
    'â€˜': '‘',
    'â€™': '’',
    'â€œ': '“',
    'â€': '”',
    'â€¢': '•',
    'âˆš': '√',
    'â´': '⁴',
    'Ï€': 'π',
    'Ï„': 'τ',
    'Î¸': 'θ',
    'Î£': 'Σ',
    'Î¼': 'μ',
    'Î±': 'α',
    'Î²': 'β',
    'Î³': 'γ',
    'Î·': 'η',
    'Î»': 'λ',
    'Î´': 'δ',
    'Îº': 'κ',
    'Î¾': 'ξ',
    'Î¶': 'ζ',
    'Ï‰': 'ω',
    'Ï': 'ρ',
    'ïƒ': 'σ',
    'ï€': '°',
}

for old, new in replacements.items():
    text = text.replace(old, new)

path.write_text(text, encoding='utf-8')
print('updated symbols')
