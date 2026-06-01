const express  = require('express');
const bcrypt   = require('bcryptjs');
const supabase = require('../supabase');
const router   = express.Router();

// POST /api/teachers/register
router.post('/register', async (req, res) => {
  const { username, name, password } = req.body;
  if (!username || !name || !password)
    return res.status(400).json({ error: 'All fields are required' });

  // Check username taken
  const { data: existing } = await supabase
    .from('teachers').select('username').eq('username', username);
  if (existing && existing.length > 0)
    return res.status(409).json({ error: 'Username already taken' });

  const hashed = await bcrypt.hash(password, 10);
  const { data, error } = await supabase
    .from('teachers').insert({ username, name, password: hashed }).select();
  if (error) return res.status(500).json({ error: error.message });

  const teacher = data[0];
  delete teacher.password;
  res.json({ teacher });
});

// POST /api/teachers/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'All fields are required' });

  const { data } = await supabase
    .from('teachers').select('*').eq('username', username);
  if (!data || data.length === 0)
    return res.status(401).json({ error: 'Invalid username or password' });

  const teacher = data[0];
  const valid   = await bcrypt.compare(password, teacher.password);
  if (!valid) return res.status(401).json({ error: 'Invalid username or password' });

  delete teacher.password;
  res.json({ teacher });
});

// GET /api/teachers/:id/subjects
router.get('/:id/subjects', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('subjects')
    .select('*, subject_students(count), attendance_logs(timestamp)')
    .eq('teacher_id', id);

  if (error) return res.status(500).json({ error: error.message });

  const subjects = (data || []).map(sub => {
    sub.total_students = sub.subject_students?.[0]?.count || 0;
    const logs         = sub.attendance_logs || [];
    sub.total_classes  = new Set(logs.map(l => l.timestamp)).size;
    delete sub.subject_students;
    delete sub.attendance_logs;
    return sub;
  });

  res.json({ subjects });
});

// GET /api/teachers/:id/records
router.get('/:id/records', async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*, subjects!inner(*)')
    .eq('subjects.teacher_id', id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ records: data || [] });
});

module.exports = router;
