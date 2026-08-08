import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cloud, Lock, Server } from 'lucide-react';
import { socket } from '../utils/socket';

export default function Header() {
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }
    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return (
    <header style={{ padding: '24px 0 16px', marginBottom: '8px' }}>
      <div style={{
        maxWidth: '1100px',
        margin: '0 auto',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Brand Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 25px rgba(99, 102, 241, 0.4)'
          }}>
            <Lock size={24} color="#ffffff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.7rem', margin: 0, lineHeight: 1.2 }} className="gradient-title">
              File Sharing
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Ephemeral 10GB Peer-Approved File Share
            </p>
          </div>
        </div>

        {/* Real-time Connection Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="badge badge-emerald">
            <span className={`status-dot ${isConnected ? 'status-dot-active' : ''}`}></span>
            <span>{isConnected ? 'Sockets Live' : 'Connecting...'}</span>
          </div>
          <div className="badge badge-cyan">
            <Cloud size={14} /> S3 Direct Presigned
          </div>
          <div className="badge badge-violet">
            <ShieldCheck size={14} /> Max 10 GB
          </div>
        </div>
      </div>
    </header>
  );
}
