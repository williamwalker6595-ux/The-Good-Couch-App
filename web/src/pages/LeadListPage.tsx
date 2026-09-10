import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import {
  fetchLeads,
  LEAD_STATUSES,
  mediaProxyUrl,
  type Lead,
  type LeadStatus,
} from "../api";
import { formatDateTime } from "../format";

function LeadThumbnail({ lead }: { lead: Lead }) {
  const [failed, setFailed] = useState(false);

  if (!lead.thumbnail_url || failed) {
    return <div className="lead-thumb lead-thumb-empty" aria-hidden="true" />;
  }

  return (
    <img
      className="lead-thumb"
      src={mediaProxyUrl(lead.thumbnail_url)}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function LeadListPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchLeads(statusFilter || undefined)
      .then((data) => {
        if (!cancelled) setLeads(data);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load leads.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [statusFilter]);

  return (
    <div>
      <div className="page-header">
        <h1>Leads</h1>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as LeadStatus | "")}
        >
          <option value="">All statuses</option>
          {LEAD_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && leads.length === 0 && (
        <p className="muted">No leads found.</p>
      )}

      {!loading && !error && leads.length > 0 && (
        <table className="lead-table">
          <thead>
            <tr>
              <th aria-label="Photo"></th>
              <th>Name</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr key={lead.id}>
                <td>
                  <Link to={`/leads/${lead.id}`}>
                    <LeadThumbnail lead={lead} />
                  </Link>
                </td>
                <td>
                  <Link to={`/leads/${lead.id}`}>{lead.name}</Link>
                </td>
                <td>{lead.phone}</td>
                <td>
                  <StatusBadge status={lead.status} />
                </td>
                <td>{formatDateTime(lead.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
