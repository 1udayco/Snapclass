const express  = require('express');
const supabase = require('../supabase');
const router   = express.Router();

// POST /api/subjects  – create subject
router.post('/', async (req, res) => {
  const { subject_code, name, section, teacher_id } = req.body;
  if (!subject_code || !name || !section || !teacher_id)
    return res.status(400).json({ error: 'All fields are required' });

  const { data, error } = await supabase
    .from('subjects')
    .insert({ subject_code, name, section, teacher_id })
    .select();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ subject: data[0] });
});

// DELETE /api/subjects/:id
router.delete('/:id', async (req, res) => {
  const { error } = await supabase
    .from('subjects').delete().eq('subject_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/subjects/code/:code  – lookup by join code
router.get('/code/:code', async (req, res) => {
  const { data, error } = await supabase
    .from('subjects')
    .select('subject_id, name, subject_code')
    .eq('subject_code', req.params.code);
  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0)
    return res.status(404).json({ error: 'Subject not found' });
  res.json({ subject: data[0] });
});

// POST /api/subjects/:id/enroll
router.post('/:id/enroll', async (req, res) => {
  const { student_id } = req.body;
  const subject_id     = req.params.id;

  // Check already enrolled
  const { data: existing } = await supabase
    .from('subject_students')
    .select('*').eq('subject_id', subject_id).eq('student_id', student_id);
  if (existing && existing.length > 0)
    return res.status(409).json({ error: 'Already enrolled' });

  const { error } = await supabase
    .from('subject_students').insert({ subject_id, student_id });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// DELETE /api/subjects/:id/enroll/:studentId
router.delete('/:id/enroll/:studentId', async (req, res) => {
  const { error } = await supabase
    .from('subject_students')
    .delete()
    .eq('subject_id', req.params.id)
    .eq('student_id', req.params.studentId);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// GET /api/subjects/:id/students  – enrolled students list
router.get('/:id/students', async (req, res) => {
  const { data, error } = await supabase
    .from('subject_students')
    .select('*, students(*)')
    .eq('subject_id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ students: (data || []).map(r => r.students) });
});

module.exports = router;
