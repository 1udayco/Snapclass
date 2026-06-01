/* ════════════════════════════════════════════
   student.js  –  Student portal logic
════════════════════════════════════════════ */

/* ── INIT ── */
function initStudentPage() {
  showPage('page-student-login');
  document.getElementById('s-register-panel').style.display = 'none';
  document.getElementById('s-scan-result').innerHTML = '';
  startCamera('student-video');

  // Auto-fill join code from URL ?join-code=XXX
  const code = new URLSearchParams(window.location.search).get('join-code');
  if (code) {
    document.getElementById('enroll-code').value = code;
  }
}

function studentLogout() {
  App.student = null;
  stopCamera();
  initStudentPage();
  toast('👋 Logged out');
}

/* ── FACE SCAN ── */
async function captureAndLogin() {
  const dataURL = captureFrame('student-video');
  if (!dataURL) { toast('📷 Camera not ready — try Upload Photo'); return; }
  runFaceScan(dataURL);
}

function handleStudentFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => runFaceScan(ev.target.result);
  reader.readAsDataURL(file);
  e.target.value = '';
}

async function runFaceScan(imageDataURL) {
  const resultEl = document.getElementById('s-scan-result');
  resultEl.innerHTML = '<div class="alert alert-info">🔍 AI is scanning your face…</div>';

  showLoader('Scanning face…');
  try {
    const { student } = await AttendanceAPI.identifyFace(imageDataURL);

    if (student) {
      App.student = student;
      stopCamera();
      toast(`👋 Welcome back, ${student.name}!`);
      await loadStudentDashboard();
    } else {
      resultEl.innerHTML = '<div class="alert alert-warn">🤔 Face not recognized! Register as a new student below.</div>';
      // Store the image so we can use it for registration
      App._pendingRegImage = imageDataURL;
      document.getElementById('s-register-panel').style.display = 'block';
    }
  } catch (e) {
    // AI server might be unavailable — fall back to name-based login
    resultEl.innerHTML = `<div class="alert alert-warn">⚠️ AI server unavailable: ${e.message}<br>Please register below.</div>`;
    App._pendingRegImage = imageDataURL;
    document.getElementById('s-register-panel').style.display = 'block';
  } finally {
    hideLoader();
  }
}

/* ── REGISTER ── */
async function createStudentAccount() {
  const name = document.getElementById('s-reg-name').value.trim();
  if (!name) { toast('⚠️ Please enter your name!'); return; }

  const btn = document.getElementById('s-create-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span> Creating…';

  try {
    // Use captured image for face embedding if available
    const image = App._pendingRegImage || captureFrame('student-video') || null;
    const { student } = await StudentAPI.createWithMedia(name, image, null);
    App.student = student;
    App._pendingRegImage = null;
    stopCamera();
    toast(`🎉 Profile created! Hi ${name}! Your face has been registered.`);
    await loadStudentDashboard();
  } catch (e) {
    toast('❌ ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

/* ── DASHBOARD ── */
async function loadStudentDashboard() {
  showPage('page-student-dashboard');
  document.getElementById('s-nav-welcome').textContent = App.student.name;
  await renderStudentSubjects();
}

async function renderStudentSubjects() {
  const el = document.getElementById('s-subjects-list');
  el.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    const [{ subjects }, { logs }] = await Promise.all([
      StudentAPI.getSubjects(App.student.student_id),
      StudentAPI.getAttendance(App.student.student_id),
    ]);

    const statsMap = {};
    logs.forEach(log => {
      const sid = log.subject_id;
      if (!statsMap[sid]) statsMap[sid] = { total: 0, attended: 0 };
      statsMap[sid].total++;
      if (log.is_present) statsMap[sid].attended++;
    });

    if (!subjects.length) {
      el.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📚</div><p>Not enrolled in any subjects. Use a code to enroll!</p></div>';
      return;
    }

    el.innerHTML = subjects.map(node => {
      const sub  = node.subjects;
      const sid  = sub.subject_id;
      const stat = statsMap[sid] || { total: 0, attended: 0 };
      const pct  = stat.total ? Math.round(stat.attended / stat.total * 100) : 0;
      const color = pct >= 75 ? '#16a34a' : pct >= 50 ? '#d97706' : '#dc2626';
      return `
        <div class="subject-card">
          <h3>${sub.name}</h3>
          <div class="subject-meta">
            Code: <span class="code-badge">${sub.subject_code}</span>
            &nbsp;|&nbsp; Section: ${sub.section}
          </div>
          <div class="stat-pills">
            <span class="stat-pill">📅 <strong>${stat.total}</strong> Classes</span>
            <span class="stat-pill">✅ <strong>${stat.attended}</strong> Attended</span>
          </div>
          <div class="progress-wrap">
            <div class="progress-label">
              <span style="color:var(--gray)">Attendance</span>
              <span style="font-weight:700;color:${color}">${pct}%</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>
          <button class="btn btn-danger btn-sm btn-stretch"
            onclick="unenroll('${sid}','${sub.name}')">
            🗑️ Unenroll from this course
          </button>
        </div>`;
    }).join('');
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

async function unenroll(subjectId, name) {
  if (!confirm(`Unenroll from ${name}?`)) return;
  try {
    await SubjectAPI.unenroll(subjectId, App.student.student_id);
    toast(`✅ Unenrolled from ${name}`);
    await renderStudentSubjects();
  } catch (e) {
    toast('❌ ' + e.message);
  }
}

/* ── ENROLL MODAL ── */
function openEnrollModal() {
  document.getElementById('enroll-code').value = '';
  setAlert('enroll-msg', '');
  openModal('modal-enroll');
}

async function enrollStudent() {
  const code = document.getElementById('enroll-code').value.trim().toUpperCase();
  setAlert('enroll-msg', '');
  if (!code) { setAlert('enroll-msg', 'Please enter a subject code', 'warn'); return; }

  const btn = document.getElementById('enroll-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span>';

  try {
    const { subject } = await SubjectAPI.byCode(code);
    await SubjectAPI.enroll(subject.subject_id, App.student.student_id);
    toast(`✅ Enrolled in ${subject.name}!`);
    closeModal('modal-enroll');
    await renderStudentSubjects();
  } catch (e) {
    setAlert('enroll-msg', e.message === 'Already enrolled' ? 'You are already enrolled in this subject!' : e.message, 'warn');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Enroll Now →';
  }
}
