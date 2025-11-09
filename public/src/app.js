import { StateManager } from './services/StateManager.js';
import { WebSocketClient } from './services/WebSocketClient.js';
import { ChatUI } from './ui/ChatUI.js';
import { MembersUI } from './ui/MembersUI.js';
import { ImageHandler } from './ui/ImageHandler.js';

class ChatApp {
    constructor() {
    this.stateManager = new StateManager();
    this.wsClient = new WebSocketClient(this.stateManager);
    this.imageHandler = new ImageHandler();
    this.chatUI = new ChatUI(this.stateManager, this.imageHandler);
    this.membersUI = new MembersUI(this.stateManager);

    this.initializeElements();
    this.setupEventListeners();
    this.setupChatUICallbacks();
    this.setupStateListeners();  // ← AGREGAR ESTA LÍNEA
    
    // Exponer para debugging
    window.wsClient = this.wsClient;
    console.log('🦅 Osprey GX Chat initialized');
    }

  initializeElements() {
    this.joinScreen = document.getElementById('join-screen');
    this.app = document.getElementById('app');
    this.joinBtn = document.getElementById('joinBtn');
    this.joinName = document.getElementById('joinName');
    this.joinAvatar = document.getElementById('joinAvatar');
    this.joinAvatarPreview = document.getElementById('joinAvatarPreview');
    this.channelList = document.getElementById('channelList');
    this.meAvatar = document.getElementById('meAvatar');
    this.usernameDisplay = document.getElementById('usernameDisplay');
    this.reconnectBtn = document.getElementById('reconnectBtn');
    this.clearBtn = document.getElementById('clearBtn');
    this.channelsToggle = document.getElementById('channelsToggle');
    this.sidebarBackdrop = document.getElementById('sidebarBackdrop');
    this.sidebar = document.querySelector('.sidebar');
    this.chatHeader = document.querySelector('.chat-header');

    this.userAvatar = null;
  }

  setupEventListeners() {
    // Join
    this.joinBtn.addEventListener('click', () => this.handleJoin());
    this.joinName.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.handleJoin();
    });

    // Avatar upload
    this.joinAvatar.addEventListener('change', (e) => this.handleAvatarSelect(e));

    // Channels
    this.channelList.addEventListener('click', (e) => {
      const item = e.target.closest('li');
      if (item) this.handleChannelSwitch(item);
    });

    // Sidebar toggle (mobile)
    this.channelsToggle.addEventListener('click', () => this.toggleSidebar());
    this.sidebarBackdrop.addEventListener('click', () => this.closeSidebar());

    // Actions
    this.reconnectBtn.addEventListener('click', () => this.handleReconnect());
    this.clearBtn.addEventListener('click', () => this.handleLogout());

    // Monitor connection status
    setInterval(() => this.updateHeaderStatus(), 1000);
  }

  updateHeaderStatus() {
    if (!this.chatHeader) return;
    
    this.chatHeader.className = 'chat-header';
    this.chatHeader.classList.add(this.wsClient.connectionStatus);
  }

  setupChatUICallbacks() {
    this.chatUI.onSendMessage = (content, image) => {
      if (this.wsClient.connectionStatus === 'connected') {
        this.wsClient.sendMessage(content, image);
      } else {
        alert('No hay conexión con el servidor. Reconectando...');
        this.wsClient.connect();
      }
    };

    this.chatUI.onTypingStart = () => {
      this.wsClient.sendTyping(true);
    };

    this.chatUI.onTypingEnd = () => {
      this.wsClient.sendTyping(false);
    };
  }

  handleAvatarSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.imageHandler.onImageCropped = (croppedImage) => {
      this.userAvatar = croppedImage;
      this.joinAvatarPreview.innerHTML = `<img src="${croppedImage}" alt="Avatar" />`;
    };

    this.imageHandler.openCropper(file);
  }

// handleJoin() {
//   const name = this.joinName.value.trim();
//   if (!name) {
//     alert('Por favor ingresa tu nombre');
//     return;
//   }

//   console.log('👤 Joining as:', name);

//   // Deshabilitar botón mientras conecta
//   this.joinBtn.disabled = true;
//   this.joinBtn.textContent = 'Conectando...';

//   // Guardar nombre y avatar temporalmente
//   this.tempUserName = name;
//   this.tempUserAvatar = this.userAvatar;

//   // Conectar WebSocket
//   this.wsClient.connect();
// }
handleJoin() {
  const name = this.joinName.value.trim();
  if (!name) {
    alert('Por favor ingresa tu nombre');
    return;
  }

  console.log('👤 Joining as:', name);

  // Deshabilitar botón mientras conecta
  this.joinBtn.disabled = true;
  this.joinBtn.textContent = 'Conectando...';

  // Guardar nombre y avatar temporalmente
  this.tempUserName = name;
  this.tempUserAvatar = this.userAvatar;

  // Conectar WebSocket
  this.wsClient.connect();

  // Esperar a que conecte y enviar join
  const waitForConnection = setInterval(() => {
    if (this.wsClient.connectionStatus === 'connected') {
      clearInterval(waitForConnection);
      console.log('📤 Connection ready, sending join...');
      this.wsClient.join(this.tempUserName, this.tempUserAvatar);
    } else if (this.wsClient.connectionStatus === 'error') {
      clearInterval(waitForConnection);
      this.joinBtn.disabled = false;
      this.joinBtn.textContent = 'Unirse';
      alert('Error al conectar. Verifica que el servidor esté corriendo.');
    }
  }, 100);

  // Timeout de 10 segundos
  setTimeout(() => {
    clearInterval(waitForConnection);
    if (this.wsClient.connectionStatus !== 'connected') {
      this.joinBtn.disabled = false;
      this.joinBtn.textContent = 'Unirse';
      alert('Timeout: No se pudo conectar en 10 segundos.');
    }
  }, 10000);
}

setupStateListeners() {
  // Escuchar cuando el usuario se une exitosamente
  this.stateManager.subscribe('user', (user) => {
    if (user && this.joinScreen && !this.joinScreen.hidden) {
      console.log('✅ User state updated, showing chat interface');
      
      // Actualizar UI del perfil
      this.usernameDisplay.textContent = this.tempUserName;
      if (this.tempUserAvatar) {
        this.meAvatar.innerHTML = `<img src="${this.tempUserAvatar}" alt="${this.tempUserName}" />`;
      } else {
        this.meAvatar.textContent = this.tempUserName.charAt(0).toUpperCase();
      }

      // Mostrar chat, ocultar pantalla de join
      this.joinScreen.hidden = true;
      this.app.hidden = false;
      
      // Re-habilitar botón por si acaso
      this.joinBtn.disabled = false;
      this.joinBtn.textContent = 'Unirse';
      
      console.log('✅ Chat interface now visible');
    }
  });
}

  handleChannelSwitch(item) {
    const channel = item.dataset.channel;
    if (!channel) return;

    // Actualizar UI
    document.querySelectorAll('#channelList li').forEach(li => li.classList.remove('active'));
    item.classList.add('active');

    // Cambiar canal
    this.wsClient.switchChannel(channel);

    // Cerrar sidebar en móvil
    if (window.innerWidth <= 768) {
      this.closeSidebar();
    }
  }

  toggleSidebar() {
    const isOpen = this.sidebar.classList.toggle('open');
    this.sidebarBackdrop.classList.toggle('active', isOpen);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }

  closeSidebar() {
    this.sidebar.classList.remove('open');
    this.sidebarBackdrop.classList.remove('active');
    document.body.style.overflow = '';
  }

  handleReconnect() {
    console.log('🔄 Manual reconnect triggered');
    this.wsClient.disconnect();
    setTimeout(() => this.wsClient.connect(), 500);
  }

  handleLogout() {
    if (confirm('¿Cerrar sesión?')) {
      this.wsClient.disconnect();
      location.reload();
    }
  }
}

// Inicializar app
console.log('🚀 Loading Osprey GX Chat...');
window.chatApp = new ChatApp();
