// ocr-worker.js
// Web Worker that loads Tesseract core and runs recognition.
// This worker expects messages of form: { id, cmd: 'init'|'recognize', imageData, lang }

importScripts('https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js');

let worker = null;

self.onmessage = async (ev) => {
  const msg = ev.data;
  if (!msg || !msg.cmd) return;

  try {
    if (msg.cmd === 'init') {
      worker = Tesseract.createWorker({
        logger: m => self.postMessage({ id: msg.id, type: 'log', payload: m })
      });
      await worker.load();
      await worker.loadLanguage(msg.lang || 'eng');
      await worker.initialize(msg.lang || 'eng');
      self.postMessage({ id: msg.id, type: 'ready' });
    }

    if (msg.cmd === 'recognize' && worker) {
      const { imageData, tessParams } = msg;
      const res = await worker.recognize(imageData, tessParams?.lang || 'eng');
      self.postMessage({ id: msg.id, type: 'result', payload: res });
    }

    if (msg.cmd === 'progress') {
      // no-op; Tesseract sends progress via logger
    }
  } catch (err) {
    self.postMessage({ id: msg.id, type: 'error', error: err?.message || String(err) });
  }
};
