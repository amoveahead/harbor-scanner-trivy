import { useState } from "react";
import { get, type ScanView } from "./api";
import { Badge, ErrorBox, formatTime, Section, Summary, useData } from "./common";
import { Icon } from "./icons";

const severityTones: Record<string, string> = {
  CRITICAL: "danger",
  HIGH: "warning",
  MEDIUM: "info",
  LOW: "secondary",
  UNKNOWN: "secondary",
};

// ScanDetail is GET /api/v2/scans/{id}; queued and scanning scans refresh
// every 5 s. Findings exist only when the state is done.
export function ScanDetail({ id, onBack, onUnauthorized }: { id: string; onBack: () => void; onUnauthorized: () => void }) {
  const [search, setSearch] = useState("");
  const { data, error, loading } = useData(() => get<ScanView>(`/api/v2/scans/${id}`, [404]), [id], 5);

  const back = (
    <p className="back">
      <button type="button" className="btn btn-secondary" onClick={onBack}>
        <Icon name="arrow-left" />
        <span>Back to scans</span>
      </button>
    </p>
  );
  if (error) {
    return (
      <>
        {back}
        <ErrorBox error={error} onUnauthorized={onUnauthorized} />
      </>
    );
  }
  if (!data) {
    return (
      <>
        {back}
        <p className="muted">{loading ? "Loading..." : "No data."}</p>
      </>
    );
  }

  const findings = (data.vulnerabilities ?? []).filter((finding) =>
    `${finding.id} ${finding.package} ${finding.type} ${finding.severity}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      {back}
      <Section title="Scan" flush>
        <table className="table facts">
          <tbody>
            <tr>
              <th>scan_id</th>
              <td className="mono">{data.scan_id ?? id}</td>
            </tr>
            <tr>
              <th>State</th>
              <td>
                <Badge value={data.state} />
              </td>
            </tr>
            {data.image && (
              <tr>
                <th>Image</th>
                <td className="mono">
                  {data.image.repository}/{data.image.name}:{data.image.tag} @ {data.image.digest}
                </td>
              </tr>
            )}
            {data.db && (
              <tr>
                <th>DB</th>
                <td>
                  <Badge value={data.db.freshness} /> built {formatTime(data.db.updated_at)}, result confirmed{" "}
                  {formatTime(data.db.confirmed_at)}, last upstream check {formatTime(data.db.last_upstream_check_at)}
                </td>
              </tr>
            )}
            {data.timing && (
              <tr>
                <th>Timing</th>
                <td>
                  queued {data.timing.queue_wait_ms} ms, scan {data.timing.scan_ms} ms, total {data.timing.total_ms} ms
                </td>
              </tr>
            )}
            {data.customer_ids && (
              <tr>
                <th>Customers</th>
                <td>
                  {data.customer_ids.join(", ")}
                  {data.request_id && <span className="muted"> (request {data.request_id})</span>}
                </td>
              </tr>
            )}
            {data.error && (
              <tr>
                <th>Failure</th>
                <td>
                  <span className="mono">{data.error.class}</span>: {data.error.message}
                </td>
              </tr>
            )}
            {data.previous && (
              <tr>
                <th>Previous result</th>
                <td>
                  <Summary counts={data.previous.summary} /> for {data.previous.digest}, confirmed{" "}
                  {formatTime(data.previous.confirmed_at)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Section>

      {data.state === "done" && (
        <>
          <Section title="Result">
            <p>
              <Summary counts={data.summary} />
              {data.truncated && <span className="warn-text"> (findings truncated)</span>}
            </p>
            <p className="small muted">
              Platforms found: {(data.platforms_found ?? []).join(", ") || "-"}; not in the image:{" "}
              {(data.platforms_not_found ?? []).join(", ") || "-"}; severities: {(data.severity ?? []).join(", ")}
              {data.has_more_platforms && "; the image has more platform types"}
            </p>
          </Section>

          <Section
            title="Findings"
            aside={`${findings.length} of ${data.vulnerabilities?.length ?? 0}`}
            actions={
              <div className="custom-input-wrapper">
                <input
                  className="custom-input-field"
                  placeholder="Search ID, package, type"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            }
            flush
          >
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>ID</th>
                    <th>Package</th>
                    <th>Installed</th>
                    <th>Fixed</th>
                    <th>Type</th>
                    <th>Target</th>
                    <th>Title</th>
                  </tr>
                </thead>
                <tbody>
                  {findings.map((finding, index) => (
                    <tr key={`${finding.id}-${finding.package}-${index}`}>
                      <td>
                        <Badge value={finding.severity} tone={severityTones[finding.severity] ?? "secondary"} />
                      </td>
                      <td className="mono nowrap">
                        {finding.primary_url ? (
                          <a href={finding.primary_url} target="_blank" rel="noreferrer">
                            {finding.id}
                          </a>
                        ) : (
                          finding.id
                        )}
                      </td>
                      <td>{finding.package}</td>
                      <td className="mono">{finding.installed_version}</td>
                      <td className="mono">{finding.fixed_version ?? "-"}</td>
                      <td>{finding.type}</td>
                      <td className="small">{finding.target}</td>
                      <td className="small">{finding.title ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {findings.length === 0 && <p className="empty">No findings.</p>}
          </Section>
        </>
      )}
    </>
  );
}
