'use server' 

import { createTransport, getTestMessageUrl } from "nodemailer";
import { basePath } from "..";

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
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";

  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
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
      html: `<body style="font-family: Helvetica, Arial, sans-serif; color: #444;"><p>${escape(details.brokerageName)} has requested a payment of <strong>${escape(details.amountLabel)}</strong> for ${escape(details.description)}.</p><p><a href="${escape(details.url)}" style="background:#346df1;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">Pay securely</a></p><p>If you were not expecting this, ignore this email or contact the brokerage.</p></body>`,
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
      html: `<body style="font-family: Helvetica, Arial, sans-serif; color: #444;"><p>${escape(details.brokerageName)} received your ${kind} request. An agent will contact you to confirm the time.</p><p><strong>${escape(details.propertyTitle)}</strong>${details.address ? `<br>${escape(details.address)}` : ''}<br>Requested time: ${escape(details.whenLabel)}<br>Request number: ${escape(details.showingNumber)}</p><p><a href="${escape(details.url)}" style="background:#346df1;color:#fff;padding:10px 20px;text-decoration:none;border-radius:5px;display:inline-block;">View the listing</a></p></body>`,
    })
    return { sent: true, messageId: [String((info as any)?.messageId || ''), String((info as any)?.response || '').slice(0,120)].filter(Boolean).join(' | ') }
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : 'send_failed' }
  }
}
