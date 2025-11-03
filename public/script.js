// ==================== Osprey GX Chat – script.js (robusto) ====================

// ---- Estado global ----
let ws;
let currentChannel = "general";
const messagesByChannel = { general: [], "off-topic": [], soporte: [] };

// ---- DOM ----
const app          = document.getElementById("app");
const joinScreen   = document.getElementById("join-screen");
const joinName     = document.getElementById("joinName");
const joinBtn      = document.getElementById("joinBtn");

const msgBox       = document.getElementById("messages");
const messageInput = document.getElementById("message");
const sendBtn      = document.getElementById("sendBtn");
const clearBtn     = document.getElementById("clearBtn");
const reconnectBtn = document.getElementById("reconnectBtn");
const channelList  = document.getElementById("channelList");
const membersList  = document.getElementById("members");
const roomTitle    = document.getElementById("roomTitle");

// Soportar 2 variantes de UI: input o div para el nombre
const usernameInput   = document.getElementById("username");         // puede NO existir
const usernameDisplay = document.getElementById("usernameDisplay");   // puede NO existir

function getUserName(){
  if (usernameInput)   return (usernameInput.value || "").trim();
  if (usernameDisplay) return (usernameDisplay.textContent || "").trim();
  return "";
}
function setUserName(name){
  const n = (name || "Invitado").trim() || "Invitado";
  if (usernameInput){ usernameInput.value = n; usernameInput.title = n; }
  if (usernameDisplay){ usernameDisplay.textContent = n; usernameDisplay.title = n; }
}

// ---- Presencia (punto verde del panel) ----
const meDot = document.getElementById("meDot");
const mePresence = document.getElementById("mePresence");
function setPresence(state){
  if (!meDot || !mePresence) return;
  meDot.classList.remove("status-online","status-reconnecting","status-offline");
  if(state === "online"){
    meDot.classList.add("status-online");
    mePresence.textContent = "En línea";
  }else if(state === "reconnecting"){
    meDot.classList.add("status-reconnecting");
    mePresence.textContent = "Reconectando…";
  }else{
    meDot.classList.add("status-offline");
    mePresence.textContent = "Desconectado";
  }
}

// ---- Persistencia y flujo de ingreso ----
const savedUser = localStorage.getItem("gx_user") || "";
if (savedUser) {
  setUserName(savedUser);
  showApp();
} else {
  showJoin();
}

joinBtn?.addEventListener("click", () => {
  const name = (joinName?.value || "").trim();
  if (!name) return;
  localStorage.setItem("gx_user", name);
  setUserName(name);
  showApp();
});
joinName?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn?.click();
});

function showJoin() {
  if (app) app.hidden = true;
  if (joinScreen) joinScreen.style.display = "grid";
}
function showApp() {
  if (joinScreen) joinScreen.style.display = "none";
  if (app) app.hidden = false;
  connectWS(); // inicia conexión
}

// ---- WebSocket ----
function connectWS() {
  const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    appendSystem("Conectado al servidor.");
    toggleButtons(true);
    setPresence("online");
    sendSetName(getUserName() || "Invitado");
    sendJoin(currentChannel);
  };

  ws.onerror = () => {
    appendSystem("No se pudo conectar al servidor WebSocket.");
    toggleButtons(false);
    setPresence("reconnecting");
  };

  ws.onclose = () => {
    appendSystem("Conexión cerrada.");
    toggleButtons(false);
    setPresence("offline");
  };

  ws.onmessage = (event) => {
    let msg;
    try { msg = JSON.parse(event.data); }
    catch { return; }

    // Actualización de lista de usuarios
    if (msg.type === "users") {
      if (msg.channel === currentChannel) renderUsers(msg.users);
      return;
    }

    // Mensajes de chat o sistema
    const ch = msg.channel || currentChannel;
    if (!messagesByChannel[ch]) messagesByChannel[ch] = [];
    messagesByChannel[ch].push(msg);
    if (ch === currentChannel) renderMessage(msg);
  };
}

function sendSetName(name) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "set_name", user: name }));
  }
}
function sendJoin(channel) {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "join", channel, user: getUserName() || "Invitado" }));
  }
}

// ---- Envío de mensajes ----
sendBtn?.addEventListener("click", sendCurrentMessage);
messageInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendCurrentMessage();
});

function sendCurrentMessage(){
  const txt = (messageInput?.value || "").trim();
  if (!txt) return;
  if (!ws || ws.readyState !== WebSocket.OPEN) return appendSystem("No conectado.");

  ws.send(JSON.stringify({
    type: "chat",
    user: getUserName() || "Invitado",
    text: txt,
    channel: currentChannel
  }));
  if (messageInput){ messageInput.value = ""; messageInput.focus(); }
}

// ---- Cerrar sesión ----
clearBtn?.addEventListener("click", () => {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "disconnect", user: getUserName(), channel: currentChannel }));
  }
  Object.keys(messagesByChannel).forEach(k => messagesByChannel[k] = []);
  if (membersList) membersList.innerHTML = "";
  if (msgBox) msgBox.innerHTML = "";
  localStorage.removeItem("gx_user");
  appendSystem("Cerraste sesión.");
  try { ws?.close(); } catch {}
  showJoin();
});

// ---- Reconectar ----
reconnectBtn?.addEventListener("click", () => {
  if (ws && ws.readyState === WebSocket.OPEN) return appendSystem("Ya estás conectado.");
  setPresence("reconnecting");
  appendSystem("Intentando reconectar...");
  connectWS();
});

// ---- Cambio de canal ----
channelList?.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-channel]");
  if (!li) return;
  const newChannel = li.getAttribute("data-channel");
  if (newChannel === currentChannel) return;

  [...channelList.querySelectorAll("li")].forEach(x => x.classList.remove("active"));
  li.classList.add("active");

  currentChannel = newChannel;
  if (roomTitle) roomTitle.textContent = `# ${currentChannel}`;
  if (msgBox) {
    msgBox.innerHTML = "";
    (messagesByChannel[currentChannel] || []).forEach(renderMessage);
  }
  sendJoin(currentChannel);
});

// ---- Render ----
function renderMessage(msg) {
  if (!msgBox) return;
  const div = document.createElement("div");
  const isSystem = (msg.user === "Sistema");
  const isSelf   = (!isSystem && (msg.user === (getUserName() || "Invitado")));

  div.className = "msg " + (isSystem ? "system" : (isSelf ? "self" : "other")) + " flash";

  const safeUser = escapeHtml(msg.user || "Invitado");
  const safeText = escapeHtml(msg.text || "");
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
  setTimeout(() => div.classList.remove("flash"), 600);
}

function renderUsers(users) {
  if (!membersList) return;
  membersList.innerHTML = "";
  (users || []).forEach(u => {
    const isMe = (u === (getUserName() || ""));
    const display = isMe ? `${u} (tú)` : u;

    const li  = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = "status status-online";

    const name = document.createElement("span");
    name.className = "user-name";  // 👈 le aplican los estilos de truncado
    name.textContent = display;
    name.title = display;          // 👈 tooltip con el nombre completo

    li.appendChild(dot);
    li.appendChild(name);
    membersList.appendChild(li);
  });
}


function appendSystem(text) {
  renderMessage({ user: "Sistema", text, time: new Date().toLocaleTimeString(), channel: currentChannel });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function toggleButtons(connected) {
  if (sendBtn) sendBtn.disabled = !connected;
  if (clearBtn) clearBtn.disabled = !connected;
  if (reconnectBtn) reconnectBtn.disabled = connected;
}
// ======================================================================
