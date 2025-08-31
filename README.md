# OCR Table Extractor — Production-ready ZIP

This package contains a working, production-friendly build of the OCR Table Extractor app.

What I fixed and included in this ZIP:
- **No cdn.tailwindcss.com**: instead there's a small, production `assets/styles.css` (handcrafted to cover the app's styles). If you want *real* Tailwind-generated CSS, see the instructions below to build with Tailwind CLI and replace `assets/styles.css`.
- **Fixed OCR usage**: uses `Tesseract.createWorker()` from Tesseract.js and calls `worker.recognize(imageDataURL)` correctly. The code waits for the worker to load and shows progress via the logger.
- The app runs fully client-side (images processed in browser by default).

## How to run locally (recommended)
Serve the folder over HTTP (modules and worker require a server). Example:
```bash
python -m http.server 8000
# Open http://localhost:8000
```

## Using real Tailwind (optional)
If you prefer to replace the handcrafted CSS with a Tailwind build:
1. Install Tailwind & PostCSS:
   ```bash
   npm install -D tailwindcss postcss autoprefixer
   npx tailwindcss init
   ```
2. Create `assets/input.css` with:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```
3. Update `tailwind.config.js` `content` to include `./index.html` and `./assets/**/*.js`.
4. Build:
   ```bash
   npx tailwindcss -i ./assets/input.css -o ./assets/styles.css --minify
   ```
5. Commit the generated `assets/styles.css` (so GitHub Pages serves a static CSS).

## Notes
- Tesseract.js downloads language data at runtime (~2–8 MB). First run may take longer.
- If OCR accuracy is poor, try preprocessing (deskew, contrast). OpenCV.js can be integrated client-side as a later improvement.

## License
MIT
