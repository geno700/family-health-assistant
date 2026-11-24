// Navigation helpers for views (kept apart from app.js to avoid circular imports).

let rerenderHook = () => {};

export function setRerender(fn) {
  rerenderHook = fn;
}

/** Go to a route like "meds/new". */
export function go(path) {
  const target = `#/${path}`;
  if (location.hash === target) rerenderHook();
  else location.hash = target;
}

/** Redraw the current screen from scratch (after a change that affects the whole app). */
export function rerender() {
  rerenderHook();
}
