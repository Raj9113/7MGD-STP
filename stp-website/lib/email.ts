/**
 * Email helper — uses Nodemailer with SMTP.
 * Configure via environment variables (see .env.local).
 * Fails gracefully if SMTP is not configured.
 */
import nodemailer from 'nodemailer';

// ── Transporter ───────────────────────────────────────────────────────────────

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[email] SMTP not configured — emails will be skipped. Set SMTP_HOST, SMTP_USER, SMTP_PASS in .env.local');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

// ── Send Helper ───────────────────────────────────────────────────────────────

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(opts: SendEmailOptions): Promise<boolean> {
  try {
    const transporter = createTransporter();
    if (!transporter) return false;

    const from = `"7 MGD STP Sonia Vihar" <${process.env.SMTP_USER}>`;

    await transporter.sendMail({ from, ...opts });
    return true;
  } catch (err) {
    console.error('[email] Failed to send email:', err);
    return false;
  }
}

// ── Shared Styles ─────────────────────────────────────────────────────────────

const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f3f4f6;
  margin: 0; padding: 0;
`;

const CARD_STYLE = `
  max-width: 560px; margin: 40px auto; background: #fff;
  border-radius: 12px; overflow: hidden;
  border: 2px solid #ffcc00; box-shadow: 0 4px 20px rgba(0,0,0,0.12);
`;

const HEADER_STYLE = `
  background: #0062b8; padding: 28px 32px;
  border-bottom: 3px solid #ffcc00; text-align: center;
`;

const BODY_STYLE = `padding: 28px 32px;`;

const BTN_GREEN = `
  display: inline-block; background: #16a34a; color: #fff !important;
  text-decoration: none; font-weight: bold; font-size: 15px;
  padding: 12px 28px; border-radius: 8px; margin: 6px;
`;
const BTN_RED = `
  display: inline-block; background: #dc2626; color: #fff !important;
  text-decoration: none; font-weight: bold; font-size: 15px;
  padding: 12px 28px; border-radius: 8px; margin: 6px;
`;
const BTN_BLUE = `
  display: inline-block; background: #0062b8; color: #fff !important;
  text-decoration: none; font-weight: bold; font-size: 15px;
  padding: 12px 28px; border-radius: 8px; margin: 6px;
`;

function header(subtitle: string) {
  return `
    <div style="${HEADER_STYLE}">
      <div style="display:inline-block;border:2px solid #ffcc00;border-radius:8px;padding:4px 20px;margin-bottom:10px;">
        <span style="color:#fff;font-size:32px;font-weight:900;letter-spacing:2px;">AIP</span>
      </div>
      <h2 style="color:#fff;margin:0;font-size:18px;font-weight:700;letter-spacing:1px;">7 MGD STP SONIA VIHAR</h2>
      <p style="color:#fde68a;margin:6px 0 0;font-size:13px;">${subtitle}</p>
    </div>
  `;
}

function footer() {
  return `
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
      <p style="color:#9ca3af;font-size:11px;margin:0;">
        This is an automated message from the 7 MGD STP Portal. Do not reply to this email.
      </p>
    </div>
  `;
}

// ── Template: Admin — New Registration Request ────────────────────────────────

export function buildAdminRegistrationRequestEmail(opts: {
  fullName: string;
  email: string;
  department: string;
  employeeId?: string | null;
  notes?: string | null;
  approveUrl: string;
  rejectUrl: string;
}): string {
  return `
    <body style="${BASE_STYLE}">
      <div style="${CARD_STYLE}">
        ${header('New Registration Request')}
        <div style="${BODY_STYLE}">
          <h3 style="color:#1f2937;margin:0 0 16px;">📋 A new user has requested access</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
            <tr><td style="padding:8px 0;font-weight:600;width:140px;">Full Name</td><td>${opts.fullName}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;">Email</td><td>${opts.email}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;">Department</td><td>${opts.department}</td></tr>
            ${opts.employeeId ? `<tr><td style="padding:8px 0;font-weight:600;">Employee ID</td><td>${opts.employeeId}</td></tr>` : ''}
            ${opts.notes ? `<tr><td style="padding:8px 0;font-weight:600;">Notes</td><td>${opts.notes}</td></tr>` : ''}
          </table>
          <div style="margin-top:28px;text-align:center;">
            <a href="${opts.approveUrl}" style="${BTN_GREEN}">✅ Approve &amp; Create Account</a>
            <a href="${opts.rejectUrl}" style="${BTN_RED}">❌ Reject Request</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:20px;">
            These links expire after use. Clicking Approve will automatically create the account and email the user a temporary password.
          </p>
        </div>
        ${footer()}
      </div>
    </body>
  `;
}

// ── Template: User — Account Approved (with temp password) ────────────────────

export function buildUserApprovedEmail(opts: {
  fullName: string;
  tempPassword: string;
  loginUrl: string;
  department: string;
}): string {
  return `
    <body style="${BASE_STYLE}">
      <div style="${CARD_STYLE}">
        ${header('Your Account Has Been Approved!')}
        <div style="${BODY_STYLE}">
          <h3 style="color:#16a34a;margin:0 0 12px;">🎉 Welcome, ${opts.fullName}!</h3>
          <p style="color:#374151;font-size:14px;line-height:1.6;">
            Your registration request has been approved. You have been assigned to the
            <strong>${opts.department}</strong> department.
          </p>
          <div style="background:#f0fdf4;border:2px solid #bbf7d0;border-radius:10px;padding:20px;margin:20px 0;text-align:center;">
            <p style="color:#166534;font-size:13px;font-weight:600;margin:0 0 8px;">Your Temporary Password</p>
            <p style="font-family:monospace;font-size:24px;font-weight:900;color:#0062b8;letter-spacing:4px;margin:0;">${opts.tempPassword}</p>
          </div>
          <p style="color:#374151;font-size:13px;line-height:1.6;">
            Use this temporary password to log in. You will be immediately prompted to create a new permanent password.
          </p>
          <div style="text-align:center;margin-top:24px;">
            <a href="${opts.loginUrl}" style="${BTN_BLUE}">🔐 Log In Now</a>
          </div>
          <p style="color:#ef4444;font-size:12px;text-align:center;margin-top:16px;">
            ⚠️ Do not share this temporary password with anyone.
          </p>
        </div>
        ${footer()}
      </div>
    </body>
  `;
}

// ── Template: User — Registration Rejected ────────────────────────────────────

export function buildUserRejectedEmail(opts: { fullName: string; adminEmail: string }): string {
  return `
    <body style="${BASE_STYLE}">
      <div style="${CARD_STYLE}">
        ${header('Registration Request Update')}
        <div style="${BODY_STYLE}">
          <h3 style="color:#dc2626;margin:0 0 12px;">Registration Not Approved</h3>
          <p style="color:#374151;font-size:14px;line-height:1.6;">
            Dear ${opts.fullName},<br/><br/>
            Unfortunately, your registration request for the 7 MGD STP Portal could not be approved at this time.
          </p>
          <p style="color:#374151;font-size:14px;line-height:1.6;">
            If you believe this is a mistake or have questions, please contact your supervisor or reach out to the admin at
            <a href="mailto:${opts.adminEmail}" style="color:#0062b8;">${opts.adminEmail}</a>.
          </p>
        </div>
        ${footer()}
      </div>
    </body>
  `;
}

// ── Template: Admin — New Role Promotion Request ──────────────────────────────

export function buildAdminRoleRequestEmail(opts: {
  userName: string;
  userEmail: string;
  currentDept: string;
  requestedDept: string;
  reason?: string | null;
  approveUrl: string;
}): string {
  return `
    <body style="${BASE_STYLE}">
      <div style="${CARD_STYLE}">
        ${header('Role Promotion Request')}
        <div style="${BODY_STYLE}">
          <h3 style="color:#1f2937;margin:0 0 16px;">⬆️ A user is requesting a role promotion</h3>
          <table style="width:100%;border-collapse:collapse;font-size:14px;color:#374151;">
            <tr><td style="padding:8px 0;font-weight:600;width:160px;">User</td><td>${opts.userName}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;">Email</td><td>${opts.userEmail}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;">Current Role</td><td><strong style="color:#6b7280;">${opts.currentDept}</strong></td></tr>
            <tr><td style="padding:8px 0;font-weight:600;">Requested Role</td><td><strong style="color:#0062b8;">${opts.requestedDept}</strong></td></tr>
            ${opts.reason ? `<tr><td style="padding:8px 0;font-weight:600;">Reason</td><td style="font-style:italic;">"${opts.reason}"</td></tr>` : ''}
          </table>
          <div style="margin-top:28px;text-align:center;">
            <a href="${opts.approveUrl}" style="${BTN_GREEN}">✅ Approve Role Change</a>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px;">
            Clicking Approve will instantly update the user's role. To reject, simply ignore this email.
          </p>
        </div>
        ${footer()}
      </div>
    </body>
  `;
}

// ── Template: User — Role Approved ───────────────────────────────────────────

export function buildUserRoleApprovedEmail(opts: {
  userName: string;
  newDept: string;
  loginUrl: string;
}): string {
  return `
    <body style="${BASE_STYLE}">
      <div style="${CARD_STYLE}">
        ${header('Role Promotion Approved!')}
        <div style="${BODY_STYLE}">
          <h3 style="color:#16a34a;margin:0 0 12px;">🎉 Your role has been updated!</h3>
          <p style="color:#374151;font-size:14px;line-height:1.6;">
            Dear ${opts.userName},<br/><br/>
            Your role promotion request has been approved. You are now assigned to the
            <strong>${opts.newDept}</strong> department.
          </p>
          <p style="color:#374151;font-size:14px;line-height:1.6;">
            Your new access permissions will take effect the next time you log in.
          </p>
          <div style="text-align:center;margin-top:24px;">
            <a href="${opts.loginUrl}" style="${BTN_BLUE}">Go to Dashboard</a>
          </div>
        </div>
        ${footer()}
      </div>
    </body>
  `;
}
