'use server' 

import { createTransport, getTestMessageUrl } from "nodemailer";
import { basePath } from "..";
import { emailButton, emailLayout, emailMuted, emailPanel, emailParagraph } from "./email-layout";

// Utility function to get base URL for emails
function getBaseUrlForEmails(): string {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  
  // Fallback warning - this should be set in production
  console.warn('SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.');
  return '';
}

const transport = createTransport({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

function passwordResetEmail({ url }: { url: string }): string {
  return emailLayout({
    preheader: "Use this link to choose a new password.",
    title: "Reset your password",
    body: `${emailParagraph("We received a request to reset the password for your account. Use the button below to choose a new one.")}
${emailButton("Reset password", url)}
${emailMuted("If you did not request this, you can safely ignore this email. Your password will not change.")}`,
  });
}

/** `resetPath` lets storefront customers land on the storefront reset page instead of the dashboard's. */
export async function sendPasswordResetEmail(resetToken: string, to: string, baseUrl?: string, resetPath?: string): Promise<void> {
  // Use provided baseUrl or fall back to utility function
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  
  // email the user a token
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Reset your password",
    html: passwordResetEmail({
      url: resetPath
        ? `${frontendUrl}${resetPath}?token=${encodeURIComponent(resetToken)}&email=${encodeURIComponent(to)}`
        : `${frontendUrl}${basePath && basePath}/reset?token=${encodeURIComponent(resetToken)}`,
    }),
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`📧 Message Sent!  Preview it at ${getTestMessageUrl(info as any)}`);
  }
}


/** Sends a hosted payment link requested by brokerage staff. Returns false when mail is not configured. */
export async function sendPaymentRequestEmail(to: string, details: { url: string; amountLabel: string; description: string; brokerageName: string }): Promise<boolean> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return false;
  const escape = (value: string) => value.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string);
  try {
    await transport.sendMail({
      to,
      from: process.env.SMTP_FROM,
      subject: `${details.brokerageName}: payment request for ${details.amountLabel}`,
      html: emailLayout({
        storeName: details.brokerageName,
        preheader: `Payment request for ${details.amountLabel}`,
        title: 'Payment request',
        body: `${emailParagraph(`${escape(details.brokerageName)} has requested a payment of <strong>${escape(details.amountLabel)}</strong> for ${escape(details.description)}.`)}
${emailButton('Pay securely', details.url)}
${emailMuted('If you were not expecting this, ignore this email or contact the brokerage.')}`,
      }),
    });
    return true;
  } catch {
    return false;
  }
}

/** Receipt for a showing request: the agent still has to confirm the time. */
export async function sendShowingRequestEmail(
  to: string,
  details: { brokerageName: string; propertyTitle: string; address: string; whenLabel: string; showingType: 'in_person' | 'virtual'; showingNumber: string; url: string },
): Promise<{ sent: boolean; error?: string; messageId?: string }> {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) return { sent: false, error: 'not_configured' }
  const escape = (value: string) => value.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] as string)
  const kind = details.showingType === 'virtual' ? 'virtual tour' : 'showing'
  try {
    const info = await transport.sendMail({
      to,
      from: process.env.SMTP_FROM,
      subject: `${details.brokerageName}: we received your ${kind} request`,
      html: emailLayout({
        storeName: details.brokerageName,
        preheader: `We received your ${kind} request.`,
        title: `We received your ${kind} request`,
        body: `${emailParagraph(`${escape(details.brokerageName)} received your ${kind} request. An agent will contact you to confirm the time.`)}
${emailPanel(`<strong>${escape(details.propertyTitle)}</strong>${details.address ? `<br>${escape(details.address)}` : ''}<br>Requested time: ${escape(details.whenLabel)}<br>Request number: ${escape(details.showingNumber)}`)}
${emailButton('View the listing', details.url)}`,
      }),
    })
    return { sent: true, messageId: [String((info as any)?.messageId || ''), String((info as any)?.response || '').slice(0,120)].filter(Boolean).join(' | ') }
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'send_failed' }
  }
}
