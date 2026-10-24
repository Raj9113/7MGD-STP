export async function fetchFile(url: string): Promise<{ blob: Blob; name: string | null }> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `The download failed (${res.status}).`);
  }
  return { blob: await res.blob(), name: /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? null };
}

type NativePlugins = {
  Filesystem: { writeFile(o: { path: string; data: string; directory: string }): Promise<{ uri: string }> };
  Share: { share(o: { title?: string; files: string[] }): Promise<unknown> };
};

type CapacitorGlobal = { isNativePlatform?: () => boolean; registerPlugin?: (name: string) => unknown };

const capacitor = () => (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
const inWebView = () => /; wv\)/.test(navigator.userAgent);

function nativePlugins(): NativePlugins | null {
  const cap = capacitor();
  if (!cap?.registerPlugin || !(cap.isNativePlatform?.() || inWebView())) return null;
  return { Filesystem: cap.registerPlugin('Filesystem'), Share: cap.registerPlugin('Share') } as NativePlugins;
}

async function shareNative(plugins: NativePlugins, blob: Blob, name: string) {
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  const { uri } = await plugins.Filesystem.writeFile({ path: name, data, directory: 'CACHE' });
  await plugins.Share.share({ title: name, files: [uri] });
}

export function saveBlob(blob: Blob, name: string) {
  const plugins = nativePlugins();
  if (!plugins && inWebView()) {
    window.alert('This app build cannot save files. Install the latest APK.');
    return;
  }
  if (plugins) {
    void shareNative(plugins, blob, name).catch((e) => window.alert(`Could not open the file: ${e instanceof Error ? e.message : String(e)}`));
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
