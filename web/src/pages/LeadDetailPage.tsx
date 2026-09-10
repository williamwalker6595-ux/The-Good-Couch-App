import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import StatusBadge from "../components/StatusBadge";
import {
  composeQuoteMessagePreview,
  confirmLeadSchedule,
  createLeadScheduleTask,
  DISPOSITION_TYPES,
  fetchLead,
  fetchLeadConditionAssessment,
  fetchLeadDisposition,
  fetchLeadMessages,
  fetchLeadQuoteOptions,
  fetchLeadQuoteResponse,
  fetchLeadSchedule,
  quickApproveDisposition,
  QUOTE_CUSTOMER_RESPONSES,
  recordLeadQuoteResponse,
  sendLeadQuote,
  suggestLeadDisposition,
  type ConditionAssessment,
  type ConversationMessage,
  type Disposition,
  type DispositionType,
  type Lead,
  type QuoteCustomerResponse,
  type QuoteOptions,
  type QuoteResponse,
  type ScheduleSlot,
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
  const [quoteOptions, setQuoteOptions] = useState<QuoteOptions | null>(null);

  const [quoteResponse, setQuoteResponse] = useState<QuoteResponse | null>(
    null,
  );
  const [quoteContent, setQuoteContent] = useState("");
  const [quoteActionLoading, setQuoteActionLoading] = useState(false);
  const [quoteActionError, setQuoteActionError] = useState<string | null>(
    null,
  );
  const [manualResponse, setManualResponse] =
    useState<QuoteCustomerResponse>("accepted");
  const [manualFinalAmount, setManualFinalAmount] = useState<string>("");

  const [scheduleSlot, setScheduleSlot] = useState<ScheduleSlot | null>(null);
  const [scheduleActionLoading, setScheduleActionLoading] = useState(false);
  const [scheduleActionError, setScheduleActionError] = useState<
    string | null
  >(null);
  const [pickupDatetimeInput, setPickupDatetimeInput] = useState("");

  function reload(id: string) {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchLead(id),
      fetchLeadMessages(id),
      fetchLeadConditionAssessment(id),
      fetchLeadDisposition(id),
      fetchLeadQuoteOptions(id),
      fetchLeadQuoteResponse(id),
      fetchLeadSchedule(id),
    ])
      .then(
        ([
          leadData,
          messagesData,
          assessmentData,
          dispositionData,
          quoteOptionsData,
          quoteResponseData,
          scheduleSlotData,
        ]) => {
          if (cancelled) return;
          setLead(leadData);
          setMessages(messagesData);
          setConditionAssessment(assessmentData);
          setDisposition(dispositionData);
          setQuoteOptions(quoteOptionsData);
          setQuoteResponse(quoteResponseData);
          setQuoteContent(
            dispositionData ? composeQuoteMessagePreview(dispositionData) : "",
          );
          setScheduleSlot(scheduleSlotData);
        },
      )
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

  async function handleQuickApprove(type: DispositionType) {
    if (!leadId) return;
    setDispositionActionLoading(true);
    setDispositionActionError(null);
    try {
      await quickApproveDisposition(leadId, type);
      reload(leadId);
    } catch {
      setDispositionActionError("Failed to approve disposition.");
    } finally {
      setDispositionActionLoading(false);
    }
  }

  async function handleSendQuote() {
    if (!leadId || quoteContent.trim() === "") return;
    setQuoteActionLoading(true);
    setQuoteActionError(null);
    try {
      await sendLeadQuote(leadId, quoteContent.trim());
      reload(leadId);
    } catch {
      setQuoteActionError("Failed to send quote.");
    } finally {
      setQuoteActionLoading(false);
    }
  }

  async function handleRecordResponse() {
    if (!leadId) return;
    setQuoteActionLoading(true);
    setQuoteActionError(null);
    try {
      await recordLeadQuoteResponse(leadId, {
        customerResponse: manualResponse,
        finalAmount:
          manualResponse === "declined" || manualFinalAmount === ""
            ? null
            : Number(manualFinalAmount),
      });
      reload(leadId);
    } catch {
      setQuoteActionError("Failed to record customer response.");
    } finally {
      setQuoteActionLoading(false);
    }
  }

  async function handleCreateScheduleTask() {
    if (!leadId) return;
    setScheduleActionLoading(true);
    setScheduleActionError(null);
    try {
      await createLeadScheduleTask(leadId);
      reload(leadId);
    } catch {
      setScheduleActionError("Failed to create Todoist task.");
    } finally {
      setScheduleActionLoading(false);
    }
  }

  async function handleConfirmSchedule() {
    if (!leadId || pickupDatetimeInput === "") return;
    setScheduleActionLoading(true);
    setScheduleActionError(null);
    try {
      await confirmLeadSchedule(
        leadId,
        new Date(pickupDatetimeInput).toISOString(),
      );
      reload(leadId);
    } catch {
      setScheduleActionError("Failed to confirm pickup time.");
    } finally {
      setScheduleActionLoading(false);
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
              <dt>Seats/sections</dt>
              <dd>{conditionAssessment.seat_count ?? "—"}</dd>
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
                <dt>Current</dt>
                <dd>
                  {formatStatusLabel(disposition.type)}
                  {disposition.quote_amount !== null &&
                    ` — $${disposition.quote_amount}`}
                </dd>
                <dt>Set by</dt>
                <dd>{formatStatusLabel(disposition.suggested_by)}</dd>
                <dt>Status</dt>
                <dd>{formatStatusLabel(disposition.status)}</dd>
              </dl>
              {disposition.reasoning && (
                <p className="reasoning">"{disposition.reasoning}"</p>
              )}
            </>
          ) : (
            <p className="muted">No disposition set yet.</p>
          )}

          {![
            "quote_sent",
            "accepted",
            "declined",
            "scheduled",
          ].includes(lead.status) && (
            <>
              <p className="muted" style={{ marginTop: "1rem" }}>
                Pick a disposition — each button shows the pre-calculated
                quote:
              </p>
              <div className="button-row">
                {DISPOSITION_TYPES.map((type) => {
                  const option = quoteOptions?.[type];
                  const amount = option?.amount ?? null;
                  return (
                    <button
                      key={type}
                      className="button-primary"
                      onClick={() => handleQuickApprove(type)}
                      disabled={dispositionActionLoading || amount === null}
                      title={option?.blockedReason ?? option?.explanation ?? undefined}
                    >
                      {formatStatusLabel(type)}
                      {" — "}
                      {amount !== null ? `$${amount}` : "unavailable"}
                    </button>
                  );
                })}
              </div>
              {quoteOptions &&
                (quoteOptions.mileage.blockedReason ||
                  quoteOptions.full.blockedReason) && (
                  <p className="muted" style={{ marginTop: "0.5rem" }}>
                    {quoteOptions.mileage.blockedReason && (
                      <>Mileage: {quoteOptions.mileage.blockedReason}. </>
                    )}
                    {quoteOptions.full.blockedReason && (
                      <>Full: {quoteOptions.full.blockedReason}.</>
                    )}
                  </p>
                )}

              <div className="button-row">
                <button
                  onClick={handleSuggest}
                  disabled={dispositionActionLoading}
                >
                  {dispositionActionLoading
                    ? "Working…"
                    : "Get AI recommendation"}
                </button>
              </div>
            </>
          )}

          {dispositionActionError && (
            <p className="error">{dispositionActionError}</p>
          )}
        </div>
      </section>

      <section>
        <h2>Quote</h2>
        <div className="card">
          {disposition?.status === "approved" ? (
            <>
              <label htmlFor="quote-content" className="muted">
                Message to send
              </label>
              <textarea
                id="quote-content"
                rows={4}
                style={{ width: "100%", marginTop: "0.35rem" }}
                value={quoteContent}
                onChange={(e) => setQuoteContent(e.target.value)}
                disabled={quoteActionLoading}
              />
              <div className="button-row">
                <button
                  className="button-primary"
                  onClick={handleSendQuote}
                  disabled={quoteActionLoading || quoteContent.trim() === ""}
                >
                  {lead.status === "quote_sent" ? "Re-send quote" : "Send quote"}
                </button>
              </div>
            </>
          ) : (
            <p className="muted">
              Approve a disposition above before sending a quote.
            </p>
          )}

          {quoteResponse && (
            <dl className="lead-facts" style={{ marginTop: "1rem" }}>
              <dt>Customer response</dt>
              <dd>{formatStatusLabel(quoteResponse.customer_response)}</dd>
              <dt>Final amount</dt>
              <dd>{quoteResponse.final_amount ?? "—"}</dd>
              <dt>Responded</dt>
              <dd>{formatDateTime(quoteResponse.responded_at)}</dd>
            </dl>
          )}

          {lead.status === "quote_sent" && (
            <>
              <p className="muted" style={{ marginTop: "1rem" }}>
                Record the customer's response manually if it wasn't picked up
                automatically:
              </p>
              <div className="disposition-form">
                <label htmlFor="manual-response">Response</label>
                <select
                  id="manual-response"
                  value={manualResponse}
                  onChange={(e) =>
                    setManualResponse(
                      e.target.value as QuoteCustomerResponse,
                    )
                  }
                  disabled={quoteActionLoading}
                >
                  {QUOTE_CUSTOMER_RESPONSES.map((r) => (
                    <option key={r} value={r}>
                      {formatStatusLabel(r)}
                    </option>
                  ))}
                </select>
                {manualResponse !== "declined" && (
                  <>
                    <label htmlFor="manual-final-amount">
                      Final amount ($)
                    </label>
                    <input
                      id="manual-final-amount"
                      type="number"
                      min="0"
                      step="1"
                      value={manualFinalAmount}
                      onChange={(e) => setManualFinalAmount(e.target.value)}
                      disabled={quoteActionLoading}
                    />
                  </>
                )}
              </div>
              <div className="button-row">
                <button
                  onClick={handleRecordResponse}
                  disabled={quoteActionLoading}
                >
                  Record response
                </button>
              </div>
            </>
          )}

          {quoteActionError && <p className="error">{quoteActionError}</p>}
        </div>
      </section>

      {(lead.status === "accepted" || lead.status === "scheduled") && (
        <section>
          <h2>Scheduling</h2>
          <div className="card">
            {scheduleSlot?.todoist_task_id ? (
              <dl className="lead-facts">
                <dt>Todoist task</dt>
                <dd>{scheduleSlot.todoist_task_id}</dd>
                <dt>Status</dt>
                <dd>{formatStatusLabel(scheduleSlot.status)}</dd>
                <dt>Pickup time</dt>
                <dd>
                  {scheduleSlot.pickup_datetime
                    ? formatDateTime(scheduleSlot.pickup_datetime)
                    : "Not yet confirmed"}
                </dd>
              </dl>
            ) : (
              <>
                <p className="muted">No Todoist task created yet.</p>
                <div className="button-row">
                  <button
                    onClick={handleCreateScheduleTask}
                    disabled={scheduleActionLoading}
                  >
                    Create Todoist task
                  </button>
                </div>
              </>
            )}

            <p className="muted" style={{ marginTop: "1rem" }}>
              Once you've coordinated a pickup window with the customer,
              confirm it here:
            </p>
            <div className="disposition-form">
              <label htmlFor="pickup-datetime">Pickup time</label>
              <input
                id="pickup-datetime"
                type="datetime-local"
                value={pickupDatetimeInput}
                onChange={(e) => setPickupDatetimeInput(e.target.value)}
                disabled={scheduleActionLoading}
              />
            </div>
            <div className="button-row">
              <button
                className="button-primary"
                onClick={handleConfirmSchedule}
                disabled={scheduleActionLoading || pickupDatetimeInput === ""}
              >
                Confirm pickup time
              </button>
            </div>

            {scheduleActionError && (
              <p className="error">{scheduleActionError}</p>
            )}
          </div>
        </section>
      )}

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
