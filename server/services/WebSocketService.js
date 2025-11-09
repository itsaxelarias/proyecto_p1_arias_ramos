import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { Message } from '../models/Message.js';
import { logger } from '../utils/logger.js';

export class WebSocketService {
  constructor(server, chatService) {
    this.wss = new WebSocketServer({ server });
    this.chatService = chatService;
    this.clients = new Map();
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      const clientId = uuidv4();
      logger.info(`New connection: ${clientId}`);

      ws.on('message', (data) => {
        this.handleMessage(clientId, ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(clientId);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for ${clientId}:`, error);
      });

      // Heartbeat
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });
    });

    // Ping interval para detectar conexiones muertas
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) {
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  handleMessage(clientId, ws, data) {
    try {
      const message = JSON.parse(data);
      logger.info(`Message from ${clientId}:`, message.type);

      switch (message.type) {
        case 'join':
          this.handleJoin(clientId, ws, message.data);
          break;
        case 'message':
          this.handleChatMessage(clientId, message.data);
          break;
        case 'channel-switch':
          this.handleChannelSwitch(clientId, message.data);
          break;
        case 'typing':
          this.handleTyping(clientId, message.data);
          break;
        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }
    } catch (error) {
      logger.error('Error handling message:', error);
      this.sendToClient(ws, Message.create('error', { 
        message: 'Invalid message format' 
      }));
    }
  }

//   handleJoin(clientId, ws, data) {
//     // Registrar cliente
//     this.clients.set(clientId, ws);
    
//     // Agregar usuario al servicio de chat
//     const user = this.chatService.addUser(clientId, data);
    
//     // Enviar confirmación al cliente
//     this.sendToClient(ws, Message.create('joined', {
//       userId: clientId,
//       user: user.toJSON()
//     }));

//     // Enviar historial de mensajes
//     const history = this.chatService.getMessageHistory('general');
//     this.sendToClient(ws, Message.create('history', { messages: history }));

//     // Notificar a todos los usuarios
//     this.broadcastToChannel('general', Message.create('user-joined', {
//       user: user.toJSON()
//     }), clientId);

//     // Enviar lista de miembros actualizada
//     this.broadcastChannelMembers('general');
//   }

handleJoin(clientId, ws, data) {
  console.log('🔍 DEBUG handleJoin - clientId:', clientId);
  console.log('🔍 DEBUG handleJoin - data:', data);
  
  try {
    // Registrar cliente
    this.clients.set(clientId, ws);
    console.log('✅ Client registered');
    
    // Agregar usuario al servicio de chat
    const user = this.chatService.addUser(clientId, data);
    console.log('✅ User added to chat service:', user.toJSON());
    
    // Enviar confirmación al cliente
    const joinedMessage = Message.create('joined', {
      userId: clientId,
      user: user.toJSON()
    });
    console.log('📤 Sending joined message:', joinedMessage);
    this.sendToClient(ws, joinedMessage);
    console.log('✅ Joined message sent');

    // Enviar historial de mensajes
    const history = this.chatService.getMessageHistory('general');
    console.log('📜 Message history length:', history.length);
    this.sendToClient(ws, Message.create('history', { messages: history }));
    console.log('✅ History sent');

    // Notificar a todos los usuarios
    this.broadcastToChannel('general', Message.create('user-joined', {
      user: user.toJSON()
    }), clientId);
    console.log('✅ User joined broadcast sent');

    // Enviar lista de miembros actualizada
    this.broadcastChannelMembers('general');
    console.log('✅ Members list sent');
    
  } catch (error) {
    console.error('❌ ERROR in handleJoin:', error);
    this.sendToClient(ws, Message.create('error', { 
      message: 'Error al unirse: ' + error.message 
    }));
  }
}

  handleChatMessage(clientId, data) {
    const user = this.chatService.getUser(clientId);
    if (!user) return;

    const messageData = {
      id: uuidv4(),
      userId: clientId,
      username: user.name,
      avatar: user.avatar,
      content: data.content,
      image: data.image || null,
      channel: user.currentChannel,
      timestamp: new Date().toISOString()
    };

    // Guardar en historial
    this.chatService.storeMessage(user.currentChannel, messageData);

    // Broadcast a todos en el canal
    this.broadcastToChannel(
      user.currentChannel,
      Message.create('message', messageData)
    );
  }

  handleChannelSwitch(clientId, data) {
    const user = this.chatService.getUser(clientId);
    if (!user) return;

    const oldChannel = user.currentChannel;
    const newChannel = data.channel;

    // Cambiar de canal
    if (this.chatService.joinChannel(clientId, newChannel)) {
      const ws = this.clients.get(clientId);

      // Confirmar cambio al cliente
      this.sendToClient(ws, Message.create('channel-switched', {
        channel: newChannel
      }));

      // Enviar historial del nuevo canal
      const history = this.chatService.getMessageHistory(newChannel);
      this.sendToClient(ws, Message.create('history', { messages: history }));

      // Actualizar listas de miembros
      this.broadcastChannelMembers(oldChannel);
      this.broadcastChannelMembers(newChannel);

      // Notificar al nuevo canal
      this.broadcastToChannel(newChannel, Message.create('user-joined', {
        user: user.toJSON()
      }), clientId);
    }
  }

  handleTyping(clientId, data) {
    const user = this.chatService.getUser(clientId);
    if (!user) return;

    this.broadcastToChannel(
      user.currentChannel,
      Message.create('typing', {
        userId: clientId,
        username: user.name,
        isTyping: data.isTyping
      }),
      clientId
    );
  }

  handleDisconnect(clientId) {
    logger.info(`Client disconnected: ${clientId}`);
    
    const user = this.chatService.removeUser(clientId);
    if (user) {
      // Notificar a todos
      this.broadcastToChannel(
        user.currentChannel,
        Message.create('user-left', { user: user.toJSON() })
      );
      
      // Actualizar lista de miembros
      this.broadcastChannelMembers(user.currentChannel);
    }

    this.clients.delete(clientId);
  }

  broadcastToChannel(channelName, message, excludeClientId = null) {
    const members = this.chatService.getChannelMembers(channelName);
    
    members.forEach(member => {
      if (member.id !== excludeClientId) {
        const ws = this.clients.get(member.id);
        if (ws && ws.readyState === ws.OPEN) {
          this.sendToClient(ws, message);
        }
      }
    });
  }

  broadcastChannelMembers(channelName) {
    const members = this.chatService.getChannelMembers(channelName);
    const message = Message.create('members-update', { 
      channel: channelName,
      members 
    });
    this.broadcastToChannel(channelName, message);
  }

  sendToClient(ws, message) {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  shutdown() {
    clearInterval(this.pingInterval);
    this.wss.close();
  }
}