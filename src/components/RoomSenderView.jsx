import React, { useState, useEffect } from 'react';
import { Copy, Check, UserCheck, File, ShieldCheck, XCircle, Share2, Link as LinkIcon, Layers } from 'lucide-react';
import ExpiryTimer from './ExpiryTimer';
import { formatBytes, getFileTypeLabel } from '../utils/s3UploadHelpers';
import { socket } from '../utils/socket';
import { saveActiveSession, clearActiveSession } from '../utils/sessionStorage';

export default function RoomSenderView({ roomData, onReset }) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [receiverInfo, setReceiverInfo] = useState(roomData?.receiverInfo || null);
  const [approvalState, setApprovalState] = useState(roomData?.approvalState || null);

  useEffect(() => {
    if (!roomData?.code) return;

    // Persist active uploader room state to sessionStorage & URL
    saveActiveSession({
      role: 'sender',
      code: roomData.code,
      uploaderName: roomData.uploaderName,
      roomData,
      receiverInfo,
      approvalState,
      expiresAt: roomData.expiresAt,
    });

    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('join-as-uploader', { code: roomData.code });

    const handleReceiverJoined = (data) => {
      console.log('[Uploader Socket] Receiver requested download:', data);
      setReceiverInfo(data);
      saveActiveSession({
        role: 'sender',
        code: roomData.code,
        uploaderName: roomData.uploaderName,
        roomData,
        receiverInfo: data,
        approvalState: null,
        expiresAt: roomData.expiresAt,
      });
    };

    socket.on('receiver-joined', handleReceiverJoined);

    return () => {
      socket.off('receiver-joined', handleReceiverJoined);
    };
  }, [roomData, approvalState]);

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

  const approveDownload = () => {
    socket.emit('approve-download', { code: roomData.code });
    setApprovalState('approved');
    saveActiveSession({
      role: 'sender',
      code: roomData.code,
      uploaderName: roomData.uploaderName,
      roomData,
      receiverInfo,
      approvalState: 'approved',
      expiresAt: roomData.expiresAt,
    });
  };

  const rejectDownload = () => {
    socket.emit('reject-download', { code: roomData.code });
    setApprovalState('rejected');
    saveActiveSession({
      role: 'sender',
      code: roomData.code,
      uploaderName: roomData.uploaderName,
      roomData,
      receiverInfo,
      approvalState: 'rejected',
      expiresAt: roomData.expiresAt,
    });
  };

  const handleCloseRoom = () => {
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

      {/* Peer Authorization Box */}
      {receiverInfo ? (
        <div className="glass-card pulse-box" style={{
          padding: '26px',
          border: '1px solid rgba(99, 102, 241, 0.5)',
          background: 'rgba(20, 27, 48, 0.85)',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '18px' }}>
            <UserCheck size={28} color="#38bdf8" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h4 style={{ fontSize: '1.15rem', margin: 0, color: 'var(--text-main)' }}>
                Download Request Received
              </h4>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Recipient <strong style={{ color: '#38bdf8' }}>"{receiverInfo.receiverName}"</strong> entered code <strong>{roomData.code}</strong> and is requesting file access for {files.length} {files.length === 1 ? 'file' : 'files'}.
              </p>
            </div>
          </div>

          {approvalState === 'approved' ? (
            <div style={{
              padding: '14px 18px',
              borderRadius: '14px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#6ee7b7',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <ShieldCheck size={22} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.92rem' }}>
                Download Approved! AWS S3 presigned links dispatched to {receiverInfo.receiverName}.
              </span>
            </div>
          ) : approvalState === 'rejected' ? (
            <div style={{
              padding: '14px 18px',
              borderRadius: '14px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fca5a5',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <XCircle size={22} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: '0.92rem' }}>You declined this download request.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '14px', marginTop: '18px' }}>
              <button className="btn-success" style={{ flex: 1 }} onClick={approveDownload}>
                <ShieldCheck size={18} /> Approve Download Access
              </button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={rejectDownload}>
                <XCircle size={18} /> Decline
              </button>
            </div>
          )}
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
            Waiting for peer to enter 5-digit code <strong style={{ color: '#38bdf8' }}>{roomData.code}</strong>...
          </p>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-dim)', marginTop: '4px' }}>
            When recipient connects, you will receive a real-time approval prompt here.
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
