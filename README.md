# SnapClass – AI Attendance System

> Face & voice recognition attendance · Node.js + Express · FastAPI Python AI · Supabase · Vercel-ready

---

## Project Structure

```
snapclass-web/
├── backend/
│   ├── server.js                   ← Express entry point
│   ├── supabase.js                 ← Supabase client (singleton)
│   ├── middleware/
│   │   └── aiProxy.js              ← Proxy calls to Python AI server
│   └── routes/
│       ├── teachers.js             ← Login, register, subjects, records
│       ├── subjects.js             ← CRUD + enroll/unenroll
│       ├── students.js             ← Register with face/voice embedding
│       └── attendance.js           ← Save logs + AI analyse endpoints
├── frontend/
│   ├── index.html                  ← All 5 pages (SPA, no framework)
│   ├── css/
│   │   └── style.css               ← Full design system
│   └── js/
│       ├── api.js                  ← All API calls
│       ├── app.js                  ← State, router, utils
│       ├── teacher.js              ← Teacher portal (real AI analysis)
│       └── student.js              ← Student portal (real face login)
├── ai_server/
│   ├── main.py                     ← FastAPI AI server entry point
│   └── src/
│       ├── face_pipeline.py        ← dlib + SVM face recognition
│       └── voice_pipeline.py       ← resemblyzer voice recognition
├── .env.example                    ← Copy to .env and fill in values
├── .gitignore
├── package.json
├── requirements.txt                ← Python dependencies
├── vercel.json                     ← Vercel deployment config
└── README.md
```

---

## Quick Start (Local Development)

### 1 — Install Node.js dependencies
```bash
npm install
```

### 2 — Install Python dependencies
```bash
pip install -r requirements.txt
```

> **Note on dlib:** dlib requires CMake and a C++ compiler.
> - **macOS:** `brew install cmake`
> - **Ubuntu/Debian:** `sudo apt-get install cmake build-essential`
> - **Windows:** Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and CMake

### 3 — Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

`.env`:
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-public-key
# Optional compatibility names for Next-style public env usage
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key
PORT=3000
AI_SERVER_URL=http://localhost:8000
```

> Note: This app uses the backend server to access Supabase, so the main values are `SUPABASE_URL` and `SUPABASE_KEY`. The `NEXT_PUBLIC_*` names are also accepted so you can deploy from environments that expect Next.js-style public env vars.

### 4 — Run both servers

**Option A — Together (recommended):**
```bash
npm run dev:all
```

**Option B — Separately:**
```bash
# Terminal 1: Node.js backend
npm run dev

# Terminal 2: Python AI server
npm run ai
# or directly:
uvicorn ai_server.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5 — Open in browser
```
http://localhost:3000
```

---

## Supabase Database Setup

Run these SQL statements in your Supabase project (SQL Editor):

```sql
-- Teachers
create table teachers (
  teacher_id uuid primary key default gen_random_uuid(),
  username   text unique not null,
  password   text not null,
  name       text not null
);

-- Students
create table students (
  student_id      serial primary key,
  name            text not null,
  face_embedding  float8[],
  voice_embedding float8[]
);

-- Subjects
create table subjects (
  subject_id   uuid primary key default gen_random_uuid(),
  subject_code text unique not null,
  name         text not null,
  section      text not null,
  teacher_id   uuid references teachers(teacher_id)
);

-- Enrollments
create table subject_students (
  subject_id uuid references subjects(subject_id),
  student_id int  references students(student_id),
  primary key (subject_id, student_id)
);

-- Attendance Logs
create table attendance_logs (
  id         serial primary key,
  student_id int  references students(student_id),
  subject_id uuid references subjects(subject_id),
  timestamp  timestamptz default now(),
  is_present boolean not null
);
```

---

## Deployment

### Deploy Node.js to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → Import project
3. Set environment variables in Vercel dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `AI_SERVER_URL` ← URL of your deployed Python AI server

### Deploy Python AI Server

The AI server runs Python with heavy ML libraries (dlib, resemblyzer) — it cannot run on Vercel.
Recommended platforms:

| Platform | Notes |
|---|---|
| **Railway** | `railway up` — easy, supports pip, persistent |
| **Render** | Free tier available, Docker or native Python |
| **Fly.io** | `fly launch` — great for always-on workloads |
| **Google Cloud Run** | Scalable, pay-per-use |

**Dockerfile (for Railway/Render/Fly.io):**
```dockerfile
FROM python:3.11-slim
RUN apt-get update && apt-get install -y cmake build-essential libopenblas-dev liblapack-dev
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "ai_server.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

---

## API Reference

### Node.js Backend (`/api/...`)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/teachers/register` | Register teacher |
| POST | `/api/teachers/login` | Login teacher |
| GET | `/api/teachers/:id/subjects` | Get teacher's subjects |
| GET | `/api/teachers/:id/records` | Get attendance records |
| POST | `/api/subjects` | Create subject |
| DELETE | `/api/subjects/:id` | Delete subject |
| GET | `/api/subjects/code/:code` | Look up by join code |
| POST | `/api/subjects/:id/enroll` | Enroll student |
| DELETE | `/api/subjects/:id/enroll/:studentId` | Unenroll student |
| GET | `/api/subjects/:id/students` | List enrolled students |
| POST | `/api/students` | Register student (with optional image/audio) |
| GET | `/api/students` | List all students |
| PATCH | `/api/students/:id/embeddings` | Update face/voice embeddings |
| POST | `/api/attendance` | Save attendance logs |
| POST | `/api/attendance/analyse-face` | Run face recognition on classroom photo |
| POST | `/api/attendance/analyse-voice` | Run voice recognition on audio |
| POST | `/api/attendance/identify-face` | Identify a single student by face |
| POST | `/api/attendance/embed-face` | Extract face embedding from image |
| POST | `/api/attendance/embed-voice` | Extract voice embedding from audio |

### Python AI Server (`/ai/...`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/ai/health` | Health check |
| POST | `/ai/face/embed` | Extract face embeddings |
| POST | `/ai/face/identify` | Identify one student |
| POST | `/ai/face/attendance` | Bulk attendance from classroom photo |
| POST | `/ai/voice/embed` | Extract voice embedding |
| POST | `/ai/voice/attendance` | Bulk voice attendance |

---

## Features

| Feature | Status |
|---|---|
| Teacher login / register | ✅ Full (bcrypt) |
| Create / delete subjects | ✅ Full |
| Share subject via QR code | ✅ Full |
| Upload classroom photos | ✅ Full |
| **Face attendance (real AI)** | ✅ dlib + SVM |
| **Student face login (real AI)** | ✅ dlib identification |
| **Voice attendance (real AI)** | ✅ resemblyzer |
| **Student registration with face embed** | ✅ Auto-extracted on register |
| Save attendance to DB | ✅ Supabase |
| Student enroll / unenroll | ✅ Full |
| Attendance % progress bars | ✅ Full |
| QR code auto-enroll | ✅ `?join-code=` URL |
| Responsive mobile layout | ✅ Full |
| GitHub-ready | ✅ |
| Vercel-ready (Node.js) | ✅ `vercel.json` included |

---

## Tech Stack

| Layer | Tech |
|---|---|
| Node.js Backend | Express 4 |
| Database | Supabase (PostgreSQL) |
| Auth | bcryptjs password hashing |
| Frontend | Vanilla HTML + CSS + JS |
| Face AI | dlib + scikit-learn SVM (Python FastAPI) |
| Voice AI | resemblyzer + librosa (Python FastAPI) |
| Deployment | Vercel (Node) + Railway/Render/Fly (Python) |
