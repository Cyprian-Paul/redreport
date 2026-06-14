import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as api from "../api";
import { DashboardSkeleton } from "../components/Skeleton";
import "./Dashboard.css";

const riskOrder = ["Critical","High","Medium","Low","Info"];
const riskColors = { Critical:"#e63946", High:"#f39c12", Medium:"#3498db", Low:"#2ecc71", Info:"#888" };

function RiskChart({ reports }) {
  const counts = { Critical:0, High:0, Medium:0, Low:0, Info:0 };
  reports.forEach(r => { if (counts[r.risk_rating]!==undefined) counts[r.risk_rating]++; });
  const max = Math.max(...Object.values(counts), 1);
  return (
    <div className="risk-chart-card">
      <div className="risk-chart-title">Risk Distribution</div>
      <div className="risk-chart-bars">
        {riskOrder.map(sev => (
          <div key={sev} className="risk-bar-wrap">
            <div className="risk-bar-track">
              <div className="risk-bar-fill" style={{
                height: `${(counts[sev]/max)*100}%`,
                background: riskColors[sev],
                minHeight: counts[sev]>0 ? "4px" : "0"
              }}/>
            </div>
            <div className="risk-bar-count" style={{color:riskColors[sev]}}>{counts[sev]}</div>
            <div className="risk-bar-label">{sev.slice(0,4)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRisk, setFilterRisk] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  

useEffect(() => { fetchReports(); }, [search, filterRisk, filterStatus, sort]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchReports = async () => {
    try {
      const res = await api.getReports({ search, risk: filterRisk, status: filterStatus, sort });
      setReports(res.data);
    } catch {} finally { setLoading(false); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this report?")) return;
    await api.deleteReport(id);
    setReports(reports.filter(r => r.id !== id));
  };

  const handleDuplicate = async (id, e) => {
    e.stopPropagation();
    const res = await api.duplicateReport(id);
    navigate(`/report/${res.data.id}/edit`);
  };

  const handleShare = async (id, e) => {
    e.stopPropagation();
    const res = await api.toggleShare(id);
    if (res.data.share_token) {
      const url = `${window.location.origin}/shared/${res.data.share_token}`;
      navigator.clipboard.writeText(url).catch(() => {});
      alert(`Share link copied:\n${url}`);
    } else {
      alert("Share link removed.");
    }
    fetchReports();
  };

  const stats = {
    total: reports.length,
    critical: reports.filter(r => r.risk_rating === "Critical").length,
    final: reports.filter(r => r.status === "final").length,
    draft: reports.filter(r => r.status === "draft").length,
  };

  const riskBadge = r => ({Critical:"critical",High:"high",Medium:"medium",Low:"low",Info:"info"}[r]||"info");

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-brand" onClick={() => navigate("/dashboard")} style={{cursor:"pointer"}}>
          <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
            <path d="M16 2L4 8v8c0 7.18 5.16 13.9 12 15.93C22.84 29.9 28 23.18 28 16V8L16 2z" fill="#e63946"/>
            <path d="M13 16l2 2 4-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="brand-name">RedReport</span>
        </div>
        <div className="dash-user">
          <span className="user-greeting">Welcome, <strong>{user?.username}</strong></span>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate("/profile")}>Profile</button>
          <button className="btn btn-secondary btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-top">
          <div>
            <h2 className="dash-title">Pentest Reports</h2>
            <p className="dash-subtitle">Manage and track all your security findings</p>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/report/new")}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            New Report
          </button>
        </div>

        {loading ? <DashboardSkeleton /> : (
          <>
            <div className="dash-overview">
              <div className="stats-grid">
                <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total Reports</div></div>
                <div className="stat-card stat-card-red"><div className="stat-value text-red">{stats.critical}</div><div className="stat-label">Critical</div></div>
                <div className="stat-card"><div className="stat-value" style={{color:"#2ecc71"}}>{stats.final}</div><div className="stat-label">Final</div></div>
                <div className="stat-card"><div className="stat-value" style={{color:"#888"}}>{stats.draft}</div><div className="stat-label">Drafts</div></div>
              </div>
              {reports.length > 0 && <RiskChart reports={reports} />}
            </div>

            <div className="filters-row">
              <div className="search-wrap">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" className="search-icon">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"/>
                </svg>
                <input className="search-input" placeholder="Search by title or target..." value={search} onChange={e => setSearch(e.target.value)}/>
              </div>
              <select className="filter-select" value={filterRisk} onChange={e => setFilterRisk(e.target.value)}>
                <option value="">All Risk Levels</option>
                {riskOrder.map(r => <option key={r}>{r}</option>)}
              </select>
              <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="final">Final</option>
              </select>
              <select className="filter-select" value={sort} onChange={e => setSort(e.target.value)}>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="risk">By Risk Level</option>
                <option value="title">By Title</option>
              </select>
              {(search || filterRisk || filterStatus) && (
                <button className="btn btn-ghost btn-sm" onClick={() => { setSearch(""); setFilterRisk(""); setFilterStatus(""); }}>Clear</button>
              )}
            </div>

            {reports.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">
                  <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                  </svg>
                </div>
                <h3>No reports found</h3>
                <p>{search||filterRisk||filterStatus ? "Try adjusting your filters" : "Create your first pentest report"}</p>
                {!search && !filterRisk && !filterStatus && (
                  <button className="btn btn-primary mt-2" onClick={() => navigate("/report/new")}>Create First Report</button>
                )}
              </div>
            ) : (
              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>Report Title</th>
                      <th>Target</th>
                      <th>Date</th>
                      <th>Risk</th>
                      <th>Status</th>
                      <th>Shared</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(report => (
                      <tr key={report.id} onClick={() => navigate(`/report/${report.id}`)} className="report-row">
                        <td className="report-title-cell">{report.title}</td>
                        <td className="text-muted">{report.target||"N/A"}</td>
                        <td className="text-muted">{report.date||"N/A"}</td>
                        <td><span className={`badge badge-${riskBadge(report.risk_rating)}`}>{report.risk_rating||"N/A"}</span></td>
                        <td><span className={`status-${report.status}`} style={{fontSize:"12px",fontWeight:600}}>{report.status==="final"?"Final":"Draft"}</span></td>
                        <td>{report.share_token
                          ? <span style={{color:"#2ecc71",fontSize:"12px",fontWeight:600}}>Public</span>
                          : <span style={{color:"#555",fontSize:"12px"}}>Private</span>}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <div className="action-btns">
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/report/${report.id}`)}>View</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/report/${report.id}/edit`)}>Edit</button>
                            <button className="btn btn-ghost btn-sm" onClick={e => handleDuplicate(report.id,e)}>Copy</button>
                            <button className="btn btn-ghost btn-sm" onClick={e => handleShare(report.id,e)}>{report.share_token?"Unshare":"Share"}</button>
                            <button className="btn btn-danger btn-sm" onClick={e => handleDelete(report.id,e)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
