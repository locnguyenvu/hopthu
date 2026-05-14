/**
 * Get the application base path from the build-time constant.
 * Returns '' for root deployments, or the path without trailing slash (e.g., '/mail').
 */
export function getBase() {
  const base = typeof API_BASE !== 'undefined' ? API_BASE : '/';
  return base === '/' ? '' : base.replace(/\/$/, '');
}

/**
 * Build a full path with the base prefix.
 * Use for href attributes and route() calls.
 */
export function bp(path) {
  const base = getBase();
  return base + path;
}
