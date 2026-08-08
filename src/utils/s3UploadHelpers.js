/**
 * Format bytes to readable human strings (e.g. 5.4 GB, 120 MB)
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
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
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return `Video (${ext.toUpperCase()})`;
  if (['jpeg', 'jpg', 'png', 'gif', 'svg', 'webp', 'tiff', 'tif', 'bmp'].includes(ext)) return `Image (${ext.toUpperCase()})`;
  if (['psd', 'ai', 'eps', 'indd'].includes(ext)) return `Design Document (${ext.toUpperCase()})`;
  if (['pdf', 'docx', 'xlsx', 'pptx', 'txt'].includes(ext)) return `Document (${ext.toUpperCase()})`;
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return `Archive (${ext.toUpperCase()})`;
  
  return fileType || ext?.toUpperCase() || 'File';
}

/**
 * Multipart Upload Handler for files up to 10GB
 */
export async function performMultipartUpload({ file, code, uploadId, storageKey, onProgress }) {
  const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB Chunk Size
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const parts = [];

  let uploadedBytes = 0;
  const startTime = Date.now();

  for (let partNumber = 1; partNumber <= totalChunks; partNumber++) {
    const start = (partNumber - 1) * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    // Request presigned URL or local endpoint for partNumber
    const resUrl = await fetch('/api/upload/presigned-part', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storageKey, uploadId, partNumber }),
    });

    if (!resUrl.ok) {
      throw new Error(`Failed to get presigned URL for part ${partNumber}`);
    }

    const { url } = await resUrl.json();

    // Upload chunk via PUT request directly to S3 or Local Endpoint
    const uploadRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: chunk,
    });

    if (!uploadRes.ok) {
      throw new Error(`Part ${partNumber} upload failed.`);
    }

    const etagHeader = uploadRes.headers.get('ETag');
    const etag = etagHeader ? etagHeader.replace(/"/g, '') : `etag_part_${partNumber}`;

    parts.push({
      ETag: etag,
      PartNumber: partNumber,
    });

    uploadedBytes += chunk.size;
    const elapsedTime = (Date.now() - startTime) / 1000;
    const speed = uploadedBytes / (elapsedTime || 1); // Bytes per sec
    const percent = Math.min(100, Math.round((uploadedBytes / file.size) * 100));

    if (onProgress) {
      onProgress({
        uploadedBytes,
        totalBytes: file.size,
        percent,
        speed, // bytes/sec
      });
    }
  }

  // Complete Multipart Upload
  const completeRes = await fetch('/api/upload/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, uploadId, storageKey, parts }),
  });

  if (!completeRes.ok) {
    throw new Error('Failed to finalize multipart upload.');
  }

  return await completeRes.json();
}
