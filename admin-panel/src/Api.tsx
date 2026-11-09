import { useState, type FormEvent } from "react";
import { request, type RawResponse } from "./api";
import { Badge, Section, useData } from "./common";
import { Icon } from "./icons";

interface Endpoint {
  method: "GET" | "POST";
  path: string;
  auth: "token" | "none";
  description: string;
  // example is put into the console when the endpoint is picked.
  example?: { path?: string; body?: string };
}

const scanBody = JSON.stringify(
  {
    request_id: "manual-check-1",
    image: { repository: "library", name: "alpine", tag: "3.20" },
    customer_ids: ["admin-panel"],
    platforms: ["alpine"],
    severity: ["HIGH", "CRITICAL"],
    max_db_age: "6h",
    force: false,
  },
  null,
  2,
);

const groups: { title: string; note: string; endpoints: Endpoint[] }[] = [
  {
    title: "Direct scan API",
    note: "Bearer token (SCANNER_V2_AUTH_TOKEN). Errors are {\"error\": {\"code\", \"message\"}}.",
    endpoints: [
      {
        method: "POST",
        path: "/api/v2/scans",
        auth: "token",
        description: "Scan an image tag, or answer from the cache. 202 queued, 200 cached or already running, 409 another scan of the tag, 429 busy, 503 not ready.",
        example: { body: scanBody },
      },
      {
        method: "GET",
        path: "/api/v2/scans/{scan_id}",
        auth: "token",
        description: "State of a tag's scan; the result when done. Optional ?platforms= and ?severity= filter the view. Retry-After while queued or scanning.",
        example: { path: "/api/v2/scans/" },
      },
      {
        method: "GET",
        path: "/api/v2/scans",
        auth: "token",
        description: "Scans, newest first. Filters: customer_id, digest, repository, name, state, platform, request_id, from, to; limit (max 200) and cursor.",
        example: { path: "/api/v2/scans?limit=10" },
      },
      {
        method: "GET",
        path: "/api/v2/db",
        auth: "token",
        description: "Vulnerability DB state of every instance: mode, age, freshness, last check of each source.",
      },
      {
        method: "GET",
        path: "/api/v2/health",
        auth: "token",
        description: "ok, degraded or unhealthy (503), with the checks behind it, the queue and the recent scans.",
      },
    ],
  },
  {
    title: "Probes",
    note: "No token. Used by Docker healthchecks and orchestrators.",
    endpoints: [
      { method: "GET", path: "/probe/healthy", auth: "none", description: "Liveness: the process answers." },
      {
        method: "GET",
        path: "/probe/ready",
        auth: "none",
        description: "Readiness: MongoDB, schema, Trivy DB, Java DB when configured, trivy binary, not shutting down.",
      },
    ],
  },
  {
    title: "Harbor adapter",
    note: "Called by Harbor, which registers the scanner. Unchanged from upstream.",
    endpoints: [
      { method: "GET", path: "/api/v1/metadata", auth: "none", description: "Scanner name, version and capabilities." },
      { method: "POST", path: "/api/v1/scan", auth: "none", description: "Harbor's scan request (registry, credentials, artifact)." },
      { method: "GET", path: "/api/v1/scan/{id}/report", auth: "none", description: "The report of a Harbor scan (302 while running)." },
    ],
  },
];

const errorCodes: [string, string, string][] = [
  ["invalid_request", "400 413 415", "Bad input, body too large or not JSON"],
  ["unauthorized", "401", "Missing or wrong token"],
  ["image_not_found", "404", "The tag is not in the registry"],
  ["scan_in_progress", "409", "Another scan of this tag is running (Retry-After 5)"],
  ["queue_full", "429", "Too many queued scans (Retry-After)"],
  ["too_many_requests", "429", "Too many POSTs at once (Retry-After 1)"],
  ["registry_auth_failed", "502", "The registry refused the robot account"],
  ["registry_unavailable", "503", "The registry did not answer (Retry-After)"],
  ["not_ready", "503", "Starting up, no DB yet, or shutting down"],
  ["store_unavailable", "503", "MongoDB is down"],
  ["internal", "500", "Unexpected error (details only in the scanner's log)"],
];

// Api lists the endpoints and has a console to call them.
export function Api() {
  const healthy = useData(() => request("GET", "/probe/healthy"), [], 10);
  const ready = useData(() => request("GET", "/probe/ready"), [], 10);

  const [method, setMethod] = useState<"GET" | "POST">("GET");
  const [path, setPath] = useState("/api/v2/health");
  const [body, setBody] = useState("");
  const [answer, setAnswer] = useState<RawResponse | null>(null);
  const [failure, setFailure] = useState("");
  const [sending, setSending] = useState(false);

  function pick(endpoint: Endpoint) {
    setMethod(endpoint.method);
    setPath(endpoint.example?.path ?? endpoint.path);
    setBody(endpoint.method === "POST" ? (endpoint.example?.body ?? "{}") : "");
    setAnswer(null);
    setFailure("");
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setFailure("");
    try {
      setAnswer(await request(method, path, method === "POST" ? body : undefined));
    } catch (err) {
      setAnswer(null);
      setFailure((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="patient-summary">
        <Probe name="/probe/healthy" status={healthy.data?.status} />
        <Probe name="/probe/ready" status={ready.data?.status} detail={ready.data && ready.data.status !== 200 ? ready.data.body : ""} />
        <p className="summary-note">One replica answers each call; refreshed every 10 s.</p>
      </div>

      {groups.map((group) => (
        <Section key={group.title} title={group.title} aside={group.note} flush>
          <div className="table-responsive">
            <table className="table clickable">
              <tbody>
                {group.endpoints.map((endpoint) => (
                  <tr key={endpoint.method + endpoint.path} onClick={() => pick(endpoint)} title="Load into the console">
                    <td className="method-cell">
                      <Badge value={endpoint.method} tone={endpoint.method === "GET" ? "success" : "info"} />
                    </td>
                    <td className="mono path-cell">{endpoint.path}</td>
                    <td className="auth-cell small muted">{endpoint.auth === "token" ? "token" : "open"}</td>
                    <td>{endpoint.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ))}

      <Section title="Console" aside="Sends the request with your token from this page. Pick an endpoint above to fill it in.">
        <form onSubmit={send}>
          <div className="console-line">
            <div className="custom-input-wrapper method-select">
              <select
                className="custom-input-field"
                aria-label="Method"
                value={method}
                onChange={(e) => setMethod(e.target.value as "GET" | "POST")}
              >
                <option>GET</option>
                <option>POST</option>
              </select>
            </div>
            <div className="custom-input-wrapper grow">
              <input
                className="custom-input-field mono"
                aria-label="Path"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                spellCheck={false}
              />
            </div>
            <button type="submit" className="btn btn-primary" disabled={sending || !path.startsWith("/")}>
              <Icon name="send" />
              <span>{sending ? "Sending" : "Send"}</span>
            </button>
          </div>
          {method === "POST" && (
            <div className="custom-input-wrapper">
              <textarea
                className="custom-input-field custom-textarea mono"
                aria-label="Body"
                rows={12}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                spellCheck={false}
              />
            </div>
          )}
        </form>
        {failure && <div className="alert alert-danger">{failure}</div>}
        {answer && <Answer answer={answer} />}
      </Section>

      <Section title="Error codes" aside="The code field of every v2 error" flush>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>HTTP</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {errorCodes.map(([code, http, meaning]) => (
                <tr key={code}>
                  <td className="mono">{code}</td>
                  <td className="num">{http}</td>
                  <td>{meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

// statusTone colours an HTTP status.
function statusTone(status: number): string {
  return status < 300 ? "success" : status < 500 ? "warning" : "danger";
}

function Probe({ name, status, detail }: { name: string; status?: number; detail?: string }) {
  return (
    <div className="summary-item" title={detail}>
      <strong className="mono">{name}</strong>
      {status === undefined ? <span className="muted">...</span> : <Badge value={status} tone={statusTone(status)} />}
    </div>
  );
}

function Answer({ answer }: { answer: RawResponse }) {
  let pretty = answer.body;
  try {
    pretty = JSON.stringify(JSON.parse(answer.body), null, 2);
  } catch {
    // not JSON: shown as it came
  }
  return (
    <div className="answer">
      <div className="answer-head">
        <Badge value={answer.status} tone={statusTone(answer.status)} />
        <span className="muted">{answer.statusText}</span>
        <span className="muted num">{answer.millis} ms</span>
        {Object.entries(answer.headers).map(([name, value]) => (
          <span key={name} className="mono muted">
            {name}: {value}
          </span>
        ))}
      </div>
      <pre className="mono">{pretty || "(empty body)"}</pre>
    </div>
  );
}
