require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const connectDB = require('./config/db');
const chatRoutes = require('./routes/chat');
const resumeRoutes = require('./routes/resumeRoutes');
const { setupWebSocketServer } = require('./websocket/streamingServer');
const { setupDeepgramServer } = require('./websocket/deepgramServer');
const fileUpload = require('express-fileupload');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true
}));
app.use(express.json());

app.use(fileUpload({
  createParentPath: true,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  useTempFiles: true,
  tempFileDir: './tmp/', // Use relative path for Windows
  debug: true,
  safeFileNames: true,
  preserveExtension: true,
  abortOnLimit: true,
  parseNested: true,
  uploadTimeout: 60000
}));

// Add error handling middleware right after file upload middleware
app.use((error, req, res, next) => {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      message: 'File is too large. Maximum size is 10MB'
    });
  }

  if (error.code === 'ENOENT') {
    return res.status(400).json({
      success: false,
      message: 'Temp directory is not accessible'
    });
  }

  console.error('File upload error:', error);
  return res.status(500).json({
    success: false,
    message: 'File upload failed',
    error: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Routes
app.use('/api/chat', chatRoutes);
app.use('/api/resume', resumeRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'An internal server error occurred',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Setup WebSocket Servers
const wss = new WebSocket.Server({ noServer: true });
const deepgramWss = new WebSocket.Server({ noServer: true });

setupWebSocketServer(wss);
setupDeepgramServer(deepgramWss);

// Handle upgrade requests
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url;

  if (pathname === '/ws/speech') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/transcribe') {
    deepgramWss.handleUpgrade(request, socket, head, (ws) => {
      deepgramWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Promise Rejection:', err);
  // Don't crash the server, just log the error
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});