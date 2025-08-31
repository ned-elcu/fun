// ui.js (module)
// Main UI glue: handles file input, canvas preview, Tesseract worker usage, and table UI.

import { groupBoxesToRows, extractNamesFromRows, uniqueFuzzy } from './parser.js';

const state = {
  image: null,
  ocrWorker: null, // Tesseract worker instance (created via Tesseract.createWorker)
  names: [],
  lastId: 0,
};

function $(id){return document.getElementById(id);}

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

  // Drag-drop handlers
  ['dragenter','dragover'].forEach(ev=> dropzone.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.add('border-indigo-300'); }));
  ['dragleave','drop'].forEach(ev=> dropzone.addEventListener(ev, e=>{ e.preventDefault(); dropzone.classList.remove('border-indigo-300'); }));
  dropzone.addEventListener('drop', (e)=>{ const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) loadFile(f); });
  dropzone.addEventListener('click', ()=> fileInput.click());
  fileInput.addEventListener('change', (e)=> { const f = e.target.files[0]; if (f) loadFile(f); });

  // Paste support
  window.addEventListener('paste', (e)=>{
    const item = e.clipboardData.items[0]; if (item && item.type.startsWith('image/')){ const blob = item.getAsFile(); loadFile(blob); }
  });

  processBtn.addEventListener('click', async ()=>{
    if (!state.image) { setStatus('No image loaded.'); return; }
    setStatus('Initializing OCR...');
    await initWorker();
    setStatus('Running OCR — this may take a few seconds.');

    try {
      const res = await state.ocrWorker.recognize(state.image);
      appendOCRLog('OCR complete');
      progress.value = 1;
      handleTesseractResult(res);
    } catch (err) {
      setStatus('OCR Error: ' + (err && err.message ? err.message : String(err)));
    }
  });

  overlayToggle.addEventListener('change', ()=>{ ocrOverlay.classList.toggle('hidden', !overlayToggle.checked); if (overlayToggle.checked) renderOverlay([]); });

  function appendOCRLog(s){ ocrOutput.textContent += '\n' + s; ocrOutput.scrollTop = ocrOutput.scrollHeight; }

  async function initWorker(){
    if (state.ocrWorker) return;
    if (typeof Tesseract === 'undefined') { setStatus('Tesseract.js not loaded'); throw new Error('Tesseract.js not loaded'); }
    setStatus('Loading Tesseract worker (this may download ~3–10 MB)...');
    state.ocrWorker = Tesseract.createWorker({
      logger: m => {
        // m: { status: 'recognizing text'|'initialized'|..., progress: 0.xx }
        if (m && m.status === 'recognizing text') {
          progress.value = m.progress || 0;
        }
        appendOCRLog(JSON.stringify(m));
      }
    });
    await state.ocrWorker.load();
    await state.ocrWorker.loadLanguage('eng');
    await state.ocrWorker.initialize('eng');
    setStatus('OCR worker ready.');
  }

  async function handleTesseractResult(res){
    // Tesseract result structure: res.data.words / res.data.symbols etc.
    const boxes = [];
    try{
      const words = res.data && res.data.words ? res.data.words : [];
      for (const w of words) {
        boxes.push({ text: w.text, bbox: { x0: w.bbox.x0, y0: w.bbox.y0, x1: w.bbox.x1, y1: w.bbox.y1 } });
      }
      const rows = groupBoxesToRows(boxes, Math.max(8, Math.round(previewCanvas.height * 0.02)));
      const names = extractNamesFromRows(rows);
      const fuzzy = $('fuzzyToggle').checked ? uniqueFuzzy(names) : names;
      state.names = fuzzy.filter(Boolean);
      renderTable();
      if ($('overlayToggle').checked) renderOverlay(rows);
      setStatus('Extraction complete — ' + state.names.length + ' names found.');
    } catch (err){ setStatus('Parsing error: ' + err.message); }
  }

  function renderOverlay(rows){
    ocrOverlay.innerHTML = '';
    const scaleX = previewCanvas.width / (state.imageWidth || previewCanvas.width);
    const scaleY = previewCanvas.height / (state.imageHeight || previewCanvas.height);
    for (const r of rows) {
      for (const b of r.items) {
        const el = document.createElement('div'); el.className = 'bounding-box';
        el.style.left = (b.bbox.x0 * scaleX) + 'px';
        el.style.top = (b.bbox.y0 * scaleY) + 'px';
        el.style.width = ((b.bbox.x1 - b.bbox.x0) * scaleX) + 'px';
        el.style.height = ((b.bbox.y1 - b.bbox.y0) * scaleY) + 'px';
        ocrOverlay.appendChild(el);
      }
    }
  }

  function renderTable(){
    namesTableBody.innerHTML = '';
    state.names.forEach((n,i)=>{
      const tr = document.createElement('tr');
      const inputId = 'name-input-' + i;
      tr.innerHTML = `<td class="p-2 text-xs">${i+1}</td><td class="p-2 text-sm"><input id="${inputId}" aria-label="name-${i}" class="w-full p-1 border rounded text-sm" /></td><td class="p-2 text-sm"><button data-i="${i}" class="delBtn px-2 py-1 text-xs border rounded">Delete</button></td>`;
      namesTableBody.appendChild(tr);
      const inputEl = document.getElementById(inputId);
      inputEl.value = n;
      inputEl.addEventListener('change', (e)=>{ state.names[i] = e.target.value; });
      tr.querySelector('.delBtn').addEventListener('click', ()=>{ state.names.splice(i,1); renderTable(); });
    });
  }

  searchInput.addEventListener('input', ()=>{ filterAndSortRender(); });
  sortSelect.addEventListener('change', ()=>{ filterAndSortRender(); });

  copyBtn.addEventListener('click', ()=>{
    const csv = toCSV(state.names);
    navigator.clipboard.writeText(csv).then(()=> setStatus('Copied CSV to clipboard')).catch(()=> setStatus('Copy failed'));
  });
  exportBtn.addEventListener('click', ()=>{
    const csv = toCSV(state.names);
    const blob = new Blob([csv],{type:'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'names.csv'; a.click(); URL.revokeObjectURL(url);
  });

  resetBtn.addEventListener('click', ()=>{ resetAll(); });

  function filterAndSortRender(){
    const q = searchInput.value.toLowerCase();
    const sort = sortSelect.value;
    let list = state.names.filter(n => n.toLowerCase().includes(q));
    list.sort((a,b)=> sort==='asc' ? a.localeCompare(b) : b.localeCompare(a));
    namesTableBody.innerHTML = '';
    list.forEach((n,i)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="p-2 text-xs">${i+1}</td><td class="p-2 text-sm">${escapeHtml(n)}</td><td class="p-2 text-sm"></td>`;
      namesTableBody.appendChild(tr);
    });
  }

  function toCSV(list){
    return list.map(s => '"' + s.replace(/"/g,'""') + '"').join('\n');
  }

  function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function setStatus(s){ $('status').textContent = s; }

  function resetAll(){ state.image = null; state.names = []; if (state.ocrWorker) { state.ocrWorker.terminate(); state.ocrWorker = null; } $('previewCanvas').getContext('2d').clearRect(0,0, $('previewCanvas').width, $('previewCanvas').height); $('ocrOutput').textContent=''; $('namesTable').querySelector('tbody').innerHTML=''; setStatus('Reset.'); }

  async function loadFile(file){
    setStatus('Loading image...');
    const blobURL = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const ctx = previewCanvas.getContext('2d');
      const maxW = 1200; const maxH = 900;
      let w = img.width; let h = img.height; const scale = Math.min(maxW/w, maxH/h, 1);
      previewCanvas.width = Math.round(w * scale);
      previewCanvas.height = Math.round(h * scale);
      ctx.clearRect(0,0,previewCanvas.width, previewCanvas.height);
      ctx.drawImage(img,0,0, previewCanvas.width, previewCanvas.height);
      state.image = blobURL;
      state.imageWidth = img.width; state.imageHeight = img.height;
      setStatus('Image loaded. Ready to process.');
    };
    img.onerror = ()=> setStatus('Failed to load image');
    img.src = blobURL;
  }

});
