import { User } from '../models/User.js';
import { Message } from '../models/Message.js';

export class ChatService {
  constructor() {
    this.users = new Map();
    this.channels = new Map([
      ['general', { name: 'general', members: new Set() }],
      ['off-topic', { name: 'off-topic', members: new Set() }],
      ['soporte', { name: 'soporte', members: new Set() }]
    ]);
    this.messageHistory = new Map();
  }

  addUser(userId, userData) {
    const user = new User(userId, userData.name, userData.avatar);
    this.users.set(userId, user);
    this.joinChannel(userId, 'general');
    return user;
  }

  removeUser(userId) {
    const user = this.users.get(userId);
    if (user) {
      this.leaveChannel(userId, user.currentChannel);
      this.users.delete(userId);
    }
    return user;
  }

  getUser(userId) {
    return this.users.get(userId);
  }

  getAllUsers() {
    return Array.from(this.users.values()).map(u => u.toJSON());
  }

  joinChannel(userId, channelName) {
    const user = this.users.get(userId);
    if (!user) return false;

    const channel = this.channels.get(channelName);
    if (!channel) return false;

    // Salir del canal anterior
    if (user.currentChannel) {
      this.leaveChannel(userId, user.currentChannel);
    }

    channel.members.add(userId);
    user.currentChannel = channelName;
    return true;
  }

  leaveChannel(userId, channelName) {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.members.delete(userId);
    }
  }

  getChannelMembers(channelName) {
    const channel = this.channels.get(channelName);
    if (!channel) return [];

    return Array.from(channel.members)
      .map(id => this.users.get(id))
      .filter(u => u)
      .map(u => u.toJSON());
  }

  storeMessage(channelName, message) {
    if (!this.messageHistory.has(channelName)) {
      this.messageHistory.set(channelName, []);
    }
    const history = this.messageHistory.get(channelName);
    history.push(message);
    
    // Mantener solo los últimos 100 mensajes
    if (history.length > 100) {
      history.shift();
    }
  }

  getMessageHistory(channelName, limit = 50) {
    const history = this.messageHistory.get(channelName) || [];
    return history.slice(-limit);
  }
}