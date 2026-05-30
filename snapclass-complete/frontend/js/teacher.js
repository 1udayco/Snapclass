/* ════════════════════════════════════════════
   teacher.js  –  Teacher portal logic
════════════════════════════════════════════ */

/* ── AUTH ── */
async function teacherLogin() {
  const username = document.getElementById('t-username').value.trim();
  const password = document.getElementById('t-password').value;
  setAlert('t-login-err', '');
  if (!username || !password) { setAlert('t-login-err', 'All fields are required'); return; }

  const btn = document.getElementById('t-login-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span> Logging in…';

  try {
    const { teacher } = await TeacherAPI.login(username, password);
    App.teacher = teacher;
    toast(`👋 Welcome back, ${teacher.name}!`);
    loadTeacherDashboard();
  } catch (e) {
    setAlert('t-login-err', e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔑 Login';
  }
}

async function teacherRegister() {
  const username = document.getElementById('t-reg-username').value.trim();
  const name     = document.getElementById('t-reg-name').value.trim();
  const pass     = document.getElementById('t-reg-pass').value;
  const confirm  = document.getElementById('t-reg-confirm').value;
  setAlert('t-reg-err', '');

  if (!username || !name || !pass) { setAlert('t-reg-err', 'All fields are required'); return; }
  if (pass !== confirm)  { setAlert('t-reg-err', "Passwords don't match"); return; }
  if (pass.length < 4)   { setAlert('t-reg-err', 'Password must be at least 4 characters'); return; }

  const btn = document.getElementById('t-reg-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span> Creating…';

  try {
    const { teacher } = await TeacherAPI.register(username, name, pass);
    App.teacher = teacher;
    toast('🎉 Account created!');
    loadTeacherDashboard();
  } catch (e) {
    setAlert('t-reg-err', e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✅ Create Account';
  }
}

function teacherLogout() {
  App.teacher = null;
  App.attendancePhotos = [];
  App.attendanceResults = [];
  showPage('page-teacher-login');
  document.getElementById('teacher-tab-attend').classList.add('active');
  document.getElementById('teacher-tab-subjects').classList.remove('active');
  document.getElementById('teacher-tab-records').classList.remove('active');
  switchTeacherTab('attend');
  toast('👋 Logged out');
}

function showTeacherRegister() {
  document.getElementById('teacher-login-card').style.display = 'none';
  document.getElementById('teacher-register-card').style.display = 'block';
}
function showTeacherLoginCard() {
  document.getElementById('teacher-register-card').style.display = 'none';
  document.getElementById('teacher-login-card').style.display = 'block';
}

/* ── DASHBOARD BOOTSTRAP ── */
async function loadTeacherDashboard() {
  showPage('page-teacher-dashboard');
  document.getElementById('t-nav-welcome').textContent = App.teacher.name;
  switchTeacherTab('attend');
  await Promise.all([renderTeacherSubjects(), renderTeacherRecords()]);
  populateSubjectSelect();
}

/* ── TABS ── */
function switchTeacherTab(name) {
  ['attend', 'subjects', 'records'].forEach(t => {
    document.getElementById(`t-tab-${t}`)?.classList.remove('active');
    document.getElementById(`t-tabp-${t}`)?.classList.remove('active');
  });
  document.getElementById(`t-tab-${name}`)?.classList.add('active');
  document.getElementById(`t-tabp-${name}`)?.classList.add('active');
}

/* ── SUBJECTS LIST ── */
async function renderTeacherSubjects() {
  const el = document.getElementById('t-subjects-list');
  el.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading subjects…</p></div>';
  try {
    const { subjects } = await TeacherAPI.getSubjects(App.teacher.teacher_id);
    App._subjects = subjects;
    if (!subjects.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📚</div><p>No subjects yet. Create one above!</p></div>';
      return;
    }
    el.innerHTML = subjects.map(s => `
      <div class="subject-card" id="subcard-${s.subject_id}">
        <h3>${s.name}</h3>
        <div class="subject-meta">
          Code: <span class="code-badge">${s.subject_code}</span>
          &nbsp;|&nbsp; Section: ${s.section}
        </div>
        <div class="stat-pills">
          <span class="stat-pill">🫂 <strong>${s.total_students}</strong> Students</span>
          <span class="stat-pill">🕰️ <strong>${s.total_classes}</strong> Classes</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-outline btn-sm"
            onclick="openShareModal('${s.name}','${s.subject_code}')">
            🔗 Share Code
          </button>
          <button class="btn btn-danger btn-sm"
            onclick="deleteSubject('${s.subject_id}')">
            🗑️ Delete
          </button>
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

function populateSubjectSelect() {
  const sel = document.getElementById('attend-subject-select');
  const subjects = App._subjects || [];
  sel.innerHTML = '<option value="">-- Select a subject --</option>' +
    subjects.map(s => `<option value="${s.subject_id}">${s.name} — ${s.subject_code}</option>`).join('');
}

/* Create subject */
function openCreateSubjectModal() {
  ['cs-code','cs-name','cs-section'].forEach(id => document.getElementById(id).value = '');
  setAlert('cs-err', '');
  openModal('modal-create-subject');
}

async function createSubject() {
  const code    = document.getElementById('cs-code').value.trim().toUpperCase();
  const name    = document.getElementById('cs-name').value.trim();
  const section = document.getElementById('cs-section').value.trim().toUpperCase();
  setAlert('cs-err', '');
  if (!code || !name || !section) { setAlert('cs-err', 'All fields are required'); return; }

  const btn = document.getElementById('cs-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-inline"></span>';

  try {
    await SubjectAPI.create(code, name, section, App.teacher.teacher_id);
    closeModal('modal-create-subject');
    toast('✅ Subject created!');
    await renderTeacherSubjects();
    populateSubjectSelect();
  } catch (e) {
    setAlert('cs-err', e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Subject';
  }
}

async function deleteSubject(id) {
  if (!confirm('Delete this subject? This cannot be undone.')) return;
  try {
    await SubjectAPI.delete(id);
    document.getElementById(`subcard-${id}`)?.remove();
    toast('Subject deleted');
    populateSubjectSelect();
  } catch (e) {
    toast('❌ ' + e.message);
  }
}

/* ── SHARE / QR ── */
function openShareModal(name, code) {
  App._shareCode = code;
  const link = `${window.location.origin}/?join-code=${code}`;
  document.getElementById('share-link-text').textContent = link;
  document.getElementById('share-code-text').textContent = code;
  drawQR('share-qr-canvas', link);
  openModal('modal-share');
}
function copyShareLink() { copyText(document.getElementById('share-link-text').textContent); }
function copyShareCode() { copyText(App._shareCode); }

/* ── ATTENDANCE PHOTOS ── */
function handlePhotoUpload(e) {
  Array.from(e.target.files).forEach(file => {
    App.attendancePhotos.push({ url: URL.createObjectURL(file), file });
  });
  renderPhotoGallery();
  e.target.value = '';
}
function renderPhotoGallery() {
  const gallery  = document.getElementById('photo-gallery');
  const noPhotos = document.getElementById('t-no-photos');
  if (!App.attendancePhotos.length) {
    gallery.innerHTML = '';
    noPhotos.style.display = 'flex';
    return;
  }
  noPhotos.style.display = 'none';
  gallery.innerHTML = App.attendancePhotos.map((p, i) => `
    <div class="photo-thumb">
      <img src="${p.url}" alt="Photo ${i+1}"/>
      <button class="remove-btn" onclick="removePhoto(${i})">✕</button>
    </div>`).join('');
}
function removePhoto(i) { App.attendancePhotos.splice(i, 1); renderPhotoGallery(); }
function clearPhotos()  { App.attendancePhotos = []; renderPhotoGallery(); toast('Photos cleared'); }

/* ── FACE ANALYSIS (real AI) ── */
async function runFaceAnalysis() {
  const subjectId = document.getElementById('attend-subject-select').value;
  if (!App.attendancePhotos.length) { toast('⚠️ Add photos first!'); return; }
  if (!subjectId) { toast('⚠️ Select a subject first!'); return; }

  showLoader('Deep scanning classroom photos…');
  try {
    // Fetch enrolled students for display names
    const { students } = await SubjectAPI.students(subjectId);
    const studentMap = {};
    students.forEach(s => { studentMap[String(s.student_id)] = s.name; });

    // Aggregate detections across all uploaded photos
    const aggregatedDetected = {};

    for (let i = 0; i < App.attendancePhotos.length; i++) {
      const photo = App.attendancePhotos[i];
      // Convert File → data-URL
      const dataURL = await fileToDataURL(photo.file);
      try {
        const result = await AttendanceAPI.analyseFace(dataURL, subjectId);
        const { detected } = result;
        Object.keys(detected || {}).forEach(sid => {
          aggregatedDetected[sid] = `Photo ${i + 1}`;
        });
      } catch (aiErr) {
        // If AI server is down, show a clear warning but continue
        console.warn(`Photo ${i+1} analysis failed:`, aiErr.message);
      }
    }

    // Build results array against all enrolled students
    const results = students.map(s => {
      const sid = String(s.student_id);
      const present = sid in aggregatedDetected;
      return {
        student_id: s.student_id,
        name: s.name,
        present,
        src: present ? aggregatedDetected[sid] : '—',
      };
    });

    if (!results.length) {
      toast('⚠️ No students enrolled in this subject yet.');
      return;
    }

    App.attendanceResults = results;
    App.pendingSubjectId  = subjectId;
    showResultsModal(results);
  } catch (e) {
    toast('❌ ' + e.message);
  } finally {
    hideLoader();
  }
}

/* Convert a File object to a base64 data-URL */
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showResultsModal(results) {
  const pCount = results.filter(r => r.present).length;
  document.getElementById('res-present-count').textContent = pCount;
  document.getElementById('res-absent-count').textContent  = results.length - pCount;
  document.getElementById('res-total-count').textContent   = results.length;
  document.getElementById('res-table-body').innerHTML = results.map(r => `
    <tr>
      <td>${r.name}</td>
      <td style="color:var(--gray)">${r.src}</td>
      <td>${r.present
        ? '<span class="badge-present">✅ Present</span>'
        : '<span class="badge-absent">❌ Absent</span>'}</td>
    </tr>`).join('');
  openModal('modal-results');
}

async function saveAttendance() {
  const logs = App.attendanceResults.map(r => ({
    student_id:  r.student_id,
    subject_id:  App.pendingSubjectId,
    timestamp:   new Date().toISOString(),
    is_present:  r.present,
  }));
  try {
    await AttendanceAPI.save(logs);
    toast('💾 Attendance saved!');
    closeModal('modal-results');
    await renderTeacherRecords();
  } catch (e) {
    toast('❌ ' + e.message);
  }
}

/* ── RECORDS ── */
async function renderTeacherRecords() {
  const el = document.getElementById('t-records-content');
  el.innerHTML = '<div class="empty-state"><div class="empty-icon">⏳</div><p>Loading…</p></div>';
  try {
    const { records } = await TeacherAPI.getRecords(App.teacher.teacher_id);
    if (!records.length) {
      el.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No records yet.</p></div>';
      return;
    }
    const grouped = {};
    records.forEach(r => {
      const key = `${r.timestamp}__${r.subject_id}`;
      if (!grouped[key]) grouped[key] = { time: r.timestamp, subject: r.subjects?.name, code: r.subjects?.subject_code, present: 0, total: 0 };
      grouped[key].total++;
      if (r.is_present) grouped[key].present++;
    });
    const rows = Object.values(grouped).sort((a,b) => new Date(b.time)-new Date(a.time));
    el.innerHTML = `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>Time</th><th>Subject</th><th>Code</th><th>Attendance</th></tr></thead>
      <tbody>${rows.map(r => `<tr>
        <td>${new Date(r.time).toLocaleString()}</td>
        <td>${r.subject}</td>
        <td><span class="code-badge">${r.code}</span></td>
        <td><span class="badge-present">${r.present}</span> / ${r.total} students</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
  } catch (e) {
    el.innerHTML = `<div class="alert alert-error">${e.message}</div>`;
  }
}

/* ── VOICE ATTENDANCE (real AI) ── */
let _mediaRecorder  = null;
let _voiceChunks    = [];
let _voiceRecording = false;

async function toggleVoiceRecord() {
  _voiceRecording = !_voiceRecording;
  const btn  = document.getElementById('voice-record-btn');
  const wave = document.getElementById('voice-wave');
  const stat = document.getElementById('voice-status');

  if (_voiceRecording) {
    // Start real microphone recording
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      _voiceChunks   = [];
      _mediaRecorder = new MediaRecorder(stream);
      _mediaRecorder.ondataavailable = e => { if (e.data.size > 0) _voiceChunks.push(e.data); };
      _mediaRecorder.start(200);
    } catch {
      toast('🎙️ Microphone access denied');
      _voiceRecording = false;
      return;
    }
    btn.className   = 'btn btn-danger btn-stretch';
    btn.textContent = '⏹️ Stop Recording';
    wave.style.display = 'flex';
    stat.innerHTML  = '<div class="alert alert-warn">🔴 Recording… Students, say your name clearly.</div>';
  } else {
    // Stop recording
    if (_mediaRecorder && _mediaRecorder.state !== 'inactive') {
      _mediaRecorder.stop();
      _mediaRecorder.stream.getTracks().forEach(t => t.stop());
    }
    btn.className   = 'btn btn-primary btn-stretch';
    btn.textContent = '🎙️ Start Recording';
    wave.style.display = 'none';
    stat.innerHTML  = '<div class="alert alert-success">✅ Done. Click Process to analyse.</div>';
  }
}

async function processVoiceAttendance() {
  const subjectId = document.getElementById('attend-subject-select').value;
  if (!subjectId) { toast('⚠️ Select a subject first!'); return; }
  if (!_voiceChunks.length) { toast('⚠️ Record audio first!'); return; }

  _voiceRecording = false;
  closeModal('modal-voice');
  showLoader('Analysing voice recordings…');

  try {
    // Convert recorded chunks to base64
    const blob    = new Blob(_voiceChunks, { type: 'audio/webm' });
    const audioB64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const { students } = await SubjectAPI.students(subjectId);
    const result = await AttendanceAPI.analyseVoice(audioB64, subjectId);
    const detected = result.detected || {};

    const voiceResults = students.map(s => ({
      student_id: s.student_id,
      name: s.name,
      present: String(s.student_id) in detected,
      src: 'Voice',
    }));

    App.attendanceResults = voiceResults;
    App.pendingSubjectId  = subjectId;
    showResultsModal(voiceResults);
    toast('🎙️ Voice attendance processed!');
  } catch (e) {
    toast('❌ ' + e.message);
  } finally {
    hideLoader();
    _voiceChunks = [];
  }
}
