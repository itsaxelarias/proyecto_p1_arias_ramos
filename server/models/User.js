export class User {
  constructor(id, name, avatar = null) {
    this.id = id;
    this.name = name;
    this.avatar = avatar;
    this.status = 'online';
    this.currentChannel = 'general';
    this.connectedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      avatar: this.avatar,
      status: this.status,
      currentChannel: this.currentChannel
    };
  }
}