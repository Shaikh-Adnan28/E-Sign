export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

class DevConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    console.log(
      `\n📧 [DEV EMAIL]\n  To: ${message.to}\n  Subject: ${message.subject}\n  From: ${message.from ?? "noreply@esign.dev"}\n\n${message.html}\n`
    );
  }
}

export const emailService: EmailProvider = new DevConsoleEmailProvider();

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
  const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const signingUrl = `${appUrl}/sign/${token}`;
  await emailService.send({
    to,
    subject: `Action required: Please sign "${documentTitle}"`,
    html: `<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1e293b">
  <h2 style="margin-bottom:8px">You have a document to sign</h2>
  <p><strong>${senderName}</strong> has requested your signature on <em>&ldquo;${documentTitle}&rdquo;</em>.</p>
  <p>Hi ${signerName},</p>
  <a href="${signingUrl}" style="display:inline-block;margin:20px 0;padding:14px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:600;font-size:15px">
    Review &amp; Sign Document &rarr;
  </a>
  <p style="color:#64748b;font-size:13px">Or paste this URL in your browser:<br/>
    <span style="word-break:break-all;color:#2563eb">${signingUrl}</span>
  </p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0"/>
  <p style="color:#94a3b8;font-size:12px">This request was sent via ESign · Secure Document Signing.<br/>
  If you were not expecting this, you can safely ignore this email.</p>
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
