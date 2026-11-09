import { get, type Health } from "./api";
import { Badge, ErrorBox, formatSeconds, Section, useData } from "./common";
import { DBTable } from "./dbtable";

// Overview is GET /api/v2/health, refreshed every 10 s. The answer comes from
// whichever replica nginx picked; instance_id says which.
export function Overview({ onUnauthorized }: { onUnauthorized: () => void }) {
  // 503 means unhealthy and still carries the full body.
  const { data, error, loading } = useData(() => get<Health>("/api/v2/health", [503]), [], 10);

  if (error) {
    return <ErrorBox error={error} onUnauthorized={onUnauthorized} />;
  }
  if (!data) {
    return <p className="muted">{loading ? "Loading..." : "No data."}</p>;
  }
  return (
    <>
      <div className="patient-summary">
        <div className="summary-item">
          <strong>Status</strong>
          <Badge value={data.status} />
        </div>
        <div className="summary-item">
          <strong>Answered by</strong>
          <span className="mono">{data.instance_id}</span>
        </div>
        {data.queue && (
          <>
            <div className="summary-item">
              <strong>Queued</strong>
              <span className="value num">{data.queue.depth}</span>
            </div>
            <div className="summary-item">
              <strong>Oldest waiting</strong>
              <span className="value num">{formatSeconds(data.queue.oldest_queued_age_seconds)}</span>
            </div>
            <div className="summary-item">
              <strong>Workers here</strong>
              <span className="value num">{data.queue.workers}</span>
            </div>
          </>
        )}
        <div className="summary-item">
          <strong>Last {data.recent_scans.window} scans here</strong>
          <span className="value num">
            {data.recent_scans.done} done, {data.recent_scans.failed} failed
          </span>
        </div>
      </div>
      {!data.queue && <div className="alert alert-warning">Queue figures are not available (MongoDB down).</div>}

      <Section title="Checks" flush>
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {data.checks.map((check) => (
                <tr key={check.name}>
                  <td>{check.name}</td>
                  <td>
                    <Badge value={check.status} />
                  </td>
                  <td>{check.detail ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={`DBs of ${data.instance_id}`} flush>
        <DBTable dbs={data.dbs} />
      </Section>

      {data.other_instances_error && <div className="alert alert-warning">{data.other_instances_error}</div>}
      {data.other_instances.map((instance) => (
        <Section key={instance.instance_id} title={`DBs of ${instance.instance_id}`} aside="from MongoDB" flush>
          <DBTable dbs={instance.dbs} />
        </Section>
      ))}
      {!data.other_instances_error && data.other_instances.length === 0 && (
        <p className="muted">No other instances have written their state.</p>
      )}
    </>
  );
}
