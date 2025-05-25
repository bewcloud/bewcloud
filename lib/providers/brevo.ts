import 'std/dotenv/load.ts';

import { AppConfig } from '/lib/config.ts';

const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY') || '';

enum BrevoTemplateId {
  BEWCLOUD_VERIFY_EMAIL = 20, // NOTE: This will likely be different in your own Brevo account
}

interface BrevoResponse {
  messageId?: string;
  code?: string;
  message?: string;
}

function getApiRequestHeaders() {
  return {
    'Api-Key': BREVO_API_KEY,
    'Accept': 'application/json; charset=utf-8',
    'Content-Type': 'application/json; charset=utf-8',
  };
}

interface BrevoRequestBody {
  templateId?: number;
  params: Record<string, any> | null;
  to: { email: string; name?: string }[];
  cc?: { email: string; name?: string }[];
  bcc?: { email: string; name?: string }[];
  htmlContent?: string;
  textContent?: string;
  subject?: string;
  replyTo: { email: string; name?: string };
  tags?: string[];
  attachment?: { name: string; content: string; url: string }[];
}

async function sendEmailWithTemplate(
  to: string,
  templateId: BrevoTemplateId,
  data: BrevoRequestBody['params'],
  attachments: BrevoRequestBody['attachment'] = [],
  cc?: string,
) {
  const config = await AppConfig.getConfig();
  const helpEmail = config.visuals.helpEmail;

  const email: BrevoRequestBody = {
    templateId,
    params: data,
    to: [{ email: to }],
    replyTo: { email: helpEmail },
  };

  if (attachments?.length) {
    email.attachment = attachments;
  }

  if (cc) {
    email.cc = [{ email: cc }];
  }

  const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: getApiRequestHeaders(),
    body: JSON.stringify(email),
  });
  const brevoResult = (await brevoResponse.json()) as BrevoResponse;

  if (brevoResult.code || brevoResult.message) {
    console.log(JSON.stringify({ brevoResult }, null, 2));
    throw new Error(`Failed to send email "${templateId}"`);
  }
}

export async function sendVerifyEmailEmail(
  email: string,
  verificationCode: string,
) {
  const data = {
    verificationCode,
  };

  await sendEmailWithTemplate(email, BrevoTemplateId.BEWCLOUD_VERIFY_EMAIL, data);
}
