import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, buildUserRoleApprovedEmail } from '@/lib/email';
import { logActivity } from '@/lib/supabase/logger';

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

  const { data: roleRequest, error: fetchError } = await admin
    .from('role_requests')
    .select('*')
    .eq('token', token)
    .single();

  if (fetchError || !roleRequest) {
    return new NextResponse(htmlPage('Invalid Link', '#dc2626', '❌', '<p>This link is invalid or has already been used.</p>'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    });
  }

  if (roleRequest.status !== 'pending') {
    return new NextResponse(htmlPage('Already Processed', '#f59e0b', '⚠️',
      `<p>This role request has already been <strong>${roleRequest.status}</strong>.</p>`), {
      status: 200, headers: { 'Content-Type': 'text/html' },
    });
  }

  // Update the user's department
  const { error: updateError } = await admin
    .from('profiles')
    .update({ department: roleRequest.requested_department })
    .eq('id', roleRequest.user_id);

  if (updateError) {
    return new NextResponse(htmlPage('Error', '#dc2626', '❌',
      `<p>Failed to update role: ${updateError.message}</p>`), {
      status: 500, headers: { 'Content-Type': 'text/html' },
    });
  }

  // Mark request as approved
  await admin.from('role_requests').update({
    status:      'approved',
    reviewed_at: new Date().toISOString(),
  }).eq('id', roleRequest.id);

  // Log the event
  await logActivity({
    userId:     roleRequest.user_id,
    userName:   roleRequest.user_name,
    userEmail:  roleRequest.user_email,
    department: roleRequest.requested_department,
    action:     'UPDATE_ROLE',
    details:    `Role changed from ${roleRequest.current_department} → ${roleRequest.requested_department} (approved via email link)`,
    request,
  });

  // Email the user confirmation
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  await sendEmail({
    to:      roleRequest.user_email ?? '',
    subject: '[7MGD STP] Your Role Has Been Updated!',
    html:    buildUserRoleApprovedEmail({
      userName:  roleRequest.user_name ?? 'User',
      newDept:   roleRequest.requested_department,
      loginUrl:  `${siteUrl}/dashboard`,
    }),
  });

  return new NextResponse(
    htmlPage('Role Updated!', '#16a34a', '✅',
      `<p><strong>${roleRequest.user_name}</strong> has been promoted from <strong>${roleRequest.current_department}</strong> to <strong>${roleRequest.requested_department}</strong>.</p>
       <p>The user has been notified by email and their access has been updated immediately.</p>`),
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}
