/* =========================================================
   Osprey GX Chat – Client (FULL)
   ========================================================= */

/* --------------------- Estado global --------------------- */
let ws;
let currentChannel = "general";
const messagesByChannel = { general: [], "off-topic": [], soporte: [] };

/* ------------------------ DOM base ----------------------- */
const app            = document.getElementById("app");
const joinScreen     = document.getElementById("join-screen");
const joinName       = document.getElementById("joinName");
const joinBtn        = document.getElementById("joinBtn");

const msgBox         = document.getElementById("messages");
const messageInput   = document.getElementById("message");
const sendBtn        = document.getElementById("sendBtn");
const clearBtn       = document.getElementById("clearBtn");
const reconnectBtn   = document.getElementById("reconnectBtn");
const channelList    = document.getElementById("channelList");

const roomTitle      = document.getElementById("roomTitle");

// Nombre mostrado en el panel inferior
const usernameDisplay = document.getElementById("usernameDisplay");
function getUserName(){ return (usernameDisplay?.textContent || "").trim(); }
function setUserName(n){
  const name = (n || "Invitado").trim() || "Invitado";
  if (usernameDisplay){ usernameDisplay.textContent = name; usernameDisplay.title = name; }
}

/* ----------------- Avatar (panel inferior) ---------------- */
const meAvatarBox = document.getElementById("meAvatar");
function getAvatar(){ return localStorage.getItem("gx_avatar") || ""; }
function setAvatar(dataUrl){
  if (dataUrl) localStorage.setItem("gx_avatar", dataUrl);
  else localStorage.removeItem("gx_avatar");
  if (meAvatarBox){
    meAvatarBox.innerHTML = "";
    if (dataUrl){
      const img = document.createElement("img");
      img.src = dataUrl;
      meAvatarBox.appendChild(img);
    } else meAvatarBox.textContent = "🟠";
  }
}

/* ------------------ Presencia (me panel) ------------------ */
const meDot = document.getElementById("meDot");
const mePresence = document.getElementById("mePresence");
function setPresence(state){
  meDot.classList.remove("status-online","status-reconnecting","status-offline");
  if(state==="online"){ meDot.classList.add("status-online"); mePresence.textContent="En línea"; }
  else if(state==="reconnecting"){ meDot.classList.add("status-reconnecting"); mePresence.textContent="Reconectando…"; }
  else { meDot.classList.add("status-offline"); mePresence.textContent="Desconectado"; }
}

/* =========================================================
   JOIN: selección + recorte + redimensionado del avatar
   ========================================================= */
const joinAvatar     = document.getElementById("joinAvatar");
const joinAvatarPrev = document.getElementById("joinAvatarPreview");

// Modal cropper
const cropper    = document.getElementById("cropper");
const cropStage  = document.getElementById("cropStage");
const cropImg    = document.getElementById("cropImg");
const cropZoom   = document.getElementById("cropZoom");
const cropCancel = document.getElementById("cropCancel");
const cropUse    = document.getElementById("cropUse");

// Estado cropper
const STAGE = 320;  // tamaño de recorte visible
const OUT   = 256;  // tamaño final exportado
let imgNatW = 0, imgNatH = 0;
let baseScale = 1, userScale = 1;
let offX = 0, offY = 0;
let isDragging = false, lastX = 0, lastY = 0;
let pickedAvatarDataUrl = "";


// Tras elegir archivo -> cropper
joinAvatar?.addEventListener("change", () => {
  const f = joinAvatar.files?.[0];
  if (!f) return;
  if (!f.type.startsWith("image/")) return alert("El archivo debe ser una imagen.");
  if (f.size > 5 * 1024 * 1024) return alert("Imagen muy grande (máx 5 MB).");
  const reader = new FileReader();
  reader.onload = () => openCropper(reader.result.toString());
  reader.readAsDataURL(f);
});

function openCropper(dataUrl){
  cropImg.onload = () => {
    imgNatW = cropImg.naturalWidth; imgNatH = cropImg.naturalHeight;
    baseScale = Math.max(STAGE/imgNatW, STAGE/imgNatH);
    userScale = 1; cropZoom.value = "1";
    const dispW = imgNatW * baseScale, dispH = imgNatH * baseScale;
    offX = (STAGE - dispW)/2; offY = (STAGE - dispH)/2;
    applyTransform(); showCropper(true);
  };
  cropImg.src = dataUrl;
}
function showCropper(flag){ cropper.classList.toggle("hidden", !flag); cropper.setAttribute("aria-hidden", String(!flag)); }

cropZoom?.addEventListener("input", () => {
  const prevW = imgNatW * baseScale * userScale;
  const prevH = imgNatH * baseScale * userScale;
  userScale = parseFloat(cropZoom.value);
  const newW = imgNatW * baseScale * userScale;
  const newH = imgNatH * baseScale * userScale;
  const cx = STAGE/2, cy = STAGE/2;
  offX = cx - (cx - offX) * (newW/prevW);
  offY = cy - (cy - offY) * (newH/prevH);
  clampOffsets(); applyTransform();
});

cropStage?.addEventListener("pointerdown", e => { isDragging=true; cropStage.setPointerCapture(e.pointerId); lastX=e.clientX; lastY=e.clientY; });
cropStage?.addEventListener("pointermove", e => {
  if(!isDragging) return; const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY;
  offX+=dx; offY+=dy; clampOffsets(); applyTransform();
});
cropStage?.addEventListener("pointerup", ()=> isDragging=false);
cropStage?.addEventListener("pointercancel", ()=> isDragging=false);

function clampOffsets(){
  const dispW=imgNatW*baseScale*userScale, dispH=imgNatH*baseScale*userScale;
  if(dispW>STAGE){ const minX=STAGE-dispW; const maxX=0; offX=Math.min(maxX,Math.max(minX,offX)); } else offX=(STAGE-dispW)/2;
  if(dispH>STAGE){ const minY=STAGE-dispH; const maxY=0; offY=Math.min(maxY,Math.max(minY,offY)); } else offY=(STAGE-dispH)/2;
}
function applyTransform(){ const s=baseScale*userScale; cropImg.style.width=`${imgNatW*s}px`; cropImg.style.height=`${imgNatH*s}px`; cropImg.style.transform=`translate(${offX}px, ${offY}px)`; }

cropCancel?.addEventListener("click", ()=> showCropper(false));
cropUse?.addEventListener("click", () => {
  const dataUrl = renderCropped(); pickedAvatarDataUrl = dataUrl;
  joinAvatarPrev.innerHTML=""; const img=document.createElement("img"); img.src=dataUrl; joinAvatarPrev.appendChild(img);
  showCropper(false);
});

function renderCropped(){
  const canvas=document.createElement("canvas"); canvas.width=OUT; canvas.height=OUT;
  const ctx=canvas.getContext("2d"); const s=baseScale*userScale;
  const sx=Math.max(0,(0-offX)/s), sy=Math.max(0,(0-offY)/s);
  const sw=Math.min(imgNatW-sx, STAGE/s), sh=Math.min(imgNatH-sy, STAGE/s);
  ctx.imageSmoothingQuality="high";
  ctx.drawImage(cropImg, sx,sy,sw,sh, 0,0, OUT,OUT);
  return canvas.toDataURL("image/png");
}

/* ---------------- Pantalla Join / Persistencia ------------- */
joinBtn?.addEventListener("click", () => {
  const name = (joinName?.value || "").trim(); if(!name) return;
  localStorage.setItem("gx_user", name);
  setUserName(name); setAvatar(pickedAvatarDataUrl || "");
  showApp();
});
joinName?.addEventListener("keydown", e => { if(e.key==="Enter") joinBtn?.click(); });

const savedUser = localStorage.getItem("gx_user") || "";
if (savedUser){ setUserName(savedUser); showApp(); } else showJoin();

function showJoin(){ app.hidden = true; joinScreen.classList.remove("hidden"); joinScreen.style.display = "grid"; }
function showApp(){ joinScreen.classList.add("hidden"); joinScreen.style.display = "none"; app.hidden = false; setAvatar(getAvatar()); connectWS(); }

/* ======================= WebSocket ======================== */
function connectWS(){
  const WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    appendSystem("Conectado al servidor."); toggleButtons(true); setPresence("online");
    sendSetName(getUserName() || "Invitado");
    const av=getAvatar(); if(av) ws.send(JSON.stringify({type:"set_avatar", dataUrl: av}));
    sendJoin(currentChannel);
  };
  ws.onerror = () => { appendSystem("No se pudo conectar al servidor WebSocket."); toggleButtons(false); setPresence("reconnecting"); };
  ws.onclose  = () => { appendSystem("Conexión cerrada."); toggleButtons(false); setPresence("offline"); };

  ws.onmessage = (event) => {
    let msg; try{ msg = JSON.parse(event.data); } catch{ return; }
    if(msg.type==="users"){ if(msg.channel===currentChannel) renderUsers(msg.users); return; }
    const ch = msg.channel || currentChannel;
    (messagesByChannel[ch] ||= []).push(msg);
    if (ch===currentChannel) renderMessage(msg);
  };
}
function sendSetName(name){ if(ws?.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:"set_name", user:name})); }
function sendJoin(channel){ if(ws?.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:"join", channel, user:getUserName()||"Invitado"})); }

/* =================== Envío de mensajes ==================== */
sendBtn?.addEventListener("click", sendCurrentMessage);
messageInput?.addEventListener("keydown", e => { if(e.key==="Enter") sendCurrentMessage(); });
function sendCurrentMessage(){
  const txt=(messageInput?.value||"").trim(); if(!txt) return;
  if(!ws || ws.readyState!==WebSocket.OPEN) return appendSystem("No conectado.");
  ws.send(JSON.stringify({type:"chat", user:getUserName()||"Invitado", text:txt, channel:currentChannel}));
  messageInput.value=""; messageInput.focus();
}

/* ================= Cerrar sesión / Reconectar ============= */
clearBtn?.addEventListener("click", () => {
  if(ws?.readyState===WebSocket.OPEN) ws.send(JSON.stringify({type:"disconnect", user:getUserName(), channel:currentChannel}));
  Object.keys(messagesByChannel).forEach(k => messagesByChannel[k]=[]);
  membersList.innerHTML=""; msgBox.innerHTML="";
  localStorage.removeItem("gx_user"); setAvatar(""); setUserName("Invitado");
  appendSystem("Cerraste sesión."); try{ ws?.close(); }catch{}
  showJoin();
});
reconnectBtn?.addEventListener("click", () => {
  if(ws && ws.readyState===WebSocket.OPEN) return appendSystem("Ya estás conectado.");
  setPresence("reconnecting"); appendSystem("Intentando reconectar..."); connectWS();
});

/* ===================== Cambio de canal ==================== */
channelList?.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-channel]"); if(!li) return;
  const newCh = li.getAttribute("data-channel"); if(newCh===currentChannel) return;
  [...channelList.querySelectorAll("li")].forEach(x=>x.classList.remove("active"));
  li.classList.add("active"); currentChannel=newCh; roomTitle.textContent=`# ${currentChannel}`;
  msgBox.innerHTML=""; (messagesByChannel[currentChannel]||[]).forEach(renderMessage);
  sendJoin(currentChannel);
});

/* ======================== Render UI ======================= */
function renderMessage(msg){
  const div=document.createElement("div");
  const isSystem=(msg.user==="Sistema");
  const isSelf=!isSystem && (msg.user===(getUserName()||"Invitado"));
  div.className="msg "+(isSystem?"system":(isSelf?"self":"other"));
  const user = escapeHtml(msg.user||"Invitado");
  const text = escapeHtml(msg.text||"");
  const time = msg.time ? escapeHtml(msg.time) : new Date().toLocaleTimeString();
  div.innerHTML = `<div><strong>${user}</strong><span class="meta">[${time}]</span></div><div>${text}</div>`;
  msgBox.appendChild(div); msgBox.scrollTop=msgBox.scrollHeight;
}
function renderUsers(users) {
  membersList.innerHTML = "";
  (users || []).forEach(u => {
    const nameStr = typeof u === "string" ? u : (u.name || "Invitado");
    const avatar  = typeof u === "string" ? "" : (u.avatar || "");
    const isMe    = (nameStr === (getUserName() || ""));
    const display = isMe ? `${nameStr} (tú)` : nameStr;

    const li = document.createElement("li");

    // --- avatar + dot online
    const aw = document.createElement("div");
    aw.className = "avatar-wrap";
    if (avatar) {
      const img = document.createElement("img");
      img.src = avatar;
      aw.appendChild(img);
    } else {
      // fallback emoji
      aw.textContent = "🟠";
    }
    const dot = document.createElement("span");
    dot.className = "m-dot";          // puntito verde titilante
    aw.appendChild(dot);

    // --- nombre truncable
    const name = document.createElement("span");
    name.className = "user-name";
    name.textContent = display;
    name.title = display;

    li.appendChild(aw);
    li.appendChild(name);
    membersList.appendChild(li);
  });
}

/* ====================== Utilidades varias ================= */
function appendSystem(text){ renderMessage({user:"Sistema", text, time:new Date().toLocaleTimeString(), channel:currentChannel}); }
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function toggleButtons(connected){ sendBtn.disabled=!connected; clearBtn.disabled=!connected; reconnectBtn.disabled=connected; }


/* ====== Drawers (móvil) y colapso (desktop) – BLOQUE ÚNICO ====== */

// elementos base
const chatLayout     = document.querySelector(".chat");
const membersPanel   = document.querySelector(".members");
const membersList    = document.getElementById("members");           // ya lo usas en renderUsers
const membersToggle  = document.getElementById("membersToggle");     // botón 👥
const membersBackdrop= document.getElementById("membersBackdrop");   // <div id="membersBackdrop">

const sidebar        = document.querySelector(".sidebar");           // drawer de canales en móvil
const channelsToggle = document.getElementById("channelsToggle");    // botón ☰ en el header
const sidebarBackdrop= document.getElementById("sidebarBackdrop");   // <div id="sidebarBackdrop">

// breakpoint de móvil
const mqMobile = window.matchMedia("(max-width: 720px)");

/* ---- acciones ---- */

// alterna Miembros
function toggleMembers(){
  if (mqMobile.matches) {
    membersPanel?.classList.toggle("open");
    membersBackdrop?.classList.toggle("show", membersPanel.classList.contains("open"));
  } else {
    chatLayout?.classList.toggle("collapsed"); // colapsa/expande columna en desktop
  }
}

// alterna Sidebar (canales) en móvil
function toggleSidebar(){
  if (!mqMobile.matches) return; // solo móvil
  // mostramos la sidebar como drawer
  sidebar?.classList.toggle("open");
  sidebarBackdrop?.classList.toggle("show", sidebar.classList.contains("open"));
}

/* ---- listeners ---- */
membersToggle?.addEventListener("click", toggleMembers);
channelsToggle?.addEventListener("click", toggleSidebar);

membersBackdrop?.addEventListener("click", () => {
  membersPanel?.classList.remove("open");
  membersBackdrop?.classList.remove("show");
});
sidebarBackdrop?.addEventListener("click", () => {
  sidebar?.classList.remove("open");
  sidebarBackdrop?.classList.remove("show");
});

/* ---- coherencia al cambiar tamaño/orientación ---- */
mqMobile.addEventListener?.("change", (e) => {
  if (e.matches) {
    // entró a móvil: asegura que NO quede colapsado el layout de escritorio
    chatLayout?.classList.remove("collapsed");
  } else {
    // entró a desktop: cierra drawers móviles
    membersPanel?.classList.remove("open");
    membersBackdrop?.classList.remove("show");
    sidebar?.classList.remove("open");
    sidebarBackdrop?.classList.remove("show");
  }
});

// helper para cerrar drawers móviles cuando cambias de canal o envías mensaje
function closeMobileDrawers(){
  if (!mqMobile.matches) return;
  membersPanel?.classList.remove("open");
  membersBackdrop?.classList.remove("show");
  sidebar?.classList.remove("open");
  sidebarBackdrop?.classList.remove("show");
}

// si usas estos elementos en tu código, enlázalos así:
document.getElementById("sendBtn")?.addEventListener("click", closeMobileDrawers);
document.getElementById("channelList")?.addEventListener("click", (ev) => {
  const li = ev.target.closest("li[data-channel]");
  if (!li) return;
  closeMobileDrawers();
});
