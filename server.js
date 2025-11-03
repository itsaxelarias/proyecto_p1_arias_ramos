const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

function broadcast(obj) {
  const payload = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
}

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`✅ Nueva conexión WS desde ${ip}`);

  // Mensaje de sistema: usuario se conectó (anónimo hasta que envíe su nombre)
  broadcast({ user: "Sistema", time: new Date().toLocaleTimeString(), text: "Un usuario se conectó." });

  ws.on("message", (data) => {
    try {
      console.log("📩 Mensaje crudo del cliente:", data.toString());
      const msg = JSON.parse(data);
      const full = { user: msg.user || "Anónimo", time: new Date().toLocaleTimeString(), text: msg.text || "" };
      broadcast(full); // reenviar a todos
    } catch (e) {
      console.error("❌ Error parseando mensaje:", e);
      ws.send(JSON.stringify({ user: "Sistema", time: new Date().toLocaleTimeString(), text: "Mensaje inválido." }));
    }
  });

  ws.on("close", () => {
    console.log("🔌 Cliente desconectado");
    broadcast({ user: "Sistema", time: new Date().toLocaleTimeString(), text: "Un usuario se desconectó." });
  });

  ws.on("error", (err) => {
    console.error("💥 Error WS en cliente:", err);
  });
});

// Keep-alive para evitar caídas en algunas redes
const interval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  }
}, 30000);

server.on("close", () => clearInterval(interval));

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servidor en http://localhost:${PORT}`);
});
