import type { DBView } from "./api";
import { Badge, formatNanos, formatTime } from "./common";

// DBTable shows the DB states of one instance.
export function DBTable({ dbs }: { dbs: DBView[] }) {
  if (dbs.length === 0) {
    return <p className="empty">No DB state.</p>;
  }
  return (
    <div className="table-responsive">
      <table className="table">
        <thead>
          <tr>
            <th>DB</th>
            <th>Mode</th>
            <th>Freshness</th>
            <th>Updated (DB build)</th>
            <th>Age</th>
            <th>Confirmed current</th>
            <th>Newer available</th>
            <th>Active source</th>
            <th>Last sources</th>
          </tr>
        </thead>
        <tbody>
          {dbs.map((db) => (
            <tr key={db.kind}>
              <td className="nowrap">{db.kind}</td>
              <td>
                <Badge value={db.mode || "-"} />
              </td>
              <td>
                <Badge value={db.freshness} />
              </td>
              <td className="nowrap">{formatTime(db.updated_at)}</td>
              <td>{db.db_age ?? "-"}</td>
              <td className="nowrap">{formatTime(db.last_confirmed_current_at)}</td>
              <td>{db.newer_available ? <Badge value="yes" tone="warning" /> : "no"}</td>
              <td className="mono nowrap">{db.active_source ?? "-"}</td>
              <td className="nowrap">
                {db.last_sources.map((source) => (
                  <div key={source.source} className="mono small">
                    {source.installed ? "installed" : source.failure_class ? source.failure_class : source.answered ? "answered" : "-"}
                    {" · "}
                    {source.source} ({formatNanos(source.precheck.duration)})
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
