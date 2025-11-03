const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

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
    .map(c => c.username || "Invitado");
}
function pushUsers(channel) {
  const users = usersInChannel(channel);
  broadcastToChannel(channel, { type: "users", channel, users });
}

wss.on("connection", (ws, req) => {
  ws.id = crypto.randomUUID();
  ws.username = "Invitado";
  ws.channel = "general";

  console.log(`✅ Nueva conexión desde ${req.socket.remoteAddress} (canal: ${ws.channel})`);

  // Anunciar conexión genérica al canal por defecto
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
    catch { return ws.send(JSON.stringify({ user: "Sistema", time: new Date().toLocaleTimeString(), text: "Mensaje inválido.", channel: ws.channel })); }

    // set_name
    if (msg.type === "set_name") {
      ws.username = (msg.user || "Invitado").toString().trim() || "Invitado";
      pushUsers(ws.channel);
      return;
    }

    // join canal
    if (msg.type === "join") {
      const newCh = (msg.channel || "general").toString().trim();
      const oldCh = ws.channel;
      if (newCh === oldCh) { pushUsers(oldCh); return; }

      ws.channel = newCh;
      // actualizar listas en ambos canales
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

    // disconnect voluntario
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

    // mensaje normal
    const ch = msg.channel || ws.channel;
    const full = {
      user: msg.user || ws.username || "Invitado",
      time: new Date().toLocaleTimeString(),
      text: msg.text || "",
      channel: ch
    };
    broadcastToChannel(ch, full);
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

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => console.log(`🚀 Servidor en http://localhost:${PORT}`));
