'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, buildAdminRegistrationRequestEmail } from '@/lib/email';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';

const VALID_DEPARTMENTS = ['Mechanical', 'Electrical', 'Housekeeping', 'Viewer'];

export interface RegistrationRequestState {
  success: boolean;
  message: string;
}

export async function submitRegistrationRequest(
  _prev: RegistrationRequestState,
  formData: FormData
): Promise<RegistrationRequestState> {
  try {
    const fullName   = (formData.get('fullName')   as string)?.trim();
    const email      = (formData.get('email')      as string)?.trim().toLowerCase();
    const department = formData.get('department')  as string;
    const employeeId = (formData.get('employeeId') as string)?.trim() || null;
    const notes      = (formData.get('notes')      as string)?.trim() || null;

    if (!fullName || !email || !department) {
      return { success: false, message: 'Full name, email, and department are required.' };
    }
    if (!VALID_DEPARTMENTS.includes(department)) {
      return { success: false, message: 'Invalid department selected.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    const admin = createAdminClient();

    // Check if email already has a pending request
    const { data: existing } = await admin
      .from('registration_requests')
      .select('id, status')
      .eq('email', email)
      .in('status', ['pending'])
      .single();

    if (existing) {
      return {
        success: false,
        message: 'A registration request for this email is already pending. Please wait for admin review.',
      };
    }

    // Check if user already exists in auth
    const { data: authUsers } = await admin.auth.admin.listUsers();
    const alreadyExists = authUsers?.users?.some((u) => u.email === email);
    if (alreadyExists) {
      return { success: false, message: 'An account with this email already exists. Please log in directly.' };
    }

    // Generate a secure token for the admin approval link
    const token = crypto.randomBytes(32).toString('hex');

    // Insert the request
    const { error: insertError } = await admin.from('registration_requests').insert({
      full_name:   fullName,
      email,
      department,
      employee_id: employeeId,
      notes,
      token,
      status:      'pending',
    });

    if (insertError) {
      console.error('[registration] Insert error:', insertError);
      return { success: false, message: 'Failed to submit request. Please try again.' };
    }

    // Send email to admin
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
    const adminEmail = process.env.ADMIN_EMAIL ?? process.env.SMTP_USER;

    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `[7MGD STP] New Registration Request — ${fullName}`,
        html: buildAdminRegistrationRequestEmail({
          fullName,
          email,
          department,
          employeeId,
          notes,
          approveUrl: `${siteUrl}/api/admin/approve-registration?token=${token}`,
          rejectUrl:  `${siteUrl}/api/admin/reject-registration?token=${token}`,
        }),
      });
    }

    revalidatePath('/dashboard/admin');
    return {
      success: true,
      message: '✅ Your request has been submitted! The admin will review it and you will receive an email once approved.',
    };
  } catch (err) {
    console.error('[registration] Unexpected error:', err);
    return { success: false, message: 'An unexpected error occurred. Please try again.' };
  }
}
