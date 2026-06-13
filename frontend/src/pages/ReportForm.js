import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as api from "../api";
import "./ReportForm.css";

const RISK_LEVELS = ["Critical","High","Medium","Low","Info"];
const VULN_TYPES = ["SQL Injection","XSS (Cross-Site Scripting)","CSRF","Broken Authentication",
  "Sensitive Data Exposure","Command Injection","Path Traversal","Privilege Escalation",
  "IDOR","Broken Access Control","Security Misconfiguration","XML External Entities","Other"];

const KILL_CHAIN_STEPS = [
  { key:"input_weakness", label:"Input Weakness", desc:"Vulnerable input field or endpoint" },
  { key:"database_exposure", label:"Database Exposure", desc:"Data or structure exposed" },
  { key:"privilege_access", label:"Privilege / Access Risk", desc:"Escalation or unauthorized access" },
  { key:"server_impact", label:"Potential Server Impact", desc:"Full compromise or data breach" },
];

const TEMPLATES = {
  custom:{ label:"Blank", scope:"", methodology:"", executive_summary:"", remediation:"" },
  owasp:{ label:"OWASP", scope:"Web application tested against OWASP Top 10.", methodology:"OWASP Testing Guide v4.2",
    executive_summary:"A web application penetration test was conducted following the OWASP Testing Guide.",
    remediation:"1. Use parameterized queries.\n2. Encode output, use CSP headers.\n3. Enforce least privilege.\n4. Apply security patches promptly." },
  dvwa:{ label:"DVWA Lab", scope:"DVWA running locally. Scope: localhost, all DVWA modules including SQLi, XSS, CSRF, File Upload, Command Injection.",
    methodology:"Manual testing with Burp Suite and browser developer tools.",
    executive_summary:"Lab-based web application penetration test against DVWA to identify and document OWASP Top 10 vulnerabilities.",
    remediation:"Use parameterized queries, output encoding, CSRF tokens, file type validation, and input sanitization." },
  ptes:{ label:"PTES", scope:"Penetration test following PTES. In-scope: web application, underlying server, and database.",
    methodology:"Penetration Testing Execution Standard (PTES)",
    executive_summary:"Penetration test performed following PTES covering pre-engagement, intelligence gathering, threat modeling, vulnerability analysis, exploitation, and post-exploitation.",
    remediation:"Refer to PTES technical guidelines for remediation steps." },
};

const riskColor = { Critical:"#e63946", High:"#f39c12", Medium:"#3498db", Low:"#2ecc71", Info:"#888" };

const emptyFinding = () => ({
  id: Date.now() + Math.random(),
  title:"", type:"", severity:"High", affected_component:"",
  description:"", evidence:"", impact:"", cvss:"",
  kill_chain:{ input_weakness:"", database_exposure:"", privilege_access:"", server_impact:"" }
});

function calcCVSS(av,ac,pr,ui,s,c,i,a) {
  const AV={N:0.85,A:0.62,L:0.55,P:0.2}[av]||0;
  const AC={L:0.77,H:0.44}[ac]||0;
  const PRu={N:0.85,L:0.62,H:0.27}[pr]||0;
  const PRc={N:0.85,L:0.68,H:0.5}[pr]||0;
  const UI={N:0.85,R:0.62}[ui]||0;
  const Cv={N:0,L:0.22,H:0.56}[c]||0;
  const Iv={N:0,L:0.22,H:0.56}[i]||0;
  const Av={N:0,L:0.22,H:0.56}[a]||0;
  const changed=s==="C";
  const PRv=changed?PRc:PRu;
  const ISC=1-(1-Cv)*(1-Iv)*(1-Av);
  const Impact=changed?7.52*(ISC-0.029)-3.25*Math.pow(ISC-0.02,15):6.42*ISC;
  if(Impact<=0) return "0.0";
  const Exploitability=8.22*AV*AC*PRv*UI;
  const base=changed?Math.min(1.08*(Impact+Exploitability),10):Math.min(Impact+Exploitability,10);
  return Math.ceil(base*10)/10;
}

function CVSSCalculator({ onScore }) {
  const [v,setV] = useState({av:"N",ac:"L",pr:"N",ui:"N",s:"U",c:"H",i:"H",a:"H"});
  const score = calcCVSS(v.av,v.ac,v.pr,v.ui,v.s,v.c,v.i,v.a);
  const getSev = s => s>=9?"Critical":s>=7?"High":s>=4?"Medium":s>=0.1?"Low":"None";
  const sev = getSev(parseFloat(score));
  const sel=(key,options,labels)=>(
    <div className="cvss-field">
      <span className="cvss-label">{key.toUpperCase()}</span>
      <div className="cvss-options">
        {options.map((o,i)=>(
          <button key={o} className={`cvss-opt ${v[key]===o?"active":""}`} onClick={()=>setV({...v,[key]:o})}>{labels?labels[i]:o}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="cvss-calc">
      <div className="cvss-score-display">
        <span className={`cvss-score-num badge badge-${sev.toLowerCase()}`}>{score}</span>
        <span className="cvss-sev-label">{sev}</span>
        <button className="btn btn-primary btn-sm" onClick={()=>onScore(score,sev)}>Use This Score</button>
      </div>
      <div className="cvss-grid">
        {sel("av",["N","A","L","P"],["Network","Adjacent","Local","Physical"])}
        {sel("ac",["L","H"],["Low","High"])}
        {sel("pr",["N","L","H"],["None","Low","High"])}
        {sel("ui",["N","R"],["None","Required"])}
        {sel("s",["U","C"],["Unchanged","Changed"])}
        {sel("c",["N","L","H"],["None","Low","High"])}
        {sel("i",["N","L","H"],["None","Low","High"])}
        {sel("a",["N","L","H"],["None","Low","High"])}
      </div>
    </div>
  );
}

function PreviewReport({ form }) {
  return (
    <div className="preview-report">
      <div className="preview-header-bar">
        <span>PENETRATION TEST REPORT</span>
        <span>CONFIDENTIAL</span>
      </div>
      <h1 className="preview-title">{form.title||"Untitled Report"}</h1>
      <div className="preview-meta-grid">
        {[["Tester",form.tester_name],["Target",form.target],["Date",form.date],["Methodology",form.methodology],["Risk",form.risk_rating]]
          .filter(([,v])=>v).map(([l,v])=>(
          <div key={l} className="preview-meta-item">
            <div className="preview-meta-label">{l}</div>
            <div className="preview-meta-value">{v}</div>
          </div>
        ))}
      </div>
      {form.scope && <div className="preview-section"><div className="preview-section-title">SCOPE</div><p className="preview-text">{form.scope}</p></div>}
      {form.executive_summary && <div className="preview-section"><div className="preview-section-title">EXECUTIVE SUMMARY</div><p className="preview-text">{form.executive_summary}</p></div>}
      {form.findings?.length>0 && (
        <div className="preview-section">
          <div className="preview-section-title">TECHNICAL FINDINGS ({form.findings.length})</div>
          {form.findings.map((f,i)=>(
            <div key={i} className="preview-finding" style={{borderLeftColor:riskColor[f.severity]||"#888"}}>
              <div className="preview-finding-header">
                <span><strong>#{i+1}:</strong> {f.title||"Untitled"}</span>
                <span className={`badge badge-${f.severity?.toLowerCase()}`}>{f.severity}</span>
              </div>
              {f.description && <p className="preview-text" style={{fontSize:"12px",marginTop:"6px"}}>{f.description}</p>}
              {f.kill_chain && Object.values(f.kill_chain).some(v=>v) && (
                <div className="preview-kill-chain">
                  {KILL_CHAIN_STEPS.map(step => f.kill_chain[step.key] ? (
                    <div key={step.key} className="pkc-step">
                      <div className="pkc-label">{step.label}</div>
                      <div className="pkc-value">{f.kill_chain[step.key]}</div>
                    </div>
                  ):null)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {form.remediation && <div className="preview-section"><div className="preview-section-title">REMEDIATION</div><p className="preview-text">{form.remediation}</p></div>}
      <div className="preview-footer">Generated by RedReport</div>
    </div>
  );
}

export default function ReportForm() {
  const { id } = useParams();
  const isEdit = id && id !== "new";
  const navigate = useNavigate();
  const autoSaveTimer = useRef(null);
  const reportIdRef = useRef(isEdit ? id : null);
  const dragItem = useRef(null);
  const dragOver = useRef(null);

  const [form, setForm] = useState({
    title:"", tester_name:"", target:"",
    date: new Date().toISOString().split("T")[0],
    scope:"", methodology:"OWASP Testing Guide v4.2",
    executive_summary:"", findings:[emptyFinding()],
    remediation:"", risk_rating:"Medium", status:"draft", template:"custom"
  });
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [showCVSS, setShowCVSS] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [uploadingFor, setUploadingFor] = useState(null);

  useEffect(() => {
    if (isEdit) {
      api.getReport(id).then(res => {
        const d = res.data;
        d.findings = (d.findings||[]).length
          ? d.findings.map(f=>({...emptyFinding(),...f, kill_chain:{...emptyFinding().kill_chain,...(f.kill_chain||{})}}))
          : [emptyFinding()];
        setForm(d); setLoading(false);
        api.getReportUploads(id).then(r=>setUploads(r.data)).catch(()=>{});
      }).catch(()=>{setError("Failed to load"); setLoading(false);});
    }
  }, [id, isEdit]);

  useEffect(() => {
    if (autoSaveTimer.current) clearInterval(autoSaveTimer.current);
    autoSaveTimer.current = setInterval(async () => {
      if (!reportIdRef.current) return;
      try {
        await api.updateReport(reportIdRef.current, {...form, status:"draft"});
        setAutoSaveStatus("Auto-saved"); setTimeout(()=>setAutoSaveStatus(""),3000);
      } catch {}
    }, 30000);
    return () => clearInterval(autoSaveTimer.current);
  }, [form]);

  const applyTemplate = key => {
    const t = TEMPLATES[key]; if(!t) return;
    setForm(f=>({...f, template:key, scope:t.scope, methodology:t.methodology, executive_summary:t.executive_summary, remediation:t.remediation}));
  };

  const handleChange = e => setForm({...form, [e.target.name]:e.target.value});
  const handleFindingChange = (idx,field,value) => {
    const updated=[...form.findings]; updated[idx]={...updated[idx],[field]:value};
    setForm({...form, findings:updated});
  };
  const handleKillChainChange = (idx,key,value) => {
    const updated=[...form.findings];
    updated[idx]={...updated[idx], kill_chain:{...updated[idx].kill_chain,[key]:value}};
    setForm({...form, findings:updated});
  };
  const addFinding = () => setForm({...form, findings:[...form.findings, emptyFinding()]});
  const removeFinding = idx => { if(form.findings.length===1) return; setForm({...form, findings:form.findings.filter((_,i)=>i!==idx)}); };

  // Drag to reorder
  const onDragStart = (idx) => { dragItem.current = idx; };
  const onDragEnter = (idx) => { dragOver.current = idx; };
  const onDragEnd = () => {
    const items = [...form.findings];
    const draggedItem = items.splice(dragItem.current, 1)[0];
    items.splice(dragOver.current, 0, draggedItem);
    dragItem.current = null; dragOver.current = null;
    setForm({...form, findings:items});
  };

  const handleSubmit = async (status) => {
    setSaving(true); setError("");
    try {
      const payload = {...form, status};
      if (isEdit) { await api.updateReport(id, payload); navigate(`/report/${id}`); }
      else { const res = await api.createReport(payload); reportIdRef.current=res.data.id; navigate(`/report/${res.data.id}`); }
    } catch { setError("Failed to save report"); }
    finally { setSaving(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if(!file) return;
    if (!reportIdRef.current) { alert("Save the report first before uploading evidence."); return; }
    setUploadingFor(true);
    const fd = new FormData(); fd.append("file",file); fd.append("report_id",reportIdRef.current);
    try { const res=await api.uploadFile(fd); setUploads(prev=>[...prev,res.data]); }
    catch { alert("Upload failed."); }
    finally { setUploadingFor(false); }
  };

  const handleDeleteUpload = async (uid) => {
    await api.deleteUpload(uid); setUploads(prev=>prev.filter(f=>f.id!==uid));
  };

  if (loading) return <div className="form-page loading-page"><span className="spinner"></span> Loading...</div>;

  return (
    <div className="form-page">
      <header className="form-header">
        <div className="form-header-left">
          <button className="btn btn-ghost btn-sm" onClick={()=>navigate(isEdit?`/report/${id}`:"/dashboard")}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Back
          </button>
          <h1 className="form-page-title">{isEdit?"Edit Report":"New Report"}</h1>
          {autoSaveStatus && <span className="autosave-badge">{autoSaveStatus}</span>}
        </div>
        <div className="form-header-actions">
          {error && <span className="form-error-inline">{error}</span>}
          <button className="btn btn-secondary btn-sm" onClick={()=>handleSubmit("draft")} disabled={saving}>Save Draft</button>
          <button className="btn btn-primary btn-sm" onClick={()=>handleSubmit("final")} disabled={saving}>
            {saving && <span className="spinner"></span>}
            {saving?"Saving...":"Save as Final"}
          </button>
        </div>
      </header>

      <div className="form-tabs">
        {["overview","findings","evidence","remediation","preview"].map(tab=>(
          <button key={tab} className={`form-tab ${activeTab===tab?"active":""}`} onClick={()=>setActiveTab(tab)}>
            {tab.charAt(0).toUpperCase()+tab.slice(1)}
            {tab==="findings" && <span className="tab-count">{form.findings.length}</span>}
            {tab==="evidence" && <span className="tab-count">{uploads.length}</span>}
            {tab==="preview" && <span className="tab-count new-badge">New</span>}
          </button>
        ))}
      </div>

      <div className="form-body">

        {activeTab==="overview" && (
          <div className="form-section">
            <div className="template-row">
              <span className="template-label">Template:</span>
              {Object.entries(TEMPLATES).map(([key,t])=>(
                <button key={key} className={`template-btn ${form.template===key?"active":""}`} onClick={()=>applyTemplate(key)}>{t.label}</button>
              ))}
            </div>
            <div className="form-grid-2">
              <div className="form-group"><label>Report Title</label><input name="title" value={form.title} onChange={handleChange} placeholder="e.g. DVWA Web App Penetration Test"/></div>
              <div className="form-group"><label>Tester Name</label><input name="tester_name" value={form.tester_name} onChange={handleChange} placeholder="e.g. Cyprian Paul"/></div>
              <div className="form-group"><label>Target</label><input name="target" value={form.target} onChange={handleChange} placeholder="e.g. DVWA localhost:80"/></div>
              <div className="form-group"><label>Test Date</label><input name="date" type="date" value={form.date} onChange={handleChange}/></div>
              <div className="form-group"><label>Overall Risk Rating</label>
                <select name="risk_rating" value={form.risk_rating} onChange={handleChange}>{RISK_LEVELS.map(r=><option key={r}>{r}</option>)}</select></div>
              <div className="form-group"><label>Methodology</label><input name="methodology" value={form.methodology} onChange={handleChange}/></div>
            </div>
            <div className="form-group"><label>Scope</label><textarea name="scope" value={form.scope} onChange={handleChange} rows={3} placeholder="What was in scope..."/></div>
            <div className="form-group"><label>Executive Summary</label><textarea name="executive_summary" value={form.executive_summary} onChange={handleChange} rows={5} placeholder="High-level summary..."/></div>
          </div>
        )}

        {activeTab==="findings" && (
          <div className="form-section">
            <div className="findings-header">
              <div>
                <h3>Technical Findings</h3>
                <p className="text-muted" style={{fontSize:"13px",marginTop:"4px"}}>Drag findings to reorder them</p>
              </div>
              <button className="btn btn-secondary btn-sm" onClick={addFinding}>+ Add Finding</button>
            </div>

            {form.findings.map((finding,idx)=>(
              <div key={finding.id} className="finding-card"
                draggable onDragStart={()=>onDragStart(idx)} onDragEnter={()=>onDragEnter(idx)}
                onDragEnd={onDragEnd} onDragOver={e=>e.preventDefault()}>

                <div className="finding-card-header">
                  <div className="flex-center gap-2">
                    <span className="drag-handle" title="Drag to reorder">⠿</span>
                    <span className="finding-number">Finding #{idx+1}</span>
                  </div>
                  <div className="flex-center gap-2">
                    <span className={`badge badge-${finding.severity?.toLowerCase()}`}>{finding.severity}</span>
                    <button className="btn btn-ghost btn-sm" onClick={()=>setShowCVSS(showCVSS===idx?null:idx)}>
                      {showCVSS===idx?"Hide CVSS":"CVSS Calc"}
                    </button>
                    {form.findings.length>1 && <button className="btn btn-danger btn-sm" onClick={()=>removeFinding(idx)}>Remove</button>}
                  </div>
                </div>

                {showCVSS===idx && (
                  <div className="cvss-wrapper">
                    <CVSSCalculator onScore={(score,sev)=>{ handleFindingChange(idx,"cvss",String(score)); handleFindingChange(idx,"severity",sev); setShowCVSS(null); }}/>
                  </div>
                )}

                <div className="form-grid-2">
                  <div className="form-group"><label>Finding Title</label><input value={finding.title} onChange={e=>handleFindingChange(idx,"title",e.target.value)} placeholder="e.g. SQL Injection in Login Form"/></div>
                  <div className="form-group"><label>Vulnerability Type</label>
                    <select value={finding.type} onChange={e=>handleFindingChange(idx,"type",e.target.value)}>
                      <option value="">Select type...</option>{VULN_TYPES.map(t=><option key={t}>{t}</option>)}
                    </select></div>
                  <div className="form-group"><label>Severity</label>
                    <select value={finding.severity} onChange={e=>handleFindingChange(idx,"severity",e.target.value)}>
                      {RISK_LEVELS.map(r=><option key={r}>{r}</option>)}</select></div>
                  <div className="form-group"><label>Affected Component</label><input value={finding.affected_component} onChange={e=>handleFindingChange(idx,"affected_component",e.target.value)} placeholder="e.g. /dvwa/sqli/"/></div>
                  <div className="form-group"><label>CVSS Score</label><input value={finding.cvss} onChange={e=>handleFindingChange(idx,"cvss",e.target.value)} placeholder="e.g. 9.1"/></div>
                </div>
                <div className="form-group"><label>Description</label><textarea value={finding.description} onChange={e=>handleFindingChange(idx,"description",e.target.value)} rows={3} placeholder="How was this found and how does it work..."/></div>
                <div className="form-group"><label>Evidence</label><textarea value={finding.evidence} onChange={e=>handleFindingChange(idx,"evidence",e.target.value)} rows={3} placeholder="Payloads, request/response data..."/></div>
                <div className="form-group"><label>Business Impact</label><textarea value={finding.impact} onChange={e=>handleFindingChange(idx,"impact",e.target.value)} rows={2} placeholder="What damage could this cause..."/></div>

                {/* Kill Chain Section */}
                <div className="kill-chain-section">
                  <div className="kill-chain-title">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                    </svg>
                    Kill Chain
                  </div>
                  <div className="kill-chain-steps">
                    {KILL_CHAIN_STEPS.map((step,si)=>(
                      <div key={step.key} className="kc-step">
                        <div className="kc-step-header">
                          <span className="kc-step-num">{si+1}</span>
                          <div>
                            <div className="kc-step-label">{step.label}</div>
                            <div className="kc-step-desc">{step.desc}</div>
                          </div>
                        </div>
                        <input
                          value={finding.kill_chain?.[step.key]||""}
                          onChange={e=>handleKillChainChange(idx,step.key,e.target.value)}
                          placeholder={`Describe ${step.label.toLowerCase()}...`}
                          className="kc-input"
                        />
                        {si < KILL_CHAIN_STEPS.length-1 && <div className="kc-arrow">↓</div>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab==="evidence" && (
          <div className="form-section">
            <div className="findings-header">
              <div>
                <h3>Screenshots and Evidence Files</h3>
                <p className="text-muted" style={{fontSize:"13px",marginTop:"4px"}}>
                  {!reportIdRef.current?"Save the report first, then upload evidence.":"Supported: PNG, JPG, PDF, TXT (max 10MB each)"}
                </p>
              </div>
              {reportIdRef.current && (
                <label className="btn btn-secondary btn-sm" style={{cursor:"pointer"}}>
                  {uploadingFor?<span className="spinner"></span>:"+ Upload File"}
                  <input type="file" accept="image/*,.pdf,.txt" style={{display:"none"}} onChange={handleFileUpload}/>
                </label>
              )}
            </div>
            {uploads.length===0 ? (
              <div className="empty-state" style={{padding:"40px"}}><p>No files uploaded yet.</p></div>
            ) : (
              <div className="uploads-grid">
                {uploads.map(file=>(
                  <div key={file.id} className="upload-card">
                    {file.mimetype?.startsWith("image/")
                      ? <img src={`http://localhost:5000${file.url}`} alt={file.original_name} className="upload-preview"/>
                      : <div className="upload-icon-placeholder">
                          <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                        </div>}
                    <div className="upload-info">
                      <span className="upload-name">{file.original_name}</span>
                      <div className="upload-actions">
                        <a href={`http://localhost:5000${file.url}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">View</a>
                        <button className="btn btn-danger btn-sm" onClick={()=>handleDeleteUpload(file.id)}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab==="remediation" && (
          <div className="form-section">
            <div className="form-group">
              <label>Remediation Recommendations</label>
              <textarea name="remediation" value={form.remediation} onChange={handleChange} rows={12} placeholder="List your recommended fixes..."/>
            </div>
            <div className="remediation-tips">
              <h4>Common Fixes Reference</h4>
              <div className="tips-grid">
                {[["SQL Injection","Use parameterized queries or prepared statements"],
                  ["XSS","Encode output, use Content-Security-Policy headers"],
                  ["Auth Issues","Enforce MFA, secure session management"],
                  ["Access Control","Implement least privilege, validate server side"],
                  ["Command Injection","Avoid shell calls, use safe APIs"],
                  ["CSRF","Use CSRF tokens on all state-changing requests"]
                ].map(([title,tip])=>(
                  <div key={title} className="tip-card">
                    <div className="tip-title">{title}</div>
                    <div className="tip-text">{tip}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab==="preview" && (
          <div className="form-section">
            <div className="preview-notice">
              This is how your report will look when exported. Save as Final when you are ready.
            </div>
            <PreviewReport form={form} />
          </div>
        )}

      </div>
    </div>
  );
}
