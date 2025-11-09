export class WebSocketClient {
  constructor(stateManager) {
    this.ws = null;
    this.stateManager = stateManager;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 2000;
    this.connectionStatus = 'disconnected';
    this.pendingJoin = null;  
  }

  getWebSocketURL() {
    // Si estamos en desarrollo local
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      const port = window.location.port || '3000';
      return `ws://localhost:${port}`;
    }
    
    // Si estamos en producción (Render u otro hosting)
    // Usar el protocolo correcto basado en HTTP/HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }

// connect() {
//   const wsUrl = this.getWebSocketURL();
//   console.log(`Connecting to WebSocket: ${wsUrl}`);
  
//   try {
//     this.ws = new WebSocket(wsUrl);
//     this.connectionStatus = 'connecting';
//     this.updateConnectionUI();

//     this.ws.onopen = () => {
//       console.log('✅ WebSocket connected successfully');
//       this.connectionStatus = 'connected';
//       this.reconnectAttempts = 0;
//       this.updateConnectionUI();
      
//       // Si hay un join pendiente, enviarlo ahora
//       if (this.pendingJoin) {
//         console.log('📤 Sending pending join request');
//         this.join(this.pendingJoin.name, this.pendingJoin.avatar);
//         this.pendingJoin = null;
//       }
//     };

//     // ... resto del código igual ...
//   } catch (error) {
//     console.error('Failed to create WebSocket:', error);
//     this.connectionStatus = 'error';
//     this.updateConnectionUI();
//   }
// }

connect() {
  const wsUrl = this.getWebSocketURL();
  console.log(`Connecting to WebSocket: ${wsUrl}`);
  
  try {
    this.ws = new WebSocket(wsUrl);
    this.connectionStatus = 'connecting';
    this.updateConnectionUI();

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected successfully');
      this.connectionStatus = 'connected';
      this.reconnectAttempts = 0;
      this.updateConnectionUI();
      
      // AGREGAR ESTO: Si hay un join pendiente, enviarlo ahora
      if (this.pendingJoin) {
        console.log('📤 Sending pending join request');
        const success = this.send('join', this.pendingJoin);
        console.log('Join sent:', success ? 'success' : 'failed');
        this.pendingJoin = null;
      }
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onclose = (event) => {
      console.log('❌ WebSocket disconnected', event.code, event.reason);
      this.connectionStatus = 'disconnected';
      this.updateConnectionUI();
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      console.error('⚠️ WebSocket error:', error);
      this.connectionStatus = 'error';
      this.updateConnectionUI();
    };
  } catch (error) {
    console.error('Failed to create WebSocket:', error);
    this.connectionStatus = 'error';
    this.updateConnectionUI();
  }
}

  updateConnectionUI() {
    const statusDot = document.getElementById('meDot');
    const statusText = document.getElementById('mePresence');
    
    if (!statusDot || !statusText) return;

    switch (this.connectionStatus) {
      case 'connecting':
        statusDot.className = 'status status-away';
        statusText.textContent = 'Conectando...';
        break;
      case 'connected':
        statusDot.className = 'status status-online';
        statusText.textContent = 'En línea';
        break;
      case 'disconnected':
      case 'error':
        statusDot.className = 'status status-offline';
        statusText.textContent = 'Desconectado';
        break;
    }
  }

  handleMessage(message) {
    console.log('📨 Received:', message.type);

    switch (message.type) {
      case 'joined':
        console.log('✅ Successfully joined chat');
        this.stateManager.setUserId(message.data.userId);
        this.stateManager.setUser(message.data.user);
        break;

      case 'history':
        console.log('📜 Received message history:', message.data.messages.length, 'messages');
        this.stateManager.setMessages(message.data.messages);
        break;

      case 'message':
        console.log('💬 New message from:', message.data.username);
        this.stateManager.addMessage(message.data);
        break;

      case 'members-update':
        if (message.data.channel === this.stateManager.state.currentChannel) {
          console.log('👥 Members updated:', message.data.members.length, 'members');
          this.stateManager.setMembers(message.data.members);
        }
        break;

      case 'user-joined':
        console.log('👋 User joined:', message.data.user.name);
        break;

      case 'user-left':
        console.log('👋 User left:', message.data.user.name);
        break;

      case 'channel-switched':
        console.log('🔄 Switched to channel:', message.data.channel);
        this.stateManager.setCurrentChannel(message.data.channel);
        break;

      case 'typing':
        if (message.data.isTyping) {
          this.stateManager.addTypingUser(message.data.userId, message.data.username);
        } else {
          this.stateManager.removeTypingUser(message.data.userId);
        }
        setTimeout(() => {
          this.stateManager.removeTypingUser(message.data.userId);
        }, 3000);
        break;

      case 'error':
        console.error('❌ Server error:', message.data.message);
        alert(`Error del servidor: ${message.data.message}`);
        break;

      default:
        console.warn('⚠️ Unknown message type:', message.type);
    }
  }

  send(type, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📤 Sending:', type);
      this.ws.send(JSON.stringify({ type, data }));
      return true;
    } else {
      console.warn('⚠️ WebSocket not ready. State:', this.ws?.readyState);
      return false;
    }
  }

//   join(name, avatar) {
//     console.log('🚀 Attempting to join chat as:', name);
//     this.send('join', { name, avatar });
//   }
// join(name, avatar) {
//   console.log('🚀 Attempting to join chat as:', name);
  
//   if (this.connectionStatus === 'connected') {
//     this.send('join', { name, avatar });
//   } else {
//     console.log('⏳ WebSocket not ready, queuing join request');
//     this.pendingJoin = { name, avatar };
//   }
// }

join(name, avatar) {
  console.log('🚀 Attempting to join chat as:', name);
  
  if (this.connectionStatus === 'connected') {
    console.log('📤 Sending join immediately (already connected)');
    this.send('join', { name, avatar });
  } else {
    console.log('⏳ WebSocket not ready, queuing join request');
    this.pendingJoin = { name, avatar };
  }
}

  sendMessage(content, image = null) {
    this.send('message', { content, image });
  }

  switchChannel(channel) {
    this.send('channel-switch', { channel });
  }

  sendTyping(isTyping) {
    this.send('typing', { isTyping });
  }

  handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * this.reconnectAttempts;
      console.log(`🔄 Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
      
      setTimeout(() => {
        if (this.connectionStatus !== 'connected') {
          this.connect();
        }
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached');
      alert('No se pudo conectar al servidor. Por favor recarga la página.');
    }
  }

  disconnect() {
    console.log('👋 Disconnecting WebSocket');
    if (this.ws) {
      this.ws.close();
    }
  }
}