// server.js
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

// Broadcast solo a un canal
function broadcastToChannel(channel, obj) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.channel === channel) {
      client.send(payload);
    }
  }
}

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  ws.channel = "general";       // canal por defecto
  ws.username = "Anónimo";      // opcional: para logs
  console.log(`✅ Nueva conexión WS desde ${ip} (canal: ${ws.channel})`);

  // Mensaje sistema al canal actual
  broadcastToChannel(ws.channel, {
    user: "Sistema",
    time: new Date().toLocaleTimeString(),
    text: "Un usuario se ha conectado.",
    channel: ws.channel
  });

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
      console.log("📩 Mensaje crudo del cliente:", data.toString());
    } catch (e) {
      return ws.send(JSON.stringify({
        user: "Sistema",
        time: new Date().toLocaleTimeString(),
        text: "Mensaje inválido.",
        channel: ws.channel
      }));
    }

    // Registrar nombre si llega en mensajes
    if (typeof msg.user === "string" && msg.user.trim()) {
      ws.username = msg.user.trim();
    }

    // Cambiar de canal
    if (msg.type === "join") {
      const newChannel = (msg.channel || "general").trim();
      const oldChannel = ws.channel;
      ws.channel = newChannel;

      // Avisar en el nuevo canal
      broadcastToChannel(newChannel, {
        user: "Sistema",
        time: new Date().toLocaleTimeString(),
        text: `${ws.username} se unió a #${newChannel}.`,
        channel: newChannel
      });
      return;
    }

    // Desconexión voluntaria
    if (msg.type === "disconnect") {
      broadcastToChannel(ws.channel, {
        user: msg.user || "Usuario",
        time: new Date().toLocaleTimeString(),
        text: "se ha desconectado.",
        channel: ws.channel
      });
      return;
    }

    // Mensaje normal de chat (va al canal activo o al que venga en el payload)
    const ch = (msg.channel && String(msg.channel)) || ws.channel;
    const full = {
      user: msg.user || "Anónimo",
      time: new Date().toLocaleTimeString(),
      text: msg.text || "",
      channel: ch
    };
    broadcastToChannel(ch, full);
  });

  ws.on("close", () => {
    console.log("🔌 Cliente desconectado (canal:", ws.channel, ")");
    broadcastToChannel(ws.channel, {
      user: "Sistema",
      time: new Date().toLocaleTimeString(),
      text: "Un usuario se ha desconectado.",
      channel: ws.channel
    });
  });

  ws.on("error", (err) => console.error("💥 Error WS en cliente:", err));
});

const PORT = 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});
