import 'server-only'
import { Resend } from 'resend'

type WelcomeEmailInput = {
  uid: string
  email: string
  firstName: string
  role: string
}

const ROLE_MESSAGES: Record<string, string> = {
  client: 'Find trusted talent, manage your bookings and keep every job organised in one place.',
  artisan: 'Showcase your craft, connect with nearby clients and grow a business people can trust.',
  professional: 'Present your experience clearly and connect with opportunities that match your expertise.',
  recruiter: 'Reach qualified candidates, share opportunities and manage your hiring conversations.',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    }
    return entities[character] ?? character
  })
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.RESEND_FROM_EMAIL?.trim()
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://anywork-365-inky.vercel.app').replace(/\/$/, '')

  return { apiKey, from, appUrl }
}

export function isWelcomeEmailConfigured(): boolean {
  const { apiKey, from } = getEmailConfig()
  return Boolean(apiKey && from)
}

export async function sendWelcomeEmail({
  uid,
  email,
  firstName,
  role,
}: WelcomeEmailInput): Promise<{ id: string | null }> {
  const { apiKey, from, appUrl } = getEmailConfig()
  if (!apiKey || !from) throw new Error('Resend welcome email is not configured')

  const resend = new Resend(apiKey)
  const safeFirstName = escapeHtml(firstName)
  const normalizedRole = role.trim().toLowerCase()
  const roleLabel = escapeHtml(normalizedRole.charAt(0).toUpperCase() + normalizedRole.slice(1))
  const roleMessage = ROLE_MESSAGES[normalizedRole] || 'Build your profile and make the most of Anywork365.'
  const destination = `${appUrl}/login`

  const { data, error } = await resend.emails.send(
    {
      from,
      to: email,
      subject: `Welcome to Anywork365, ${firstName}`,
      text: [
        `Hi ${firstName},`,
        '',
        `Your ${roleLabel.toLowerCase()} account has been created successfully.`,
        roleMessage,
        '',
        `Continue to Anywork365: ${destination}`,
        '',
        'Anywork365 — Trusted people. Real opportunities.',
      ].join('\n'),
      html: `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f3f7f6;font-family:Arial,Helvetica,sans-serif;color:#15312e;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${roleLabel} account is ready.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f7f6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background:#ffffff;border:1px solid #dce8e5;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 20px;border-bottom:1px solid #e6efed;">
                <img src="${appUrl}/anyworks-logo.png" width="230" alt="Anywork365" style="display:block;width:230px;max-width:100%;height:auto;border:0;" />
              </td>
            </tr>
            <tr>
              <td style="padding:36px 32px 34px;">
                <p style="margin:0 0 10px;font-size:13px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:#08776d;">Welcome to Anywork365</p>
                <h1 style="margin:0 0 18px;font-size:30px;line-height:1.18;color:#102c29;">You’re ready to get started, ${safeFirstName}.</h1>
                <p style="margin:0 0 14px;font-size:16px;line-height:1.65;color:#48615e;">Your <strong>${roleLabel}</strong> account has been created successfully.</p>
                <p style="margin:0 0 26px;font-size:16px;line-height:1.65;color:#48615e;">${roleMessage}</p>
                <a href="${destination}" style="display:inline-block;background:#08776d;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 22px;border-radius:9px;">Continue to Anywork365</a>
                <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#748784;">If you have not verified your email yet, use the separate verification message from Anywork365 before signing in.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#0d3c37;color:#d9e9e6;font-size:12px;line-height:1.6;">
                Trusted people. Real opportunities.<br />
                This is an automated account email from Anywork365.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    },
    { idempotencyKey: `welcome/${uid}` }
  )

  if (error) throw new Error(error.message)
  return { id: data?.id ?? null }
}
