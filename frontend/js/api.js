/* ════════════════════════════════════════════
   api.js  –  All backend calls in one place
   Base URL auto-detects: localhost or deployed
════════════════════════════════════════════ */
const API_BASE = window.location.origin;

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Request failed');
  return json;
}

/* ── TEACHERS ── */
const TeacherAPI = {
  login:      (username, password)         => apiFetch('/api/teachers/login',    { method: 'POST', body: { username, password } }),
  register:   (username, name, password)   => apiFetch('/api/teachers/register', { method: 'POST', body: { username, name, password } }),
  getSubjects:(id)                         => apiFetch(`/api/teachers/${id}/subjects`),
  getRecords: (id)                         => apiFetch(`/api/teachers/${id}/records`),
};

/* ── SUBJECTS ── */
const SubjectAPI = {
  create:   (subject_code, name, section, teacher_id) =>
              apiFetch('/api/subjects', { method: 'POST', body: { subject_code, name, section, teacher_id } }),
  delete:   (id)                => apiFetch(`/api/subjects/${id}`, { method: 'DELETE' }),
  byCode:   (code)              => apiFetch(`/api/subjects/code/${code}`),
  enroll:   (id, student_id)   => apiFetch(`/api/subjects/${id}/enroll`,               { method: 'POST',   body: { student_id } }),
  unenroll: (id, student_id)   => apiFetch(`/api/subjects/${id}/enroll/${student_id}`, { method: 'DELETE' }),
  students: (id)               => apiFetch(`/api/subjects/${id}/students`),
};

/* ── STUDENTS ── */
const StudentAPI = {
  create:        (name, face_embedding, voice_embedding) =>
                   apiFetch('/api/students', { method: 'POST', body: { name, face_embedding, voice_embedding } }),
  createWithMedia:(name, image, audio) =>
                   apiFetch('/api/students', { method: 'POST', body: { name, image, audio } }),
  getAll:        ()   => apiFetch('/api/students'),
  getSubjects:   (id) => apiFetch(`/api/students/${id}/subjects`),
  getAttendance: (id) => apiFetch(`/api/students/${id}/attendance`),
  updateEmbeddings: (id, face_embedding, voice_embedding) =>
                   apiFetch(`/api/students/${id}/embeddings`, { method: 'PATCH', body: { face_embedding, voice_embedding } }),
};

/* ── ATTENDANCE ── */
const AttendanceAPI = {
  save:           (logs)                   => apiFetch('/api/attendance',               { method: 'POST', body: { logs } }),
  analyseFace:    (image, subject_id)      => apiFetch('/api/attendance/analyse-face',  { method: 'POST', body: { image, subject_id } }),
  analyseVoice:   (audio, subject_id, threshold) =>
                   apiFetch('/api/attendance/analyse-voice', { method: 'POST', body: { audio, subject_id, threshold } }),
  identifyFace:   (image)                  => apiFetch('/api/attendance/identify-face', { method: 'POST', body: { image } }),
  embedFace:      (image)                  => apiFetch('/api/attendance/embed-face',    { method: 'POST', body: { image } }),
  embedVoice:     (audio)                  => apiFetch('/api/attendance/embed-voice',   { method: 'POST', body: { audio } }),
};
