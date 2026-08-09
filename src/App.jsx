import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import FileUploader from './components/FileUploader';
import RoomSenderView from './components/RoomSenderView';
import RoomReceiverView from './components/RoomReceiverView';
import { UploadCloud, DownloadCloud, ShieldCheck, Zap, HardDrive, Clock, Sparkles } from 'lucide-react';
import { getStoredSession, clearActiveSession, verifyRoomActive } from './utils/sessionStorage';

export default function App() {
  const [activeTab, setActiveTab] = useState('send'); // 'send' | 'receive'
  const [activeRoom, setActiveRoom] = useState(null);
  const [restoredReceiverState, setRestoredReceiverState] = useState(null);
  const [isRestoringSession, setIsRestoringSession] = useState(true);

  // Restore session from sessionStorage or URL query params on page load
  useEffect(() => {
    async function restoreSession() {
      try {
        const stored = getStoredSession();
        if (stored && stored.code) {
          const room = await verifyRoomActive(stored.code);
          if (room) {
            if (stored.role === 'sender') {
              setActiveRoom({
                ...(stored.roomData || {}),
                ...room,
                receivers: stored.receivers || room.receivers || [],
                receiverInfo: stored.receiverInfo || room.receiverInfo || null,
                approvalState: stored.approvalState || room.approvalState || null,
              });
            } else {
              setActiveTab('receive');
              const currentReceiverName = stored.receiverName || '';
              const matchedRec = Array.isArray(room.receivers)
                ? room.receivers.find((r) => r.receiverName.toLowerCase() === currentReceiverName.toLowerCase())
                : null;

              setRestoredReceiverState({
                code: stored.code,
                receiverName: currentReceiverName || matchedRec?.receiverName || '',
                roomData: { ...(stored.roomData || {}), ...room },
                isWaitingApproval: matchedRec
                  ? matchedRec.approvalState === 'pending'
                  : stored.isWaitingApproval !== undefined
                  ? Boolean(stored.isWaitingApproval)
                  : room.approvalState === 'pending',
                downloadUrls: matchedRec?.downloadUrls || stored.downloadUrls || room.downloadUrls || null,
                downloadUrl: stored.downloadUrl || matchedRec?.downloadUrls?.[0]?.downloadUrl || room.downloadUrls?.[0]?.downloadUrl || null,
              });
            }
          } else {
            clearActiveSession();
          }
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
        clearActiveSession();
      } finally {
        setIsRestoringSession(false);
      }
    }

    restoreSession();
  }, []);

  const handleResetSender = () => {
    clearActiveSession();
    setActiveRoom(null);
  };

  if (isRestoringSession) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '1rem', fontFamily: 'var(--font-heading)', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Sparkles size={20} color="#06b6d4" className="animate-spin" /> Restoring session...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />

      <main style={{ flex: 1, maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '10px 24px 60px' }}>
        {/* Navigation Tabs */}
        {!activeRoom && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '36px' }}>
            <div className="tab-switcher">
              <button
                className={`tab-btn ${activeTab === 'send' ? 'active' : ''}`}
                onClick={() => setActiveTab('send')}
              >
                <UploadCloud size={18} /> Send File (Up to 10GB)
              </button>
              <button
                className={`tab-btn ${activeTab === 'receive' ? 'active' : ''}`}
                onClick={() => setActiveTab('receive')}
              >
                <DownloadCloud size={18} /> Receive File (Enter Code)
              </button>
            </div>
          </div>
        )}

        {/* View Routing */}
        {activeRoom ? (
          <RoomSenderView roomData={activeRoom} onReset={handleResetSender} />
        ) : activeTab === 'send' ? (
          <FileUploader onUploadComplete={(room) => setActiveRoom(room)} />
        ) : (
          <RoomReceiverView
            initialCode={restoredReceiverState?.code || ''}
            initialReceiverName={restoredReceiverState?.receiverName || ''}
            initialRoomData={restoredReceiverState?.roomData || null}
            initialWaiting={restoredReceiverState?.isWaitingApproval || false}
            initialDownloadUrl={restoredReceiverState?.downloadUrl || null}
            initialDownloadUrls={restoredReceiverState?.downloadUrls || null}
          />
        )}

        {/* High-End Feature Highlights Grid */}
        {!activeRoom && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '24px',
            marginTop: '64px'
          }}>
            <div className="glass-card" style={{ padding: '28px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <HardDrive size={26} color="#38bdf8" />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>10 GB High-Volume Multipart</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Direct S3 presigned multipart streaming. Handles 4K videos, massive zip archives, and raw media assets with multi-threaded parallel uploads.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '28px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(139, 92, 246, 0.15)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <Clock size={26} color="#c084fc" />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Auto-Expiring Lifetime</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Configurable storage duration (1.5m to 2 hours). Files are permanently purged from S3 and memory as soon as the timer expires.
              </p>
            </div>

            <div className="glass-card" style={{ padding: '28px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px'
              }}>
                <ShieldCheck size={26} color="#818cf8" />
              </div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Real-Time Peer Authorization</h3>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                WebSocket handshake requiring the sender to explicitly approve download requests before presigned URLs are dispatched.
              </p>
            </div>
          </div>
        )}
      </main>

      <footer style={{
        textAlign: 'center',
        padding: '28px 24px',
        borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        color: 'var(--text-dim)',
        fontSize: '0.85rem'
      }}>
        File Sharing Ephemeral System • Powered by React, Node.js, Socket.io & AWS S3
      </footer>
    </div>
  );
}
