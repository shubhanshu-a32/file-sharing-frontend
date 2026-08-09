import React, { useState, useEffect } from 'react';
import { Copy, Check, UserCheck, File, ShieldCheck, XCircle, Share2, Link as LinkIcon, Layers } from 'lucide-react';
import ExpiryTimer from './ExpiryTimer';
import { formatBytes, getFileTypeLabel } from '../utils/s3UploadHelpers';
import { socket } from '../utils/socket';
import { saveActiveSession, clearActiveSession } from '../utils/sessionStorage';
import { getApiUrl } from '../utils/apiConfig';

export default function RoomSenderView({ roomData, onReset }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [receiversList, setReceiversList] = useState(
    roomData?.receivers || (roomData?.receiverInfo ? [roomData.receiverInfo] : [])
  );

  // Sync internal state when roomData prop updates
  useEffect(() => {
    if (Array.isArray(roomData?.receivers) && roomData.receivers.length > 0) {
      setReceiversList(roomData.receivers);
    }
  }, [roomData?.receivers]);

  // Persist session whenever receiversList or roomData changes
  useEffect(() => {
    if (!roomData?.code) return;

    saveActiveSession({
      role: 'sender',
      code: roomData.code,
      uploaderName: roomData.uploaderName,
      roomData,
      receivers: receiversList,
      receiverInfo: receiversList[0] || null,
      approvalState: receiversList[0]?.approvalState || null,
      expiresAt: roomData.expiresAt,
    });
  }, [roomData, receiversList]);

  // Socket listener setup
  useEffect(() => {
    if (!roomData?.code) return;

    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('join-as-uploader', { code: roomData.code });

    const handleReceiversUpdated = (data) => {
      console.log('[Uploader Socket] Receivers updated:', data);
      const updated = data.receivers || [];
      setReceiversList(updated);
    };

    const handleReceiverJoined = (data) => {
      console.log('[Uploader Socket] Receiver joined:', data);
      if (data.receivers) {
        setReceiversList(data.receivers);
      } else if (data.receiverName) {
        setReceiversList((prev) => {
          const cleanName = data.receiverName.trim().toLowerCase();
          const exists = prev.some((r) => r.receiverName.trim().toLowerCase() === cleanName);
          if (exists) {
            return prev.map((r) => r.receiverName.trim().toLowerCase() === cleanName ? { ...r, approvalState: 'pending', socketId: data.socketId || r.socketId } : r);
          }
          return [...prev, { id: data.id || data.socketId, receiverName: data.receiverName, approvalState: 'pending' }];
        });
      }
    };

    socket.on('receivers-updated', handleReceiversUpdated);
    socket.on('receiver-joined', handleReceiverJoined);

    return () => {
      socket.off('receivers-updated', handleReceiversUpdated);
      socket.off('receiver-joined', handleReceiverJoined);
    };
  }, [roomData?.code]);

  const copyCode = () => {
    navigator.clipboard.writeText(roomData.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyShareLink = () => {
    const shareUrl = `${window.location.origin}/?code=${roomData.code}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const approveDownload = (rec) => {
    const receiverId = typeof rec === 'object' ? rec.id : rec;
    const receiverName = typeof rec === 'object' ? rec.receiverName : null;

    socket.emit('approve-download', { code: roomData.code, receiverId, receiverName });
    setReceiversList((prev) =>
      prev.map((r) =>
        r.id === receiverId || r.socketId === receiverId || (receiverName && r.receiverName.toLowerCase() === String(receiverName).toLowerCase())
          ? { ...r, approvalState: 'approved' }
          : r
      )
    );
  };

  const rejectDownload = (rec) => {
    const receiverId = typeof rec === 'object' ? rec.id : rec;
    const receiverName = typeof rec === 'object' ? rec.receiverName : null;

    socket.emit('reject-download', { code: roomData.code, receiverId, receiverName });
    setReceiversList((prev) =>
      prev.map((r) =>
        r.id === receiverId || r.socketId === receiverId || (receiverName && r.receiverName.toLowerCase() === String(receiverName).toLowerCase())
          ? { ...r, approvalState: 'rejected' }
          : r
      )
    );
  };

  const handleCloseRoom = async () => {
    if (roomData?.code) {
      if (socket.connected) {
        socket.emit('close-room', { code: roomData.code });
      }
      try {
        await fetch(getApiUrl(`/api/upload/room/${roomData.code}/close`), { method: 'POST' });
      } catch (err) {
        console.error('Failed to close room via API:', err);
      }
    }
    clearActiveSession();
    if (onReset) onReset();
  };

  const files = roomData.files || [{ fileName: roomData.fileName, fileSize: roomData.fileSize, fileType: roomData.fileType }];
  const totalBatchSize = roomData.totalFileSize || roomData.fileSize || files.reduce((s, f) => s + f.fileSize, 0);

  return (
    <div className="glass-panel" style={{ padding: '40px', maxWidth: '680px', margin: '0 auto', textAlign: 'center' }}>
      {/* Step Indicator */}
      <div className="step-bar">
        <div className="step-item">
          <span className="step-number">1</span> Select Files
        </div>
        <div className="step-divider"></div>
        <div className="step-item">
          <span className="step-number">2</span> Upload Chunks
        </div>
        <div className="step-divider"></div>
        <div className="step-item active">
          <span className="step-number">3</span> Share 5-Digit Code
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <ExpiryTimer expiresAt={roomData.expiresAt} onExpired={handleCloseRoom} />
      </div>

      <h2 style={{ fontSize: '1.9rem', marginBottom: '6px' }}>
        File Sharing Room Ready!
      </h2>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', marginBottom: '20px' }}>
        Share this 5-digit code or link with your recipient.
      </p>

      {/* Code Card */}
      <div className="room-code-card">
        <span className="room-code-digits">{roomData.code}</span>
      </div>

      {/* Copy Actions */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '28px', flexWrap: 'wrap' }}>
        <button className="btn-secondary active" onClick={copyCode}>
          {copiedCode ? <Check size={18} color="#10b981" /> : <Copy size={18} />}
          {copiedCode ? 'Code Copied!' : 'Copy 5-Digit Code'}
        </button>

        <button className="btn-secondary" onClick={copyShareLink}>
          {copiedLink ? <Check size={18} color="#10b981" /> : <LinkIcon size={18} />}
          {copiedLink ? 'Link Copied!' : 'Copy Shareable Link'}
        </button>
      </div>

      {/* Batch Files Info Card */}
      <div className="glass-card" style={{ padding: '20px 24px', textAlign: 'left', marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Layers size={16} color="#38bdf8" /> Shared Batch ({files.length} {files.length === 1 ? 'file' : 'files'})
          </span>
          <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
            Total: {formatBytes(totalBatchSize)}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '200px', overflowY: 'auto' }}>
          {files.map((file, idx) => (
            <div key={file.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '8px 12px', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.5)' }}>
              <div style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'rgba(6, 182, 212, 0.15)',
                border: '1px solid rgba(6, 182, 212, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <File size={20} color="#38bdf8" />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {file.fileName}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {formatBytes(file.fileSize)} • {getFileTypeLabel(file.fileName, file.fileType)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Multi-Receiver Peer Authorization List (Line-by-line) */}
      {receiversList.length > 0 ? (
        <div style={{ textAlign: 'left', marginBottom: '28px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <UserCheck size={20} color="#38bdf8" /> Receiver Requests ({receiversList.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {receiversList.map((rec, idx) => (
              <div
                key={rec.id || rec.socketId || idx}
                className="glass-card pulse-box"
                style={{
                  padding: '20px 22px',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  background: 'rgba(20, 27, 48, 0.85)',
                  textAlign: 'left'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h4 style={{ fontSize: '1.05rem', margin: 0, color: 'var(--text-main)' }}>
                      Recipient: <strong style={{ color: '#38bdf8' }}>"{rec.receiverName}"</strong>
                    </h4>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '2px', display: 'inline-block' }}>
                      Entered code {roomData.code} • Requesting {files.length} {files.length === 1 ? 'file' : 'files'}
                    </span>
                  </div>

                  <span style={{
                    fontSize: '0.78rem',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontWeight: 600,
                    background: rec.approvalState === 'approved' ? 'rgba(16, 185, 129, 0.2)' : rec.approvalState === 'rejected' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                    color: rec.approvalState === 'approved' ? '#6ee7b7' : rec.approvalState === 'rejected' ? '#fca5a5' : '#fcd34d',
                    border: `1px solid ${rec.approvalState === 'approved' ? 'rgba(16, 185, 129, 0.4)' : rec.approvalState === 'rejected' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`
                  }}>
                    {rec.approvalState === 'approved' ? 'Approved' : rec.approvalState === 'rejected' ? 'Declined' : 'Pending Request'}
                  </span>
                </div>

                {rec.approvalState === 'approved' ? (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#6ee7b7',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.88rem'
                  }}>
                    <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                    <span>Download Approved! AWS S3 presigned links dispatched to {rec.receiverName}.</span>
                  </div>
                ) : rec.approvalState === 'rejected' ? (
                  <div style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#fca5a5',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.88rem'
                  }}>
                    <XCircle size={18} style={{ flexShrink: 0 }} />
                    <span>You declined download access for {rec.receiverName}.</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                    <button className="btn-success" style={{ flex: 1, padding: '10px 16px', fontSize: '0.88rem' }} onClick={() => approveDownload(rec)}>
                      <ShieldCheck size={16} /> Approve Access
                    </button>
                    <button className="btn-danger" style={{ flex: 1, padding: '10px 16px', fontSize: '0.88rem' }} onClick={() => rejectDownload(rec)}>
                      <XCircle size={16} /> Decline
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          padding: '28px',
          borderRadius: '20px',
          background: 'rgba(10, 15, 30, 0.5)',
          border: '1px dashed rgba(255, 255, 255, 0.12)',
          color: 'var(--text-muted)'
        }}>
          <Share2 size={36} color="#64748b" style={{ marginBottom: '12px' }} />
          <p style={{ margin: 0, fontSize: '0.95rem' }}>
            Waiting for peers to enter 5-digit code <strong style={{ color: '#38bdf8' }}>{roomData.code}</strong>...
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            When recipients connect, real-time approval prompts will appear line by line here.
          </p>
        </div>
      )}

      <div style={{ marginTop: '32px' }}>
        <button className="btn-secondary" onClick={handleCloseRoom}>
          Close Room & Create New Share
        </button>
      </div>
    </div>
  );
}
