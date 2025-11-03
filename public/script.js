// Detecta automáticamente el host e inicia la conexión WebSocket
const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
console.log("Conectando a:", WS_URL);
const ws = new WebSocket(WS_URL);

const msgBox = document.getElementById("messages");
const username = document.getElementById("username");
const message  = document.getElementById("message");
const sendBtn  = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");

// ---- DEPURACIÓN DE CONEXIÓN ----
ws.onopen = () => {
  console.log("✅ Conectado al servidor WebSocket");
  appendSystem("Conectado al servidor.");
};

ws.onerror = (err) => {
  console.error("❌ Error de WebSocket:", err);
  appendSystem("No se pudo conectar al servidor WebSocket.");
};

ws.onclose = () => {
  console.warn("🔌 Conexión cerrada");
  appendSystem("Conexión cerrada.");
};

// ---- RECEPCIÓN DE MENSAJES ----
ws.onmessage = (event) => {
  try {
    const msg = JSON.parse(event.data);
    const div = document.createElement("div");
    div.classList.add("msg");
    div.innerHTML = `<strong>${escapeHtml(msg.user)}</strong> [${msg.time}]: ${escapeHtml(msg.text)}`;
    msgBox.appendChild(div);
    msgBox.scrollTop = msgBox.scrollHeight;
  } catch (e) {
    console.error("❌ No se pudo parsear el mensaje:", e, event.data);
  }
};

// ---- ENVÍO ----
sendBtn.onclick = () => {
  if (!username.value.trim() || !message.value.trim()) return;

  if (ws.readyState !== WebSocket.OPEN) {
    appendSystem("No conectado. Revisa el servidor.");
    return;
  }

  const msg = { user: username.value.trim(), text: message.value.trim() };
  ws.send(JSON.stringify(msg));
  message.value = "";
  message.focus();
};

// ---- LIMPIAR/CERRAR SESIÓN ----
clearBtn.onclick = () => {
  username.value = "";
  msgBox.innerHTML = "";
};

// ---- FUNCIONES AUXILIARES ----
function appendSystem(text) {
  const div = document.createElement("div");
  div.classList.add("msg");
  div.innerHTML = `<em>【${new Date().toLocaleTimeString()}】 ${escapeHtml(text)}</em>`;
  msgBox.appendChild(div);
  msgBox.scrollTop = msgBox.scrollHeight;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}
