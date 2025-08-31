# OCR Table Extractor

Client-side web app to extract names from an image of a table. Designed to be GitHub Pages–deployable and privacy-first: images processed in the browser.

## Features
- Drag & drop / paste / file upload
- Client-side Tesseract.js OCR running inside a Web Worker
- Bounding-box overlay to verify OCR
- Heuristics to parse words into table rows and extract name tokens
- Search, sort, edit, copy, and export CSV
- Accessible UI, dark-mode aware, keyboard-friendly

## Architecture
- `index.html` — single-page UI
- `assets/ocr-worker.js` — Web Worker loading Tesseract
- `assets/parser.js` — heuristics for grouping and name cleaning
- `assets/ui.js` — glue and UI handling

## How to deploy on GitHub Pages
1. Create a new public repository and push these files.
2. In repo settings → Pages, choose branch `main` (or `gh-pages`) and `/ (root)` folder.
3. Optionally add the workflow provided to auto-deploy.

## Notes & Troubleshooting
- For large images, enable the `overlay` only after processing to avoid UI lag.
- If OCR fails, try a higher-contrast, deskewed scan. Consider preprocessing with OpenCV.js for better results.

## License
MIT. See `LICENSE`.
