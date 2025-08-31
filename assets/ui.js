// ui.js (ES module)
// Main UI glue: handles file input, canvas preview, Tesseract worker usage, and table UI.

import { groupBoxesToRows, extractNamesFromRows, uniqueFuzzy } from './parser.js';

const state = {
  image: null,           // data URL of image shown on canvas
  imageWidth: 0,
  imageHeight: 0,
  ocrWorker: null,       // Tesseract worker instance
  names: [],
};

function $(id){ return document.getElementById(id); }

window.addEventListener('DOMContentLoaded', () => {
  const dropzone = $('dropzone');
  const fileInput = $('fileInput');
  const processBtn = $('processBtn');
  const previewCanvas = $('previewCanvas');
  const progress = $('progress');
  const ocrOutput = $('ocrOutput');
  const overlayToggle = $('overlayToggle');
  const ocrOverlay = $('ocrOverlay');
  const namesTableBody = $('namesTable').querySelector('tbody');
  const searchInput = $('searchInput');
  const sortSelect = $('sortSelect');
  const copyBtn = $('copyBtn');
  const exportBtn = $('exportBtn');
  const resetBtn = $('resetBtn');
  const statusEl = $('status');

  // Drag/drop handlers
  ['dragenter','dragover'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.add('drop-active'); }));
  ['dragleave','drop'].forEach(ev => dropzone.addEventListener(ev, e => { e.preventDefault(); dropzone.classList.remove('drop-active'); }));
  dropzone.addEventListener('drop', e => { const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => { const f = e.target.files[0]; if (f) loadFile(f); });

  // Paste image support
  window.addEventListener('paste', (e) => {
    const items = e.clipboardData && e.clipboardData.items;
    if (!items) return;
    for (const it of items) {
      if (it.type && it.type.indexOf('image') !== -1) {
        const blob = it.getAsFile();
        loadFile(blob);
        break;
      }
    }
  });

  processBtn.addEventListener('click', async () => {
    if (!state.image) { setStatus('No image loaded.'); return; }
    try {
      setStatus('Initializing OCR...');
      await initWorker();
      setStatus('Running OCR — this may take a few seconds.');
      const res = await state.ocrWorker.recognize(state.image);
      // optional: keep the worker for subsequent runs, or terminate to free memory
      // await state.ocrWorker.terminate();
      // state.ocrWorker = null;
      handleTesseractResult(res);
      setStatus('OCR finished.');
    } catch (err) {
      setStatus('OCR Error: ' + (err && err.message ? err.message : String(err)));
      console.error(err);
    }
  });

  overlayToggle.addEventListener('change', () => {
    ocrOverlay.classList.toggle('hidden', !overlayToggle.checked);
  });

  copyBtn.addEventListener('click', async () => {
    const csv = toCSV(state.names);
    try {
      await navigator.clipboard.writeText(csv);
      setStatus('Copied CSV to clipboard');
    } catch (e) {
      setStatus('Copy failed: ' + e.message);
    }
  });

  exportBtn.addEventListener('click', () => {
    const csv = toCSV(state.names);
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'names.csv'; a.click(); URL.revokeObjectURL(url);
  });

  resetBtn.addEventListener('click', resetAll);
  searchInput.addEventListener('input', filterAndSortRender);
  sortSelect.addEventListener('change', filterAndSortRender);

  
  
  
  
async function initWorker() {
  if (state.ocrWorker) return;

  const logger = m => {
    if (m && m.status === 'recognizing text') {
      try { progress.value = m.progress || 0; } catch (e) {}
    }
    appendOCRLog(JSON.stringify(m));
  };

  // v5 API: createWorker(lang, oem, options)
  state.ocrWorker = await Tesseract.createWorker('eng', 1, { logger });

  setStatus('OCR worker ready.');
}



  }

  function appendOCRLog(s) {
    ocrOutput.textContent += '\n' + s;
    ocrOutput.scrollTop = ocrOutput.scrollHeight;
  }

  function handleTesseractResult(res) {
    // Build boxes from words / symbols
    const boxes = [];
    try {
      const words = res && res.data && res.data.words ? res.data.words : [];
      for (const w of words) {
        // w.bbox: { x0, y0, x1, y1 }
        boxes.push({ text: w.text, bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } });
      }
      const rows = groupBoxesToRows(boxes, Math.max(8, Math.round(previewCanvas.height * 0.02)));
      const names = extractNamesFromRows(rows);
      const final = $('fuzzyToggle').checked ? uniqueFuzzy(names) : names;
      state.names = final.filter(Boolean);
      renderTable();
      if ($('overlayToggle').checked) renderOverlay(rows);
      setStatus('Extraction complete — ' + state.names.length + ' names found.');
    } catch (err) {
      console.error(err);
      setStatus('Parsing error: ' + (err && err.message ? err.message : String(err)));
    }
  }

  function renderOverlay(rows) {
    ocrOverlay.innerHTML = '';
    if (!rows || !rows.length) return;
    // scale from OCR coordinate system to canvas
    const scaleX = previewCanvas.width / state.imageWidth;
    const scaleY = previewCanvas.height / state.imageHeight;
    for (const r of rows) {
      for (const b of r.items) {
        const el = document.createElement('div');
        el.className = 'bounding-box';
        const left = Math.round(b.bbox.x0 * scaleX);
        const top = Math.round(b.bbox.y0 * scaleY);
        const w = Math.round((b.bbox.x1 - b.bbox.x0) * scaleX);
        const h = Math.round((b.bbox.y1 - b.bbox.y0) * scaleY);
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.width = Math.max(2, w) + 'px';
        el.style.height = Math.max(2, h) + 'px';
        ocrOverlay.appendChild(el);
      }
    }
  }

  function renderTable() {
    namesTableBody.innerHTML = '';
    state.names.forEach((n, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td><input aria-label="name-${i}" class="input" value="${escapeHtml(n)}" /></td><td><button data-i="${i}" class="btn">Delete</button></td>`;
      namesTableBody.appendChild(tr);
      const input = tr.querySelector('input');
      input.addEventListener('change', (e) => { state.names[i] = e.target.value; });
      tr.querySelector('button').addEventListener('click', () => { state.names.splice(i,1); renderTable(); });
    });
  }

  function filterAndSortRender() {
    const q = searchInput.value.toLowerCase();
    const sort = sortSelect.value;
    let list = state.names.filter(n => n.toLowerCase().includes(q));
    list.sort((a,b) => sort === 'asc' ? a.localeCompare(b) : b.localeCompare(a));
    namesTableBody.innerHTML = '';
    list.forEach((n,i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i+1}</td><td>${escapeHtml(n)}</td><td></td>`;
      namesTableBody.appendChild(tr);
    });
  }

  function toCSV(list) {
    return list.map(s => '"' + (s || '').replace(/"/g,'""') + '"').join('\n');
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function setStatus(s) { statusEl.textContent = s; }

  function resetAll() {
    state.image = null;
    state.imageWidth = 0;
    state.imageHeight = 0;
    state.names = [];
    if (state.ocrWorker) { state.ocrWorker.terminate(); state.ocrWorker = null; }
    const ctx = previewCanvas.getContext('2d');
    ctx.clearRect(0,0,previewCanvas.width, previewCanvas.height);
    $('ocrOutput').textContent = '';
    $('namesTable').querySelector('tbody').innerHTML = '';
    setStatus('Reset.');
  }

  async function loadFile(file) {
    setStatus('Loading image...');
    const img = new Image();
    const blobURL = URL.createObjectURL(file);
    img.onload = () => {
      // store original size
      state.imageWidth = img.naturalWidth;
      state.imageHeight = img.naturalHeight;
      // fit canvas to max sizes but preserve aspect ratio
      const maxW = 1200, maxH = 900;
      let w = img.naturalWidth, h = img.naturalHeight;
      const scale = Math.min(maxW / w, maxH / h, 1);
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);
      const canvas = previewCanvas;
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0,0,canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // keep a data URL for Tesseract; this avoids blob/URL issues in some browsers
      state.image = canvas.toDataURL('image/png');
      setStatus('Image loaded. Ready to process.');
      URL.revokeObjectURL(blobURL);
    };
    img.onerror = () => {
      setStatus('Failed to load image.');
      URL.revokeObjectURL(blobURL);
    };
    img.src = blobURL;
  }

});
