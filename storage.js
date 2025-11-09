// storage.js
import { qs } from "./utils.js";

const usernameDisplay = qs("usernameDisplay");
const meAvatarBox = qs("meAvatar");

export function getUserName() {
  return (usernameDisplay?.textContent || "").trim();
}
export function setUserName(n) {
  const name = (n || "Invitado").trim() || "Invitado";
  if (usernameDisplay) {
    usernameDisplay.textContent = name;
    usernameDisplay.title = name;
  }
}
export function getAvatar() {
  return localStorage.getItem("gx_avatar") || "";
}
export function setAvatar(dataUrl) {
  if (dataUrl) localStorage.setItem("gx_avatar", dataUrl);
  else localStorage.removeItem("gx_avatar");
  if (meAvatarBox) {
    meAvatarBox.innerHTML = "";
    if (dataUrl) {
      const img = document.createElement("img");
      img.src = dataUrl;
      meAvatarBox.appendChild(img);
    } else meAvatarBox.textContent = "🟠";
  }
}
