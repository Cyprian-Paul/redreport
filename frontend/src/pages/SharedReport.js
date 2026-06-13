import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as api from "../api";
import "./ReportView.css";
import "./SharedReport.css";

const riskColor = { Critical:"#e63946", High:"#f39c12", Medium:"#3498db", Low:"#2ecc71", Info:"#888" };

function generateReadme(report) {
  const findings = (report.findings||[]);
  const counts = { Critical:0,High:0,Medium:0,Low:0,Info:0 };
  findings.forEach(f => { if(counts[f.severity]!==undefined) counts[f.severity]++; });
  const badge = (sev,count) => count>0 ? `![${sev}](https://img.shields.io/badge/${sev}-${count}-${
    {Critical:"e63946",High:"f39c12",Medium:"3498db",Low:"2ecc71",Info:"888888"}[sev]}?style=flat-square)` : "";

  return `# ${report.title}

> Penetration Test Report | Generated with [RedReport](http://localhost:3000)

## Summary

| Field | Details |
|-------|---------|
| **Tester** | ${report.tester_name||"N/A"} |
| **Target** | ${report.target||"N/A"} |
| **Date** | ${report.date||"N/A"} |
| **Methodology** | ${report.methodology||"N/A"} |
| **Overall Risk** | **${report.risk_rating||"N/A"}** |

## Risk Overview

${badge("Critical",counts.Critical)} ${badge("High",counts.High)} ${badge("Medium",counts.Medium)} ${badge("Low",counts.Low)} ${badge("Info",counts.Info)}

## Scope

${report.scope||"N/A"}

## Executive Summary

${report.executive_summary||"N/A"}

## Technical Findings

${findings.length===0?"No findings documented."
: findings.map((f,i) => `### Finding #${i+1}: ${f.title||"Untitled"}

| Field | Details |
|-------|---------|
| **Severity** | ${f.severity} |
| **Type** | ${f.type||"N/A"} |
| **Component** | \`${f.affected_component||"N/A"}\` |
${f.cvss?`| **CVSS Score** | ${f.cvss} |`:""}

**Description:** ${f.description||"N/A"}

**Evidence:** ${f.evidence||"N/A"}

**Business Impact:** ${f.impact||"N/A"}
${f.kill_chain && Object.values(f.kill_chain).some(v=>v) ? `
**Kill Chain:**
${[
  ["Input Weakness", f.kill_chain.input_weakness],
  ["Database Exposure", f.kill_chain.database_exposure],
  ["Privilege / Access Risk", f.kill_chain.privilege_access],
  ["Potential Server Impact", f.kill_chain.server_impact],
].filter(([,v])=>v).map(([l,v])=>`- **${l}:** ${v}`).join("\n")}` : ""}

---`).join("\n\n")}

## Remediation Recommendations

${report.remediation||"N/A"}

---

*Generated with [RedReport](http://localhost:3000) — Professional Pentest Report Generator*
`;
}

export default function SharedReport() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showReadme, setShowReadme] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getSharedReport(token)
      .then(res => { setReport(res.data); setLoading(false); })
      .catch(() => { setError("This report is not available or has been made private."); setLoading(false); });
  }, [token]);

  const shareOnLinkedIn = () => {
    const url = encodeURIComponent(window.location.href);
    const title = encodeURIComponent(`${report.title} — Penetration Test Report`);
    const summary = encodeURIComponent(`I just completed a web application penetration test and documented my findings professionally using RedReport. Check out the full report here.`);
    window.open(`https://www.linkedin.com/shareArticle?mini=true&url=${url}&title=${title}&summary=${summary}`, "_blank", "width=600,height=500");
  };

  const copyReadme = () => {
    navigator.clipboard.writeText(generateReadme(report));
    setCopied(true); setTimeout(()=>setCopied(false),2500);
  };

  const downloadReadme = () => {
    const blob = new Blob([generateReadme(report)], {type:"text/markdown"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href=url;
    a.download=`${report.title?.replace(/\s+/g,"-").toLowerCase()||"report"}-README.md`;
    a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div className="view-page loading-view"><span className="spinner"></span> Loading...</div>;

  if (error) return (
    <div className="view-page loading-view" style={{flexDirection:"column",gap:"16px"}}>
      <p style={{color:"var(--text-secondary)"}}>{error}</p>
      <button className="btn btn-primary" onClick={()=>navigate("/")}>Go to RedReport</button>
    </div>
  );

  return (
    <div className="view-page">
      <header className="view-header">
        <div className="view-header-left">
          <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M16 2L4 8v8c0 7.18 5.16 13.9 12 15.93C22.84 29.9 28 23.18 28 16V8L16 2z" fill="#e63946"/>
              <path d="M13 16l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{fontWeight:700,fontSize:"15px"}}>RedReport</span>
          </div>
          <span style={{color:"var(--text-muted)",fontSize:"12px",background:"var(--bg-input)",padding:"2px 8px",borderRadius:"4px"}}>Shared Report</span>
          <h1 className="view-page-title">{report.title}</h1>
          <span className={`badge badge-${report.risk_rating?.toLowerCase()}`}>{report.risk_rating}</span>
        </div>
        <div className="view-header-actions">
          <button className="btn btn-linkedin" onClick={shareOnLinkedIn}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h14m-.5 15.5v-5.3a3.26 3.26 0 00-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 011.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 001.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 00-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
            </svg>
            Share on LinkedIn
          </button>
          <button className="btn btn-github" onClick={()=>setShowReadme(!showReadme)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2A10 10 0 002 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/>
            </svg>
            {showReadme ? "Hide README" : "GitHub README"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={()=>navigate("/login")}>Create Your Own</button>
        </div>
      </header>

      {showReadme && (
        <div className="readme-panel">
          <div className="readme-panel-header">
            <div>
              <h3 className="readme-panel-title">GitHub README.md</h3>
              <p className="readme-panel-desc">Copy this into your GitHub project README to showcase this pentest as a portfolio piece.</p>
            </div>
            <div className="readme-panel-actions">
              <button className="btn btn-secondary btn-sm" onClick={copyReadme}>
                {copied ? "Copied!" : "Copy Markdown"}
              </button>
              <button className="btn btn-primary btn-sm" onClick={downloadReadme}>Download .md</button>
            </div>
          </div>
          <pre className="readme-preview">{generateReadme(report)}</pre>
        </div>
      )}

      <div className="view-body">
        <div className="view-meta-grid">
          {[["Tester",report.tester_name],["Target",report.target],["Date",report.date],["Methodology",report.methodology]]
            .filter(([,v])=>v).map(([label,value])=>(
              <div key={label} className="meta-item">
                <div className="meta-label">{label}</div>
                <div className="meta-value">{value}</div>
              </div>
            ))}
        </div>

        {report.scope && <div className="view-section"><h2 className="section-title">Scope</h2><p className="section-content">{report.scope}</p></div>}
        {report.executive_summary && <div className="view-section"><h2 className="section-title">Executive Summary</h2><p className="section-content">{report.executive_summary}</p></div>}

        {report.findings?.length>0 && (
          <div className="view-section">
            <h2 className="section-title">Technical Findings <span className="section-count">{report.findings.length}</span></h2>
            {report.findings.map((f,i)=>(
              <div key={i} className="finding-view-card" style={{"--sev-color":riskColor[f.severity]||"#888"}}>
                <div className="finding-view-header">
                  <div className="finding-view-title"><span className="finding-idx">#{i+1}</span><span>{f.title}</span></div>
                  <span className={`badge badge-${f.severity?.toLowerCase()}`}>{f.severity}</span>
                </div>
                <div className="finding-view-body">
                  {f.type && <div className="fv-row"><span className="fv-label">Type</span><span className="fv-value">{f.type}</span></div>}
                  {f.affected_component && <div className="fv-row"><span className="fv-label">Component</span><code className="fv-code">{f.affected_component}</code></div>}
                  {f.description && <div className="fv-row fv-block"><span className="fv-label">Description</span><p className="fv-value">{f.description}</p></div>}
                  {f.impact && <div className="fv-row fv-block"><span className="fv-label">Impact</span><p className="fv-value">{f.impact}</p></div>}
                  {f.kill_chain && Object.values(f.kill_chain).some(v=>v) && (
                    <div className="fv-row fv-block">
                      <span className="fv-label">Kill Chain</span>
                      <div className="shared-kill-chain">
                        {[["Input Weakness","input_weakness"],["Database Exposure","database_exposure"],
                          ["Privilege Risk","privilege_access"],["Server Impact","server_impact"]
                        ].filter(([,k])=>f.kill_chain[k]).map(([label,key],ci)=>(
                          <div key={key} className="skc-item">
                            <span className="skc-num">{ci+1}</span>
                            <div><div className="skc-label">{label}</div><div className="skc-value">{f.kill_chain[key]}</div></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {report.remediation && <div className="view-section"><h2 className="section-title">Remediation</h2><p className="section-content">{report.remediation}</p></div>}

        <div className="shared-cta">
          <p>Report generated with RedReport</p>
          <button className="btn btn-primary" onClick={()=>navigate("/login")}>Build Your Own Pentest Reports</button>
        </div>
      </div>
    </div>
  );
}
