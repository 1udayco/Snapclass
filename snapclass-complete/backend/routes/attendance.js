const express  = require('express');
const supabase = require('../supabase');
const { aiPost } = require('../middleware/aiProxy');
const router   = express.Router();

// POST /api/attendance  – save attendance logs array
// Body: { logs: [{ student_id, subject_id, timestamp, is_present }] }
router.post('/', async (req, res) => {
  const { logs } = req.body;
  if (!logs || !Array.isArray(logs) || logs.length === 0)
    return res.status(400).json({ error: 'logs array is required' });

  const { data, error } = await supabase
    .from('attendance_logs').insert(logs).select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ saved: data.length });
});


// POST /api/attendance/analyse-face
// Body: { image: <dataURL or base64>, subject_id: <uuid> }
// Returns: { detected: {student_id: true}, all_students: [], faces_found: N }
router.post('/analyse-face', async (req, res) => {
  const { image, subject_id } = req.body;
  if (!image || !subject_id)
    return res.status(400).json({ error: 'image and subject_id are required' });

  try {
    // Fetch enrolled students (with embeddings) for the subject
    const { data: enrollments, error: enErr } = await supabase
      .from('subject_students')
      .select('students(student_id, face_embedding)')
      .eq('subject_id', subject_id);

    if (enErr) return res.status(500).json({ error: enErr.message });

    const students = (enrollments || [])
      .map(e => e.students)
      .filter(s => s && s.face_embedding);

    // Call Python AI server
    const result = await aiPost('/ai/face/attendance', { image, students });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: `AI server unreachable: ${e.message}` });
  }
});


// POST /api/attendance/analyse-voice
// Body: { audio: <dataURL or base64>, subject_id: <uuid>, threshold?: number }
// Returns: { detected: {student_id: score} }
router.post('/analyse-voice', async (req, res) => {
  const { audio, subject_id, threshold } = req.body;
  if (!audio || !subject_id)
    return res.status(400).json({ error: 'audio and subject_id are required' });

  try {
    const { data: enrollments, error: enErr } = await supabase
      .from('subject_students')
      .select('students(student_id, voice_embedding)')
      .eq('subject_id', subject_id);

    if (enErr) return res.status(500).json({ error: enErr.message });

    const students = (enrollments || [])
      .map(e => e.students)
      .filter(s => s && s.voice_embedding);

    const result = await aiPost('/ai/voice/attendance', {
      audio,
      students,
      threshold: threshold || 0.65,
    });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: `AI server unreachable: ${e.message}` });
  }
});


// POST /api/attendance/identify-face
// Body: { image: <dataURL or base64> }
// Returns: { student_id, confidence } – used for student login
router.post('/identify-face', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'image is required' });

  try {
    // Fetch all students with face embeddings
    const { data: students, error } = await supabase
      .from('students')
      .select('student_id, name, face_embedding')
      .not('face_embedding', 'is', null);

    if (error) return res.status(500).json({ error: error.message });

    const result = await aiPost('/ai/face/identify', { image, students });
    if (result.student_id) {
      // Return full student record
      const found = students.find(s => String(s.student_id) === String(result.student_id));
      return res.json({ student: found || null, confidence: result.confidence });
    }
    res.json({ student: null, confidence: 0 });
  } catch (e) {
    res.status(502).json({ error: `AI server unreachable: ${e.message}` });
  }
});


// POST /api/attendance/embed-face
// Body: { image: <dataURL or base64> }
// Returns: { embeddings: [[128 floats], ...] }
router.post('/embed-face', async (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'image is required' });
  try {
    const result = await aiPost('/ai/face/embed', { image });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: `AI server unreachable: ${e.message}` });
  }
});


// POST /api/attendance/embed-voice
// Body: { audio: <dataURL or base64> }
// Returns: { embedding: [256 floats] }
router.post('/embed-voice', async (req, res) => {
  const { audio } = req.body;
  if (!audio) return res.status(400).json({ error: 'audio is required' });
  try {
    const result = await aiPost('/ai/voice/embed', { audio });
    res.json(result);
  } catch (e) {
    res.status(502).json({ error: `AI server unreachable: ${e.message}` });
  }
});

module.exports = router;
