import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { formatTimer } from '../utils/s3UploadHelpers';

export default function ExpiryTimer({ expiresAt, onExpired }) {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor((expiresAt - Date.now()) / 1000)));

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (onExpired) onExpired();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const isCritical = timeLeft <= 30;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 18px',
      borderRadius: '12px',
      background: isCritical ? 'rgba(239, 68, 68, 0.15)' : 'rgba(99, 102, 241, 0.15)',
      border: `1px solid ${isCritical ? 'rgba(239, 68, 68, 0.4)' : 'rgba(99, 102, 241, 0.3)'}`,
      color: isCritical ? '#fca5a5' : '#a5b4fc',
      fontWeight: 600,
      fontFamily: 'var(--font-mono)'
    }}>
      {isCritical ? <AlertTriangle size={18} className="pulse-box" /> : <Clock size={18} />}
      <span>Expiring in: {formatTimer(timeLeft)}</span>
    </div>
  );
}
