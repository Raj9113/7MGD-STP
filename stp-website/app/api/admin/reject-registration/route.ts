import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, buildUserRejectedEmail } from '@/lib/email';

function htmlPage(title: string, color: string, emoji: string, body: string): string {
  return `<!DOCTYPE html><html><head><title>${title}</title>
  <style>
    body { font-family: -apple-system, sans-serif; background:#f3f4f6; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
    .card { background:#fff; border-radius:16px; border:2px solid ${color}; padding:40px 48px; max-width:480px; text-align:center; box-shadow:0 8px 32px rgba(0,0,0,.12); }
    h1 { color:${color}; font-size:22px; margin:12px 0; }
    p { color:#374151; font-size:15px; line-height:1.6; }
  </style></head><body>
  <div class="card">
    <div style="font-size:52px">${emoji}</div>
    <h1>${title}</h1>
    ${body}
  </div></body></html>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return new NextResponse(htmlPage('Invalid Link', '#dc2626', '❌', '<p>This link is invalid.</p>'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    });
  }

  const admin = createAdminClient();

  const { data: regRequest, error: fetchError } = await admin
    .from('registration_requests')
    .select('*')
    .eq('token', token)
    .single();

  if (fetchError || !regRequest) {
    return new NextResponse(htmlPage('Invalid Link', '#dc2626', '❌', '<p>This link is invalid or has already been used.</p>'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    });
  }

  if (regRequest.status !== 'pending') {
    return new NextResponse(htmlPage('Already Processed', '#f59e0b', '⚠️',
      `<p>This request has already been <strong>${regRequest.status}</strong>.</p>`), {
      status: 200, headers: { 'Content-Type': 'text/html' },
    });
  }

  // Mark as rejected
  await admin.from('registration_requests').update({
    status:      'rejected',
    reviewed_at: new Date().toISOString(),
  }).eq('id', regRequest.id);

  // Notify the user
  const adminEmail = process.env.ADMIN_EMAIL ?? process.env.SMTP_USER ?? '';
  await sendEmail({
    to:      regRequest.email,
    subject: '[7MGD STP] Registration Request Update',
    html:    buildUserRejectedEmail({ fullName: regRequest.full_name, adminEmail }),
  });

  return new NextResponse(
    htmlPage('Request Rejected', '#dc2626', '❌',
      `<p>The registration request from <strong>${regRequest.full_name}</strong> (${regRequest.email}) has been rejected.</p>
       <p>The user has been notified by email.</p>`),
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}
