import React, { useState, useEffect } from 'react';
import { Download, KeyRound, User, File, Loader2, ShieldCheck, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import ExpiryTimer from './ExpiryTimer';
import { formatBytes, getFileTypeLabel } from '../utils/s3UploadHelpers';
import { socket } from '../utils/socket';
import { saveActiveSession, clearActiveSession, verifyRoomActive } from '../utils/sessionStorage';

export default function RoomReceiverView({ initialCode = '', initialReceiverName = '', initialRoomData = null, initialWaiting = false, initialDownloadUrl = null }) {
  const [code, setCode] = useState(initialCode);
  const [receiverName, setReceiverName] = useState(initialReceiverName);
  const [roomData, setRoomData] = useState(initialRoomData);
  const [isFetchingRoom, setIsFetchingRoom] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(initialWaiting);
  const [downloadUrl, setDownloadUrl] = useState(initialDownloadUrl);
  const [error, setError] = useState(null);
  const [rejected, setRejected] = useState(false);
  const [expired, setExpired] = useState(false);

  // Sync initial parameters if provided (e.g. from parent restored session)
  useEffect(() => {
    if (initialCode && initialCode.length === 5 && !roomData) {
      handleCodeChange(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    // Socket event listeners for receiver
    const handleDownloadApproved = (data) => {
      console.log('[Receiver Socket] Download Approved:', data);
      setIsWaitingApproval(false);
      setDownloadUrl(data.downloadUrl);

      // Persist state in sessionStorage
      saveActiveSession({
        role: 'receiver',
        code,
        receiverName,
        roomData,
        isWaitingApproval: false,
        downloadUrl: data.downloadUrl,
        expiresAt: roomData?.expiresAt,
      });

      // Auto trigger download link
      try {
        const anchor = document.createElement('a');
        anchor.href = data.downloadUrl;
        anchor.download = data.fileName || 'download';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
      } catch (err) {
        console.error('Auto download trigger error:', err);
      }
    };

    const handleDownloadRejected = (data) => {
      setIsWaitingApproval(false);
      setRejected(true);
      setError(data.message || 'The uploader declined your download request.');
      clearActiveSession();
    };

    const handleRoomExpired = () => {
      setIsWaitingApproval(false);
      setExpired(true);
      setError('This room has expired and the file has been securely deleted.');
      clearActiveSession();
    };

    socket.on('download-approved', handleDownloadApproved);
    socket.on('download-rejected', handleDownloadRejected);
    socket.on('room-expired', handleRoomExpired);

    return () => {
      socket.off('download-approved', handleDownloadApproved);
      socket.off('download-rejected', handleDownloadRejected);
      socket.off('room-expired', handleRoomExpired);
    };
  }, [code, receiverName, roomData]);

  // Fetch Room Info when 5 digits are entered
  const handleCodeChange = async (val) => {
    const cleanVal = val.replace(/\D/g, '').substring(0, 5);
    setCode(cleanVal);

    if (cleanVal.length === 5) {
      setIsFetchingRoom(true);
      setError(null);
      try {
        const room = await verifyRoomActive(cleanVal);
        if (!room) {
          throw new Error('Invalid or expired 5-digit room code.');
        }
        setRoomData(room);
        saveActiveSession({
          role: 'receiver',
          code: cleanVal,
          receiverName,
          roomData: room,
          isWaitingApproval,
          downloadUrl,
          expiresAt: room.expiresAt,
        });
      } catch (err) {
        setRoomData(null);
        setError(err.message || 'Room not found.');
      } finally {
        setIsFetchingRoom(false);
      }
    } else {
      setRoomData(null);
    }
  };

  const requestDownload = () => {
    if (!receiverName.trim()) {
      setError('Please enter your name as the receiver.');
      return;
    }
    if (!code || code.length !== 5) {
      setError('Please enter a valid 5-digit room code.');
      return;
    }

    setError(null);
    setIsWaitingApproval(true);

    // Save state before sending socket request
    saveActiveSession({
      role: 'receiver',
      code,
      receiverName: receiverName.trim(),
      roomData,
      isWaitingApproval: true,
      downloadUrl: null,
      expiresAt: roomData?.expiresAt,
    });

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('receiver-request-download', {
      code,
      receiverName: receiverName.trim(),
    });
  };

  const handleResetReceiver = () => {
    clearActiveSession();
    setCode('');
    setReceiverName('');
    setRoomData(null);
    setIsWaitingApproval(false);
    setDownloadUrl(null);
    setError(null);
    setRejected(false);
    setExpired(false);
  };

  return (
    <div className="glass-panel" style={{ padding: '40px', maxWidth: '680px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.85rem', marginBottom: '8px' }}>
          Receive Ephemeral File
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Enter the 5-digit code provided by the sender to request download access.
        </p>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '14px',
          background: 'rgba(244, 63, 94, 0.12)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          color: '#fecdd3',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.92rem'
        }}>
          <AlertCircle size={20} color="#f43f5e" style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* 5-Digit Code Input */}
      <div style={{ marginBottom: '22px' }}>
        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
          5-Digit Room Code
        </label>
        <div style={{ position: 'relative' }}>
          <KeyRound size={20} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="input-field"
            style={{
              paddingLeft: '44px',
              letterSpacing: '0.3em',
              fontFamily: 'var(--font-mono)',
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#38bdf8'
            }}
            placeholder="e.g. 48291"
            maxLength={5}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            disabled={isWaitingApproval || downloadUrl !== null}
          />
        </div>
      </div>

      {/* Receiver Name */}
      <div style={{ marginBottom: '24px' }}>
        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
          Your Name (Receiver)
        </label>
        <div style={{ position: 'relative' }}>
          <User size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '44px' }}
            placeholder="e.g. Sam Jordan"
            value={receiverName}
            onChange={(e) => {
              setReceiverName(e.target.value);
              if (code.length === 5 && roomData) {
                saveActiveSession({
                  role: 'receiver',
                  code,
                  receiverName: e.target.value,
                  roomData,
                  isWaitingApproval,
                  downloadUrl,
                  expiresAt: roomData.expiresAt,
                });
              }
            }}
            disabled={isWaitingApproval || downloadUrl !== null}
          />
        </div>
      </div>

      {/* Room Preview */}
      {isFetchingRoom && (
        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
          <Loader2 className="animate-spin" size={26} color="#06b6d4" style={{ margin: '0 auto 8px', animation: 'spin 1s linear infinite' }} />
          <div style={{ fontSize: '0.9rem' }}>Fetching room details from server...</div>
        </div>
      )}

      {roomData && (
        <div className="glass-card" style={{ padding: '22px 26px', marginBottom: '24px', textAlign: 'left' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              Sender: <strong style={{ color: '#38bdf8' }}>{roomData.uploaderName}</strong>
            </div>
            <ExpiryTimer expiresAt={roomData.expiresAt} onExpired={handleResetReceiver} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{
              width: '46px',
              height: '46px',
              borderRadius: '14px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <File size={24} color="#a5b4fc" />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>
                {roomData.fileName}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                {formatBytes(roomData.fileSize)} • {getFileTypeLabel(roomData.fileName, roomData.fileType)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action States */}
      {downloadUrl ? (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            padding: '24px',
            borderRadius: '20px',
            background: 'rgba(16, 185, 129, 0.15)',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            marginBottom: '20px',
            color: '#6ee7b7'
          }}>
            <ShieldCheck size={44} style={{ margin: '0 auto 10px' }} />
            <h4 style={{ fontSize: '1.25rem', marginBottom: '6px' }}>Download Approved!</h4>
            <p style={{ fontSize: '0.9rem', margin: 0 }}>
              Your file transfer has started. If the download didn't trigger automatically, click below.
            </p>
          </div>
          <a href={downloadUrl} download className="btn-success" style={{ width: '100%', textDecoration: 'none', display: 'flex' }}>
            <Download size={20} /> Download File Directly
          </a>

          <button className="btn-secondary" style={{ width: '100%', marginTop: '14px' }} onClick={handleResetReceiver}>
            <RefreshCw size={16} /> Enter Another Code
          </button>
        </div>
      ) : isWaitingApproval ? (
        <div style={{
          padding: '30px',
          borderRadius: '20px',
          background: 'rgba(15, 23, 42, 0.7)',
          border: '1px solid rgba(99, 102, 241, 0.4)',
          textAlign: 'center'
        }} className="pulse-box">
          <Loader2 size={38} color="#6366f1" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 14px' }} />
          <h4 style={{ fontSize: '1.2rem', marginBottom: '6px' }}>
            Request Sent to {roomData?.uploaderName || 'Sender'}
          </h4>
          <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', margin: 0 }}>
            Waiting for sender to approve your download in real-time...
          </p>
        </div>
      ) : (
        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={requestDownload}
          disabled={!roomData || !receiverName.trim()}
        >
          <Download size={20} /> Request Download Access
        </button>
      )}
    </div>
  );
}
