'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { canEditLab } from '@/lib/access';
import { logActivity } from '@/lib/supabase/logger';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { MAX_PHOTO_BYTES, PHOTO_KINDS, PHOTO_LABEL, todayIST, type PhotoKind } from '@/app/dashboard/laboratory/entry-fields';
import { parseEntry } from '@/app/dashboard/laboratory/entry-validate';
import { isMissingTable } from '@/app/dashboard/laboratory/lab-live';

const BUCKET = 'lab-photos';
const EXT: Record<string, string> = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' };

export interface SaveLabState {
  success: boolean;
  message: string;
  date?: string;
  errors?: Record<string, string>;
}

interface StoredPhoto { kind: PhotoKind; path: string }

/** The signed-in user, only if they may enter lab reports (Laboratory role or Admin). */
async function assertLabEditor() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated.');

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, department')
    .eq('id', user.id)
    .single();

  if (!canEditLab(profile?.department ?? 'Unknown')) {
    throw new Error('Only the Laboratory team and Admin can enter lab reports.');
  }
  return { user, profile: profile! };
}

export async function saveLabEntry(_prev: SaveLabState, formData: FormData): Promise<SaveLabState> {
  try {
    const { user, profile } = await assertLabEditor();

    const parsed = parseEntry((name) => {
      const v = formData.get(name);
      return typeof v === 'string' ? v : null;
    }, todayIST());
    if (!parsed.ok) {
      return { success: false, message: 'Please correct the highlighted fields.', errors: parsed.errors };
    }

    // Photos: validate before touching storage
    const uploads: { kind: PhotoKind; file: File; ext: string }[] = [];
    for (const kind of PHOTO_KINDS) {
      const f = formData.get(`photo_${kind}`);
      if (!(f instanceof File) || f.size === 0) continue;
      const ext = EXT[f.type];
      if (!ext) return { success: false, message: `${PHOTO_LABEL[kind]}: use a JPEG, PNG or WebP image.`, errors: { [`photo_${kind}`]: 'Unsupported image type.' } };
      if (f.size > MAX_PHOTO_BYTES) {
        return { success: false, message: `${PHOTO_LABEL[kind]} is too large (${(f.size / 1048576).toFixed(1)} MB, limit 2 MB).`, errors: { [`photo_${kind}`]: 'Too large.' } };
      }
      uploads.push({ kind, file: f, ext });
    }

    const admin = createAdminClient();
    const { data: existing, error: readErr } = await admin
      .from('lab_daily')
      .select('photos, created_by, created_by_name')
      .eq('date', parsed.date)
      .maybeSingle();
    if (readErr) {
      return {
        success: false,
        message: isMissingTable(readErr)
          ? 'Daily entry is not set up yet: the administrator must run supabase/lab-entry.sql in Supabase once.'
          : `Could not save: ${readErr.message}`,
      };
    }

    // Upload new photos (replacing the same day's earlier ones)
    const month = parsed.date.slice(0, 7);
    const day = parsed.date.slice(8, 10);
    const photos: StoredPhoto[] = ((existing?.photos ?? []) as StoredPhoto[]).filter((p) => PHOTO_KINDS.includes(p.kind));
    const stale: string[] = [];
    for (const u of uploads) {
      const path = `${month}/${day}-${u.kind}.${u.ext}`;
      const { error } = await admin.storage.from(BUCKET).upload(path, Buffer.from(await u.file.arrayBuffer()), {
        contentType: u.file.type,
        upsert: true,
      });
      if (error) {
        return {
          success: false,
          message: /bucket/i.test(error.message)
            ? 'Photo storage is not set up yet: the administrator must run supabase/lab-entry.sql in Supabase once.'
            : `Could not upload the ${u.kind === 'olms' ? 'OLMS' : 'sample'} photograph: ${error.message}`,
        };
      }
      const i = photos.findIndex((p) => p.kind === u.kind);
      if (i >= 0) {
        if (photos[i].path !== path) stale.push(photos[i].path);
        photos[i] = { kind: u.kind, path };
      } else {
        photos.push({ kind: u.kind, path });
      }
    }
    if (stale.length) await admin.storage.from(BUCKET).remove(stale);

    const now = new Date().toISOString();
    const who = profile.full_name || user.email || 'Unknown';
    const { error: saveErr } = await admin.from('lab_daily').upsert(
      {
        date: parsed.date,
        readings: parsed.readings,
        power: parsed.power,
        photos,
        created_by: existing?.created_by ?? user.id,
        created_by_name: existing?.created_by_name ?? who,
        updated_by: user.id,
        updated_by_name: who,
        updated_at: now,
      },
      { onConflict: 'date' },
    );
    if (saveErr) return { success: false, message: `Could not save: ${saveErr.message}` };

    await logActivity({
      userId: user.id,
      userName: profile.full_name,
      userEmail: user.email,
      department: profile.department,
      action: existing ? 'DATA_UPDATE' : 'DATA_ENTRY',
      details: `Laboratory report ${parsed.date} ${existing ? 'updated' : 'entered'}${uploads.length ? ` (${uploads.length} photo${uploads.length > 1 ? 's' : ''})` : ''}`,
      request: { headers: await headers() },
    });

    revalidatePath('/dashboard/laboratory');
    return {
      success: true,
      date: parsed.date,
      message: existing ? `Report for ${parsed.date} updated.` : `Report for ${parsed.date} saved.`,
    };
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Something went wrong. Please try again.' };
  }
}
