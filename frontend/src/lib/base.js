/**
 * Get the application base path from the build-time constant.
 * Returns '' for root deployments, or the path without trailing slash (e.g., '/mail').
 */
export function getBase() {
  const base = typeof API_BASE !== 'undefined' ? API_BASE : '/';
  return base === '/' ? '' : base.replace(/\/$/, '');
}
