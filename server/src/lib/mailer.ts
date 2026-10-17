import { env } from "../config/env";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

/** Mails "sent" while testing, so integration tests can read reset links. */
export const testOutbox: Mail[] = [];

/**
 * Sends through Resend when RESEND_API_KEY is set; otherwise (local dev) the message is logged to
 * the server console so links can be followed without an email provider.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (env.NODE_ENV === "test") {
    testOutbox.push(mail);
    return;
  }
  if (!env.RESEND_API_KEY) {
    console.info(`\n📬 [mail → ${mail.to}] ${mail.subject}\n${mail.text}\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
  });
  if (!res.ok) console.error(`[mail] Resend rejected the message (${res.status}).`);
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!);

export function passwordResetMail(to: string, name: string, url: string): Mail {
  const first = name.split(" ")[0] || "there";
  return {
    to,
    subject: "Reset your NESTAMA password",
    text: `Hi ${first},\n\nUse this link to choose a new password (valid for 1 hour):\n${url}\n\nIf you didn't ask for this, you can ignore this email.\n\n— NESTAMA, Your True Friend`,
    html: `<p>Hi ${escapeHtml(first)},</p><p>Use this link to choose a new password (valid for 1 hour):</p><p><a href="${escapeHtml(url)}">Reset my password</a></p><p>If you didn't ask for this, you can ignore this email.</p><p>— NESTAMA, Your True Friend</p>`,
  };
}
