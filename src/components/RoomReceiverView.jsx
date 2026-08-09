import React, { useState, useEffect } from "react";
import {
  Download,
  KeyRound,
  User,
  File,
  Loader2,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  Layers,
  CheckCircle2,
} from "lucide-react";
import ExpiryTimer from "./ExpiryTimer";
import { formatBytes, getFileTypeLabel } from "../utils/s3UploadHelpers";
import { socket } from "../utils/socket";
import {
  saveActiveSession,
  clearActiveSession,
  verifyRoomActive,
} from "../utils/sessionStorage";

export default function RoomReceiverView({
  initialCode = "",
  initialReceiverName = "",
  initialRoomData = null,
  initialWaiting = false,
  initialDownloadUrl = null,
  initialDownloadUrls = null,
}) {
  const [code, setCode] = useState(initialCode);
  const [receiverName, setReceiverName] = useState(initialReceiverName);
  const [roomData, setRoomData] = useState(initialRoomData);
  const [isFetchingRoom, setIsFetchingRoom] = useState(false);
  const [isWaitingApproval, setIsWaitingApproval] = useState(initialWaiting);
  const [downloadUrls, setDownloadUrls] = useState(
    initialDownloadUrls || (initialDownloadUrl ? [{ id: "file_0", fileName: "download_file", fileSize: 0, downloadUrl: initialDownloadUrl }] : null)
  );
  const [error, setError] = useState(null);

  // Sync initial parameters if provided
  useEffect(() => {
    if (initialCode && initialCode.length === 5 && !roomData) {
      handleCodeChange(initialCode);
    }
  }, [initialCode]);

  useEffect(() => {
    if (!receiverName.trim()) return;

    const matched = Array.isArray(roomData?.receivers)
      ? roomData.receivers.find((r) => r.receiverName?.toLowerCase() === receiverName?.trim()?.toLowerCase())
      : null;

    if (!matched) return;

    if (matched.approvalState === 'rejected' && isWaitingApproval) {
      setIsWaitingApproval(false);
      setError('The sender declined your download request.');
    } else if (matched.approvalState === 'approved' && matched.downloadUrls && !downloadUrls) {
      setIsWaitingApproval(false);
      setDownloadUrls(matched.downloadUrls);
    }
  }, [roomData, receiverName, isWaitingApproval]);

  useEffect(() => {
    const handleDownloadApproved = (data) => {
      // Must have receiverName set, and must match event target if specified
      if (!receiverName || !receiverName.trim()) return;
      if (data.receiverName && data.receiverName.trim().toLowerCase() !== receiverName.trim().toLowerCase()) {
        return;
      }

      console.log("[Receiver Socket] Download Approved:", data);
      setIsWaitingApproval(false);

      const urls = data.downloadUrls || [
        {
          id: "file_0",
          fileName: data.fileName || "download_file",
          fileSize: data.fileSize || 0,
          downloadUrl: data.downloadUrl,
        },
      ];
      setDownloadUrls(urls);

      saveActiveSession({
        role: "receiver",
        code,
        receiverName,
        roomData,
        isWaitingApproval: false,
        downloadUrls: urls,
        expiresAt: roomData?.expiresAt,
      });

      // Trigger first file download automatically
      if (urls.length > 0 && urls[0].downloadUrl) {
        try {
          const anchor = document.createElement("a");
          anchor.href = urls[0].downloadUrl;
          anchor.download = urls[0].fileName || "download";
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        } catch (err) {
          console.error("Auto download trigger error:", err);
        }
      }
    };

    const handleDownloadRejected = (data) => {
      // Must have receiverName set, and must match event target if specified
      if (!receiverName || !receiverName.trim()) return;
      if (data.receiverName && data.receiverName.trim().toLowerCase() !== receiverName.trim().toLowerCase()) {
        return;
      }
      setIsWaitingApproval(false);
      setError(data.message || "The sender declined your download request.");
      clearActiveSession();
    };

    const handleRoomExpired = (data) => {
      setIsWaitingApproval(false);
      const msg = data?.reason === "closed_by_uploader"
        ? "This room has been closed by the sender and all uploaded files have been permanently deleted from storage."
        : "This room has expired and the files have been securely deleted.";
      setError(msg);
      clearActiveSession();
    };

    socket.on("download-approved", handleDownloadApproved);
    socket.on("download-rejected", handleDownloadRejected);
    socket.on("room-expired", handleRoomExpired);

    return () => {
      socket.off("download-approved", handleDownloadApproved);
      socket.off("download-rejected", handleDownloadRejected);
      socket.off("room-expired", handleRoomExpired);
    };
  }, [code, receiverName, roomData]);

  // Fetch Room Info when 5 digits are entered
  const handleCodeChange = async (val) => {
    const cleanVal = val.replace(/\D/g, "").substring(0, 5);
    setCode(cleanVal);

    if (cleanVal.length === 5) {
      setIsFetchingRoom(true);
      setError(null);
      try {
        const room = await verifyRoomActive(cleanVal);
        if (!room) {
          throw new Error("Invalid or expired 5-digit room code.");
        }
        setRoomData(room);
        saveActiveSession({
          role: "receiver",
          code: cleanVal,
          receiverName,
          roomData: room,
          isWaitingApproval,
          downloadUrls,
          expiresAt: room.expiresAt,
        });
      } catch (err) {
        setRoomData(null);
        setError(err.message || "Room not found.");
      } finally {
        setIsFetchingRoom(false);
      }
    } else {
      setRoomData(null);
    }
  };

  const requestDownload = () => {
    if (!receiverName.trim()) {
      setError("Please enter your name as the receiver.");
      return;
    }
    if (!code || code.length !== 5) {
      setError("Please enter a valid 5-digit room code.");
      return;
    }

    setError(null);
    setIsWaitingApproval(true);

    saveActiveSession({
      role: "receiver",
      code,
      receiverName: receiverName.trim(),
      roomData,
      isWaitingApproval: true,
      downloadUrls: null,
      expiresAt: roomData?.expiresAt,
    });

    if (!socket.connected) {
      socket.connect();
    }

    socket.emit("receiver-request-download", {
      code,
      receiverName: receiverName.trim(),
    });
  };

  const handleDownloadAll = () => {
    if (!downloadUrls || downloadUrls.length === 0) return;
    downloadUrls.forEach((item, idx) => {
      setTimeout(() => {
        try {
          const anchor = document.createElement("a");
          anchor.href = item.downloadUrl;
          anchor.download = item.fileName || `file_${idx + 1}`;
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
        } catch (err) {
          console.error("Batch download error:", err);
        }
      }, idx * 700); // 700ms stagger between file downloads
    });
  };

  const handleResetReceiver = () => {
    clearActiveSession();
    setCode("");
    setReceiverName("");
    setRoomData(null);
    setIsWaitingApproval(false);
    setDownloadUrls(null);
    setError(null);
  };

  const files =
    roomData?.files ||
    (roomData?.fileName
      ? [
          {
            fileName: roomData.fileName,
            fileSize: roomData.fileSize,
            fileType: roomData.fileType,
          },
        ]
      : []);
  const totalBatchSize =
    roomData?.totalFileSize ||
    roomData?.fileSize ||
    files.reduce((s, f) => s + (f.fileSize || 0), 0);

  return (
    <div
      className="glass-panel"
      style={{ padding: "40px", maxWidth: "680px", margin: "0 auto" }}
    >
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.85rem", marginBottom: "8px" }}>
          Receive Ephemeral Files
        </h2>
        <p style={{ color: "var(--text-muted)", fontSize: "0.95rem" }}>
          Enter the 5-digit code provided by the sender to request download
          access.
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "14px 18px",
            borderRadius: "14px",
            background: "rgba(244, 63, 94, 0.12)",
            border: "1px solid rgba(244, 63, 94, 0.3)",
            color: "#fecdd3",
            marginBottom: "22px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "0.92rem",
          }}
        >
          <AlertCircle size={20} color="#f43f5e" style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {/* 5-Digit Code Input */}
      <div style={{ marginBottom: "22px" }}>
        <label
          style={{
            display: "block",
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          5-Digit Room Code
        </label>
        <div style={{ position: "relative" }}>
          <KeyRound
            size={20}
            style={{
              position: "absolute",
              left: "16px",
              top: "16px",
              color: "var(--text-dim)",
            }}
          />
          <input
            type="text"
            className="input-field"
            style={{
              paddingLeft: "44px",
              letterSpacing: "0.3em",
              fontFamily: "var(--font-mono)",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "#38bdf8",
            }}
            placeholder="e.g. 48291"
            maxLength={5}
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            disabled={isWaitingApproval || downloadUrls !== null}
          />
        </div>
      </div>

      {/* Receiver Name */}
      <div style={{ marginBottom: "24px" }}>
        <label
          style={{
            display: "block",
            fontSize: "0.88rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: "8px",
          }}
        >
          Your Name (Receiver)
        </label>
        <div style={{ position: "relative" }}>
          <User
            size={18}
            style={{
              position: "absolute",
              left: "16px",
              top: "16px",
              color: "var(--text-dim)",
            }}
          />
          <input
            type="text"
            className="input-field"
            style={{ paddingLeft: "44px" }}
            placeholder="e.g. Sam Jordan"
            value={receiverName}
            onChange={(e) => {
              setReceiverName(e.target.value);
              if (code.length === 5 && roomData) {
                saveActiveSession({
                  role: "receiver",
                  code,
                  receiverName: e.target.value,
                  roomData,
                  isWaitingApproval,
                  downloadUrls,
                  expiresAt: roomData.expiresAt,
                });
              }
            }}
            disabled={isWaitingApproval || downloadUrls !== null}
          />
        </div>
      </div>

      {/* Room Preview */}
      {isFetchingRoom && (
        <div
          style={{
            textAlign: "center",
            padding: "24px",
            color: "var(--text-muted)",
          }}
        >
          <Loader2
            className="animate-spin"
            size={26}
            color="#06b6d4"
            style={{
              margin: "0 auto 8px",
              animation: "spin 1s linear infinite",
            }}
          />
          <div style={{ fontSize: "0.9rem" }}>
            Fetching room details from server...
          </div>
        </div>
      )}

      {roomData && (
        <div
          className="glass-card"
          style={{
            padding: "22px 26px",
            marginBottom: "24px",
            textAlign: "left",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "14px",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <div style={{ fontSize: "0.88rem", color: "var(--text-muted)" }}>
              Sender:{" "}
              <strong style={{ color: "#38bdf8" }}>
                {roomData.uploaderName}
              </strong>
            </div>
            <ExpiryTimer
              expiresAt={roomData.expiresAt}
              onExpired={handleResetReceiver}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <span
              style={{
                fontSize: "0.88rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Layers size={16} color="#38bdf8" /> Shared Files Batch (
              {files.length} {files.length === 1 ? "file" : "files"})
            </span>
            <span
              style={{
                fontSize: "0.88rem",
                fontWeight: 700,
                color: "#38bdf8",
                fontFamily: "var(--font-mono)",
              }}
            >
              Total: {formatBytes(totalBatchSize)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "200px",
              overflowY: "auto",
            }}
          >
            {files.map((file, idx) => (
              <div
                key={file.id || idx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  background: "rgba(15, 23, 42, 0.5)",
                }}
              >
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    background: "rgba(99, 102, 241, 0.15)",
                    border: "1px solid rgba(99, 102, 241, 0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <File size={20} color="#a5b4fc" />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "0.92rem",
                      color: "var(--text-main)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {file.fileName}
                  </div>
                  <div
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    {formatBytes(file.fileSize)} •{" "}
                    {getFileTypeLabel(file.fileName, file.fileType)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action States */}
      {downloadUrls && downloadUrls.length > 0 ? (
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              padding: "24px",
              borderRadius: "20px",
              background: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              marginBottom: "20px",
              color: "#6ee7b7",
            }}
          >
            <ShieldCheck size={44} style={{ margin: "0 auto 10px" }} />
            <h4 style={{ fontSize: "1.25rem", marginBottom: "6px" }}>
              Download Access Approved!
            </h4>
            <p style={{ fontSize: "0.9rem", margin: 0 }}>
              Batch transfer for{" "}
              <strong>
                {downloadUrls.length}{" "}
                {downloadUrls.length === 1 ? "file" : "files"}
              </strong>{" "}
              approved. Click below to download all or individual files.
            </p>
          </div>

          {/* Download All Button */}
          {downloadUrls.length > 1 && (
            <button
              className="btn-primary"
              style={{
                width: "100%",
                marginBottom: "16px",
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                boxShadow: "0 8px 24px rgba(16, 185, 129, 0.35)",
              }}
              onClick={handleDownloadAll}
            >
              <Download size={20} /> Download All {downloadUrls.length} Files
            </button>
          )}

          {/* Individual File Download Cards */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            {downloadUrls.map((item, idx) => (
              <a
                key={item.id || idx}
                href={item.downloadUrl}
                download
                className="btn-secondary"
                style={{
                  width: "100%",
                  textDecoration: "none",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "14px 20px",
                  fontSize: "0.95rem",
                  borderColor: "rgba(16, 185, 129, 0.3)",
                  background: "rgba(16, 185, 129, 0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    minWidth: 0,
                  }}
                >
                  <CheckCircle2 size={18} color="#10b981" />
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "340px",
                      fontWeight: 600,
                    }}
                  >
                    {item.fileName}
                  </span>
                </div>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    color: "#6ee7b7",
                    fontWeight: 600,
                    fontSize: "0.88rem",
                  }}
                >
                  {formatBytes(item.fileSize)} <Download size={16} />
                </span>
              </a>
            ))}
          </div>

          <button
            className="btn-secondary"
            style={{ width: "100%" }}
            onClick={handleResetReceiver}
          >
            <RefreshCw size={16} /> Enter Another Code
          </button>
        </div>
      ) : isWaitingApproval ? (
        <div
          style={{
            padding: "30px",
            borderRadius: "20px",
            background: "rgba(15, 23, 42, 0.7)",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            textAlign: "center",
          }}
          className="pulse-box"
        >
          <Loader2
            size={38}
            color="#6366f1"
            style={{
              animation: "spin 1s linear infinite",
              margin: "0 auto 14px",
            }}
          />
          <h4 style={{ fontSize: "1.2rem", marginBottom: "6px" }}>
            Request Sent to {roomData?.uploaderName || "Sender"}
          </h4>
          <p
            style={{
              fontSize: "0.92rem",
              color: "var(--text-muted)",
              margin: 0,
            }}
          >
            Waiting for sender to approve your download in real-time...
          </p>
        </div>
      ) : (
        <button
          className="btn-primary"
          style={{ width: "100%" }}
          onClick={requestDownload}
          disabled={!roomData || !receiverName.trim()}
        >
          <Download size={20} /> Request Download Access ({files.length}{" "}
          {files.length === 1 ? "File" : "Files"})
        </button>
      )}
    </div>
  );
}
