const PALETTE = ['#E8B94A', '#D64545', '#2FA6A0', '#8B6BC4', '#E0954A', '#4A2E52'];
const DEFAULT_ENTRIES = [
  { id: 'e1', name: 'Voucher Belanja', qty: 3, image: null },
  { id: 'e2', name: 'Payung Cantik', qty: 2, image: null },
  { id: 'e3', name: 'Tumbler Eksklusif', qty: 5, image: null },
  { id: 'e4', name: 'Grand Prize', qty: 1, image: null },
];

let entries = [...DEFAULT_ENTRIES];
let rotation = 0;
let spinning = false;
let winner = null;
let idCounter = 0;
let currentImageBase64 = null;

function nextId() {
  idCounter++;
  return `e${Date.now()}_${idCounter}`;
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return ['M', cx, cy, 'L', start.x, start.y, 'A', r, r, 0, largeArcFlag, 0, end.x, end.y, 'L', cx, cy, 'Z'].join(' ');
}

function activeEntries() { return entries.filter(e => e.qty > 0); }
function totalQty() { return activeEntries().reduce((s, e) => s + e.qty, 0); }

function computeSegments() {
  const active = activeEntries();
  const total = totalQty();
  if (total <= 0) return [];
  let cum = 0;
  return active.map((e, i) => {
    const angle = (e.qty / total) * 360;
    const seg = { id: e.id, name: e.name, qty: e.qty, image: e.image, start: cum, end: cum + angle, mid: cum + angle / 2, color: PALETTE[i % PALETTE.length] };
    cum += angle;
    return seg;
  });
}

function compressImage(file, callback) {
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = new Image();
    img.onload = function() {
      const canvas = document.createElement('canvas');
      const max_size = 250; 
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > max_size) { height *= max_size / width; width = max_size; }
      } else {
        if (height > max_size) { width *= max_size / height; height = max_size; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      callback(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function saveEntries() {
  try { localStorage.setItem('roda-hoki-entries', JSON.stringify(entries)); } catch (err) {
    console.warn('Storage penuh, mungkin gambar terlalu banyak.');
  }
}

function loadEntries() {
  try {
    const saved = localStorage.getItem('roda-hoki-entries');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) entries = parsed;
    }
  } catch (err) {}
  renderAll();
}

function createSvgElement(tag, attrs) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function renderHeaderBulbs() {
  const container = document.getElementById('headerBulbs');
  container.innerHTML = '';
  for(let i=0; i<9; i++) {
    const color = i % 2 === 0 ? 'var(--gold)' : 'var(--red)';
    const span = document.createElement('span');
    span.className = 'bulb inline-block rounded-full';
    span.style.width = '8px'; span.style.height = '8px';
    span.style.background = color;
    span.style.animationDelay = `${i * 0.15}s`;
    span.style.boxShadow = `0 0 8px ${color}`;
    container.appendChild(span);
  }
}

function renderWheel() {
  const svg = document.getElementById('wheelSvg');
  svg.innerHTML = '';
  svg.style.transform = `rotate(${rotation}deg)`;
  svg.style.transition = spinning ? 'transform 4.2s cubic-bezier(0.12,0.65,0.1,1)' : 'none';

  svg.appendChild(createSvgElement('circle', { cx: 200, cy: 200, r: 196, fill: 'none', stroke: 'var(--gold)', 'stroke-width': 5 }));
  
  for(let i=0; i<20; i++) {
    const p = polarToCartesian(200, 200, 190, (360 / 20) * i);
    const color = i % 2 === 0 ? 'var(--gold)' : 'var(--cream)';
    const circle = createSvgElement('circle', { cx: p.x, cy: p.y, r: 4, fill: color, class: 'bulb' });
    circle.style.animationDelay = `${(i % 5) * 0.2}s`;
    svg.appendChild(circle);
  }

  const segments = computeSegments();
  if (segments.length === 0) {
    svg.appendChild(createSvgElement('circle', { cx: 200, cy: 200, r: 175, fill: 'var(--panel-2)', stroke: 'rgba(245,239,227,0.15)', 'stroke-width': 2 }));
    const text = createSvgElement('text', { x: 200, y: 200, 'text-anchor': 'middle', fill: 'rgba(245,239,227,0.5)', 'font-size': 16, class: 'rh-body' });
    text.textContent = 'Tambahkan item';
    svg.appendChild(text);
  } else {
    segments.forEach(seg => {
      svg.appendChild(createSvgElement('path', { d: describeArc(200, 200, 175, seg.start, seg.end), fill: seg.color, stroke: 'var(--bg)', 'stroke-width': 2 }));
      
      const g = createSvgElement('g', { transform: `rotate(${seg.mid}, 200, 200)` });
      
      const text = createSvgElement('text', { 
        x: 200, 
        y: seg.image ? 42 : 48,
        'text-anchor': 'middle', 
        fill: 'var(--cream)', 
        'font-size': 15, 
        class: 'rh-body' 
      });
      text.style.fontWeight = '700';
      text.style.paintOrder = 'stroke';
      text.style.stroke = 'rgba(0,0,0,0.35)';
      text.style.strokeWidth = '3';
      text.textContent = seg.name.length > 15 ? seg.name.slice(0, 14) + '…' : seg.name;
      g.appendChild(text);

      if (seg.image) {
        const imgSize = 34;
        const imgEl = createSvgElement('image', {
          x: 200 - (imgSize / 2),
          y: 52,
          width: imgSize,
          height: imgSize,
          preserveAspectRatio: 'xMidYMid slice',
          class: 'svg-image-clip'
        });
        imgEl.setAttribute('href', seg.image);
        g.appendChild(imgEl);
      }

      svg.appendChild(g);
    });
  }

  svg.appendChild(createSvgElement('circle', { cx: 200, cy: 200, r: 34, fill: 'var(--gold)', stroke: 'var(--cream)', 'stroke-width': 3 }));
  svg.appendChild(createSvgElement('circle', { cx: 200, cy: 200, r: 16, fill: 'var(--ink)' }));
}

function renderEntries() {
  const list = document.getElementById('entriesList');
  list.innerHTML = '';
  
  if (entries.length === 0) {
    const p = document.createElement('p');
    p.className = 'text-sm text-center py-6';
    p.style.color = 'rgba(245,239,227,0.5)';
    p.textContent = 'Belum ada item. Tambahkan di bawah.';
    list.appendChild(p);
  } else {
    const active = activeEntries();
    entries.forEach((e) => {
      const row = document.createElement('div');
      row.className = 'entry-row fade-item rounded-lg px-3 py-2 flex items-center gap-2';
      row.style.opacity = e.qty === 0 ? '0.5' : '1';

      if (e.image) {
        const imgThumb = document.createElement('img');
        imgThumb.src = e.image;
        imgThumb.className = 'w-6 h-6 rounded object-cover flex-shrink-0 border border-white/20';
        row.appendChild(imgThumb);
      } else {
        const dot = document.createElement('span');
        dot.className = 'inline-block rounded-full flex-shrink-0';
        dot.style.width = '10px'; dot.style.height = '10px';
        dot.style.background = e.qty > 0 ? PALETTE[active.findIndex(a => a.id === e.id) % PALETTE.length] : 'rgba(245,239,227,0.3)';
        row.appendChild(dot);
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'flex-1 text-sm truncate';
      nameSpan.style.color = 'var(--cream)';
      nameSpan.textContent = e.name;
      row.appendChild(nameSpan);

      if (e.qty === 0) {
        const badge = document.createElement('span');
        badge.className = 'rh-mono text-[10px] px-2 py-0.5 rounded font-bold tracking-wider';
        badge.style.background = 'rgba(214,69,69,0.25)';
        badge.style.color = 'var(--red)';
        badge.textContent = 'HABIS';
        row.appendChild(badge);
      } else {
        const qtySpan = document.createElement('span');
        qtySpan.className = 'rh-mono text-sm w-6 text-center font-bold';
        qtySpan.style.color = 'var(--gold)';
        qtySpan.textContent = e.qty;
        row.appendChild(qtySpan);
      }

      const minusBtn = document.createElement('button');
      minusBtn.className = 'icon-btn hover:bg-white/10';
      minusBtn.style.background = 'rgba(245,239,227,0.08)';
      minusBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      minusBtn.onclick = () => { adjustQty(e.id, -1); };
      row.appendChild(minusBtn);

      const plusBtn = document.createElement('button');
      plusBtn.className = 'icon-btn hover:bg-white/10';
      plusBtn.style.background = 'rgba(245,239,227,0.08)';
      plusBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--cream)" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`;
      plusBtn.onclick = () => { adjustQty(e.id, 1); };
      row.appendChild(plusBtn);

      const delBtn = document.createElement('button');
      delBtn.className = 'icon-btn hover:bg-red-500/20';
      delBtn.style.background = 'rgba(214,69,69,0.15)';
      delBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
      delBtn.onclick = () => { removeEntry(e.id); };
      row.appendChild(delBtn);

      list.appendChild(row);
    });
  }

  document.getElementById('restoreBtn').style.display = entries.some(e => e.qty === 0) ? 'flex' : 'none';
}

function renderUI() {
  const total = totalQty();
  const active = activeEntries().length;
  document.getElementById('statsText').textContent = `${total} stok tersisa dari ${active} jenis item`;
  
  const spinBtn = document.getElementById('spinBtn');
  const disabled = spinning || active === 0;
  spinBtn.disabled = disabled;
  spinBtn.textContent = spinning ? 'MEMUTAR…' : 'PUTAR!';
  spinBtn.style.background = disabled ? 'rgba(232,185,74,0.35)' : 'var(--gold)';
  spinBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
  spinBtn.style.boxShadow = disabled ? 'none' : '0 6px 0 rgba(0,0,0,0.35)';
  spinBtn.style.transform = spinning ? 'scale(0.98)' : 'scale(1)';
}

function renderAll() {
  renderHeaderBulbs();
  renderWheel();
  renderEntries();
  renderUI();
}

document.getElementById('uploadImgBtn').addEventListener('click', () => {
  document.getElementById('imageInput').click();
});

document.getElementById('imageInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    compressImage(file, (base64) => {
      currentImageBase64 = base64;
      const btn = document.getElementById('uploadImgBtn');
      btn.style.backgroundImage = `url(${base64})`;
      document.getElementById('uploadIcon').style.display = 'none';
    });
  }
});

function resetImageUploader() {
  currentImageBase64 = null;
  const btn = document.getElementById('uploadImgBtn');
  btn.style.backgroundImage = 'none';
  document.getElementById('uploadIcon').style.display = 'block';
  document.getElementById('imageInput').value = '';
}

function addEntry() {
  const nameInp = document.getElementById('nameInput');
  const qtyInp = document.getElementById('qtyInput');
  const name = nameInp.value.trim();
  const qty = Math.max(1, parseInt(qtyInp.value, 10) || 1);
  
  if (!name) return;
  entries.push({ id: nextId(), name, qty, image: currentImageBase64 });
  
  nameInp.value = ''; qtyInp.value = '1';
  resetImageUploader();
  
  saveEntries(); renderAll();
}

function removeEntry(id) {
  entries = entries.filter(e => e.id !== id);
  saveEntries(); renderAll();
}

function adjustQty(id, delta) {
  entries = entries.map(e => e.id === id ? { ...e, qty: Math.max(0, e.qty + delta) } : e);
  saveEntries(); renderAll();
}

function runBulkImport() {
  const text = document.getElementById('bulkText').value;
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return;
  
  const parsed = lines.map(line => {
    const parts = line.split(',');
    const name = parts[0].trim();
    const qty = parts[1] ? Math.max(0, parseInt(parts[1].trim(), 10) || 0) : 1;
    return { id: nextId(), name, qty, image: null };
  }).filter(e => e.name);
  
  if (parsed.length === 0) return;
  entries = [...entries, ...parsed];
  
  document.getElementById('bulkText').value = '';
  document.getElementById('bulkContainer').classList.replace('flex', 'hidden');
  document.getElementById('showBulkBtn').classList.replace('hidden', 'flex');
  
  saveEntries(); renderAll();
}

function pickWeightedWinner() {
  const active = activeEntries();
  const total = totalQty();
  let r = Math.random() * total;
  for (const e of active) {
    if (r < e.qty) return e;
    r -= e.qty;
  }
  return active[active.length - 1];
}

function spin() {
  const active = activeEntries();
  const total = totalQty();
  if (spinning || active.length === 0 || total <= 0) return;
  
  const winnerEntry = pickWeightedWinner();
  const segments = computeSegments();
  const seg = segments.find(s => s.id === winnerEntry.id);
  if (!seg) return;
  
  const span = seg.end - seg.start;
  const jitter = span * (0.15 + Math.random() * 0.7);
  const targetPoint = seg.start + jitter;
  const spins = 6 + Math.floor(Math.random() * 3);
  const currentMod = ((rotation % 360) + 360) % 360;
  const delta = (((360 - targetPoint) - currentMod) % 360 + 360) % 360;
  
  rotation = rotation + spins * 360 + delta;
  winner = null; spinning = true;
  renderAll();
  
  window.setTimeout(() => {
    spinning = false; winner = winnerEntry;
    renderAll(); showWinnerModal();
  }, 4300);
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(err => {});
  } else {
    if (document.exitFullscreen) document.exitFullscreen();
  }
}

document.addEventListener('fullscreenchange', () => {
  const fsIcon = document.getElementById('fsIcon');
  if (document.fullscreenElement) {
    document.body.classList.add('is-fullscreen');
    fsIcon.innerHTML = `<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>`;
  } else {
    document.body.classList.remove('is-fullscreen');
    fsIcon.innerHTML = `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>`;
  }
});

function showWinnerModal() {
  const modal = document.getElementById('winnerModal');
  const reduceBtn = document.getElementById('reduceBtn');
  const imgContainer = document.getElementById('modalImageContainer');
  
  const currentEntry = entries.find(e => e.id === winner.id);
  const currentQty = currentEntry ? currentEntry.qty : 0;
  
  if (currentEntry && currentEntry.image) {
    imgContainer.innerHTML = `<img src="${currentEntry.image}" class="w-28 h-28 object-cover rounded-xl shadow-lg border-[3px] border-yellow-500/50 animation-popIn" />`;
  } else {
    imgContainer.innerHTML = `<span class="text-6xl drop-shadow-lg animation-popIn">🎟️</span>`;
  }

  document.getElementById('winName').textContent = winner.name;
  document.getElementById('winSub').textContent = currentQty > 0 ? `Stok item tersisa: ${currentQty}` : 'Stok item ini sudah habis diambil';
  
  if (currentQty === 0) {
    reduceBtn.disabled = true;
    reduceBtn.style.background = 'rgba(214,69,69,0.3)';
    reduceBtn.style.transform = 'none';
    reduceBtn.style.cursor = 'not-allowed';
  } else {
    reduceBtn.disabled = false;
    reduceBtn.style.background = 'var(--red)';
    reduceBtn.style.cursor = 'pointer';
  }
  
  modal.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('winnerModal').classList.add('hidden');
  winner = null;
}

document.getElementById('spinBtn').addEventListener('click', spin);
document.getElementById('addBtn').addEventListener('click', addEntry);
document.getElementById('nameInput').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') addEntry(); });
document.getElementById('qtyInput').addEventListener('input', (ev) => { ev.target.value = ev.target.value.replace(/[^0-9]/g, ''); });
document.getElementById('fsToggleBtn').addEventListener('click', toggleFullScreen);

document.getElementById('showBulkBtn').addEventListener('click', () => {
  document.getElementById('showBulkBtn').classList.replace('flex', 'hidden');
  document.getElementById('bulkContainer').classList.replace('hidden', 'flex');
});
document.getElementById('cancelBulkBtn').addEventListener('click', () => {
  document.getElementById('bulkContainer').classList.replace('flex', 'hidden');
  document.getElementById('showBulkBtn').classList.replace('hidden', 'flex');
  document.getElementById('bulkText').value = '';
});
document.getElementById('importBtn').addEventListener('click', runBulkImport);

document.getElementById('restoreBtn').addEventListener('click', () => {
  entries = entries.map(e => e.qty === 0 ? { ...e, qty: 1 } : e);
  saveEntries(); renderAll();
});

document.getElementById('reduceBtn').addEventListener('click', () => {
  if (winner) adjustQty(winner.id, -1);
  closeModal();
});
document.getElementById('continueBtn').addEventListener('click', closeModal);
document.getElementById('closeModalBtn').addEventListener('click', closeModal);

loadEntries();