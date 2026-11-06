export const GUEST_ID = 'plt-local-guest';
const view = new URLSearchParams(window.location.search).get('view');
const isVercelHomepage = window.location.hostname === 'plt-phi.vercel.app' && window.location.pathname === '/';

export const isGuestWorkspace = view === 'guest' || (view === null && isVercelHomepage);

export function workspaceStorageKey(key: string) {
  return isGuestWorkspace ? `guest:${key}` : key;
}
