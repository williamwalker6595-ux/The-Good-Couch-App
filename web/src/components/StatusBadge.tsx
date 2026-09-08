import { formatStatusLabel } from "../format";

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`status-badge status-${status}`}>{formatStatusLabel(status)}</span>;
}
