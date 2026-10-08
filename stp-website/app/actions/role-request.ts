'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendEmail, buildAdminRoleRequestEmail } from '@/lib/email';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

const VALID_DEPARTMENTS = ['Mechanical', 'Electrical', 'Housekeeping', 'Laboratory', 'Viewer'];

export interface RoleRequestState {
  success: boolean;
  message: string;
}

export async function submitRoleRequest(
  _prev: RoleRequestState,
  formData: FormData
): Promise<RoleRequestState> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, message: 'You must be logged in to request a role change.' };

    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, department')
      .eq('id', user.id)
      .single();

    const requestedDept = formData.get('requestedDept') as string;
    const reason        = (formData.get('reason') as string)?.trim() || null;

    if (!requestedDept) {
      return { success: false, message: 'Please select a role to request.' };
    }
    if (!VALID_DEPARTMENTS.includes(requestedDept)) {
      return { success: false, message: 'Invalid department selected.' };
    }
    if (requestedDept === profile?.department) {
      return { success: false, message: 'You already have this role.' };
    }

    const admin = createAdminClient();

    // Check for existing pending request from this user
    const { data: existing } = await admin
      .from('role_requests')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .single();

    if (existing) {
      return { success: false, message: 'You already have a pending role request. Please wait for admin review.' };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const userName = profile?.full_name ?? user.email ?? 'Unknown';

    const { error: insertError } = await admin.from('role_requests').insert({
      user_id:              user.id,
      user_name:            userName,
      user_email:           user.email,
      current_department:   profile?.department ?? 'Unknown',
      requested_department: requestedDept,
      reason,
      token,
      status: 'pending',
    });

    if (insertError) {
      console.error('[role-request] Insert error:', insertError);
      return { success: false, message: 'Failed to submit request. Please try again.' };
    }

    // Send email to admin
    const siteUrl    = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const adminEmail = process.env.ADMIN_EMAIL ?? process.env.SMTP_USER;

    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `[7MGD STP] Role Promotion Request — ${userName}`,
        html: buildAdminRoleRequestEmail({
          userName,
          userEmail:    user.email ?? '',
          currentDept:  profile?.department ?? 'Unknown',
          requestedDept,
          reason,
          approveUrl: `${siteUrl}/api/admin/approve-role?token=${token}`,
        }),
      });
    }

    revalidatePath('/dashboard/admin');
    return {
      success: true,
      message: '✅ Role request submitted! The admin will review it and you will be notified by email.',
    };
  } catch (err) {
    console.error('[role-request] Unexpected error:', err);
    return { success: false, message: 'An unexpected error occurred. Please try again.' };
  }
}
