// parser.js
// Implements heuristics to parse Tesseract results into rows of names.

/**
 * Group boxes into rows by y-center proximity, then sort by x.
 * boxes: [{text, bbox:{x0,y0,x1,y1}}]
 */
export function groupBoxesToRows(boxes, yThreshold = 10) {
  if (!boxes || !boxes.length) return [];
  // compute centers
  boxes.forEach(b => { b.cy = (b.bbox.y0 + b.bbox.y1)/2; b.cx = (b.bbox.x0 + b.bbox.x1)/2; });
  boxes.sort((a,b) => a.cy - b.cy || a.cx - b.cx);
  const rows = [];
  for (const b of boxes) {
    let placed = false;
    for (const r of rows) {
      const dy = Math.abs(r.cy - b.cy);
      if (dy <= yThreshold) {
        r.items.push(b); r.cy = (r.cy * (r.items.length-1) + b.cy) / r.items.length; placed = true; break;
      }
    }
    if (!placed) rows.push({ cy: b.cy, items: [b] });
  }
  // sort each row by x
  for (const r of rows) r.items.sort((a,b)=> a.cx - b.cx);
  return rows;
}

/**
 * Flatten rows into probable name tokens using heuristics.
 * Returns array of cleaned strings.
 */
export function extractNamesFromRows(rows) {
  const names = [];
  for (const r of rows) {
    const text = r.items.map(i => i.text).join(' ').trim();
    const clean = normalizeName(text);
    if (clean) names.push(clean);
  }
  return names;
}

export function normalizeName(s) {
  if (!s) return null;
  // Basic Unicode normalization
  let t = s.replace(/[\u00A0]/g,' ').replace(/\s+/g,' ').trim();
  // Remove table-like noise (allow letters, numbers, spaces, dots, commas, hyphens, apostrophes)
  t = t.replace(/[^\p{L}\p{N} .,\-']/gu, '');
  // collapse multiple punctuation
  t = t.replace(/[.,\-']{2,}/g, match => match[0]);
  if (t.length < 2) return null;
  // Capitalize words
  t = t.split(' ').map(w => w.length>1 ? (w[0].toUpperCase()+w.slice(1).toLowerCase()) : w.toUpperCase()).join(' ');
  return t;
}

export function uniqueFuzzy(list) {
  // Simple O(n^2) fuzzy dedupe using levenshtein threshold
  const out = [];
  for (const s of list) {
    let dup = false;
    for (const e of out) {
      if (levDist(s.toLowerCase(), e.toLowerCase()) <= 2) { dup = true; break; }
    }
    if (!dup) out.push(s);
  }
  return out;
}

function levDist(a,b){
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp = Array(b.length+1).fill(0).map((_,j)=>j);
  for (let i=1;i<=a.length;i++){ let prev=i; for (let j=1;j<=b.length;j++){ const cur = dp[j]; let cost = a[i-1]===b[j-1]?0:1; dp[j] = Math.min(dp[j]+1, dp[j-1]+1, prev+cost); prev = cur; } }
  return dp[b.length];
}
