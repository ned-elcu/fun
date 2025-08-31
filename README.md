# OCR Table Extractor (fixed)

This version addresses two common issues you reported:
- invalid SRI / integrity attribute for Tailwind CDN (removed, using official CDN script)
- `import` syntax error (now `assets/ui.js` is loaded as an ES module and uses Tesseract.createWorker directly)

Run locally with a simple static server (recommended):
```bash
python -m http.server 8000
# then open http://localhost:8000 in your browser
```

Or push to GitHub Pages as usual.
