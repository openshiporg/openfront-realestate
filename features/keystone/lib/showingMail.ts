import { createTransport } from "nodemailer";
import { emailButton, emailLayout, emailPanel, emailParagraph, escapeHtml } from "./email-layout";

// Same SMTP settings as the password-reset sender in mail.ts.
const transport = createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
});

export type ShowingEmailKind = "confirmed" | "moved" | "cancelled";

/** Showing confirmed / moved / cancelled, through the same sender as password reset. Returns the provider message id. */
export async function sendShowingEmail(input: { kind: ShowingEmailKind; to: string; name?: string | null; listing: string; address?: string | null; when: string; showingId: string; storeName?: string | null }): Promise<string> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) throw new Error("Email is not set up on this site.");
  const base = (process.env.SMTP_STORE_LINK || process.env.PUBLIC_APP_URL || "");
  const link = base ? `${base}/account/showings/${encodeURIComponent(input.showingId)}` : "";
  const title = input.kind === "confirmed" ? "Your showing is confirmed" : input.kind === "moved" ? "Your showing has a new time" : "Your showing was cancelled";
  const lead = input.kind === "confirmed"
    ? `Your showing of ${input.listing} is confirmed for ${input.when}.`
    : input.kind === "moved"
      ? `Your showing of ${input.listing} has moved to ${input.when}.`
      : `Your showing of ${input.listing} on ${input.when} was cancelled. Reply to this email or request a new time on the listing.`;
  const html = emailLayout({
    storeName: input.storeName || undefined,
    preheader: lead,
    title,
    body: `${emailParagraph(`${input.name ? `Hi ${escapeHtml(input.name)}, ` : ""}${escapeHtml(lead)}`)}
${input.address ? emailPanel(`${escapeHtml(input.listing)}<br>${escapeHtml(input.address)}`) : ""}
${link ? emailButton("View your showing", link) : ""}`,
  });
  const info = await transport.sendMail({ to: input.to, from: process.env.SMTP_FROM, subject: title, html });
  // Resend answers "250 Queued as <id>"; keep that provider id alongside the Message-ID header.
  const queued = /queued as\s+(\S+)/i.exec(String(info.response || ""))?.[1];
  return [queued ? `resend ${queued}` : "", info.messageId ? `message-id ${info.messageId}` : ""].filter(Boolean).join(" · ");
}
