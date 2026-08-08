import { getApiUrl } from './apiConfig.js';

/**
 * Format bytes to readable human strings (e.g. 5.4 GB, 120 MB)
 */
export function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Format seconds into mm:ss or hh:mm:ss format
 */
export function formatTimer(seconds) {
  if (seconds <= 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const pad = (n) => (n < 10 ? `0${n}` : n);

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Infer human friendly file type description
 */
export function getFileTypeLabel(fileName, fileType) {
  if (!fileName) return 'File';
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return `Video (${ext.toUpperCase()})`;
  if (['jpeg', 'jpg', 'png', 'gif', 'svg', 'webp', 'tiff', 'tif', 'bmp'].includes(ext)) return `Image (${ext.toUpperCase()})`;
  if (['psd', 'ai', 'eps', 'indd'].includes(ext)) return `Design Document (${ext.toUpperCase()})`;
  if (['pdf', 'docx', 'xlsx', 'pptx', 'txt'].includes(ext)) return `Document (${ext.toUpperCase()})`;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return `Archive (${ext.toUpperCase()})`;
  
  return fileType || ext?.toUpperCase() || 'File';
}

/**
 * Single File Multipart Upload Handler
 */
export async function performMultipartUpload({ file, code, uploadId, storageKey, onProgress }) {
  return performBatchMultipartUpload({
    fileList: [file],
    code,
    serverFiles: [{ storageKey, uploadId }],
    onProgress,
  });
}

/**
 * Multi-File Batch Multipart Upload Handler
 */
export async function performBatchMultipartUpload({ fileList, code, serverFiles, onProgress }) {
  const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB Chunk Size
  const totalBatchBytes = fileList.reduce((sum, f) => sum + f.size, 0);
  let totalUploadedBytes = 0;
  const startTime = Date.now();

  const fileCompletions = [];

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const serverFile = serverFiles[i] || {};
    const storageKey = serverFile.storageKey;
    const uploadId = serverFile.uploadId;

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const parts = [];

    for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
      const start = (partNumber - 1) * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      const resUrl = await fetch(getApiUrl('/api/upload/presigned-part'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storageKey, uploadId, partNumber }),
      });

      if (!resUrl.ok) {
        throw new Error(`Failed to get presigned URL for part ${partNumber} of file ${file.name}`);
      }

      const { url } = await resUrl.json();

      const uploadRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
        },
        body: chunk,
      });

      if (!uploadRes.ok) {
        throw new Error(`Part ${partNumber} upload failed for file ${file.name}`);
      }

      const etagHeader = uploadRes.headers.get('ETag');
      const etag = etagHeader ? etagHeader.replace(/"/g, '') : `etag_part_${partNumber}`;

      parts.push({
        ETag: etag,
        PartNumber: partNumber,
      });

      totalUploadedBytes += chunk.size;
      const elapsedTime = (Date.now() - startTime) / 1000;
      const speed = totalUploadedBytes / (elapsedTime || 1);
      const percent = Math.min(100, Math.round((totalUploadedBytes / totalBatchBytes) * 100));

      if (onProgress) {
        onProgress({
          currentFileIndex: i,
          currentFileName: file.name,
          uploadedBytes: totalUploadedBytes,
          totalBytes: totalBatchBytes,
          percent,
          speed,
        });
      }
    }

    fileCompletions.push({
      storageKey,
      uploadId,
      parts,
    });
  }

  // Complete Batch Multipart Upload
  const completeRes = await fetch(getApiUrl('/api/upload/complete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, fileCompletions }),
  });

  if (!completeRes.ok) {
    throw new Error('Failed to finalize batch upload.');
  }

  return await completeRes.json();
}
