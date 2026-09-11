export interface EmailProvider {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

export class DevConsoleEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[EMAIL to ${to}]: ${subject}\n${body}\n`);
  }
}

export const emailProvider = new DevConsoleEmailProvider();
