import { formatTimestamp, sanitizeHTML } from '../utils/helpers.js';

export class ChatUI {
  constructor(stateManager, imageHandler) {
    this.stateManager = stateManager;
    this.imageHandler = imageHandler;
    this.messagesContainer = document.getElementById('messages');
    this.messageInput = document.getElementById('message');
    this.sendBtn = document.getElementById('sendBtn');
    this.attachBtn = document.getElementById('attachBtn');
    this.attachFile = document.getElementById('attachFile');
    this.roomTitle = document.getElementById('roomTitle');

    this.typingTimeout = null;
    this.isTyping = false;

    this.setupEventListeners();
    this.stateManager.subscribe('messages', (messages) => this.renderMessages(messages));
    this.stateManager.subscribe('currentChannel', (channel) => this.updateChannelTitle(channel));
    this.stateManager.subscribe('typingUsers', (users) => this.renderTypingIndicator(users));
  }

  setupEventListeners() {
    this.sendBtn.addEventListener('click', () => this.handleSendMessage());
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendMessage();
      }
    });

    this.messageInput.addEventListener('input', () => this.handleTyping());

    this.attachBtn.addEventListener('click', () => this.attachFile.click());
    this.attachFile.addEventListener('change', (e) => this.handleFileAttach(e));
  }

  handleTyping() {
    if (!this.isTyping) {
      this.isTyping = true;
      this.onTypingStart();
    }

    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.isTyping = false;
      this.onTypingEnd();
    }, 1000);
  }

  handleSendMessage() {
    const content = this.messageInput.value.trim();
    if (!content) return;

    this.onSendMessage(content);
    this.messageInput.value = '';
    this.messageInput.focus();

    if (this.isTyping) {
      this.isTyping = false;
      clearTimeout(this.typingTimeout);
      this.onTypingEnd();
    }
  }

  async handleFileAttach(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const compressed = await this.compressImage(file);
      this.onSendMessage('', compressed);
      e.target.value = '';
    } catch (error) {
      console.error('Error compressing image:', error);
      alert('Error al procesar la imagen');
    }
  }

  async compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          const maxSize = 800;

          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  renderMessages(messages) {
    const currentUserId = this.stateManager.state.userId;
    
    this.messagesContainer.innerHTML = messages.map(msg => {
      const isOwn = msg.userId === currentUserId;
      const time = formatTimestamp(msg.timestamp);

      return `
        <div class="message ${isOwn ? 'own' : ''}">
          ${!isOwn ? `
            <div class="message-avatar">
              ${msg.avatar 
                ? `<img src="${msg.avatar}" alt="${msg.username}" />` 
                : '<span>👤</span>'}
            </div>
          ` : ''}
          <div class="message-content">
            ${!isOwn ? `<div class="message-author">${sanitizeHTML(msg.username)}</div>` : ''}
            ${msg.image ? `
              <img 
                src="${msg.image}" 
                alt="Imagen" 
                class="message-image"
                onclick="window.chatApp.imageHandler.openLightbox('${msg.image}', '${sanitizeHTML(msg.username)}')"
              />
            ` : ''}
            ${msg.content ? `<div class="message-text">${this.linkify(sanitizeHTML(msg.content))}</div>` : ''}
            <div class="message-time">${time}</div>
          </div>
        </div>
      `;
    }).join('');

    this.scrollToBottom();
  }

  renderTypingIndicator(typingUsers) {
    const existingIndicator = document.querySelector('.typing-indicator');
    if (existingIndicator) {
      existingIndicator.remove();
    }

    if (typingUsers.size === 0) return;

    const users = Array.from(typingUsers).map(u => JSON.parse(u));
    const names = users.map(u => u.username).join(', ');

    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.innerHTML = `
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
      <span class="typing-text">${sanitizeHTML(names)} ${users.length > 1 ? 'están' : 'está'} escribiendo...</span>
    `;

    this.messagesContainer.appendChild(indicator);
    this.scrollToBottom();
  }

  linkify(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
  }

  updateChannelTitle(channel) {
    this.roomTitle.textContent = `# ${channel}`;
  }

  scrollToBottom() {
    setTimeout(() => {
      this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }, 0);
  }

  // Callbacks que serán asignados desde app.js
  onSendMessage(content, image = null) {}
  onTypingStart() {}
  onTypingEnd() {}
}