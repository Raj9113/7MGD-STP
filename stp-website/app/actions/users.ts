'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const VALID_DEPARTMENTS = ['Mechanical', 'Electrical', 'Housekeeping', 'Admin', 'Viewer'];

/** Verify that the currently logged-in user is an Admin. */
async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) throw new Error('Not authenticated.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('department')
    .eq('id', user.id)
    .single();

  if (profile?.department !== 'Admin') {
    throw new Error('Forbidden — Admin access required.');
  }
}

// ── Invite New User ────────────────────────────────────────────────────────────

export interface InviteUserState {
  success: boolean;
  message: string;
}

export async function inviteUser(
  _prev: InviteUserState,
  formData: FormData
): Promise<InviteUserState> {
  try {
    await assertAdmin();

    const email = (formData.get('email') as string)?.trim().toLowerCase();
    const fullName = (formData.get('fullName') as string)?.trim();
    const department = formData.get('department') as string;
    const employeeId = (formData.get('employeeId') as string)?.trim();

    if (!email || !fullName || !department) {
      return { success: false, message: 'Email, Full Name, and Department are required.' };
    }

    if (!VALID_DEPARTMENTS.includes(department)) {
      return { success: false, message: 'Invalid department selected.' };
    }

    const admin = createAdminClient();

    // Invite the user — Supabase sends them an email with a magic link
    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      email,
      {
        data: { full_name: fullName },
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/auth/callback`,
      }
    );

    if (inviteError) {
      // Common case: user already exists
      if (inviteError.message.includes('already been registered')) {
        return { success: false, message: `A user with email "${email}" already exists.` };
      }
      return { success: false, message: inviteError.message };
    }

    const newUserId = inviteData.user?.id;
    if (!newUserId) {
      return { success: false, message: 'User created but ID not returned. Check Supabase dashboard.' };
    }

    // Update the auto-created profile row with department + employee ID
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: newUserId,
        full_name: fullName,
        department,
        employee_id: employeeId || null,
      });

    if (profileError) {
      return {
        success: false,
        message: `User invited but profile update failed: ${profileError.message}`,
      };
    }

    revalidatePath('/dashboard/admin');
    return {
      success: true,
      message: `✅ Invite sent to ${email}. They will receive an email to set their password.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, message };
  }
}

// ── Update User Department ─────────────────────────────────────────────────────

export interface UpdateDeptState {
  success: boolean;
  message: string;
}

export async function updateUserDepartment(
  _prev: UpdateDeptState,
  formData: FormData
): Promise<UpdateDeptState> {
  try {
    await assertAdmin();

    const userId = formData.get('userId') as string;
    const department = formData.get('department') as string;

    if (!userId || !department) {
      return { success: false, message: 'User ID and department are required.' };
    }

    if (!VALID_DEPARTMENTS.includes(department)) {
      return { success: false, message: 'Invalid department.' };
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from('profiles')
      .update({ department })
      .eq('id', userId);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath('/dashboard/admin');
    return { success: true, message: `Department updated to ${department}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, message };
  }
}

// ── Delete / Disable User ─────────────────────────────────────────────────────

export interface DeleteUserState {
  success: boolean;
  message: string;
}

export async function deleteUser(
  _prev: DeleteUserState,
  formData: FormData
): Promise<DeleteUserState> {
  try {
    await assertAdmin();

    const userId = formData.get('userId') as string;
    if (!userId) return { success: false, message: 'User ID is required.' };

    const admin = createAdminClient();

    // Delete from auth — cascade will remove profile row too
    const { error } = await admin.auth.admin.deleteUser(userId);

    if (error) {
      return { success: false, message: error.message };
    }

    revalidatePath('/dashboard/admin');
    return { success: true, message: 'User deleted successfully.' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { success: false, message };
  }
}
