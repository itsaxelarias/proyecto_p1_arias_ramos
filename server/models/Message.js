export class Message {
  constructor(type, data, userId = null) {
    this.type = type;
    this.data = data;
    this.userId = userId;
    this.timestamp = new Date().toISOString();
  }

  static create(type, data, userId = null) {
    return new Message(type, data, userId);
  }
}