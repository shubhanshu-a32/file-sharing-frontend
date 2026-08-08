/**
 * Base Backend URL configuration
 * On Vercel: If VITE_BACKEND_URL is set, uses that domain.
 * Otherwise defaults to relative URL ('') so Vite proxy / vercel.json rewrites handle API routing.
 */
export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

export function getApiUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${BACKEND_URL}${cleanPath}`;
}
