/**
 * Manages URL query parameters and sessionStorage state for seamless page refresh recovery
 */
const SESSION_KEY = 'filesharing_active_session';

export function saveActiveSession(sessionData) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    if (sessionData?.code) {
      const url = new URL(window.location.href);
      url.searchParams.set('code', sessionData.code);
      if (sessionData.role) {
        url.searchParams.set('role', sessionData.role);
      }
      window.history.replaceState({}, '', url.toString());
    }
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

export function getStoredSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        clearActiveSession();
        return null;
      }
      return parsed;
    }

    // Fallback: check URL parameters if sessionStorage was cleared or opened via shared link
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const role = params.get('role') || 'receiver';

    if (code && code.length === 5) {
      return { code, role, fromUrl: true };
    }

    return null;
  } catch (err) {
    console.error('Failed to read session:', err);
    return null;
  }
}

export function clearActiveSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
    const url = new URL(window.location.href);
    url.searchParams.delete('code');
    url.searchParams.delete('role');
    const newSearch = url.searchParams.toString();
    const newUrl = url.pathname + (newSearch ? `?${newSearch}` : '');
    window.history.replaceState({}, '', newUrl);
  } catch (err) {
    console.error('Failed to clear session:', err);
  }
}

export async function verifyRoomActive(code) {
  try {
    const res = await fetch(`/api/upload/room/${code}`);
    if (!res.ok) return null;
    const room = await res.json();
    return room;
  } catch (err) {
    console.error('Failed to verify room:', err);
    return null;
  }
}
