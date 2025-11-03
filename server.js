// Osprey GX Chat – WebSocket server (Express + ws)
const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Archivos estáticos
app.use(express.static("public"));

/* -------------------- Helpers -------------------- */
function broadcastToChannel(channel, obj) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.channel === channel) {
      client.send(payload);
    }
  }
}
function usersInChannel(channel) {
  return [...wss.clients]
    .filter(c => c.readyState === WebSocket.OPEN && c.channel === channel)
    .map(c => ({ name: c.username || "Invitado", avatar: c.avatar || "" }));
}
function pushUsers(channel) {
  broadcastToChannel(channel, { type: "users", channel, users: usersInChannel(channel) });
}
// Tamaño real (bytes) de un dataURL base64
function dataUrlSizeBytes(dataUrl) {
  const m = /^data:\w+\/[\w.+-]+;base64,/.exec(dataUrl);
  if (!m) return -1;
  const b64 = dataUrl.slice(m[0].length);
  const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return (b64.length * 3) / 4 - padding;
}

/* -------------------- WebSocket -------------------- */
wss.on("connection", (ws, req) => {
  ws.id = crypto.randomUUID();
  ws.username = "Invitado";
  ws.channel = "general";
  ws.avatar = "";

  console.log(`✅ Nueva conexión desde ${req.socket.remoteAddress} (canal: ${ws.channel})`);

  broadcastToChannel(ws.channel, {
    user: "Sistema",
    time: new Date().toLocaleTimeString(),
    text: "Un usuario se ha conectado.",
    channel: ws.channel
  });
  pushUsers(ws.channel);

  ws.on("message", (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); }
    catch {
      return ws.send(JSON.stringify({
        user: "Sistema",
        time: new Date().toLocaleTimeString(),
        text: "Mensaje inválido.",
        channel: ws.channel
      }));
    }

    if (msg.type === "set_name") {
      ws.username = (msg.user || "Invitado").toString().trim() || "Invitado";
      pushUsers(ws.channel);
      return;
    }

    if (msg.type === "set_avatar") {
      const dataUrl = (msg.dataUrl || "").toString();
      const BYTES_MAX = 5 * 1024 * 1024; // 5 MB
      const okMime = dataUrl.startsWith("data:image/") && dataUrl.includes(";base64,");
      const size = okMime ? dataUrlSizeBytes(dataUrl) : -1;
      if (okMime && size >= 0 && size <= BYTES_MAX) {
        ws.avatar = dataUrl;
        pushUsers(ws.channel);
      } else {
        ws.send(JSON.stringify({
          user: "Sistema",
          time: new Date().toLocaleTimeString(),
          text: "Avatar rechazado: formato inválido o tamaño > 5 MB.",
          channel: ws.channel
        }));
      }
      return;
    }

    if (msg.type === "join") {
      const newCh = (msg.channel || "general").toString().trim();
      const oldCh = ws.channel;
      if (newCh === oldCh) { pushUsers(oldCh); return; }
      ws.channel = newCh;
      pushUsers(oldCh);
      pushUsers(newCh);
      broadcastToChannel(newCh, {
        user: "Sistema",
        time: new Date().toLocaleTimeString(),
        text: `${ws.username} se unió a #${newCh}.`,
        channel: newCh
      });
      return;
    }

    if (msg.type === "disconnect") {
      broadcastToChannel(ws.channel, {
        user: msg.user || ws.username,
        time: new Date().toLocaleTimeString(),
        text: "se ha desconectado.",
        channel: ws.channel
      });
      pushUsers(ws.channel);
      return;
    }

    const ch = msg.channel || ws.channel;
    broadcastToChannel(ch, {
      user: msg.user || ws.username || "Invitado",
      time: new Date().toLocaleTimeString(),
      text: msg.text || "",
      channel: ch
    });
  });

  ws.on("close", () => {
    broadcastToChannel(ws.channel, {
      user: "Sistema",
      time: new Date().toLocaleTimeString(),
      text: "Un usuario se ha desconectado.",
      channel: ws.channel
    });
    pushUsers(ws.channel);
  });

  ws.on("error", (err) => console.error("WS error:", err));
});

/* -------------------- HTTP -------------------- */
const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});
