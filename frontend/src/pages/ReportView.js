import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import jsPDF from "jspdf";
import * as api from "../api";
import { ReportSkeleton } from "../components/Skeleton";
import "./ReportView.css";

const riskColor = { Critical:"#e63946", High:"#f39c12", Medium:"#3498db", Low:"#2ecc71", Info:"#888" };
const KILL_CHAIN_LABELS = [
  ["input_weakness","Input Weakness"],
  ["database_exposure","Database Exposure"],
  ["privilege_access","Privilege / Access Risk"],
  ["server_impact","Potential Server Impact"],
];

export default function ReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const reportRef = useRef();

  useEffect(() => {
    Promise.all([
      api.getReport(id),
      api.getReportUploads(id)
    ]).then(([rRes, uRes]) => {
      setReport(rRes.data);
      setUploads(uRes.data);
      if (rRes.data.share_token) {
        setShareUrl(`${window.location.origin}/shared/${rRes.data.share_token}`);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await api.toggleShare(id);
      if (res.data.share_token) {
        const url = `${window.location.origin}/shared/${res.data.share_token}`;
        setShareUrl(url);
        navigator.clipboard.writeText(url).catch(() => {});
        alert(`Share link copied to clipboard:\n${url}`);
      } else {
        setShareUrl("");
        alert("Share link removed. Report is now private.");
      }
      setReport(r => ({ ...r, share_token: res.data.share_token }));
    } catch { alert("Failed to update share settings."); }
    finally { setSharing(false); }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" });
      const pageW=210, pageH=297, margin=20, contentW=170;
      let y = margin;
      const addPage = () => { doc.addPage(); y = margin; };
      const checkPage = (n=20) => { if (y+n > pageH-margin) addPage(); };

      // Red header bar
      doc.setFillColor(230,57,70); doc.rect(0,0,pageW,18,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(11); doc.setFont("helvetica","bold");
      doc.text("PENETRATION TEST REPORT", margin, 12);
      doc.setFont("helvetica","normal"); doc.setFontSize(9);
      doc.text("CONFIDENTIAL", pageW-margin, 12, {align:"right"});
      y = 30;

      doc.setTextColor(20,20,20); doc.setFontSize(22); doc.setFont("helvetica","bold");
      doc.text(report.title||"Pentest Report", margin, y); y += 12;

      const meta=[["Tester",report.tester_name||"N/A"],["Target",report.target||"N/A"],
        ["Date",report.date||"N/A"],["Methodology",report.methodology||"N/A"],
        ["Overall Risk",report.risk_rating||"N/A"],["Status",(report.status||"").toUpperCase()]];
      meta.forEach(([label,value],i) => {
        const col = i%2===0 ? margin : margin+contentW/2;
        if (i%2===0 && i>0) y += 7;
        doc.setFont("helvetica","bold"); doc.setTextColor(100,100,100); doc.setFontSize(9);
        doc.text(label+":", col, y+3);
        doc.setFont("helvetica","normal"); doc.setTextColor(30,30,30);
        doc.text(value, col+30, y+3);
      });
      y += 16;
      doc.setDrawColor(220,220,220); doc.line(margin,y,pageW-margin,y); y += 10;

      const secHeader = (t) => {
        checkPage(14); doc.setFillColor(245,245,245); doc.rect(margin,y,contentW,8,"F");
        doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(60,60,60);
        doc.text(t, margin+3, y+5.5); y += 13;
      };
      const addText = (text) => {
        doc.setFont("helvetica","normal"); doc.setFontSize(9); doc.setTextColor(50,50,50);
        const lines = doc.splitTextToSize(text||"N/A", contentW);
        checkPage(lines.length*4); doc.text(lines,margin,y); y += lines.length*4+4;
      };

      if (report.scope) { secHeader("SCOPE"); addText(report.scope); }
      if (report.executive_summary) { secHeader("EXECUTIVE SUMMARY"); addText(report.executive_summary); }

      if (report.findings?.length > 0) {
        secHeader(`TECHNICAL FINDINGS (${report.findings.length})`);
        report.findings.forEach((f,i) => {
          checkPage(30);
          const hex = riskColor[f.severity]||"#888";
          const rgb = [parseInt(hex.slice(1,3),16),parseInt(hex.slice(3,5),16),parseInt(hex.slice(5,7),16)];
          doc.setFillColor(250,250,250); doc.setDrawColor(...rgb); doc.setLineWidth(0.5);
          doc.rect(margin,y,contentW,8,"FD");
          doc.setFont("helvetica","bold"); doc.setFontSize(10); doc.setTextColor(30,30,30);
          doc.text(`Finding #${i+1}: ${f.title||"Untitled"}`, margin+3, y+5.5);
          doc.setFillColor(...rgb); doc.rect(pageW-margin-22,y+1,20,6,"F");
          doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(255,255,255);
          doc.text((f.severity||"N/A").toUpperCase(), pageW-margin-12, y+5.5, {align:"center"});
          y += 12;
          [["Type",f.type],["Component",f.affected_component],["CVSS",f.cvss],
           ["Description",f.description],["Evidence",f.evidence],["Impact",f.impact]
          ].forEach(([label,val]) => {
            if (!val) return; checkPage(12);
            doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(100,100,100);
            doc.text(label+":", margin+2, y);
            doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
            const lines = doc.splitTextToSize(val,contentW-4);
            doc.text(lines,margin+2,y+4); y += lines.length*4+6;
          });
          // Kill chain in PDF
          const kc = f.kill_chain||{};
          const kcItems = KILL_CHAIN_LABELS.filter(([key])=>kc[key]);
          if (kcItems.length > 0) {
            checkPage(10);
            doc.setFont("helvetica","bold"); doc.setFontSize(8); doc.setTextColor(192,57,43);
            doc.text("Kill Chain:", margin+2, y); y += 5;
            kcItems.forEach(([key,label],ci) => {
              checkPage(8);
              doc.setFont("helvetica","bold"); doc.setFontSize(7); doc.setTextColor(100,100,100);
              doc.text(`${ci+1}. ${label}:`, margin+6, y);
              doc.setFont("helvetica","normal"); doc.setTextColor(40,40,40);
              const lines = doc.splitTextToSize(kc[key],contentW-14);
              doc.text(lines,margin+6,y+4); y += lines.length*4+4;
            });
          }
          y += 4; doc.setDrawColor(220,220,220); doc.line(margin,y,pageW-margin,y); y += 8;
        });
      }

      if (report.remediation) { secHeader("REMEDIATION"); addText(report.remediation); }
      doc.setFontSize(8); doc.setTextColor(150,150,150);
      doc.text("Generated by RedReport", margin, pageH-10);
      doc.text(`Page ${doc.getNumberOfPages()}`, pageW-margin, pageH-10, {align:"right"});
      doc.save(`pentest-${report.title?.replace(/\s+/g,"-").toLowerCase()||"report"}.pdf`);
    } catch(e) { alert("PDF export failed."); }
    finally { setExporting(false); }
  };

  const exportDocx = async () => {
    setExportingDocx(true);
    try {
      const res = await api.exportDocx(id);
      const url = window.URL.createObjectURL(new Blob([res.data],
        {type:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}));
      const a = document.createElement("a"); a.href=url;
      a.download = `pentest-${report.title?.replace(/\s+/g,"-").toLowerCase()||"report"}.docx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch(e) { alert("DOCX export failed. Make sure Node.js is installed and the backend docx package is set up."); }
    finally { setExportingDocx(false); }
  };

  if (loading) return (
    <div className="view-page">
      <header className="view-header no-print">
        <div className="view-header-left">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/dashboard")}>← Dashboard</button>
        </div>
      </header>
      <ReportSkeleton />
    </div>
  );

  if (!report) return (
    <div className="view-page loading-view">
      <p>Report not found. <button className="link-btn" onClick={() => navigate("/dashboard")}>Go back</button></p>
    </div>
  );

  const imageUploads = uploads.filter(u => u.mimetype?.startsWith("image/"));
  const otherUploads = uploads.filter(u => !u.mimetype?.startsWith("image/"));

  return (
    <div className="view-page">
      <header className="view-header no-print">
        <div className="view-header-left">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/dashboard")}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
            </svg>
            Dashboard
          </button>
          <h1 className="view-page-title">{report.title}</h1>
          <span className={`badge badge-${report.risk_rating?.toLowerCase()}`}>{report.risk_rating}</span>
          <span className={`status-${report.status}`} style={{fontSize:"12px",fontWeight:600}}>
            {report.status==="final"?"Final":"Draft"}
          </span>
        </div>
        <div className="view-header-actions">
          <button className="btn btn-secondary btn-sm" onClick={handleShare} disabled={sharing}>
            {sharing ? <span className="spinner"></span> : (
              report.share_token ? "Unshare" : (
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
                </svg>
              )
            )}
            {report.share_token ? "Unshare" : "Share"}
          </button>
          {report.share_token && (
            <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(shareUrl); alert("Link copied!"); }}>
              Copy Link
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}>Print</button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/report/${id}/edit`)}>Edit</button>
          <button className="btn btn-secondary btn-sm" onClick={exportDocx} disabled={exportingDocx}>
            {exportingDocx ? <><span className="spinner"></span> Exporting...</> : "Export DOCX"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={exportPDF} disabled={exporting}>
            {exporting ? <><span className="spinner"></span> Exporting...</> : "Export PDF"}
          </button>
        </div>
      </header>

      <div className="view-body" ref={reportRef}>

        {/* Print-only header */}
        <div className="print-header">
          <div className="print-top-bar">
            <span>PENETRATION TEST REPORT</span>
            <span>CONFIDENTIAL</span>
          </div>
          <h1 className="print-title">{report.title}</h1>
          <div className="print-meta-row">
            {report.tester_name && <span>Tester: <strong>{report.tester_name}</strong></span>}
            {report.date && <span>Date: <strong>{report.date}</strong></span>}
            {report.risk_rating && <span>Overall Risk: <strong>{report.risk_rating}</strong></span>}
          </div>
          <hr className="print-rule"/>
        </div>

        {/* Meta grid */}
        <div className="view-meta-grid">
          {[["Tester",report.tester_name],["Target",report.target],["Date",report.date],["Methodology",report.methodology]]
            .filter(([,v])=>v).map(([label,value]) => (
              <div key={label} className="meta-item">
                <div className="meta-label">{label}</div>
                <div className="meta-value">{value}</div>
              </div>
            ))}
        </div>

        {/* Severity chart */}
        {report.findings?.length > 0 && (() => {
          const counts = {Critical:0,High:0,Medium:0,Low:0,Info:0};
          report.findings.forEach(f => { if (counts[f.severity]!==undefined) counts[f.severity]++; });
          return (
            <div className="severity-chart">
              {Object.entries(counts).map(([sev,count]) => (
                <div key={sev} className="sev-bar-item">
                  <div className="sev-bar-count" style={{color:riskColor[sev]}}>{count}</div>
                  <div className="sev-bar-label">{sev}</div>
                </div>
              ))}
            </div>
          );
        })()}

        {report.scope && <div className="view-section"><h2 className="section-title">Scope</h2><p className="section-content">{report.scope}</p></div>}
        {report.executive_summary && <div className="view-section"><h2 className="section-title">Executive Summary</h2><p className="section-content">{report.executive_summary}</p></div>}

        {/* Findings with kill chain */}
        {report.findings?.length > 0 && (
          <div className="view-section">
            <h2 className="section-title">Technical Findings <span className="section-count no-print">{report.findings.length}</span></h2>
            {report.findings.map((f,i) => (
              <div key={i} className="finding-view-card" style={{"--sev-color":riskColor[f.severity]||"#888"}}>
                <div className="finding-view-header">
                  <div className="finding-view-title">
                    <span className="finding-idx">#{i+1}</span>
                    <span>{f.title||"Untitled"}</span>
                  </div>
                  <div className="flex-center gap-2">
                    {f.cvss && <span className="cvss-badge">CVSS {f.cvss}</span>}
                    <span className={`badge badge-${f.severity?.toLowerCase()}`}>{f.severity}</span>
                  </div>
                </div>
                <div className="finding-view-body">
                  {f.type && <div className="fv-row"><span className="fv-label">Type</span><span className="fv-value">{f.type}</span></div>}
                  {f.affected_component && <div className="fv-row"><span className="fv-label">Component</span><code className="fv-code">{f.affected_component}</code></div>}
                  {f.description && <div className="fv-row fv-block"><span className="fv-label">Description</span><p className="fv-value">{f.description}</p></div>}
                  {f.evidence && <div className="fv-row fv-block"><span className="fv-label">Evidence</span><p className="fv-value fv-evidence">{f.evidence}</p></div>}
                  {f.impact && <div className="fv-row fv-block"><span className="fv-label">Impact</span><p className="fv-value">{f.impact}</p></div>}

                  {/* Kill chain display */}
                  {f.kill_chain && KILL_CHAIN_LABELS.some(([key]) => f.kill_chain[key]) && (
                    <div className="fv-row fv-block">
                      <span className="fv-label">Kill Chain</span>
                      <div className="kill-chain-view">
                        {KILL_CHAIN_LABELS.filter(([key]) => f.kill_chain[key]).map(([key,label],ci,arr) => (
                          <React.Fragment key={key}>
                            <div className="kcv-step">
                              <div className="kcv-num">{ci+1}</div>
                              <div className="kcv-content">
                                <div className="kcv-label">{label}</div>
                                <div className="kcv-value">{f.kill_chain[key]}</div>
                              </div>
                            </div>
                            {ci < arr.length-1 && <div className="kcv-arrow">↓</div>}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {report.remediation && <div className="view-section"><h2 className="section-title">Remediation Recommendations</h2><p className="section-content">{report.remediation}</p></div>}

        {/* Evidence screenshots */}
        {uploads.length > 0 && (
          <div className="view-section no-print">
            <h2 className="section-title">Evidence Files <span className="section-count">{uploads.length}</span></h2>
            {imageUploads.length > 0 && (
              <div className="evidence-grid">
                {imageUploads.map(file => (
                  <div key={file.id} className="evidence-card">
                    <img src={`http://localhost:5000${file.url}`} alt={file.original_name} className="evidence-img"
                      onClick={() => window.open(`http://localhost:5000${file.url}`,"_blank")}/>
                    <div className="evidence-name">{file.original_name}</div>
                  </div>
                ))}
              </div>
            )}
            {otherUploads.length > 0 && (
              <div className="other-uploads">
                {otherUploads.map(file => (
                  <a key={file.id} href={`http://localhost:5000${file.url}`} target="_blank" rel="noreferrer" className="other-upload-item">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                    </svg>
                    {file.original_name}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Share status */}
        {report.share_token && (
          <div className="share-status-bar no-print">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/>
            </svg>
            <span>This report is publicly shared.</span>
            <a href={shareUrl} target="_blank" rel="noreferrer" className="link-btn">{shareUrl}</a>
          </div>
        )}

        {/* Print footer */}
        <div className="print-footer">
          <span>Generated by RedReport</span>
          <span>CONFIDENTIAL</span>
        </div>
      </div>
    </div>
  );
}
