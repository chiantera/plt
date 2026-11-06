export const GUEST_ID = 'plt-local-guest';
export const isGuestWorkspace = new URLSearchParams(window.location.search).get('view') === 'guest';

export function workspaceStorageKey(key: string) {
  return isGuestWorkspace ? `guest:${key}` : key;
}
