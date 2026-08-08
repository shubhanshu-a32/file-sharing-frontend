import React, { useState, useRef } from 'react';
import { UploadCloud, File, User, Clock, CheckCircle2, AlertCircle, Shield, FileSpreadsheet, Film, Image as ImageIcon, Archive } from 'lucide-react';
import { formatBytes, getFileTypeLabel, performMultipartUpload } from '../utils/s3UploadHelpers';

export default function FileUploader({ onUploadComplete }) {
  const [uploaderName, setUploaderName] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [ttlMinutes, setTtlMinutes] = useState(1.5); // Default 1.5 mins
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ percent: 0, speed: 0, uploadedBytes: 0, totalBytes: 0 });
  const [error, setError] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const presets = [
    { label: '1.5 Mins', value: 1.5 },
    { label: '10 Mins', value: 10 },
    { label: '30 Mins', value: 30 },
    { label: '1 Hour', value: 60 },
    { label: '2 Hours', value: 120 },
  ];

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (file) => {
    const MAX_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB
    if (file.size > MAX_SIZE) {
      setError('File size exceeds the maximum allowed limit of 10 GB.');
      return;
    }
    setError(null);
    setSelectedFile(file);
  };

  const getFileIcon = (file) => {
    if (!file) return <UploadCloud size={44} color="#06b6d4" style={{ marginBottom: '12px' }} />;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['mp4', 'mov', 'mkv', 'avi'].includes(ext)) return <Film size={36} color="#38bdf8" />;
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return <ImageIcon size={36} color="#c084fc" />;
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return <Archive size={36} color="#f59e0b" />;
    return <FileSpreadsheet size={36} color="#818cf8" />;
  };

  const startUpload = async () => {
    if (!uploaderName.trim()) {
      setError('Please enter your name before initiating the upload.');
      return;
    }
    if (!selectedFile) {
      setError('Please select or drop a file to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // 1. Initiate upload session on backend
      const initRes = await fetch('/api/upload/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploaderName: uploaderName.trim(),
          fileName: selectedFile.name,
          fileSize: selectedFile.size,
          fileType: selectedFile.type,
          ttlMinutes: parseFloat(ttlMinutes),
        }),
      });

      if (!initRes.ok) {
        const errData = await initRes.json();
        throw new Error(errData.error || 'Failed to initiate upload session.');
      }

      const { code, uploadId, storageKey, expiresAt, storageMode } = await initRes.json();

      // 2. Perform direct S3 / Local multipart upload
      await performMultipartUpload({
        file: selectedFile,
        code,
        uploadId,
        storageKey,
        onProgress: (prog) => {
          setUploadProgress(prog);
        },
      });

      // 3. Callback to parent component with complete room info
      onUploadComplete({
        code,
        uploaderName: uploaderName.trim(),
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        ttlMinutes,
        expiresAt,
        storageKey,
        storageMode,
      });
    } catch (err) {
      console.error('Upload Error:', err);
      setError(err.message || 'An unexpected error occurred during file upload.');
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '40px', maxWidth: '680px', margin: '0 auto' }}>
      {/* Workflow Step Bar */}
      <div className="step-bar">
        <div className="step-item active">
          <span className="step-number">1</span> Select File
        </div>
        <div className="step-divider"></div>
        <div className="step-item">
          <span className="step-number">2</span> Upload Chunks
        </div>
        <div className="step-divider"></div>
        <div className="step-item">
          <span className="step-number">3</span> Share 5-Digit Code
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.85rem', marginBottom: '8px' }}>
          Create Ephemeral File Share
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Upload files up to 10GB with real-time peer download authorization.
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

      {/* Uploader Name */}
      <div style={{ marginBottom: '22px' }}>
        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
          Sender Name / Alias
        </label>
        <div style={{ position: 'relative' }}>
          <User size={18} style={{ position: 'absolute', left: '16px', top: '16px', color: 'var(--text-dim)' }} />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: '44px' }}
            placeholder="e.g. Alex Rivera"
            value={uploaderName}
            onChange={(e) => setUploaderName(e.target.value)}
            disabled={isUploading}
          />
        </div>
      </div>

      {/* Drag & Drop Zone */}
      <div
        className={`dropzone ${isDragging ? 'active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
        onClick={() => !isUploading && fileInputRef.current?.click()}
        style={{ marginBottom: '24px' }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          style={{ display: 'none' }}
          disabled={isUploading}
        />

        {selectedFile ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(6, 182, 212, 0.15)',
              border: '1px solid rgba(6, 182, 212, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {getFileIcon(selectedFile)}
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 600, fontSize: '1.08rem', color: 'var(--text-main)', wordBreak: 'break-all' }}>
                {selectedFile.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', gap: '10px', marginTop: '4px' }}>
                <span style={{ color: 'var(--accent-cyan-light)', fontWeight: 600 }}>{formatBytes(selectedFile.size)}</span>
                <span>•</span>
                <span>{getFileTypeLabel(selectedFile.name, selectedFile.type)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div>
            {getFileIcon(null)}
            <h4 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>
              Drag & Drop file here or <span style={{ color: 'var(--accent-cyan-light)', textDecoration: 'underline' }}>Browse</span>
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Supports MP4, MOV, PSD, TIFF, ZIP, PDF & all formats up to <strong>10 GB</strong>
            </p>
          </div>
        )}
      </div>

      {/* Expiration Slider & Quick Presets */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--accent-cyan-light)" /> Expiration Duration:
          </label>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-cyan-light)', fontFamily: 'var(--font-mono)' }}>
            {ttlMinutes < 60 ? `${ttlMinutes} Mins` : `${(ttlMinutes / 60).toFixed(1)} Hours`}
          </span>
        </div>

        {/* Quick Preset Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`btn-secondary ${ttlMinutes === preset.value ? 'active' : ''}`}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                borderRadius: '100px',
                background: ttlMinutes === preset.value ? 'rgba(6, 182, 212, 0.2)' : undefined,
                borderColor: ttlMinutes === preset.value ? 'var(--accent-cyan)' : undefined,
                color: ttlMinutes === preset.value ? '#38bdf8' : undefined,
              }}
              onClick={() => setTtlMinutes(preset.value)}
              disabled={isUploading}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <input
          type="range"
          min="1"
          max="120"
          step="0.5"
          className="custom-range"
          value={ttlMinutes}
          onChange={(e) => setTtlMinutes(parseFloat(e.target.value))}
          disabled={isUploading}
        />
      </div>

      {/* Upload Progress State */}
      {isUploading ? (
        <div style={{ marginTop: '20px', background: 'rgba(10, 15, 30, 0.6)', padding: '20px', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '10px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
              Uploading Chunks directly... <strong style={{ color: '#ffffff' }}>{uploadProgress.percent}%</strong>
            </span>
            <span style={{ color: 'var(--accent-cyan-light)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {formatBytes(uploadProgress.speed)}/s
            </span>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${uploadProgress.percent}%` }}></div>
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)', textAlign: 'right', marginTop: '8px' }}>
            Transferred {formatBytes(uploadProgress.uploadedBytes)} of {formatBytes(uploadProgress.totalBytes)}
          </div>
        </div>
      ) : (
        <button
          className="btn-primary"
          style={{ width: '100%' }}
          onClick={startUpload}
          disabled={!selectedFile}
        >
          <UploadCloud size={20} /> Generate 5-Digit Room Code & Start Upload
        </button>
      )}
    </div>
  );
}
