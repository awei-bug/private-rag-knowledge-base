import { type ReactNode } from "react";

import { type Notice } from "./state";

export function PageHeader({
  eyebrow,
  title,
  description,
  error,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  error?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="page-header-side">
        {actions ? <div className="page-header-actions">{actions}</div> : null}
        {error ? <div className="error-banner">{error}</div> : null}
      </div>
    </header>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  accent = "teal",
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
  accent?: "teal" | "amber" | "slate";
}) {
  return (
    <section className={`panel panel-${accent}`}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning";
  hint?: string;
}) {
  return (
    <div className={`metric-card metric-card-${tone}`}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {hint ? <p className="metric-hint">{hint}</p> : null}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "accent";
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

export function ToastStack({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack">
      {notices.map((notice) => (
        <div key={notice.id} className={`toast toast-${notice.kind}`}>
          {notice.message}
        </div>
      ))}
    </div>
  );
}
