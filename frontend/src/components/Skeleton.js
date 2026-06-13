import React from "react";
import "./Skeleton.css";

export function SkeletonLine({ width="100%", height="14px", style={} }) {
  return <div className="skeleton-line" style={{ width, height, ...style }} />;
}

export function DashboardSkeleton() {
  return (
    <div className="skeleton-wrap">
      <div className="skeleton-stats">
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton-stat-card">
            <SkeletonLine width="50px" height="32px" style={{marginBottom:"8px"}} />
            <SkeletonLine width="70%" height="11px" />
          </div>
        ))}
      </div>
      <div className="skeleton-filters">
        <SkeletonLine width="60%" height="36px" style={{borderRadius:"6px"}} />
        <SkeletonLine width="120px" height="36px" style={{borderRadius:"6px"}} />
        <SkeletonLine width="120px" height="36px" style={{borderRadius:"6px"}} />
      </div>
      {[1,2,3,4,5].map(i => (
        <div key={i} className="skeleton-row">
          <SkeletonLine width="30%" height="14px" />
          <SkeletonLine width="15%" height="14px" />
          <SkeletonLine width="10%" height="14px" />
          <SkeletonLine width="60px" height="22px" style={{borderRadius:"20px"}} />
          <SkeletonLine width="50px" height="14px" />
        </div>
      ))}
    </div>
  );
}

export function ReportSkeleton() {
  return (
    <div className="skeleton-report-wrap">
      <div className="skeleton-meta-grid">
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton-meta-card">
            <SkeletonLine width="50%" height="11px" style={{marginBottom:"8px"}} />
            <SkeletonLine width="75%" height="14px" />
          </div>
        ))}
      </div>
      <SkeletonLine width="25%" height="12px" style={{marginBottom:"12px",marginTop:"32px"}} />
      {[100,90,95,80,70].map((w,i) => (
        <SkeletonLine key={i} width={`${w}%`} height="12px" style={{marginBottom:"8px"}} />
      ))}
      <SkeletonLine width="25%" height="12px" style={{marginBottom:"12px",marginTop:"28px"}} />
      {[100,88,94].map((w,i) => (
        <SkeletonLine key={i} width={`${w}%`} height="12px" style={{marginBottom:"8px"}} />
      ))}
    </div>
  );
}
