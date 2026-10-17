// Dates are shown in India time, whatever the visitor's own time zone.
const TZ = "Asia/Kolkata";

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: TZ,
});
const timeFormat = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: TZ });

/** "14 Oct 2026" */
export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

/** "14 Oct, 4:05 pm" */
export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

/** "4:05 pm" */
export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}
