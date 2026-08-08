/**
 * Base Backend URL configuration
 * If running on HTTPS (e.g. Vercel) and VITE_BACKEND_URL is insecure http://,
 * default to relative URL ('') so vercel.json rewrite proxy handles API requests over HTTPS!
 */
const rawUrl = (import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, "");
const isHttpsPage =
  typeof window !== "undefined" && window.location.protocol === "https:";

export const BACKEND_URL =
  isHttpsPage && rawUrl.startsWith("http://") ? "" : rawUrl;

export function getApiUrl(path) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${BACKEND_URL}${cleanPath}`;
}
