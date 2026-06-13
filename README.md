# RedReport v4

Professional web application penetration testing report generator.

## Tech Stack

- Frontend: React, React Router, jsPDF, Axios
- Backend: Python Flask, Flask-JWT-Extended, SQLite
- DOCX Export: Node.js + docx package (included in backend/node_modules)

---

## Quick Start

### Step 1: Backend

```bash
cd pentest-app/backend

# Create virtual environment
python -m venv venv

# Activate (Linux/Mac)
source venv/bin/activate

# Activate (Windows)
venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Start backend
python app.py
```

Backend runs on: http://localhost:5000

On startup you will see either:
- `SMTP connected` — emails will send for OTP and verification
- `SMTP not configured` — OTP codes show in the API response (dev mode)

### Step 2: Frontend

```bash
cd pentest-app/frontend
npm install
npm start
```

Frontend runs on: http://localhost:3000

---

## SMTP Setup (for real emails)

Copy `.env.example` to `.env` inside the backend folder:

```bash
cp backend/.env.example backend/.env
```

Edit `.env` with your Gmail credentials:

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=RedReport <your@gmail.com>
```

To get a Gmail App Password:
1. Enable 2-Factor Authentication on your Google account
2. Go to myaccount.google.com/apppasswords
3. Generate a password for "Mail"
4. Paste it in SMTP_PASS

---

## Features

- Signup and login with JWT authentication
- Email verification on signup
- Forgot password with 6-digit OTP
- Change password from profile page
- Session timeout after 30 minutes inactivity
- Rate limiting on login (5 attempts per 5 minutes)
- Create structured pentest reports with templates (OWASP, PTES, DVWA Lab)
- Multiple findings per report with CVSS v3 calculator
- Kill chain section per finding (Input Weakness, Database Exposure, Privilege Risk, Server Impact)
- Drag and drop finding reorder
- Auto-save every 30 seconds
- Report preview before saving as final
- Screenshot and file evidence upload per report
- Export reports as PDF or Word DOCX
- Share reports via public link
- LinkedIn share button on shared reports
- GitHub README generator from report
- Risk distribution chart on dashboard
- Search, filter by risk/status, and sort reports
- Edit username, email, bio, and category on profile
- Delete account with confirmation

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/signup | No | Create account |
| POST | /api/auth/login | No | Sign in |
| GET | /api/auth/verify/:token | No | Verify email |
| POST | /api/auth/resend-verification | Yes | Resend verification email |
| POST | /api/auth/forgot-password | No | Request OTP |
| POST | /api/auth/verify-otp | No | Verify OTP code |
| POST | /api/auth/reset-password | No | Reset password |
| POST | /api/auth/change-password | Yes | Change password |
| GET | /api/profile | Yes | Get profile + stats |
| PUT | /api/profile | Yes | Update profile |
| DELETE | /api/profile | Yes | Delete account |
| GET | /api/reports | Yes | List reports |
| POST | /api/reports | Yes | Create report |
| GET | /api/reports/:id | Yes | Get report |
| PUT | /api/reports/:id | Yes | Update report |
| DELETE | /api/reports/:id | Yes | Delete report |
| POST | /api/reports/:id/duplicate | Yes | Duplicate report |
| POST | /api/reports/:id/share | Yes | Toggle share link |
| GET | /api/shared/:token | No | View shared report |
| GET | /api/reports/:id/export-docx | Yes | Export as DOCX |
| POST | /api/uploads | Yes | Upload file |
| GET | /api/uploads/report/:id | Yes | Get report files |
| DELETE | /api/uploads/:id | Yes | Delete file |

---

## Portfolio Resume Bullets

"Performed a full web application penetration test in a lab, identified SQL injection and privilege escalation, documented the complete attack kill chain, and delivered a professional remediation report."

"Built a full-stack pentest report generator using React and Flask with JWT authentication, CVSS v3 calculator, PDF/DOCX export, screenshot evidence management, and public share links."
