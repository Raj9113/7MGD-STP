import { createAdminClient } from '@/lib/supabase/admin';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const PHOTO_FILE = /^\d{2}-(olms|sample)\.(jpeg|png|webp)$/;
export const PHOTO_TYPES: Record<string, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

export async function readLabPhoto(month: string, file: string): Promise<Buffer | null> {
  if (!/^\d{4}-\d{2}$/.test(month) || !PHOTO_FILE.test(file)) return null;

  try {
    const { data } = await createAdminClient().storage.from('lab-photos').download(`${month}/${file}`);
    if (data) return Buffer.from(await data.arrayBuffer());
  } catch {
  }

  try {
    return await readFile(path.join(process.cwd(), 'data', 'lab', 'photos', month, file));
  } catch {
    return null;
  }
}

export function parsePhotoSrc(src: string): { month: string; file: string } | null {
  const m = /^\/api\/lab\/photo\/(\d{4}-\d{2})\/([^/?]+)/.exec(src);
  return m && PHOTO_FILE.test(m[2]) ? { month: m[1], file: m[2] } : null;
}
