import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as api from "../api";
import PasswordInput from "../components/PasswordInput";
import "./Auth.css";

const CATEGORIES = ["Student","Professor","Penetration Tester","Security Analyst","CTF Player","Researcher","Other"];

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ username:"", email:"", password:"", confirmPassword:"", category:"", rememberMe:false });
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNew, setConfirmNew] = useState("");
  const [demoOtp, setDemoOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const remembered = localStorage.getItem("remembered_email");
    if (remembered) setForm(f => ({ ...f, email: remembered, rememberMe: true }));
  }, []);

  const handleChange = (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: val });
    setError("");
  };

  const switchMode = (m) => { setMode(m); setError(""); setSuccess(""); setOtpInput(""); setDemoOtp(""); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      if (mode === "login") {
        const res = await api.login({ email: form.email, password: form.password });
        if (form.rememberMe) localStorage.setItem("remembered_email", form.email);
        else localStorage.removeItem("remembered_email");
        login({ username: res.data.username, email: res.data.email, is_verified: res.data.is_verified }, res.data.token);
        navigate("/dashboard");
      } else {
        if (!form.username.trim()) { setError("Username is required"); return; }
        if (!form.category) { setError("Please select a category"); return; }
        if (form.password !== form.confirmPassword) { setError("Passwords do not match"); return; }
        const res = await api.signup({ username: form.username, email: form.email, password: form.password, category: form.category });
        login({ username: res.data.username, email: res.data.email, is_verified: 0 }, res.data.token);
        navigate("/dashboard");
      }
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally { setLoading(false); }
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.forgotPassword(forgotEmail);
      if (res.data.demo_otp) {
        setDemoOtp(res.data.demo_otp);
        setSuccess(`No SMTP configured. Demo OTP: ${res.data.demo_otp}`);
      } else {
        setSuccess(`OTP sent to ${forgotEmail}. Check your inbox.`);
      }
      setTimeout(() => { setSuccess(""); setMode("otp"); }, 2500);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to send OTP");
    } finally { setLoading(false); }
  };

  const handleOTPSubmit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await api.verifyOTP(forgotEmail, otpInput);
      setResetToken(res.data.reset_token);
      setMode("reset");
    } catch (err) {
      setError(err.response?.data?.error || "Invalid OTP");
    } finally { setLoading(false); }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmNew) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      await api.resetPassword(forgotEmail, resetToken, newPassword);
      setSuccess("Password reset successful. Sign in now.");
      setTimeout(() => { setSuccess(""); switchMode("login"); }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || "Reset failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-brand">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L4 8v8c0 7.18 5.16 13.9 12 15.93C22.84 29.9 28 23.18 28 16V8L16 2z" fill="#e63946" opacity="0.9"/>
            <path d="M13 16l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="brand-name">RedReport</span>
        </div>
        <div className="auth-hero">
          <h1>Document vulnerabilities.<br/><span className="text-red">Prove your findings.</span></h1>
          <p>Build professional pentest reports with structured findings, risk ratings, and evidence logs.</p>
          <div className="auth-features">
            <div className="feature-item"><span className="feature-dot"></span><span>Structured OWASP-aligned reporting</span></div>
            <div className="feature-item"><span className="feature-dot"></span><span>PDF and DOCX export for your portfolio</span></div>
            <div className="feature-item"><span className="feature-dot"></span><span>CVSS calculator built into every finding</span></div>
            <div className="feature-item"><span className="feature-dot"></span><span>GitHub README and LinkedIn sharing</span></div>
          </div>
          <div className="auth-demo-info">
            <div className="demo-label">Demo Account</div>
            <div className="demo-detail">Name: Cyprian Paul</div>
            <div className="demo-detail">Email: mangongocyprian1@gmail.com</div>
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-card">

          {mode === "login" && (
            <>
              <div className="auth-tabs">
                <button className="auth-tab active">Sign In</button>
                <button className="auth-tab" onClick={() => switchMode("signup")}>Create Account</button>
              </div>
              <form onSubmit={handleSubmit} className="auth-form">
                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" placeholder="mangongocyprian1@gmail.com" value={form.email} onChange={handleChange} required autoComplete="email"/>
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <PasswordInput name="password" placeholder="Your password" value={form.password} onChange={handleChange} autoComplete="current-password" required/>
                </div>
                <div className="remember-row">
                  <label className="checkbox-label">
                    <input type="checkbox" name="rememberMe" checked={form.rememberMe} onChange={handleChange}/>
                    <span className="checkbox-box"></span>
                    <span className="checkbox-text">Remember me</span>
                  </label>
                  <button type="button" className="link-btn forgot-btn" onClick={() => switchMode("forgot")}>Forgot password?</button>
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading && <span className="spinner"></span>}
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
              <p className="auth-switch">Don't have an account? <button className="link-btn" onClick={() => switchMode("signup")}>Create one</button></p>
            </>
          )}

          {mode === "signup" && (
            <>
              <div className="auth-tabs">
                <button className="auth-tab" onClick={() => switchMode("login")}>Sign In</button>
                <button className="auth-tab active">Create Account</button>
              </div>
              <form onSubmit={handleSubmit} className="auth-form">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>Username</label>
                  <input name="username" type="text" placeholder="e.g. cyprian_paul" value={form.username} onChange={handleChange} autoComplete="username"/>
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input name="email" type="email" placeholder="mangongocyprian1@gmail.com" value={form.email} onChange={handleChange} required autoComplete="email"/>
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select name="category" value={form.category} onChange={handleChange} required>
                    <option value="">Select your role...</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <PasswordInput name="password" placeholder="At least 6 characters" value={form.password} onChange={handleChange} autoComplete="new-password" required/>
                </div>
                <div className="form-group">
                  <label>Confirm Password</label>
                  <PasswordInput name="confirmPassword" placeholder="Repeat your password" value={form.confirmPassword} onChange={handleChange} autoComplete="new-password" required/>
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading && <span className="spinner"></span>}
                  {loading ? "Creating account..." : "Create Account"}
                </button>
              </form>
              <p className="auth-switch">Already have an account? <button className="link-btn" onClick={() => switchMode("login")}>Sign in</button></p>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div className="auth-back"><button className="link-btn" onClick={() => switchMode("login")}>← Back to Sign In</button></div>
              <h2 className="auth-section-title">Reset Password</h2>
              <p className="auth-section-desc">Enter your registered email. We will send you a 6-digit OTP code.</p>
              <form onSubmit={handleForgotSubmit} className="auth-form">
                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}
                <div className="form-group">
                  <label>Registered Email</label>
                  <input type="email" placeholder="mangongocyprian1@gmail.com" value={forgotEmail} onChange={e => { setForgotEmail(e.target.value); setError(""); }} required/>
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading && <span className="spinner"></span>}
                  {loading ? "Sending..." : "Send OTP Code"}
                </button>
              </form>
            </>
          )}

          {mode === "otp" && (
            <>
              <div className="auth-back"><button className="link-btn" onClick={() => switchMode("forgot")}>← Back</button></div>
              <h2 className="auth-section-title">Enter OTP Code</h2>
              <p className="auth-section-desc">A 6-digit code was sent to <strong>{forgotEmail}</strong>. Enter it below.</p>
              {demoOtp && <div className="alert alert-success" style={{fontSize:"13px"}}>No SMTP set up. Your demo OTP is: <strong style={{letterSpacing:"4px"}}>{demoOtp}</strong></div>}
              <form onSubmit={handleOTPSubmit} className="auth-form">
                {error && <div className="alert alert-error">{error}</div>}
                <div className="form-group">
                  <label>OTP Code</label>
                  <input type="text" placeholder="Enter 6-digit code" value={otpInput} onChange={e => { setOtpInput(e.target.value); setError(""); }} maxLength={6} className="otp-input" required/>
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading && <span className="spinner"></span>}
                  {loading ? "Verifying..." : "Verify Code"}
                </button>
              </form>
              <p className="auth-switch">Did not receive it? <button className="link-btn" onClick={() => switchMode("forgot")}>Resend</button></p>
            </>
          )}

          {mode === "reset" && (
            <>
              <div className="auth-back"></div>
              <h2 className="auth-section-title">New Password</h2>
              <p className="auth-section-desc">OTP verified. Set your new password below.</p>
              <form onSubmit={handleResetSubmit} className="auth-form">
                {error && <div className="alert alert-error">{error}</div>}
                {success && <div className="alert alert-success">{success}</div>}
                <div className="form-group">
                  <label>New Password</label>
                  <PasswordInput placeholder="At least 6 characters" value={newPassword} onChange={e => { setNewPassword(e.target.value); setError(""); }} required/>
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <PasswordInput placeholder="Repeat new password" value={confirmNew} onChange={e => { setConfirmNew(e.target.value); setError(""); }} required/>
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                  {loading && <span className="spinner"></span>}
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
