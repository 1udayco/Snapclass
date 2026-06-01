require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const teacherRoutes     = require('./routes/teachers');
const subjectRoutes     = require('./routes/subjects');
const studentRoutes     = require('./routes/students');
const attendanceRoutes  = require('./routes/attendance');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// API routes
app.use('/api/teachers',    teacherRoutes);
app.use('/api/subjects',    subjectRoutes);
app.use('/api/students',    studentRoutes);
app.use('/api/attendance',  attendanceRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 handler for unmatched API routes
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀  SnapClass running at http://localhost:${PORT}\n`);
  });
}

module.exports = app;
