import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, buildUserApprovedEmail } from '@/lib/email';
import { logActivity } from '@/lib/supabase/logger';
import crypto from 'crypto';

/** Generate a random strong temp password */
function generateTempPassword(): string {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '#@!';
  const all     = upper + lower + digits + special;

  const rand = (set: string) => set[crypto.randomInt(set.length)];

  // Guarantee at least one of each type
  const required = [rand(upper), rand(lower), rand(digits), rand(special)];
  const rest = Array.from({ length: 8 }, () => rand(all));

  return [...required, ...rest]
    .sort(() => crypto.randomInt(3) - 1) // shuffle
    .join('');
}

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
    return new NextResponse(htmlPage('Invalid Link', '#dc2626', '❌', '<p>This link is invalid or has expired.</p>'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    });
  }

  const admin = createAdminClient();

  // Look up the request by token
  const { data: regRequest, error: fetchError } = await admin
    .from('registration_requests')
    .select('*')
    .eq('token', token)
    .single();

  if (fetchError || !regRequest) {
    return new NextResponse(htmlPage('Invalid Link', '#dc2626', '❌', '<p>This approval link is invalid or has already been used.</p>'), {
      status: 400, headers: { 'Content-Type': 'text/html' },
    });
  }

  if (regRequest.status !== 'pending') {
    return new NextResponse(htmlPage('Already Processed', '#f59e0b', '⚠️',
      `<p>This request has already been <strong>${regRequest.status}</strong>.</p>`), {
      status: 200, headers: { 'Content-Type': 'text/html' },
    });
  }

  // Generate a temp password
  const tempPassword = generateTempPassword();

  // Create the user in Supabase Auth
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email:            regRequest.email,
    password:         tempPassword,
    email_confirm:    true,          // skip email confirmation — admin already verified
    user_metadata:    { full_name: regRequest.full_name },
  });

  if (createError || !newUser?.user) {
    console.error('[approve-registration] createUser error:', createError);
    return new NextResponse(htmlPage('Error', '#dc2626', '❌',
      `<p>Failed to create account: ${createError?.message ?? 'Unknown error'}. Please try from the admin panel.</p>`), {
      status: 500, headers: { 'Content-Type': 'text/html' },
    });
  }

  const userId = newUser.user.id;

  // Upsert profile with department + must_change_password flag
  await admin.from('profiles').upsert({
    id:                  userId,
    full_name:           regRequest.full_name,
    department:          regRequest.department,
    employee_id:         regRequest.employee_id ?? null,
    must_change_password: true,
  });

  // Mark request as approved
  await admin.from('registration_requests').update({
    status:      'approved',
    reviewed_at: new Date().toISOString(),
  }).eq('id', regRequest.id);

  // Log the event
  await logActivity({
    userId:     null,
    userName:   'System (Admin Email Link)',
    userEmail:  null,
    department: 'Admin',
    action:     'INVITE_USER',
    details:    `Approved registration request for ${regRequest.full_name} (${regRequest.email}) as ${regRequest.department}`,
    request,
  });

  // Email the user their temp password
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  await sendEmail({
    to:      regRequest.email,
    subject: '[7MGD STP] Your Account Has Been Approved!',
    html:    buildUserApprovedEmail({
      fullName:     regRequest.full_name,
      tempPassword,
      department:   regRequest.department,
      loginUrl:     `${siteUrl}/login`,
    }),
  });

  return new NextResponse(
    htmlPage('Account Created!', '#16a34a', '✅',
      `<p>The account for <strong>${regRequest.full_name}</strong> (${regRequest.email}) has been created as <strong>${regRequest.department}</strong>.</p>
       <p>A temporary password has been emailed to them.</p>`),
    { status: 200, headers: { 'Content-Type': 'text/html' } }
  );
}
