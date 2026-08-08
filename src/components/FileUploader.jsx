import React, { useState, useRef } from 'react';
import { UploadCloud, File, User, Clock, AlertCircle, Film, Image as ImageIcon, Archive, FileText, FileSpreadsheet, Plus, X, Layers } from 'lucide-react';
import { formatBytes, getFileTypeLabel, performBatchMultipartUpload } from '../utils/s3UploadHelpers';
import { getApiUrl } from '../utils/apiConfig.js';

export default function FileUploader({ onUploadComplete }) {
  const [uploaderName, setUploaderName] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [ttlMinutes, setTtlMinutes] = useState(1.5); // Default 1.5 mins
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ percent: 0, speed: 0, uploadedBytes: 0, totalBytes: 0, currentFileName: '' });
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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(Array.from(e.target.files));
    }
  };

  const validateAndAddFiles = (newFiles) => {
    const MAX_SINGLE = 10 * 1024 * 1024 * 1024; // 10 GB
    const combined = [...selectedFiles, ...newFiles];

    // Remove duplicates by name & size
    const uniqueFiles = combined.filter((file, index, self) =>
      index === self.findIndex((f) => f.name === file.name && f.size === file.size)
    );

    const totalBatchSize = uniqueFiles.reduce((sum, f) => sum + f.size, 0);

    if (totalBatchSize > MAX_SINGLE) {
      setError('Combined total batch file size exceeds the 10 GB limit.');
      return;
    }

    setError(null);
    setSelectedFiles(uniqueFiles);
  };

  const removeFile = (indexToRemove) => {
    const updated = selectedFiles.filter((_, idx) => idx !== indexToRemove);
    setSelectedFiles(updated);
    if (updated.length === 0) setError(null);
  };

  const getFileIcon = (fileName, fileType) => {
    if (!fileName) return <UploadCloud size={38} color="#ffffff" />;
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (['mp4', 'mov', 'mkv', 'avi'].includes(ext)) return <Film size={22} color="#38bdf8" />;
    if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) return <ImageIcon size={22} color="#c084fc" />;
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return <Archive size={22} color="#f59e0b" />;
    if (['pdf', 'docx', 'txt'].includes(ext)) return <FileText size={22} color="#818cf8" />;
    return <FileSpreadsheet size={22} color="#10b981" />;
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const startUpload = async () => {
    if (!uploaderName.trim()) {
      setError('Please enter your name as the sender.');
      return;
    }
    if (selectedFiles.length === 0) {
      setError('Please select or drop at least one file to upload.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // 1. Initiate upload sessions for all selected files
      const payloadFiles = selectedFiles.map((f, i) => ({
        id: `file_${i}_${Date.now()}`,
        fileName: f.name,
        fileSize: f.size,
        fileType: f.type,
      }));

      const initRes = await fetch(getApiUrl('/api/upload/initiate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploaderName: uploaderName.trim(),
          files: payloadFiles,
          ttlMinutes: parseFloat(ttlMinutes),
        }),
      });

      if (!initRes.ok) {
        const errData = await initRes.json();
        throw new Error(errData.error || 'Failed to initiate batch upload session.');
      }

      const initData = await initRes.json();
      const { code, files: serverFiles, expiresAt, storageMode } = initData;

      // 2. Perform direct S3 / Local multipart upload for all files in batch
      await performBatchMultipartUpload({
        fileList: selectedFiles,
        code,
        serverFiles,
        onProgress: (prog) => {
          setUploadProgress(prog);
        },
      });

      // 3. Callback to parent component with room info
      onUploadComplete({
        code,
        uploaderName: uploaderName.trim(),
        files: serverFiles,
        totalFileSize: totalSize,
        fileName: serverFiles[0]?.fileName || selectedFiles[0]?.name,
        fileSize: serverFiles[0]?.fileSize || selectedFiles[0]?.size,
        fileType: serverFiles[0]?.fileType || selectedFiles[0]?.type,
        ttlMinutes,
        expiresAt,
        storageMode,
      });
    } catch (err) {
      console.error('Batch Upload Error:', err);
      setError(err.message || 'An error occurred during multi-file upload.');
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '40px', maxWidth: '680px', margin: '0 auto' }}>
      {/* Step Indicator */}
      <div className="step-bar">
        <div className="step-item active">
          <span className="step-number">1</span> Select Files
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
        <h2 style={{ fontSize: '2rem', marginBottom: '8px' }}>
          Upload & Share Multiple Files
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>
          Select multiple files simultaneously up to 10GB combined total.
        </p>
      </div>

      {error && (
        <div style={{
          padding: '14px 18px',
          borderRadius: '14px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          marginBottom: '22px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '0.92rem'
        }}>
          <AlertCircle size={20} color="#ef4444" style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Uploader Name */}
      <div style={{ marginBottom: '22px' }}>
        <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
          Your Name (Sender)
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

      {/* Dropzone */}
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
          multiple
          disabled={isUploading}
        />

        <div>
          <UploadCloud size={42} color="var(--accent-cyan-light)" style={{ marginBottom: '12px' }} />
          <h4 style={{ fontSize: '1.15rem', marginBottom: '6px' }}>
            Drag & Drop multiple files or <span style={{ color: 'var(--accent-cyan-light)', textDecoration: 'underline' }}>Browse</span>
          </h4>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Select multiple files simultaneously up to <strong>10 GB combined batch size</strong>
          </p>
        </div>
      </div>

      {/* Selected Files List */}
      {selectedFiles.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} color="var(--accent-cyan-light)" /> Selected Batch ({selectedFiles.length} files)
            </span>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--accent-cyan-light)', fontFamily: 'var(--font-mono)' }}>
              Total: {formatBytes(totalSize)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
            {selectedFiles.map((file, idx) => (
              <div key={`${file.name}_${idx}`} className="glass-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                  {getFileIcon(file.name, file.type)}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '320px' }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatBytes(file.size)} • {getFileTypeLabel(file.name, file.type)}
                    </div>
                  </div>
                </div>

                {!isUploading && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(idx); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                    title="Remove file"
                  >
                    <X size={18} color="#ef4444" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {!isUploading && (
            <button
              type="button"
              className="btn-secondary"
              style={{ width: '100%', marginTop: '12px', padding: '8px 16px', fontSize: '0.85rem' }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Plus size={16} /> Add More Files
            </button>
          )}
        </div>
      )}

      {/* Expiration Slider & Presets */}
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <label style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--accent-cyan-light)" /> Expiration Duration:
          </label>
          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--accent-cyan-light)', fontFamily: 'var(--font-mono)' }}>
            {ttlMinutes < 60 ? `${ttlMinutes} Mins` : `${(ttlMinutes / 60).toFixed(1)} Hours`}
          </span>
        </div>

        {/* Duration Preset Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`btn-secondary ${ttlMinutes === preset.value ? 'active' : ''}`}
              style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '100px' }}
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
        <div style={{ marginTop: '20px', background: 'rgba(10, 15, 30, 0.7)', padding: '20px', borderRadius: '18px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', marginBottom: '6px' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
              Uploading Batch... <strong style={{ color: '#ffffff' }}>{uploadProgress.percent}%</strong>
            </span>
            <span style={{ color: 'var(--accent-cyan-light)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {formatBytes(uploadProgress.speed)}/s
            </span>
          </div>
          {uploadProgress.currentFileName && (
            <div style={{ fontSize: '0.82rem', color: '#38bdf8', marginBottom: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Current file: {uploadProgress.currentFileName}
            </div>
          )}
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
          disabled={selectedFiles.length === 0}
        >
          <UploadCloud size={20} /> Generate 5-Digit Code & Upload {selectedFiles.length > 0 ? `(${selectedFiles.length} Files)` : ''}
        </button>
      )}
    </div>
  );
}
