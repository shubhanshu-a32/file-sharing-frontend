# 🎨 File Sharing — Modern React + Vite Frontend

<p align="center">
  <img src="https://img.shields.io/badge/Framework-React%2018-blue?style=for-the-badge&logo=react" alt="React 18" />
  <img src="https://img.shields.io/badge/Bundler-Vite-purple?style=for-the-badge&logo=vite" alt="Vite" />
  <img src="https://img.shields.io/badge/Icons-Lucide%20React-pink?style=for-the-badge&logo=lucide" alt="Lucide" />
  <img src="https://img.shields.io/badge/WebSockets-Socket.io%20Client-black?style=for-the-badge&logo=socketdotio" alt="Socket.io Client" />
</p>

The responsive, high-performance web user interface for **File Sharing**. Built with **React 18**, **Vite**, **Lucide Icons**, and custom **CSS Glassmorphism**, providing an intuitive drag-and-drop experience for transferring files up to **10 GB**.

---

## ✨ Features & User Experience

- 📦 **10 GB Direct S3 Multipart Uploads**: Slices large files into 20MB chunks in parallel directly from the browser to AWS S3 using presigned URLs.
- 🔄 **Page Refresh Session Recovery**: Stores active room codes in `sessionStorage` and syncs URL query parameters (`?code=XXXXX&role=sender`). Refreshing the browser automatically restores active room state and socket connections.
- 🤝 **Interactive Peer Approval Handshake**: Real-time pop-up notification cards when a recipient requests access, giving the sender one-click **Approve** or **Decline** controls.
- 🎨 **Modern Glassmorphism Design**: High-end dark theme UI with custom glowing badges, backdrop blur, step workflow indicators, and duration preset chips (1.5m to 2h).
- 🏷️ **Automatic File Type Detection**: Displays custom preview icons (Video, Image, Archive, Document, Spreadsheets) based on extension and MIME type.
- 📋 **One-Click Share Actions**: Instant copy buttons for the 5-digit room code and direct shareable URLs (`http://domain/?code=48291`).

---

## 📁 Component Architecture

```
frontend/src/
├── App.jsx                   # Main tab switcher, session recovery & root layout
├── main.jsx                  # React DOM entry point
├── index.css                 # Design system tokens, glassmorphic utility classes & keyframes
├── components/
│   ├── Header.jsx            # Application header, logo & live socket status dot
│   ├── FileUploader.jsx      # Drag & drop upload zone, uploader name & TTL slider
│   ├── RoomSenderView.jsx    # 5-digit code card, copy buttons & peer approval card
│   ├── RoomReceiverView.jsx  # 5-digit code input, receiver name & download trigger
│   └── ExpiryTimer.jsx       # Live countdown clock badge with critical time warning
└── utils/
    ├── s3UploadHelpers.js    # Chunking logic (20MB), byte formatters & S3 uploader
    ├── sessionStorage.js     # URL params & sessionStorage persistence helper
    └── socket.js             # Singleton Socket.io client connection instance
```

---

## 🛠️ Environment Configuration

Create a `.env` file in the `frontend/` directory (optional):

```env
VITE_BACKEND_URL=http://localhost:5005
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Vite Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Build for Production
```bash
npm run build
```
The compiled production bundle will be output to `frontend/dist/`.

### 4. Preview Production Build
```bash
npm run preview
```
