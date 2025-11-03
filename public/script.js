// ===== Estado de cliente =====
let ws;
let currentChannel = "general";
const messagesByChannel = { general: [], "off-topic": [], soporte: [] };

// ===== Conexión =====
function connectWS() {
  const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
  console.log("Conectando a:", WS_URL);
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    console.log("✅ Conectado al servidor WebSocket");
    appendSystem("Conectado al servidor.");
    toggleButtons(true);
    // Unirse (o re-unirse) al canal actual
    sendJoin(currentChannel);
  };

  ws.onerror = (err) => {
    console.error("❌ Error de WebSocket:", err);
    appendSystem("No se pudo conectar al servidor WebSocket.");
    toggleButtons(false);
  };

  ws.onclose = () => {
    console.warn("🔌 Conexión cerrada");
    appendSystem("Conexión cerrada.");
    toggleButtons(false);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      const ch = msg.channel || currentChannel;
      if (!messagesByChannel[ch]) messagesByChannel[ch] = [];
      messagesByChannel[ch].push(msg);

      if (ch === currentChannel) {
        renderMessage(msg);
      }
    } catch (e) {
      console.error("❌ No se pudo parsear el mensaje:", e, event.data);
    }
  };
}

function sendJoin(channel) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "join", channel, user: username.value.trim() || "Invitado" }));
  }
}

// ===== DOM =====
const msgBox    = document.getElementById("messages");
const username  = document.getElementById("username");
const message   = document.getElementById("message");
const sendBtn   = document.getElementById("sendBtn");
const clearBtn  = document.getElementById("clearBtn");
const reconnectBtn = document.getElementById("reconnectBtn");
const channelList  = document.getElementById("channelList");

// Iniciar conexión
connectWS();

// ===== Enviar mensaje =====
sendBtn.onclick = () => {
  if (!username.value.trim() || !message.value.trim()) return;
  if (ws.readyState !== WebSocket.OPEN) return appendSystem("No conectado. Revisa el servidor.");

  const msg = {
    type: "chat",
    user: username.value.trim(),
    text: message.value.trim(),
    channel: currentChannel
  };
  ws.send(JSON.stringify(msg));
  message.value = "";
  message.focus();
};

// ===== Cerrar sesión =====
clearBtn.onclick = () => {
  if (ws.readyState === WebSocket.OPEN && username.value.trim()) {
    ws.send(JSON.stringify({ type: "disconnect", user: username.value.trim(), channel: currentChannel }));
  }
  username.value = "";
  msgBox.innerHTML = "";
  Object.keys(messagesByChannel).forEach(k => messagesByChannel[k] = []); // limpiar buffers locales
  appendSystem("Cerraste sesión.");
  ws.close();
};

// ===== Reconectar =====
reconnectBtn.onclick = () => {
  if (ws && ws.readyState === WebSocket.OPEN) return appendSystem("Ya estás conectado.");
  appendSystem("Intentando reconectar...");
  connectWS();
};

// ===== Cambio de canal (click en sidebar) =====
if (channelList) {
  channelList.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-channel]");
    if (!li) return;
    const newChannel = li.getAttribute("data-channel");
    if (newChannel === currentChannel) return;

    // UI: activar item
    [...channelList.querySelectorAll("li")].forEach(x => x.classList.remove("active"));
    li.classList.add("active");

    // Cambiar de canal
    currentChannel = newChannel;
    appendSystem(`Cambiado a #${currentChannel}`);
    msgBox.innerHTML = "";
    // Render historial del canal elegido (si lo hubiera)
    (messagesByChannel[currentChannel] || []).forEach(renderMessage);

    // Avisar al servidor
    sendJoin(currentChannel);
  });
}

// ===== Render helpers =====
function renderMessage(msg) {
  const div = document.createElement("div");
  div.classList.add("msg");
  div.innerHTML = `<strong>${escapeHtml(msg.user)}</strong> [${msg.time}]: ${escapeHtml(msg.text)}`;
  msgBox.appendChild(div);
  msgBox.scrollTop = msgBox.scrollHeight;
}

function appendSystem(text) {
  const div = document.createElement("div");
  div.classList.add("msg");
  div.innerHTML = `<em>【${new Date().toLocaleTimeString()}】 ${escapeHtml(text)}</em>`;
  msgBox.appendChild(div);
  msgBox.scrollTop = msgBox.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;' }[c]));
}

function toggleButtons(connected) {
  sendBtn.disabled = !connected;
  clearBtn.disabled = !connected;
  reconnectBtn.disabled = connected;
}
