// ===== Estado =====
let ws;
let currentChannel = "general";
const messagesByChannel = { general: [], "off-topic": [], soporte: [] };

// ===== Helpers DOM =====
const app          = document.getElementById("app");
const joinScreen   = document.getElementById("join-screen");
const joinName     = document.getElementById("joinName");
const joinBtn      = document.getElementById("joinBtn");

const msgBox       = document.getElementById("messages");
const username     = document.getElementById("username");
const messageInput = document.getElementById("message");
const sendBtn      = document.getElementById("sendBtn");
const clearBtn     = document.getElementById("clearBtn");
const reconnectBtn = document.getElementById("reconnectBtn");
const channelList  = document.getElementById("channelList");
const membersList  = document.getElementById("members");
const roomTitle    = document.getElementById("roomTitle");

// ===== Persistencia de usuario =====
const savedUser = localStorage.getItem("gx_user") || "";
if (savedUser) {
  username.value = savedUser;
  showApp();
} else {
  showJoin();
}

// ===== Pantalla Join =====
joinBtn.addEventListener("click", () => {
  const name = joinName.value.trim();
  if (!name) return;
  localStorage.setItem("gx_user", name);
  username.value = name;
  showApp();
});

joinName.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});

function showJoin() {
  app.hidden = true;
  joinScreen.style.display = "grid";
}
function showApp() {
  joinScreen.style.display = "none";
  app.hidden = false;
  connectWS();        // Inicia conexión cuando entra a la app
}

// ===== WebSocket =====
function connectWS() {
  const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    appendSystem("Conectado al servidor.");
    toggleButtons(true);
    // Enviar nombre y unirse al canal actual
    sendSetName(username.value || "Invitado");
    sendJoin(currentChannel);
  };

  ws.onerror = (err) => {
    console.error("WS error:", err);
    appendSystem("No se pudo conectar al servidor WebSocket.");
    toggleButtons(false);
  };

  ws.onclose = () => {
    appendSystem("Conexión cerrada.");
    toggleButtons(false);
  };

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);

      // Lista de usuarios por canal
      if (msg.type === "users") {
        if (msg.channel === currentChannel) renderUsers(msg.users);
        return;
      }

      // Mensaje de chat / sistema
      const ch = msg.channel || currentChannel;
      if (!messagesByChannel[ch]) messagesByChannel[ch] = [];
      messagesByChannel[ch].push(msg);
      if (ch === currentChannel) renderMessage(msg);
    } catch (e) {
      console.error("Parse fail:", e, event.data);
    }
  };
}

function sendSetName(name) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "set_name", user: name }));
  }
}
function sendJoin(channel) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "join", channel, user: username.value || "Invitado" }));
  }
}

// ===== Envío de mensajes =====
sendBtn.onclick = () => {
  const txt = messageInput.value.trim();
  if (!txt) return;
  if (ws.readyState !== WebSocket.OPEN) return appendSystem("No conectado.");

  ws.send(JSON.stringify({
    type: "chat",
    user: username.value.trim() || "Invitado",
    text: txt,
    channel: currentChannel
  }));
  messageInput.value = "";
  messageInput.focus();
};

// ===== Cerrar sesión =====
clearBtn.onclick = () => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "disconnect", user: username.value, channel: currentChannel }));
  }
  // limpiar app y volver al join
  Object.keys(messagesByChannel).forEach(k => messagesByChannel[k] = []);
  membersList.innerHTML = "";
  msgBox.innerHTML = "";
  localStorage.removeItem("gx_user");
  appendSystem("Cerraste sesión.");
  ws?.close();
  showJoin();
};

// ===== Reconectar =====
reconnectBtn.onclick = () => {
  if (ws && ws.readyState === WebSocket.OPEN) return appendSystem("Ya estás conectado.");
  appendSystem("Intentando reconectar...");
  connectWS();
};

// ===== Cambio de canal =====
channelList.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-channel]");
  if (!li) return;
  const newChannel = li.getAttribute("data-channel");
  if (newChannel === currentChannel) return;

  [...channelList.querySelectorAll("li")].forEach(x => x.classList.remove("active"));
  li.classList.add("active");

  currentChannel = newChannel;
  roomTitle.textContent = `# ${currentChannel}`;
  msgBox.innerHTML = "";
  (messagesByChannel[currentChannel] || []).forEach(renderMessage);
  sendJoin(currentChannel);
});

// ===== Render =====
function renderMessage(msg) {
  const div = document.createElement("div");
  const isSystem = (msg.user === "Sistema");
  const isSelf   = (!isSystem && (msg.user === (username.value || "Invitado")));

  div.className = "msg " + (isSystem ? "system" : (isSelf ? "self" : "other")) + " flash";

  // Encabezado: autor + hora mínima estilizada
  const safeUser = escapeHtml(msg.user);
  const safeText = escapeHtml(msg.text);
  const safeTime = msg.time ? escapeHtml(msg.time) : new Date().toLocaleTimeString();

  div.innerHTML = `
    <div>
      <strong>${safeUser}</strong>
      <span class="meta">[${safeTime}]</span>
    </div>
    <div>${safeText}</div>
  `;

  msgBox.appendChild(div);
  msgBox.scrollTop = msgBox.scrollHeight;

  // quitar clase flash luego del primer repintado para permitir futuros flashes
  setTimeout(() => div.classList.remove("flash"), 600);
}
function renderUsers(users) {
  membersList.innerHTML = "";
  users.forEach(u => {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "status";            // 🔥 punto verde titilante
    const name = document.createElement("span");
    name.textContent = (u === (username.value || "")) ? `${u} (tú)` : u;
    li.appendChild(dot);
    li.appendChild(name);
    membersList.appendChild(li);
  });
}

function appendSystem(text) {
  renderMessage({ user: "Sistema", text, time: new Date().toLocaleTimeString(), channel: currentChannel });
}
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function toggleButtons(connected) {
  sendBtn.disabled = !connected;
  clearBtn.disabled = !connected;
  reconnectBtn.disabled = connected;
}
