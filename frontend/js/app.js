/* ════════════════════════════════════════════
   app.js  –  Global state + router + utilities
════════════════════════════════════════════ */

/* ── STATE ── */
const App = {
  teacher: null,    // { teacher_id, username, name }
  student: null,    // { student_id, name }
  cameraStream: null,
  attendancePhotos: [],   // [{ url, file }]
  attendanceResults: [],  // [{ name, present, src }]
  pendingSubjectId: null, // subject selected for attendance
};

/* ── ROUTER ── */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById(id);
  if (page) page.classList.add('active');
  window.scrollTo(0, 0);
}

/* ── TOAST ── */
function toast(msg, duration = 3200) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

/* ── LOADER ── */
function showLoader(msg = 'Loading…') {
  const ol = document.getElementById('loader-overlay');
  ol.querySelector('.loader-text').textContent = msg;
  ol.classList.add('show');
}
function hideLoader() {
  document.getElementById('loader-overlay').classList.remove('show');
}

/* ── MODAL ── */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// Close on backdrop click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-backdrop')) {
    e.target.classList.remove('open');
  }
});

/* ── ALERT ELEMENT ── */
function setAlert(elId, msg, type = 'error') {
  const el = document.getElementById(elId);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = msg;
  el.style.display = msg ? 'flex' : 'none';
}

/* ── QR CANVAS ── */
function drawQR(canvasId, text) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const S = 160;
  canvas.width = canvas.height = S;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#5865F2';
  const cell = S / 21;

  // Deterministic pseudo-random from text
  let seed = 0;
  for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) % 9973;
  function rng() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }

  // Corner position squares
  [[0,0],[14,0],[0,14]].forEach(([cr, cc]) => {
    for (let r = cr; r < cr+7; r++) for (let c = cc; c < cc+7; c++) {
      const edge = r === cr || r === cr+6 || c === cc || c === cc+6;
      const inner = r >= cr+2 && r <= cr+4 && c >= cc+2 && c <= cc+4;
      if (edge || inner) ctx.fillRect(c*cell, r*cell, cell, cell);
    }
  });

  // Data modules
  for (let r = 0; r < 21; r++) {
    for (let c = 0; c < 21; c++) {
      const inCorner = (r < 8 && c < 8) || (r < 8 && c > 12) || (r > 12 && c < 8);
      if (!inCorner && rng() > 0.48) ctx.fillRect(c*cell, r*cell, cell, cell);
    }
  }
}

/* ── COPY TO CLIPBOARD ── */
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('📋 Copied!'); }
  catch { toast('Copy failed — please copy manually'); }
}

/* ── CAMERA ── */
async function startCamera(videoId) {
  try {
    App.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    document.getElementById(videoId).srcObject = App.cameraStream;
  } catch {
    const box = document.getElementById(videoId)?.parentElement;
    if (box) box.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:200px;background:#111;border-radius:var(--radius);color:#fff;flex-direction:column;gap:.75rem;font-size:.9rem"><span style="font-size:2.5rem">📷</span>Camera not available — use Upload Photo</div>`;
  }
}
function stopCamera() {
  if (App.cameraStream) {
    App.cameraStream.getTracks().forEach(t => t.stop());
    App.cameraStream = null;
  }
}
function captureFrame(videoId) {
  const video = document.getElementById(videoId);
  if (!video || !video.srcObject) return null;
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);
  return canvas.toDataURL('image/jpeg', .9);
}

/* ── DEBOUNCE ── */
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
