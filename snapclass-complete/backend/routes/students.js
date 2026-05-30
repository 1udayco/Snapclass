const express  = require('express');
const supabase = require('../supabase');
const { aiPost } = require('../middleware/aiProxy');
const router   = express.Router();

// POST /api/students  – register student (optionally with image for face embedding)
// Body: { name, image?, audio?, face_embedding?, voice_embedding? }
router.post('/', async (req, res) => {
  const { name, image, audio, face_embedding, voice_embedding } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  let faceEmb = face_embedding || null;
  let voiceEmb = voice_embedding || null;

  // If raw image provided, extract embedding via AI server
  if (image && !faceEmb) {
    try {
      const { embeddings } = await aiPost('/ai/face/embed', { image });
      if (embeddings && embeddings.length > 0) faceEmb = embeddings[0];
    } catch {
      // AI server optional – proceed without embedding
    }
  }

  // If raw audio provided, extract voice embedding
  if (audio && !voiceEmb) {
    try {
      const { embedding } = await aiPost('/ai/voice/embed', { audio });
      if (embedding) voiceEmb = embedding;
    } catch {
      // optional
    }
  }

  const { data, error } = await supabase
    .from('students')
    .insert({ name, face_embedding: faceEmb, voice_embedding: voiceEmb })
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ student: data[0] });
});

// GET /api/students  – all students (for face recognition matching)
router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('students').select('*');
  if (error) return res.status(500).json({ error: error.message });
  res.json({ students: data || [] });
});

// GET /api/students/:id/subjects
router.get('/:id/subjects', async (req, res) => {
  const { data, error } = await supabase
    .from('subject_students')
    .select('*, subjects(*)')
    .eq('student_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ subjects: data || [] });
});

// GET /api/students/:id/attendance
router.get('/:id/attendance', async (req, res) => {
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*, subjects(*)')
    .eq('student_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ logs: data || [] });
});

// PATCH /api/students/:id/embeddings  – update embeddings after registration
// Body: { face_embedding?, voice_embedding? }
router.patch('/:id/embeddings', async (req, res) => {
  const { face_embedding, voice_embedding } = req.body;
  const updates = {};
  if (face_embedding)  updates.face_embedding  = face_embedding;
  if (voice_embedding) updates.voice_embedding = voice_embedding;

  if (Object.keys(updates).length === 0)
    return res.status(400).json({ error: 'No embeddings provided' });

  const { data, error } = await supabase
    .from('students')
    .update(updates)
    .eq('student_id', req.params.id)
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ student: data[0] });
});

module.exports = router;
