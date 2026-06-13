import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as api from "../api";
import PasswordInput from "../components/PasswordInput";
import { DashboardSkeleton } from "../components/Skeleton";
import "./Profile.css";

const CATEGORIES = ["Student","Professor","Penetration Tester","Security Analyst","CTF Player","Researcher","Other"];

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState(null);
  const [form, setForm] = useState({ bio:"", category:"", username:"", email:"" });
  const [pwForm, setPwForm] = useState({ current:"", newPw:"", confirm:"" });
  const [saving, setSaving] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [resending, setResending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [pwError, setPwError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    api.getProfile().then(res => {
      setProfile(res.data);
      setForm({ bio:res.data.bio||"", category:res.data.category||"Other", username:res.data.username||"", email:res.data.email||"" });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(()=>setSuccess(""),3500); };
  const showError = (msg) => { setError(msg); setTimeout(()=>setError(""),4000); };

  const handleSaveProfile = async () => {
    setSaving(true); setError("");
    try {
      await api.updateProfile({ bio:form.bio, category:form.category, username:form.username, email:form.email });
      setProfile({ ...profile, ...form });
      setActiveSection(null);
      showSuccess("Profile updated.");
    } catch(err) { showError(err.response?.data?.error||"Failed to update profile"); }
    finally { setSaving(false); }
  };

  const handleChangePw = async (e) => {
    e.preventDefault(); setPwError("");
    if (pwForm.newPw.length<6) { setPwError("New password must be at least 6 characters"); return; }
    if (pwForm.newPw!==pwForm.confirm) { setPwError("Passwords do not match"); return; }
    setSavingPw(true);
    try {
      await api.changePassword(pwForm.current, pwForm.newPw);
      showSuccess("Password changed."); setActiveSection(null); setPwForm({current:"",newPw:"",confirm:""});
    } catch(err) { setPwError(err.response?.data?.error||"Failed to change password"); }
    finally { setSavingPw(false); }
  };

  const handleResend = async () => {
    setResending(true);
    try { await api.resendVerification(); showSuccess("Verification email sent."); }
    catch { showError("Failed to resend. Try again."); }
    finally { setResending(false); }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== profile.username) { showError("Username does not match."); return; }
    try {
      await api.deleteAccount();
      logout(); navigate("/login");
    } catch { showError("Failed to delete account."); }
  };

  const toggle = (section) => {
    setActiveSection(activeSection===section ? null : section);
    setError(""); setPwError("");
  };

  if (loading) return (
    <div className="profile-page">
      <header className="dash-header">
        <div className="dash-brand"><span className="brand-name">RedReport</span></div>
      </header>
      <main className="profile-main"><DashboardSkeleton /></main>
    </div>
  );

  return (
    <div className="profile-page">
      <header className="dash-header">
        <div className="dash-brand" onClick={()=>navigate("/dashboard")} style={{cursor:"pointer"}}>
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L4 8v8c0 7.18 5.16 13.9 12 15.93C22.84 29.9 28 23.18 28 16V8L16 2z" fill="#e63946"/>
            <path d="M13 16l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="brand-name">RedReport</span>
        </div>
        <div className="dash-user">
          <button className="btn btn-ghost btn-sm" onClick={()=>navigate("/dashboard")}>Dashboard</button>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <main className="profile-main">
        {!profile?.is_verified && (
          <div className="verify-banner">
            <div className="verify-banner-text">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              Your email is not verified. Check your inbox for a verification link.
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleResend} disabled={resending}>
              {resending?<span className="spinner"></span>:"Resend Email"}
            </button>
          </div>
        )}

        {success && <div className="alert alert-success">{success}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="profile-header-card">
          <div className="profile-avatar">{profile?.username?.charAt(0).toUpperCase()}</div>
          <div className="profile-info">
            <h2 className="profile-name">{profile?.username}</h2>
            <p className="profile-email">{profile?.email}</p>
            <span className="badge badge-medium" style={{marginTop:"6px"}}>{profile?.category}</span>
          </div>
          <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
            <button className="btn btn-secondary btn-sm" onClick={()=>toggle("edit")}>
              {activeSection==="edit"?"Cancel":"Edit Profile"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={()=>toggle("password")}>
              {activeSection==="password"?"Cancel":"Change Password"}
            </button>
          </div>
        </div>

        {/* Edit profile */}
        {activeSection==="edit" && (
          <div className="card">
            <div className="card-header"><h3>Edit Profile</h3></div>
            <div className="form-grid-2">
              <div className="form-group">
                <label>Username</label>
                <input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="Username"/>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email"/>
              </div>
            </div>
            <div className="form-group">
              <label>Category</label>
              <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>
                {CATEGORIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Bio</label>
              <textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} placeholder="Tell others about yourself..." rows={3}/>
            </div>
            <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
              {saving&&<span className="spinner"></span>}
              {saving?"Saving...":"Save Changes"}
            </button>
          </div>
        )}

        {/* Change password */}
        {activeSection==="password" && (
          <div className="card">
            <div className="card-header"><h3>Change Password</h3></div>
            {pwError && <div className="alert alert-error" style={{marginBottom:"16px"}}>{pwError}</div>}
            <form onSubmit={handleChangePw}>
              <div className="form-group">
                <label>Current Password</label>
                <PasswordInput placeholder="Your current password" value={pwForm.current} onChange={e=>setPwForm({...pwForm,current:e.target.value})} required/>
              </div>
              <div className="form-group">
                <label>New Password</label>
                <PasswordInput placeholder="At least 6 characters" value={pwForm.newPw} onChange={e=>setPwForm({...pwForm,newPw:e.target.value})} required/>
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <PasswordInput placeholder="Repeat new password" value={pwForm.confirm} onChange={e=>setPwForm({...pwForm,confirm:e.target.value})} required/>
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingPw}>
                {savingPw&&<span className="spinner"></span>}
                {savingPw?"Saving...":"Update Password"}
              </button>
            </form>
          </div>
        )}

        {profile?.bio && activeSection!=="edit" && (
          <div className="card">
            <div className="card-header"><h3>About</h3></div>
            <p style={{color:"var(--text-secondary)",fontSize:"14px",lineHeight:"1.8"}}>{profile.bio}</p>
          </div>
        )}

        <div className="stats-grid">
          <div className="stat-card"><div className="stat-value">{profile?.total_reports}</div><div className="stat-label">Total Reports</div></div>
          <div className="stat-card stat-card-red"><div className="stat-value text-red">{profile?.critical_reports}</div><div className="stat-label">Critical Findings</div></div>
          <div className="stat-card"><div className="stat-value" style={{color:"#2ecc71"}}>{profile?.final_reports}</div><div className="stat-label">Final Reports</div></div>
          <div className="stat-card"><div className="stat-value" style={{color:"#888"}}>{(profile?.total_reports||0)-(profile?.final_reports||0)}</div><div className="stat-label">Drafts</div></div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Account Details</h3></div>
          <div className="profile-details">
            {[["Username",profile?.username],["Email",profile?.email],["Role",profile?.category],
              ["Email Verified",profile?.is_verified?"Yes":"No"],
              ["Member Since",new Date(profile?.created_at).toLocaleDateString()]
            ].map(([label,value])=>(
              <div key={label} className="detail-row">
                <span className="detail-label">{label}</span>
                <span className="detail-value" style={label==="Email Verified"&&!profile?.is_verified?{color:"var(--red)"}:{}}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Delete account */}
        <div className="card danger-zone">
          <div className="card-header">
            <h3 style={{color:"var(--red)"}}>Danger Zone</h3>
          </div>
          <p style={{fontSize:"13px",color:"var(--text-secondary)",marginBottom:"16px"}}>
            Deleting your account permanently removes all your reports, findings, and uploaded files. This cannot be undone.
          </p>
          {activeSection==="delete" ? (
            <div>
              <p style={{fontSize:"13px",marginBottom:"10px"}}>Type your username <strong>{profile?.username}</strong> to confirm:</p>
              <div className="form-group">
                <input value={deleteConfirm} onChange={e=>setDeleteConfirm(e.target.value)} placeholder={`Type "${profile?.username}" to confirm`}/>
              </div>
              <div style={{display:"flex",gap:"8px"}}>
                <button className="btn btn-danger" onClick={handleDeleteAccount} disabled={deleteConfirm!==profile?.username}>
                  Delete My Account
                </button>
                <button className="btn btn-secondary btn-sm" onClick={()=>{setActiveSection(null);setDeleteConfirm("");}}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={()=>toggle("delete")}>Delete Account</button>
          )}
        </div>
      </main>
    </div>
  );
}
