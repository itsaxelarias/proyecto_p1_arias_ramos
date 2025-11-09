// const WebSocket = require('ws');
// const http = require('http');
// const express = require('express');
// const path = require('path');

// const app = express();
// const server = http.createServer(app);
// const wss = new WebSocket.Server({ server });

// app.use(express.static(path.join(__dirname, '../public')));

// const channels = { general: new Set(), 'off-topic': new Set(), soporte: new Set() };
// const users = new Map();

// wss.on('connection', (ws) => {
//   console.log('✅ Nueva conexión');
  
//   ws.on('message', (data) => {
//     try {
//       const msg = JSON.parse(data);
//       const user = users.get(ws) || {};

//       if (msg.type === 'set_name') {
//         users.set(ws, { ...user, name: msg.user });
//       } else if (msg.type === 'set_avatar') {
//         users.set(ws, { ...user, avatar: msg.dataUrl });
//       } else if (msg.type === 'join') {
//         if (user.channel) channels[user.channel]?.delete(ws);
//         const channel = msg.channel || 'general';
//         channels[channel]?.add(ws);
//         users.set(ws, { ...user, channel, name: msg.user });
//         broadcastUsers(channel);
//       } else if (msg.type === 'chat') {
//         broadcast(msg.channel, { type: 'chat', user: msg.user, text: msg.text, time: new Date().toLocaleTimeString(), channel: msg.channel });
//       } else if (msg.type === 'image') {
//         broadcast(msg.channel, { type: 'image', user: msg.user, dataUrl: msg.dataUrl, text: msg.text, time: new Date().toLocaleTimeString(), channel: msg.channel });
//       } else if (msg.type === 'disconnect') {
//         channels[user.channel]?.delete(ws);
//         users.delete(ws);
//         broadcastUsers(user.channel);
//         ws.close();
//       }
//     } catch (err) {
//       console.error('❌ Error:', err);
//     }
//   });

//   ws.on('close', () => {
//     const user = users.get(ws);
//     if (user) {
//       channels[user.channel]?.delete(ws);
//       broadcastUsers(user.channel);
//       users.delete(ws);
//     }
//   });
// });

// function broadcast(channel, message) {
//   const clients = channels[channel];
//   if (!clients) return;
//   const payload = JSON.stringify(message);
//   clients.forEach(client => {
//     if (client.readyState === WebSocket.OPEN) client.send(payload);
//   });
// }

// function broadcastUsers(channel) {
//   const clients = channels[channel];
//   if (!clients) return;
//   const userList = Array.from(clients).map(ws => {
//     const user = users.get(ws);
//     return { name: user?.name || 'Invitado', avatar: user?.avatar || '' };
//   });
//   broadcast(channel, { type: 'users', channel, users: userList });
// }

// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => console.log(`🚀 http://localhost:${PORT}`));

import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { WebSocketService } from './services/WebSocketService.js';
import { ChatService } from './services/ChatService.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Servir archivos estáticos
app.use(express.static(join(__dirname, '../public')));

// Inicializar servicios
const chatService = new ChatService();
const wsService = new WebSocketService(server, chatService);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    connections: wsService.clients.size,
    users: chatService.users.size
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server ready`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  wsService.shutdown();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});