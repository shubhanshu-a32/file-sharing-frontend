import { io } from 'socket.io-client';

const URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5005';

export const socket = io(URL, {
  autoConnect: true,
  transports: ['websocket', 'polling'],
});
