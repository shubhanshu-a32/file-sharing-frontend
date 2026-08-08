import { io } from 'socket.io-client';

// If running in browser on HTTPS (e.g. Vercel), use undefined (current origin)
// so Vercel's vercel.json rewrite rule proxies /socket.io over secure HTTPS polling
const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';

const URL = isHttps ? undefined : (import.meta.env.VITE_BACKEND_URL || 'http://localhost:5005');

export const socket = io(URL, {
  autoConnect: true,
  transports: ['polling', 'websocket'],
});
