type Listener = () => void;

let target: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

export const subscribeNav = (l: Listener) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
export const getNavTarget = () => target;

const key = (u: URL) => u.pathname + u.search;

export function startNav(href: string) {
  const to = new URL(href, window.location.href);
  if (to.origin !== window.location.origin || key(to) === window.location.pathname + window.location.search) return;
  target = key(to);
  clearTimeout(timer);
  timer = setTimeout(endNav, 15000);
  emit();
}

export function endNav() {
  clearTimeout(timer);
  if (target !== null) { target = null; emit(); }
}

type PushOptions = { scroll?: boolean };
export function navigate(router: { push: (h: string, o?: PushOptions) => void; replace: (h: string, o?: PushOptions) => void }, href: string, opts?: PushOptions & { replace?: boolean }) {
  startNav(href);
  if (opts?.replace) router.replace(href, opts);
  else router.push(href, opts);
}
