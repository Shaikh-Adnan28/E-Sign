import { Resend } from "resend";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export class DevConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `\n📧 [DEV EMAIL CONSOLE FALLBACK]\n  To: ${message.to}\n  Subject: ${message.subject}\n  From: ${message.from ?? process.env.FROM_EMAIL ?? process.env.EMAIL_FROM ?? "noreply@esign.dev"}\n\n${message.html}\n`
    );
  }
}

export class ResendEmailProvider implements EmailProvider {
  private resend: Resend;

  constructor(apiKey: string) {
    this.resend = new Resend(apiKey);
  }

  async send(message: EmailMessage): Promise<void> {
    let fromAddress =
      message.from ??
      process.env.FROM_EMAIL ??
      process.env.EMAIL_FROM ??
      "onboarding@resend.dev";

    // If the configured address contains unverified template domains, use Resend testing domain
    if (
      fromAddress.includes("yourdomain.com") ||
      fromAddress.includes("esign.dev") ||
      fromAddress.includes("example.com")
    ) {
      fromAddress = "onboarding@resend.dev";
    }

    const response = await this.resend.emails.send({
      from: fromAddress,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });

    if (response.error) {
      console.error("[ResendEmailProvider Error]", response.error.message);
      // If domain validation fails in dev/test, fallback to console log gracefully
      if (
        response.error.message.includes("domain is not verified") ||
        response.error.message.includes("validation_error")
      ) {
        console.warn(
          "[ResendEmailProvider Warning] Sender domain not verified in Resend. Falling back to dev console log."
        );
        console.log(
          `\n📧 [EMAIL FALLBACK]\n  To: ${message.to}\n  Subject: ${message.subject}\n\n${message.html}\n`
        );
        return;
      }
      throw new Error(`Resend email delivery failed: ${response.error.message}`);
    }
  }
}

function createEmailService(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    return new ResendEmailProvider(apiKey);
  }
  console.warn(
    "[emailService] RESEND_API_KEY not found in environment. Using DevConsoleEmailProvider fallback."
  );
  return new DevConsoleEmailProvider();
}

export const emailService: EmailProvider = createEmailService();

export async function sendSigningEmail({
  to,
  signerName,
  senderName,
  documentTitle,
  token,
}: {
  to: string;
  signerName: string;
  senderName: string;
  documentTitle: string;
  token: string;
}) {
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const signingUrl = `${appUrl}/sign/${token}`;
  await emailService.send({
    to,
    subject: `Action required: Please sign "${documentTitle}"`,
    html: `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0F172A">
  <div style="background:#1A56DB;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0;font-weight:bold;font-size:18px">ESign</div>
  <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <h2 style="margin-top:0;color:#0F172A">You have a document to sign</h2>
    <p><strong>${senderName}</strong> has requested your signature on <em>&ldquo;${documentTitle}&rdquo;</em>.</p>
    <p>Hi ${signerName},</p>
    <a href="${signingUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#1A56DB;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      Review &amp; Sign Document &rarr;
    </a>
    <p style="color:#64748B;font-size:12px">Or copy this link into your browser:<br/><span style="word-break:break-all;color:#1A56DB">${signingUrl}</span></p>
  </div>
</body>
</html>`,
  });
}

export async function sendReminderEmail({
  to,
  signerName,
  senderName,
  documentTitle,
  token,
  customMessage,
}: {
  to: string;
  signerName: string;
  senderName: string;
  documentTitle: string;
  token: string;
  customMessage?: string | null;
}) {
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const signingUrl = `${appUrl}/sign/${token}`;
  await emailService.send({
    to,
    subject: `Reminder: Signature requested for "${documentTitle}"`,
    html: `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0F172A">
  <div style="background:#1A56DB;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0;font-weight:bold;font-size:18px">ESign Reminder</div>
  <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <p>Hi <strong>${signerName}</strong>,</p>
    <p>This is a friendly reminder from <strong>${senderName}</strong> regarding your pending signature on <em>&ldquo;${documentTitle}&rdquo;</em>.</p>
    ${customMessage ? `<blockquote style="background:#EFF6FF;border-left:4px solid #1A56DB;margin:16px 0;padding:12px 16px;color:#1E3A8A;font-style:italic">&ldquo;${customMessage}&rdquo;</blockquote>` : ""}
    <a href="${signingUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#1A56DB;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      Sign Document Now &rarr;
    </a>
  </div>
</body>
</html>`,
  });
}

export async function sendExpirationWarningEmail({
  to,
  signerName,
  senderName,
  documentTitle,
  token,
  daysRemaining,
  expiresAt,
}: {
  to: string;
  signerName: string;
  senderName: string;
  documentTitle: string;
  token: string;
  daysRemaining: number;
  expiresAt: Date;
}) {
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const signingUrl = `${appUrl}/sign/${token}`;
  const dateStr = expiresAt.toLocaleDateString(undefined, { dateStyle: "medium" });
  await emailService.send({
    to,
    subject: `Action Required: Signature request for "${documentTitle}" expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
    html: `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0F172A">
  <div style="background:#E11D48;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0;font-weight:bold;font-size:18px">Expiration Warning</div>
  <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <p>Hi <strong>${signerName}</strong>,</p>
    <p>The signature request for <em>&ldquo;${documentTitle}&rdquo;</em> sent by <strong>${senderName}</strong> will expire on <strong>${dateStr}</strong> (${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining).</p>
    <a href="${signingUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#E11D48;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">
      Sign Before Expiration &rarr;
    </a>
  </div>
</body>
</html>`,
  });
}

export async function sendEnvelopeExpiredEmail({
  to,
  name,
  documentTitle,
  isSender = false,
}: {
  to: string;
  name: string;
  documentTitle: string;
  isSender?: boolean;
}) {
  await emailService.send({
    to,
    subject: `Document Expired: "${documentTitle}"`,
    html: `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0F172A">
  <div style="background:#475569;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0;font-weight:bold;font-size:18px">Signature Request Expired</div>
  <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <p>Hi <strong>${name}</strong>,</p>
    <p>${isSender ? `The signature request for <em>&ldquo;${documentTitle}&rdquo;</em> has expired because the deadline was reached.` : `The signature request for <em>&ldquo;${documentTitle}&rdquo;</em> has expired and is no longer available for signing.`}</p>
  </div>
</body>
</html>`,
  });
}

export async function sendEnvelopeCompletedEmail({
  to,
  name,
  documentTitle,
}: {
  to: string;
  name: string;
  documentTitle: string;
}) {
  await emailService.send({
    to,
    subject: `Completed: "${documentTitle}" has been signed`,
    html: `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0F172A">
  <div style="background:#059669;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0;font-weight:bold;font-size:18px">Document Completed</div>
  <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <p>Hi <strong>${name}</strong>,</p>
    <p>All signers have completed signing <em>&ldquo;${documentTitle}&rdquo;</em>. The completed document is now stored securely in your dashboard.</p>
  </div>
</body>
</html>`,
  });
}

export async function sendEnvelopeDeclinedEmail({
  to,
  senderName,
  declinedByName,
  documentTitle,
  reason,
}: {
  to: string;
  senderName: string;
  declinedByName: string;
  documentTitle: string;
  reason?: string;
}) {
  await emailService.send({
    to,
    subject: `Declined: "${documentTitle}" was declined`,
    html: `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0F172A">
  <div style="background:#DC2626;color:#fff;padding:16px 24px;border-radius:12px 12px 0 0;font-weight:bold;font-size:18px">Signing Declined</div>
  <div style="border:1px solid #E2E8F0;border-top:none;padding:24px;border-radius:0 0 12px 12px">
    <p>Hi <strong>${senderName}</strong>,</p>
    <p><strong>${declinedByName}</strong> declined to sign <em>&ldquo;${documentTitle}&rdquo;</em>.</p>
    ${reason ? `<p style="background:#FEF2F2;border-left:4px solid #DC2626;padding:10px 14px;color:#991B1B">Reason: &ldquo;${reason}&rdquo;</p>` : ""}
  </div>
</body>
</html>`,
  });
}

/** @deprecated use sendSigningEmail */
export const emailProvider = {
  sendEmail: async (to: string, subject: string, body: string) => {
    await emailService.send({ to, subject, html: `<pre>${body}</pre>` });
  },
};

