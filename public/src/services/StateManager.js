export class StateManager {
  constructor() {
    this.state = {
      userId: null,
      user: null,
      currentChannel: 'general',
      members: [],
      messages: [],
      typingUsers: new Set()
    };
    this.listeners = new Map();
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push(callback);
  }

  notify(key) {
    const callbacks = this.listeners.get(key) || [];
    callbacks.forEach(cb => cb(this.state[key]));
  }

  setUserId(userId) {
    this.state.userId = userId;
    this.notify('userId');
  }

  setUser(user) {
    this.state.user = user;
    this.notify('user');
  }

  setCurrentChannel(channel) {
    this.state.currentChannel = channel;
    this.state.messages = [];
    this.notify('currentChannel');
    this.notify('messages');
  }

  setMembers(members) {
    this.state.members = members;
    this.notify('members');
  }

  addMessage(message) {
    this.state.messages.push(message);
    this.notify('messages');
  }

  setMessages(messages) {
    this.state.messages = messages;
    this.notify('messages');
  }

  addTypingUser(userId, username) {
    this.state.typingUsers.add(JSON.stringify({ userId, username }));
    this.notify('typingUsers');
  }

  removeTypingUser(userId) {
    const toRemove = Array.from(this.state.typingUsers)
      .find(item => JSON.parse(item).userId === userId);
    if (toRemove) {
      this.state.typingUsers.delete(toRemove);
      this.notify('typingUsers');
    }
  }
}