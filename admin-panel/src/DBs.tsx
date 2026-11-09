import { get, type DBResponse } from "./api";
import { ErrorBox, formatTime, Section, useData } from "./common";
import { DBTable } from "./dbtable";
import { Icon } from "./icons";

// DBs is GET /api/v2/db: this instance's DBs from memory, the others from MongoDB.
export function DBs({ onUnauthorized }: { onUnauthorized: () => void }) {
  const { data, error, loading, reload } = useData(() => get<DBResponse>("/api/v2/db"), []);

  if (error) {
    return <ErrorBox error={error} onUnauthorized={onUnauthorized} />;
  }
  if (!data) {
    return <p className="muted">{loading ? "Loading..." : "No data."}</p>;
  }
  const refresh = (
    <button type="button" className="btn btn-secondary" onClick={reload}>
      <Icon name="refresh-cw" />
      <span>Refresh</span>
    </button>
  );
  return (
    <>
      <Section title={data.instance_id} aside="answered this request, from memory" actions={refresh} flush>
        <DBTable dbs={data.dbs} />
      </Section>
      {data.other_instances_error && <div className="alert alert-warning">{data.other_instances_error}</div>}
      {data.other_instances.map((instance) => (
        <Section
          key={instance.instance_id}
          title={instance.instance_id}
          aside={`from MongoDB, state written ${formatTime(instance.dbs[0]?.state_updated_at)}`}
          flush
        >
          <DBTable dbs={instance.dbs} />
        </Section>
      ))}
    </>
  );
}
