// Shared UI snapshot only. Firestore permissions remain the source of authorization.
let state = { requests: [], selectedId: null };
let actions = {};
const listeners = new Set();
export function adminSnapshot() { return state; }
export function adminActions() { return actions; }
export function connectAdmin(next) { actions = next; }
export function publishAdmin(next, reason) {
  state = { ...state, ...next };
  for (const listener of listeners) {
    try { listener(state, reason); } catch (error) { console.error('Admin extension failed', error); }
  }
}
export function subscribeAdmin(listener) {
  listeners.add(listener);
  listener(state, 'init');
  return () => listeners.delete(listener);
}
