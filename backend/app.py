from dotenv import load_dotenv
load_dotenv()

from flask import Flask, request, jsonify, send_from_directory, Response
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3, json, uuid, os, time, random, smtplib, subprocess, tempfile
from email.mime.text import MIMEText
from datetime import timedelta
from collections import defaultdict

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])
app.config["JWT_SECRET_KEY"] = "redreport-secret-2024"
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=24)
app.config["UPLOAD_FOLDER"] = "uploads"
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

SMTP_HOST = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.environ.get("SMTP_PORT", 587))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASS = os.environ.get("SMTP_PASS", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "RedReport <noreply@redreport.dev>")

jwt = JWTManager(app)
DB_PATH = "redreport.db"
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

login_attempts = defaultdict(list)
otp_store = {}

# ── SMTP health check on startup ──────────────────────────────────────────────
def check_smtp():
    if not SMTP_USER or not SMTP_PASS:
        print("⚠  SMTP not configured. OTP codes will show in API response (dev mode).")
        return False
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as s:
            s.starttls()
            s.login(SMTP_USER, SMTP_PASS)
        print(f"✓  SMTP connected: {SMTP_HOST}:{SMTP_PORT} as {SMTP_USER}")
        return True
    except Exception as e:
        print(f"✗  SMTP connection failed: {e}")
        print("   OTP codes will show in API response (dev mode).")
        return False

SMTP_OK = check_smtp()

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        category TEXT DEFAULT 'Other',
        bio TEXT DEFAULT '',
        is_verified INTEGER DEFAULT 0,
        verification_token TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        tester_name TEXT, target TEXT, date TEXT,
        scope TEXT, methodology TEXT, executive_summary TEXT,
        findings TEXT, remediation TEXT, risk_rating TEXT,
        status TEXT DEFAULT 'draft',
        share_token TEXT, template TEXT DEFAULT 'custom',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        report_id INTEGER, user_id INTEGER,
        filename TEXT, original_name TEXT,
        mimetype TEXT, size INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.commit(); conn.close()

init_db()

def send_email(to, subject, body):
    if not SMTP_USER or not SMTP_PASS:
        return False
    try:
        msg = MIMEText(body, "html")
        msg["Subject"] = subject
        msg["From"] = SMTP_FROM
        msg["To"] = to
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls(); s.login(SMTP_USER, SMTP_PASS)
            s.sendmail(SMTP_FROM, to, msg.as_string())
        return True
    except Exception as e:
        print(f"Email error: {e}"); return False

def is_rate_limited(ip):
    now = time.time()
    attempts = [t for t in login_attempts[ip] if now - t < 300]
    login_attempts[ip] = attempts
    return len(attempts) >= 5

def record_attempt(ip):
    login_attempts[ip].append(time.time())

# ── AUTH ──────────────────────────────────────────────────────────────────────
@app.route("/api/auth/signup", methods=["POST"])
def signup():
    data = request.get_json()
    username = data.get("username","").strip()
    email = data.get("email","").strip().lower()
    password = data.get("password","")
    category = data.get("category","Other")
    if not username or not email or not password:
        return jsonify({"error":"All fields are required"}), 400
    if len(password) < 6:
        return jsonify({"error":"Password must be at least 6 characters"}), 400
    vtoken = str(uuid.uuid4())
    conn = get_db()
    try:
        c = conn.cursor()
        c.execute("INSERT INTO users (username,email,password_hash,category,verification_token) VALUES (?,?,?,?,?)",
                  (username, email, generate_password_hash(password), category, vtoken))
        conn.commit(); user_id = c.lastrowid
        link = f"http://localhost:5000/api/auth/verify/{vtoken}"
        send_email(email, "Verify your RedReport account",
            f"<h2>Welcome to RedReport, {username}!</h2>"
            f"<p>Click below to verify your email:</p>"
            f"<a href='{link}' style='background:#e63946;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block'>Verify Email</a>")
        token = create_access_token(identity=str(user_id))
        return jsonify({"token":token,"username":username,"email":email,"category":category,"is_verified":0}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error":"Username or email already exists"}), 409
    finally: conn.close()

@app.route("/api/auth/verify/<token>")
def verify_email(token):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id FROM users WHERE verification_token=?", (token,))
    user = c.fetchone()
    if not user: conn.close(); return "<h2 style='font-family:sans-serif;color:#e63946'>Invalid or expired link.</h2>", 400
    conn.execute("UPDATE users SET is_verified=1,verification_token=NULL WHERE id=?", (user["id"],))
    conn.commit(); conn.close()
    return "<h2 style='font-family:sans-serif;color:#2ecc71'>Email verified! You can close this tab and sign in.</h2>"

@app.route("/api/auth/resend-verification", methods=["POST"])
@jwt_required()
def resend_verification():
    user_id = get_jwt_identity()
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT email,username,is_verified,verification_token FROM users WHERE id=?", (user_id,))
    user = c.fetchone(); conn.close()
    if not user: return jsonify({"error":"Not found"}), 404
    if user["is_verified"]: return jsonify({"message":"Already verified"}), 200
    vtoken = user["verification_token"] or str(uuid.uuid4())
    conn = get_db(); conn.execute("UPDATE users SET verification_token=? WHERE id=?", (vtoken, user_id)); conn.commit(); conn.close()
    link = f"http://localhost:5000/api/auth/verify/{vtoken}"
    send_email(user["email"], "Verify your RedReport account",
        f"<h2>Hi {user['username']}!</h2><p>Click to verify:</p><a href='{link}' style='background:#e63946;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block'>Verify Email</a>")
    return jsonify({"message":"Verification email resent"}), 200

@app.route("/api/auth/login", methods=["POST"])
def login():
    ip = request.remote_addr
    if is_rate_limited(ip): return jsonify({"error":"Too many attempts. Wait 5 minutes."}), 429
    data = request.get_json()
    email = data.get("email","").strip().lower()
    password = data.get("password","")
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM users WHERE email=?", (email,)); user = c.fetchone(); conn.close()
    if not user or not check_password_hash(user["password_hash"], password):
        record_attempt(ip); return jsonify({"error":"Invalid email or password"}), 401
    token = create_access_token(identity=str(user["id"]))
    return jsonify({"token":token,"username":user["username"],"email":user["email"],
                    "category":user["category"],"is_verified":user["is_verified"]}), 200

@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json()
    email = data.get("email","").strip().lower()
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id,username FROM users WHERE email=?", (email,)); user = c.fetchone(); conn.close()
    if not user: return jsonify({"error":"No account found with that email"}), 404
    code = str(random.randint(100000,999999))
    otp_store[email] = {"code":code,"expires":time.time()+600}
    sent = send_email(email,"RedReport Password Reset OTP",
        f"<h2>Password Reset</h2><p>Your OTP:</p><h1 style='color:#e63946;letter-spacing:8px'>{code}</h1><p>Expires in 10 minutes.</p>")
    resp = {"message":"OTP sent"}
    if not sent: resp["demo_otp"] = code
    return jsonify(resp), 200

@app.route("/api/auth/verify-otp", methods=["POST"])
def verify_otp():
    data = request.get_json()
    email = data.get("email","").strip().lower()
    code = data.get("code","").strip()
    entry = otp_store.get(email)
    if not entry or entry["code"]!=code or time.time()>entry["expires"]:
        return jsonify({"error":"Invalid or expired OTP"}), 400
    reset_token = str(uuid.uuid4())
    otp_store[email]["reset_token"] = reset_token
    return jsonify({"reset_token":reset_token}), 200

@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json()
    email = data.get("email","").strip().lower()
    reset_token = data.get("reset_token","")
    new_password = data.get("new_password","")
    entry = otp_store.get(email)
    if not entry or entry.get("reset_token")!=reset_token: return jsonify({"error":"Invalid reset token"}), 400
    if len(new_password)<6: return jsonify({"error":"Password must be at least 6 characters"}), 400
    conn = get_db()
    conn.execute("UPDATE users SET password_hash=? WHERE email=?",(generate_password_hash(new_password),email))
    conn.commit(); conn.close(); del otp_store[email]
    return jsonify({"message":"Password reset successful"}), 200

@app.route("/api/auth/change-password", methods=["POST"])
@jwt_required()
def change_password():
    user_id = get_jwt_identity(); data = request.get_json()
    current = data.get("current_password",""); new_pw = data.get("new_password","")
    if len(new_pw)<6: return jsonify({"error":"New password must be at least 6 characters"}), 400
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT password_hash FROM users WHERE id=?", (user_id,)); user = c.fetchone()
    if not user or not check_password_hash(user["password_hash"],current):
        conn.close(); return jsonify({"error":"Current password is incorrect"}), 401
    conn.execute("UPDATE users SET password_hash=? WHERE id=?",(generate_password_hash(new_pw),user_id))
    conn.commit(); conn.close()
    return jsonify({"message":"Password changed successfully"}), 200

# ── PROFILE ───────────────────────────────────────────────────────────────────
@app.route("/api/profile", methods=["GET"])
@jwt_required()
def get_profile():
    user_id = get_jwt_identity()
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id,username,email,category,bio,is_verified,created_at FROM users WHERE id=?",(user_id,))
    user = c.fetchone()
    c.execute("SELECT COUNT(*) as t FROM reports WHERE user_id=?",(user_id,)); total=c.fetchone()["t"]
    c.execute("SELECT COUNT(*) as t FROM reports WHERE user_id=? AND status='final'",(user_id,)); finals=c.fetchone()["t"]
    c.execute("SELECT COUNT(*) as t FROM reports WHERE user_id=? AND risk_rating='Critical'",(user_id,)); crits=c.fetchone()["t"]
    conn.close()
    if not user: return jsonify({"error":"Not found"}), 404
    return jsonify({**dict(user),"total_reports":total,"final_reports":finals,"critical_reports":crits}), 200

@app.route("/api/profile", methods=["PUT"])
@jwt_required()
def update_profile():
    user_id = get_jwt_identity(); data = request.get_json()
    new_username = data.get("username","").strip()
    new_email = data.get("email","").strip().lower()
    bio = data.get("bio",""); category = data.get("category","Other")
    conn = get_db()
    try:
        updates = ["bio=?","category=?"]
        params = [bio, category]
        if new_username:
            updates.append("username=?"); params.append(new_username)
        if new_email:
            updates.append("email=?"); params.append(new_email)
        params.append(user_id)
        conn.execute(f"UPDATE users SET {','.join(updates)} WHERE id=?", params)
        conn.commit()
        return jsonify({"message":"Profile updated"}), 200
    except sqlite3.IntegrityError:
        return jsonify({"error":"Username or email already taken"}), 409
    finally: conn.close()

@app.route("/api/profile", methods=["DELETE"])
@jwt_required()
def delete_account():
    user_id = get_jwt_identity()
    conn = get_db()
    conn.execute("DELETE FROM reports WHERE user_id=?", (user_id,))
    conn.execute("DELETE FROM uploads WHERE user_id=?", (user_id,))
    conn.execute("DELETE FROM users WHERE id=?", (user_id,))
    conn.commit(); conn.close()
    return jsonify({"message":"Account deleted"}), 200

@app.route("/api/smtp-status", methods=["GET"])
@jwt_required()
def smtp_status():
    return jsonify({"configured": bool(SMTP_USER and SMTP_PASS), "host": SMTP_HOST if SMTP_USER else None, "smtp_ok": SMTP_OK}), 200

# ── REPORTS ───────────────────────────────────────────────────────────────────
@app.route("/api/reports", methods=["GET"])
@jwt_required()
def get_reports():
    user_id = get_jwt_identity()
    search = request.args.get("search",""); risk = request.args.get("risk","")
    status = request.args.get("status",""); sort = request.args.get("sort","newest")
    query = "SELECT id,title,target,date,risk_rating,status,share_token,created_at FROM reports WHERE user_id=?"
    params = [user_id]
    if search: query += " AND (title LIKE ? OR target LIKE ?)"; params += [f"%{search}%",f"%{search}%"]
    if risk: query += " AND risk_rating=?"; params.append(risk)
    if status: query += " AND status=?"; params.append(status)
    order = {"newest":"created_at DESC","oldest":"created_at ASC",
             "risk":"CASE risk_rating WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 WHEN 'Low' THEN 4 ELSE 5 END",
             "title":"title ASC"}.get(sort,"created_at DESC")
    query += f" ORDER BY {order}"
    conn = get_db(); c = conn.cursor(); c.execute(query,params)
    reports = [dict(r) for r in c.fetchall()]; conn.close()
    return jsonify(reports), 200

@app.route("/api/reports", methods=["POST"])
@jwt_required()
def create_report():
    user_id = get_jwt_identity(); data = request.get_json()
    conn = get_db(); c = conn.cursor()
    c.execute("""INSERT INTO reports (user_id,title,tester_name,target,date,scope,methodology,
        executive_summary,findings,remediation,risk_rating,status,template) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (user_id,data.get("title","Untitled"),data.get("tester_name",""),data.get("target",""),
         data.get("date",""),data.get("scope",""),data.get("methodology",""),data.get("executive_summary",""),
         json.dumps(data.get("findings",[])),data.get("remediation",""),data.get("risk_rating","Medium"),
         data.get("status","draft"),data.get("template","custom")))
    conn.commit(); rid = c.lastrowid; conn.close()
    return jsonify({"id":rid,"message":"Report created"}), 201

@app.route("/api/reports/<int:rid>", methods=["GET"])
@jwt_required()
def get_report(rid):
    user_id = get_jwt_identity()
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM reports WHERE id=? AND user_id=?",(rid,user_id)); r = c.fetchone(); conn.close()
    if not r: return jsonify({"error":"Not found"}), 404
    d = dict(r)
    try: d["findings"] = json.loads(d["findings"] or "[]")
    except: d["findings"] = []
    return jsonify(d), 200

@app.route("/api/reports/<int:rid>", methods=["PUT"])
@jwt_required()
def update_report(rid):
    user_id = get_jwt_identity(); data = request.get_json()
    conn = get_db()
    conn.execute("""UPDATE reports SET title=?,tester_name=?,target=?,date=?,scope=?,methodology=?,
        executive_summary=?,findings=?,remediation=?,risk_rating=?,status=?,template=?,
        updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?""",
        (data.get("title",""),data.get("tester_name",""),data.get("target",""),data.get("date",""),
         data.get("scope",""),data.get("methodology",""),data.get("executive_summary",""),
         json.dumps(data.get("findings",[])),data.get("remediation",""),data.get("risk_rating","Medium"),
         data.get("status","draft"),data.get("template","custom"),rid,user_id))
    conn.commit(); conn.close()
    return jsonify({"message":"Updated"}), 200

@app.route("/api/reports/<int:rid>", methods=["DELETE"])
@jwt_required()
def delete_report(rid):
    user_id = get_jwt_identity(); conn = get_db()
    conn.execute("DELETE FROM reports WHERE id=? AND user_id=?",(rid,user_id))
    conn.commit(); conn.close()
    return jsonify({"message":"Deleted"}), 200

@app.route("/api/reports/<int:rid>/duplicate", methods=["POST"])
@jwt_required()
def duplicate_report(rid):
    user_id = get_jwt_identity(); conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM reports WHERE id=? AND user_id=?",(rid,user_id)); r = c.fetchone()
    if not r: conn.close(); return jsonify({"error":"Not found"}), 404
    c.execute("""INSERT INTO reports (user_id,title,tester_name,target,date,scope,methodology,
        executive_summary,findings,remediation,risk_rating,status,template) VALUES (?,?,?,?,?,?,?,?,?,?,?,'draft',?)""",
        (user_id,f"Copy of {r['title']}",r["tester_name"],r["target"],r["date"],r["scope"],
         r["methodology"],r["executive_summary"],r["findings"],r["remediation"],r["risk_rating"],r["template"]))
    conn.commit(); new_id = c.lastrowid; conn.close()
    return jsonify({"id":new_id}), 201

@app.route("/api/reports/<int:rid>/share", methods=["POST"])
@jwt_required()
def toggle_share(rid):
    user_id = get_jwt_identity(); conn = get_db(); c = conn.cursor()
    c.execute("SELECT share_token FROM reports WHERE id=? AND user_id=?",(rid,user_id)); r = c.fetchone()
    if not r: conn.close(); return jsonify({"error":"Not found"}), 404
    if r["share_token"]:
        conn.execute("UPDATE reports SET share_token=NULL WHERE id=?",(rid,)); token=None
    else:
        token = str(uuid.uuid4())
        conn.execute("UPDATE reports SET share_token=? WHERE id=?",(token,rid))
    conn.commit(); conn.close()
    return jsonify({"share_token":token}), 200

@app.route("/api/shared/<token>")
def get_shared_report(token):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM reports WHERE share_token=? AND status='final'",(token,)); r = c.fetchone(); conn.close()
    if not r: return jsonify({"error":"Not found or not public"}), 404
    d = dict(r)
    try: d["findings"] = json.loads(d["findings"] or "[]")
    except: d["findings"] = []
    del d["user_id"]; return jsonify(d), 200

# ── UPLOADS ───────────────────────────────────────────────────────────────────
ALLOWED = {"png","jpg","jpeg","gif","webp","pdf","txt"}

@app.route("/api/uploads", methods=["POST"])
@jwt_required()
def upload_file():
    user_id = get_jwt_identity()
    if "file" not in request.files: return jsonify({"error":"No file"}), 400
    f = request.files["file"]
    ext = f.filename.rsplit(".",1)[-1].lower() if "." in f.filename else ""
    if ext not in ALLOWED: return jsonify({"error":"File type not allowed"}), 400
    stored = f"{uuid.uuid4()}.{ext}"
    f.save(os.path.join(app.config["UPLOAD_FOLDER"],stored))
    report_id = request.form.get("report_id")
    conn = get_db(); c = conn.cursor()
    c.execute("INSERT INTO uploads (report_id,user_id,filename,original_name,mimetype,size) VALUES (?,?,?,?,?,?)",
              (report_id,user_id,stored,f.filename,f.content_type,
               os.path.getsize(os.path.join(app.config["UPLOAD_FOLDER"],stored))))
    conn.commit(); uid = c.lastrowid; conn.close()
    return jsonify({"id":uid,"filename":stored,"original_name":f.filename,
                    "url":f"/api/uploads/{stored}","mimetype":f.content_type}), 201

@app.route("/api/uploads/<filename>")
def serve_upload(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"],filename)

@app.route("/api/uploads/report/<int:rid>", methods=["GET"])
@jwt_required()
def get_report_uploads(rid):
    user_id = get_jwt_identity(); conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM uploads WHERE report_id=? AND user_id=?",(rid,user_id))
    files = [dict(r) for r in c.fetchall()]; conn.close()
    for f in files: f["url"] = f"/api/uploads/{f['filename']}"
    return jsonify(files), 200

@app.route("/api/uploads/<int:uid>", methods=["DELETE"])
@jwt_required()
def delete_upload(uid):
    user_id = get_jwt_identity(); conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM uploads WHERE id=? AND user_id=?",(uid,user_id)); f = c.fetchone()
    if not f: conn.close(); return jsonify({"error":"Not found"}), 404
    try: os.remove(os.path.join(app.config["UPLOAD_FOLDER"],f["filename"]))
    except: pass
    conn.execute("DELETE FROM uploads WHERE id=?",(uid,)); conn.commit(); conn.close()
    return jsonify({"message":"Deleted"}), 200

# ── DOCX EXPORT ───────────────────────────────────────────────────────────────
NODE_MODULES = os.path.join(os.path.dirname(__file__), "node_modules")

@app.route("/api/reports/<int:rid>/export-docx", methods=["GET"])
@jwt_required()
def export_docx(rid):
    user_id = get_jwt_identity()
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM reports WHERE id=? AND user_id=?",(rid,user_id)); r = c.fetchone(); conn.close()
    if not r: return jsonify({"error":"Not found"}), 404
    d = dict(r)
    try: d["findings"] = json.loads(d["findings"] or "[]")
    except: d["findings"] = []

    script = f"""
const {{ Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType }} = require('{NODE_MODULES}/docx');
const fs = require('fs');
const report = {json.dumps(d)};
const riskColors = {{ Critical:"C0392B", High:"E67E22", Medium:"2980B9", Low:"27AE60", Info:"7F8C8D" }};
const border = {{ style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" }};
const borders = {{ top: border, bottom: border, left: border, right: border }};

function para(text, opts={{}}) {{
  return new Paragraph({{ children:[new TextRun({{text:String(text||""),...opts}})], spacing:{{after:80}} }});
}}
function heading(text) {{
  return new Paragraph({{
    children:[new TextRun({{text,bold:true,size:24,color:"C0392B"}})],
    spacing:{{before:280,after:120}},
    border:{{bottom:{{style:BorderStyle.SINGLE,size:6,color:"C0392B",space:1}}}}
  }});
}}
function metaRow(label,value) {{
  return new TableRow({{children:[
    new TableCell({{borders,width:{{size:2500,type:WidthType.DXA}},shading:{{fill:"F5F5F5",type:ShadingType.CLEAR}},
      margins:{{top:80,bottom:80,left:120,right:120}},
      children:[new Paragraph({{children:[new TextRun({{text:label,bold:true,size:18}})]}})]}}),
    new TableCell({{borders,width:{{size:6526,type:WidthType.DXA}},
      margins:{{top:80,bottom:80,left:120,right:120}},
      children:[new Paragraph({{children:[new TextRun({{text:String(value||"N/A"),size:18}})]}})]}}),
  ]}});
}}

const children = [];

children.push(new Paragraph({{
  children:[new TextRun({{text:"PENETRATION TEST REPORT",bold:true,size:36,color:"C0392B"}})],
  alignment:AlignmentType.CENTER, spacing:{{after:160}}
}}));
children.push(new Paragraph({{
  children:[new TextRun({{text:report.title||"Report",bold:true,size:26}})],
  alignment:AlignmentType.CENTER, spacing:{{after:360}}
}}));

children.push(new Table({{
  width:{{size:9026,type:WidthType.DXA}}, columnWidths:[2500,6526],
  rows:[
    metaRow("Tester", report.tester_name),
    metaRow("Target", report.target),
    metaRow("Date", report.date),
    metaRow("Methodology", report.methodology),
    metaRow("Overall Risk", report.risk_rating),
    metaRow("Status", (report.status||"").toUpperCase()),
  ]
}}));

children.push(new Paragraph({{spacing:{{after:240}}}}));

if(report.scope){{
  children.push(heading("Scope"));
  (report.scope||"").split("\\n").forEach(line=>children.push(para(line)));
}}

if(report.executive_summary){{
  children.push(heading("Executive Summary"));
  (report.executive_summary||"").split("\\n").forEach(line=>children.push(para(line)));
}}

if(report.findings&&report.findings.length>0){{
  children.push(heading(`Technical Findings (${{report.findings.length}})`));
  report.findings.forEach((f,i)=>{{
    const sevColor = riskColors[f.severity]||"7F8C8D";
    children.push(new Paragraph({{
      children:[
        new TextRun({{text:`Finding #${{i+1}}: ${{f.title||"Untitled"}}  `,bold:true,size:22}}),
        new TextRun({{text:`[${{f.severity||"N/A"}}]`,bold:true,size:18,color:sevColor}}),
      ],
      spacing:{{before:200,after:80}},
      border:{{bottom:{{style:BorderStyle.SINGLE,size:4,color:sevColor,space:1}}}}
    }}));
    [["Type",f.type],["Affected Component",f.affected_component],["CVSS Score",f.cvss],
     ["Description",f.description],["Evidence",f.evidence],["Business Impact",f.impact]
    ].forEach(([label,value])=>{{
      if(!value) return;
      children.push(new Paragraph({{
        children:[new TextRun({{text:label+": ",bold:true,size:18,color:"555555"}}),new TextRun({{text:String(value),size:18}})],
        spacing:{{after:60}}
      }}));
    }});
    // Kill chain
    const kc = f.kill_chain||{{}};
    const kcSteps=[["Input Weakness",kc.input_weakness],["Database Exposure",kc.database_exposure],
      ["Privilege/Access Risk",kc.privilege_access],["Server Impact",kc.server_impact]].filter(([,v])=>v);
    if(kcSteps.length>0){{
      children.push(para("Kill Chain:", {{bold:true,size:17,color:"C0392B"}}));
      kcSteps.forEach(([label,value],ci)=>{{
        children.push(new Paragraph({{
          children:[new TextRun({{text:`${{ci+1}}. ${{label}}: `,bold:true,size:16}}),new TextRun({{text:value,size:16}})],
          spacing:{{after:40}},
          indent:{{left:360}}
        }}));
      }});
    }}
    children.push(new Paragraph({{spacing:{{after:160}}}}));
  }});
}}

if(report.remediation){{
  children.push(heading("Remediation Recommendations"));
  (report.remediation||"").split("\\n").forEach(line=>children.push(para(line)));
}}

children.push(new Paragraph({{spacing:{{before:400}}}}));
children.push(new Paragraph({{
  children:[new TextRun({{text:"Generated by RedReport | CONFIDENTIAL",size:16,color:"AAAAAA",italics:true}})],
  alignment:AlignmentType.CENTER
}}));

const doc = new Document({{
  styles:{{default:{{document:{{run:{{font:"Arial",size:20}}}}}}}},
  sections:[{{
    properties:{{page:{{size:{{width:11906,height:16838}},margin:{{top:1440,right:1440,bottom:1440,left:1440}}}}}},
    children
  }}]
}});

Packer.toBuffer(doc).then(buf=>{{ fs.writeFileSync(process.argv[2],buf); process.exit(0); }})
  .catch(e=>{{ console.error(e); process.exit(1); }});
"""

    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = os.path.join(tmpdir,"gen.js")
        out_path = os.path.join(tmpdir,"report.docx")
        with open(script_path,"w") as f: f.write(script)
        result = subprocess.run(["node",script_path,out_path],capture_output=True,text=True,timeout=30)
        if result.returncode!=0:
            return jsonify({"error":f"DOCX failed: {result.stderr[:200]}"}), 500
        with open(out_path,"rb") as f: docx_bytes = f.read()

    safe = (d.get("title","report") or "report").replace(" ","-").lower()
    return Response(docx_bytes,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition":f"attachment; filename=pentest-{safe}.docx"})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
