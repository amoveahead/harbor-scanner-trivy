import { useState, type FormEvent } from "react";
import { get, type ListResponse } from "./api";
import { Badge, ErrorBox, formatTime, Section, shortDigest, Summary, useData } from "./common";
import { Icon } from "./icons";

const filterNames = ["customer_id", "repository", "name", "digest", "state", "platform", "request_id"] as const;
type Filters = Partial<Record<(typeof filterNames)[number], string>>;

// Scans is GET /api/v2/scans: newest first, filtered, one page at a time.
export function Scans({ onOpen, onUnauthorized }: { onOpen: (id: string) => void; onUnauthorized: () => void }) {
  const [draft, setDraft] = useState<Filters>({});
  const [filters, setFilters] = useState<Filters>({});
  // cursors[i] is the cursor of page i (page 0 has none).
  const [cursors, setCursors] = useState<string[]>([""]);
  const page = cursors.length - 1;

  const query = new URLSearchParams();
  for (const name of filterNames) {
    const value = filters[name]?.trim();
    if (value) {
      query.set(name, value);
    }
  }
  query.set("limit", "50");
  if (cursors[page]) {
    query.set("cursor", cursors[page]);
  }
  const { data, error, loading, reload } = useData(
    () => get<ListResponse>(`/api/v2/scans?${query.toString()}`),
    [query.toString()],
  );

  function apply(event: FormEvent) {
    event.preventDefault();
    setFilters(draft);
    setCursors([""]);
  }

  return (
    <>
      <Section title="Filters">
        <form className="filters" onSubmit={apply}>
          {filterNames.map((name) => (
            <div key={name} className="form-group">
              <label className="form-label" htmlFor={`filter-${name}`}>
                {name}
              </label>
              <div className="custom-input-wrapper">
                {name === "state" ? (
                  <select
                    id="filter-state"
                    className="custom-input-field"
                    value={draft.state ?? ""}
                    onChange={(e) => setDraft({ ...draft, state: e.target.value })}
                  >
                    <option value="">any</option>
                    <option>queued</option>
                    <option>scanning</option>
                    <option>done</option>
                    <option>failed</option>
                  </select>
                ) : (
                  <input
                    id={`filter-${name}`}
                    className="custom-input-field"
                    value={draft[name] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [name]: e.target.value })}
                  />
                )}
              </div>
            </div>
          ))}
          <div className="actions">
            <button type="submit" className="btn btn-primary">
              Apply
            </button>
            <button type="button" className="btn btn-secondary" title="Refresh" onClick={reload}>
              <Icon name="refresh-cw" />
            </button>
          </div>
        </form>
      </Section>

      {error && <ErrorBox error={error} onUnauthorized={onUnauthorized} />}
      {loading && !data && <p className="muted">Loading...</p>}
      {data && (
        <Section title="Scans" aside="One record per image tag. Click a row for its findings." flush>
          <div className="table-responsive">
            <table className="table clickable">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>State</th>
                  <th>Result digest</th>
                  <th>Summary</th>
                  <th>Freshness</th>
                  <th>Customers</th>
                  <th>Created</th>
                  <th>Confirmed</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.scan_id} onClick={() => onOpen(item.scan_id)}>
                    <td className="mono nowrap">
                      {item.image.repository}/{item.image.name}:{item.image.tag}
                    </td>
                    <td>
                      <Badge value={item.state} />
                      {item.error && <div className="small muted">{item.error.class}</div>}
                    </td>
                    <td className="mono">{shortDigest(item.result?.digest)}</td>
                    <td>
                      <Summary counts={item.result?.summary} />
                    </td>
                    <td>{item.result ? <Badge value={item.result.freshness} /> : "-"}</td>
                    <td>{item.customer_ids.join(", ")}</td>
                    <td className="small nowrap">{formatTime(item.created_at)}</td>
                    <td className="small nowrap">{formatTime(item.confirmed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.items.length === 0 && <p className="empty">No scans.</p>}
          <div className="pager">
            <nav aria-label="Pages">
              <ul className="pagination-modern">
                <li className={page === 0 ? "page-item disabled" : "page-item"}>
                  <button
                    type="button"
                    className="page-link"
                    title="Previous page"
                    disabled={page === 0}
                    onClick={() => setCursors(cursors.slice(0, -1))}
                  >
                    &lsaquo;
                  </button>
                </li>
                <li className="page-item active">
                  <span className="page-link">{page + 1}</span>
                </li>
                <li className={data.next_cursor ? "page-item" : "page-item disabled"}>
                  <button
                    type="button"
                    className="page-link"
                    title="Next page"
                    disabled={!data.next_cursor}
                    onClick={() => data.next_cursor && setCursors([...cursors, data.next_cursor])}
                  >
                    &rsaquo;
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </Section>
      )}
    </>
  );
}
