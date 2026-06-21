/* ============================================
   SmartRoom / SATOM — pwa.js
   Registra el service worker y maneja el banner
   de "Instalar app" en navegadores que lo soportan
   (Android/Chrome). En iOS no existe ese evento,
   así que se muestra una instrucción manual.
   ============================================ */

let deferredPrompt = null;

// 1. Registrar el service worker (servido desde la raíz para que
//    su scope cubra todo el sitio, no solo /static/)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(() => console.log("Service worker registrado"))
      .catch((err) => console.error("Error registrando service worker:", err));
  });
}

// 2. Capturar el evento de instalación (Android/Chrome/Edge)
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPrompt = event;
  mostrarBannerInstalacion();
});

function mostrarBannerInstalacion() {
  const banner = document.getElementById("installBanner");
  if (!banner) return;

  // No mostrar de nuevo si el usuario ya lo cerró antes
  if (localStorage.getItem("smartroom_install_dismissed") === "true") return;

  banner.classList.add("show");
}

function ocultarBannerInstalacion() {
  const banner = document.getElementById("installBanner");
  if (banner) banner.classList.remove("show");
}

document.addEventListener("DOMContentLoaded", () => {
  const installBtn = document.getElementById("installBtn");
  const dismissBtn = document.getElementById("dismissInstallBtn");

  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      ocultarBannerInstalacion();
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      localStorage.setItem("smartroom_install_dismissed", "true");
      ocultarBannerInstalacion();
    });
  }

  // Detectar iOS para mostrar instrucción manual (Safari no soporta
  // beforeinstallprompt)
  const esIOS = /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
  const yaInstalada = window.matchMedia("(display-mode: standalone)").matches;
  if (esIOS && !yaInstalada && localStorage.getItem("smartroom_install_dismissed") !== "true") {
    const banner = document.getElementById("installBanner");
    if (banner) {
      banner.innerHTML = `
        <span>Para instalar SmartRoom: toca <strong>Compartir</strong> → <strong>"Agregar a pantalla de inicio"</strong>.</span>
        <button class="install-banner-btn" id="dismissInstallBtn">Entendido</button>
      `;
      banner.classList.add("show");
      document.getElementById("dismissInstallBtn").addEventListener("click", () => {
        localStorage.setItem("smartroom_install_dismissed", "true");
        ocultarBannerInstalacion();
      });
    }
  }
});
