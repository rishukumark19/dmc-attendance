# Dhanbad Municipal Corporation — Attendance System

A full-stack staff attendance & salary management system built for **Dhanbad Municipal Corporation (DMC)**, Jharkhand.

## 📁 Project Structure

```
attendence website/
├── app/             ← React + Vite frontend (active codebase)
└── legacy-html/     ← Original plain HTML/JS prototype (archived)
```

## 🚀 Tech Stack

- **Frontend**: React 19, Vite 8
- **Backend / Auth / DB**: Supabase (PostgreSQL + Auth)
- **Styling**: Vanilla CSS with custom design system
- **Language**: JavaScript (JSX)

## ✨ Features

- 🔐 Staff & Admin login (Supabase Auth)
- ✅ Check-in / Check-out with time-window enforcement (6–8 AM only)
- 🛑 Auto-block on Sundays
- 📊 Monthly attendance summary & salary calculation (₹75/hr rate)
- 👥 Admin dashboard — manage staff, today's view, records, salary report
- 📥 CSV salary export
- 🇮🇳 Hindi + English bilingual UI

## 🏃 Running Locally

```bash
cd app
npm install
npm run dev
```

Then open **http://localhost:5173**

> Requires internet — backend is hosted on Supabase.
