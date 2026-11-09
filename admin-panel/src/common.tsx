import { useEffect, useState, type ReactNode } from "react";
import { ApiError } from "./api";

// formatTime shows an ISO time in the browser's time zone; "-" when missing.
export function formatTime(value?: string): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleString();
}

// formatSeconds shows a duration such as "3m 20s".
export function formatSeconds(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${Math.round(seconds % 60)}s`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// formatNanos shows a Go duration (nanoseconds in JSON) in milliseconds.
export function formatNanos(nanos: number): string {
  return `${Math.round(nanos / 1e6)} ms`;
}

export function shortDigest(digest?: string): string {
  return digest ? digest.replace("sha256:", "").slice(0, 12) : "-";
}

// tones map states to the hospital badge colours.
const tones: Record<string, string> = {
  ok: "success",
  normal: "success",
  done: "success",
  degraded: "warning",
  stale: "warning",
  queued: "info",
  scanning: "info",
  unhealthy: "danger",
  failed: "danger",
};

// Badge is a state as a coloured pill; tone overrides the colour.
export function Badge({ value, tone }: { value?: string | number; tone?: string }) {
  return <span className={`badge badge-${tone ?? tones[String(value ?? "")] ?? "secondary"}`}>{value ?? "-"}</span>;
}

const severities = ["critical", "high", "medium", "low", "unknown"];

// Summary shows counts per severity, highest first.
export function Summary({ counts }: { counts?: Record<string, number> }) {
  if (!counts) {
    return <span>-</span>;
  }
  return (
    <span className="summary">
      {severities.map((severity) => (
        <span key={severity} className={`sev sev-${severity} ${counts[severity] ? "" : "zero"}`} title={severity}>
          <span className="sev-letter">{severity[0].toUpperCase()}</span>
          <span className="num">{counts[severity] ?? 0}</span>
        </span>
      ))}
    </span>
  );
}

// useData loads with fetcher when deps change, and again every refreshSeconds
// when given.
export function useData<T>(fetcher: () => Promise<T>, deps: unknown[], refreshSeconds?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [...deps, tick]);

  useEffect(() => {
    if (!refreshSeconds) {
      return;
    }
    const timer = setInterval(() => setTick((value) => value + 1), refreshSeconds * 1000);
    return () => clearInterval(timer);
  }, [refreshSeconds]);

  return { data, error, loading, reload: () => setTick((value) => value + 1) };
}

// ErrorBox shows an API error; a 401 asks to sign in again.
export function ErrorBox({ error, onUnauthorized }: { error: Error; onUnauthorized: () => void }) {
  const unauthorized = error instanceof ApiError && error.status === 401;
  return (
    <div className="alert alert-danger">
      <strong className="mono">{error instanceof ApiError ? `${error.status} ${error.code}` : "Error"}</strong>
      <span>{error.message}</span>
      {unauthorized && (
        <button type="button" className="btn btn-secondary" onClick={onUnauthorized}>
          Sign in again
        </button>
      )}
    </div>
  );
}

// Section is a hospital card: a header bar with the title (and a note or
// buttons) over a body. flush drops the body padding, for tables.
export function Section({
  title,
  aside,
  actions,
  flush,
  children,
}: {
  title: string;
  aside?: string;
  actions?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-header-title">
          <h6>{title}</h6>
          {aside && <span className="card-note">{aside}</span>}
        </div>
        {actions && <div className="card-header-buttons">{actions}</div>}
      </div>
      <div className={flush ? "card-body card-body--flush" : "card-body"}>{children}</div>
    </div>
  );
}
