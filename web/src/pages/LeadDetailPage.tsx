import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import {
  approveLeadDisposition,
  DISPOSITION_TYPES,
  fetchLead,
  fetchLeadConditionAssessment,
  fetchLeadDisposition,
  fetchLeadMessages,
  rejectLeadDisposition,
  suggestLeadDisposition,
  type ConditionAssessment,
  type ConversationMessage,
  type Disposition,
  type DispositionType,
  type Lead,
} from "../api";
import { formatDateTime, formatStatusLabel } from "../format";

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(url);
}

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const [lead, setLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conditionAssessment, setConditionAssessment] =
    useState<ConditionAssessment | null>(null);
  const [disposition, setDisposition] = useState<Disposition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dispositionActionLoading, setDispositionActionLoading] =
    useState(false);
  const [dispositionActionError, setDispositionActionError] = useState<
    string | null
  >(null);
  const [draftType, setDraftType] = useState<DispositionType>("free");
  const [draftQuoteAmount, setDraftQuoteAmount] = useState<string>("");

  function reload(id: string) {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchLead(id),
      fetchLeadMessages(id),
      fetchLeadConditionAssessment(id),
      fetchLeadDisposition(id),
    ])
      .then(([leadData, messagesData, assessmentData, dispositionData]) => {
        if (cancelled) return;
        setLead(leadData);
        setMessages(messagesData);
        setConditionAssessment(assessmentData);
        setDisposition(dispositionData);
        setDraftType(dispositionData?.type ?? "free");
        setDraftQuoteAmount(dispositionData?.quote_amount ?? "");
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load lead.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }

  useEffect(() => {
    if (!leadId) return;
    return reload(leadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);

  async function handleSuggest() {
    if (!leadId) return;
    setDispositionActionLoading(true);
    setDispositionActionError(null);
    try {
      await suggestLeadDisposition(leadId);
      reload(leadId);
    } catch {
      setDispositionActionError("Failed to suggest a disposition.");
    } finally {
      setDispositionActionLoading(false);
    }
  }

  async function handleApprove() {
    if (!leadId || !disposition) return;
    setDispositionActionLoading(true);
    setDispositionActionError(null);
    try {
      await approveLeadDisposition(leadId, disposition.id, {
        type: draftType,
        quoteAmount:
          draftType === "free"
            ? null
            : draftQuoteAmount === ""
              ? null
              : Number(draftQuoteAmount),
      });
      reload(leadId);
    } catch {
      setDispositionActionError("Failed to approve disposition.");
    } finally {
      setDispositionActionLoading(false);
    }
  }

  async function handleReject() {
    if (!leadId || !disposition) return;
    setDispositionActionLoading(true);
    setDispositionActionError(null);
    try {
      await rejectLeadDisposition(leadId, disposition.id);
      reload(leadId);
    } catch {
      setDispositionActionError("Failed to reject disposition.");
    } finally {
      setDispositionActionLoading(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!lead) return <p className="error">Lead not found.</p>;

  return (
    <div>
      <Link to="/" className="back-link">
        ← Back to leads
      </Link>

      <div className="lead-header">
        <h1>{lead.name}</h1>
        <StatusBadge status={lead.status} />
      </div>

      <div className="card">
        <dl className="lead-facts">
          <dt>Phone</dt>
          <dd>{lead.phone}</dd>
          <dt>Address</dt>
          <dd>{lead.address ?? "—"}</dd>
          <dt>Source</dt>
          <dd>{lead.source ?? "—"}</dd>
          <dt>Created</dt>
          <dd>{formatDateTime(lead.created_at)}</dd>
        </dl>
      </div>

      <section>
        <h2>Condition assessment</h2>
        <div className="card">
          {conditionAssessment ? (
            <dl className="lead-facts">
              <dt>Smoking household</dt>
              <dd>{conditionAssessment.smoking_household ? "Yes" : "No"}</dd>
              <dt>Pets</dt>
              <dd>{conditionAssessment.pets ? "Yes" : "No"}</dd>
              <dt>Blemishes</dt>
              <dd>{conditionAssessment.blemishes ?? "—"}</dd>
              <dt>Odors</dt>
              <dd>{conditionAssessment.odors ?? "—"}</dd>
              <dt>Stains</dt>
              <dd>{conditionAssessment.stains ?? "—"}</dd>
              <dt>Notes</dt>
              <dd>{conditionAssessment.notes ?? "—"}</dd>
            </dl>
          ) : (
            <p className="muted">No condition assessment yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2>Disposition</h2>
        <div className="card">
          {disposition ? (
            <>
              <dl className="lead-facts">
                <dt>Type</dt>
                <dd>{formatStatusLabel(disposition.type)}</dd>
                <dt>Suggested by</dt>
                <dd>{formatStatusLabel(disposition.suggested_by)}</dd>
                <dt>Quote amount</dt>
                <dd>{disposition.quote_amount ?? "—"}</dd>
                <dt>Confidence</dt>
                <dd>
                  {disposition.confidence !== null
                    ? `${Math.round(disposition.confidence * 100)}%`
                    : "—"}
                </dd>
                <dt>Status</dt>
                <dd>{formatStatusLabel(disposition.status)}</dd>
              </dl>
              {disposition.reasoning && (
                <p className="reasoning">"{disposition.reasoning}"</p>
              )}

              {disposition.status === "pending_approval" && (
                <>
                  <div className="disposition-form">
                    <label htmlFor="disposition-type">Type</label>
                    <select
                      id="disposition-type"
                      value={draftType}
                      onChange={(e) =>
                        setDraftType(e.target.value as DispositionType)
                      }
                      disabled={dispositionActionLoading}
                    >
                      {DISPOSITION_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {formatStatusLabel(type)}
                        </option>
                      ))}
                    </select>
                    <label htmlFor="disposition-quote">Quote amount ($)</label>
                    <input
                      id="disposition-quote"
                      type="number"
                      min="0"
                      step="1"
                      value={draftQuoteAmount}
                      onChange={(e) => setDraftQuoteAmount(e.target.value)}
                      disabled={draftType === "free" || dispositionActionLoading}
                      placeholder={draftType === "free" ? "n/a" : ""}
                    />
                  </div>
                  <div className="button-row">
                    <button
                      className="button-primary"
                      onClick={handleApprove}
                      disabled={dispositionActionLoading}
                    >
                      Approve
                    </button>
                    <button
                      className="button-danger"
                      onClick={handleReject}
                      disabled={dispositionActionLoading}
                    >
                      Reject
                    </button>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="muted">No disposition suggested yet.</p>
          )}

          {(!disposition || disposition.status === "rejected") && (
            <div className="button-row">
              <button onClick={handleSuggest} disabled={dispositionActionLoading}>
                {dispositionActionLoading
                  ? "Suggesting…"
                  : disposition
                    ? "Suggest again"
                    : "Suggest disposition"}
              </button>
            </div>
          )}

          {dispositionActionError && (
            <p className="error">{dispositionActionError}</p>
          )}
        </div>
      </section>

      <section>
        <h2>Conversation</h2>
        {messages.length === 0 ? (
          <p className="muted">No messages yet.</p>
        ) : (
          <ul className="conversation-thread">
            {messages.map((message) => (
              <li
                key={message.id}
                className={`message message-${message.direction}`}
              >
                <div className="message-meta">
                  <span>{message.direction === "in" ? "Customer" : "Us"}</span>
                  <span>{formatDateTime(message.created_at)}</span>
                </div>
                {message.body && <p>{message.body}</p>}
                {message.media_urls.length > 0 && (
                  <div className="message-media">
                    {message.media_urls.map((url) =>
                      isImageUrl(url) ? (
                        <img key={url} src={url} alt="Attachment" />
                      ) : (
                        <a key={url} href={url} target="_blank" rel="noreferrer">
                          Attachment
                        </a>
                      ),
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
