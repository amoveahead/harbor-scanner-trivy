// The scanner's /api/v2, called from the same origin (nginx proxies /api/).

const tokenKey = "scanner-admin-token";

export function getToken(): string {
  return sessionStorage.getItem(tokenKey) ?? "";
}

export function setToken(token: string): void {
  if (token) {
    sessionStorage.setItem(tokenKey, token);
  } else {
    sessionStorage.removeItem(tokenKey);
  }
}

// ApiError carries the scanner's error shape: {"error": {"code", "message"}}.
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// get calls a GET endpoint. Answers that carry their own body (the health check
// answers 503 when unhealthy, an unknown scan 404) are returned, not thrown.
export async function get<T>(path: string, acceptStatus: number[] = []): Promise<T> {
  const response = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } });
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // not JSON (for example an nginx error page)
  }
  if (response.ok || acceptStatus.includes(response.status)) {
    return body as T;
  }
  const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
  throw new ApiError(response.status, error?.code ?? "http_error", error?.message ?? `HTTP ${response.status}`);
}

// Types of the answers (DEMAND section 5).

export interface SourceResult {
  source: string;
  answered: boolean;
  installed: boolean;
  manifest_digest?: string;
  failure_class?: string;
  error?: string;
  precheck: { ok: boolean; failure_class?: string; duration: number; started_at: string };
}

export interface DBView {
  kind: string;
  mode: string;
  version: number;
  updated_at?: string;
  downloaded_at?: string;
  installed_at?: string;
  manifest_digest?: string;
  active_source?: string;
  last_upstream_check_at?: string;
  last_confirmed_current_at?: string;
  newer_available: boolean;
  db_age?: string;
  freshness: string;
  last_sources: SourceResult[];
  state_updated_at?: string;
}

export interface InstanceView {
  instance_id: string;
  dbs: DBView[];
}

export interface Health {
  status: "ok" | "degraded" | "unhealthy";
  instance_id: string;
  checks: { name: string; status: string; detail?: string }[];
  dbs: DBView[];
  queue?: { depth: number; oldest_queued_age_seconds: number; workers: number };
  recent_scans: { window: number; done: number; failed: number };
  other_instances: InstanceView[];
  other_instances_error?: string;
}

export interface DBResponse {
  instance_id: string;
  dbs: DBView[];
  other_instances: InstanceView[];
  other_instances_error?: string;
}

export interface Image {
  repository: string;
  name: string;
  tag: string;
  digest: string;
}

export interface DBBlock {
  updated_at?: string;
  last_upstream_check_at?: string;
  confirmed_at?: string;
  freshness: string;
}

export interface ListItem {
  scan_id: string;
  state: string;
  image: Image;
  created_at: string;
  confirmed_at?: string;
  customer_ids: string[];
  request_id?: string;
  result?: {
    digest: string;
    platforms: string[];
    severity: string[];
    image_platform_types: string[];
    summary: Record<string, number>;
    truncated: boolean;
    db_updated_at: string;
    freshness: string;
  };
  error?: { class: string; message: string };
}

export interface ListResponse {
  items: ListItem[];
  next_cursor?: string;
}

export interface Finding {
  id: string;
  package: string;
  installed_version: string;
  fixed_version?: string;
  severity: string;
  title?: string;
  primary_url?: string;
  status?: string;
  target: string;
  type: string;
}

// ScanView is GET /api/v2/scans/{id}: the result view when done, otherwise the
// state view (with error and previous); not_found has only scan_id and state.
export interface ScanView {
  scan_id?: string;
  state: string;
  image?: Image;
  db?: DBBlock;
  platforms_requested?: string[];
  platforms_found?: string[];
  platforms_not_found?: string[];
  has_more_platforms?: boolean;
  severity?: string[];
  summary?: Record<string, number>;
  truncated?: boolean;
  vulnerabilities?: Finding[];
  timing?: { queue_wait_ms: number; scan_ms: number; total_ms: number };
  customer_ids?: string[];
  customer_data?: Record<string, unknown>;
  request_id?: string;
  error?: { class: string; message: string };
  previous?: { confirmed_at?: string; digest: string; summary: Record<string, number> };
}

// RawResponse is what the API page's request console shows.
export interface RawResponse {
  status: number;
  statusText: string;
  millis: number;
  headers: Record<string, string>;
  body: string;
}

// request sends any request (with the token unless it is a probe) and returns
// the answer as it came, for the request console.
export async function request(method: string, path: string, body?: string): Promise<RawResponse> {
  const headers: Record<string, string> = {};
  if (!path.startsWith("/probe/")) {
    headers.Authorization = `Bearer ${getToken()}`;
  }
  if (body) {
    headers["Content-Type"] = "application/json";
  }
  const start = performance.now();
  const response = await fetch(path, { method, headers, body: body || undefined });
  const text = await response.text();
  const shown: Record<string, string> = {};
  for (const name of ["content-type", "retry-after", "x-request-id", "www-authenticate"]) {
    const value = response.headers.get(name);
    if (value) {
      shown[name] = value;
    }
  }
  return {
    status: response.status,
    statusText: response.statusText,
    millis: Math.round(performance.now() - start),
    headers: shown,
    body: text,
  };
}
