/** Browser helpers: fetch a generated file (showing the server's error message if it fails) and save it with its server-given name. */
export async function fetchFile(url: string): Promise<{ blob: Blob; name: string | null }> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `The download failed (${res.status}).`);
  }
  return { blob: await res.blob(), name: /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? null };
}

export function saveBlob(blob: Blob, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
