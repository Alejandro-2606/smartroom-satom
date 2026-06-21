/* ============================================
   SmartRoom / SATOM — app.js
   Lógica compartida: fetch a la API Flask,
   render de tarjetas/lista, y utilidades.
   ============================================ */

const API_BASE = "/api";

// ---------- Utilidades de estado visual ----------
function getStatusInfo(ocupacion, aforoMax) {
  const pct = aforoMax > 0 ? Math.round((ocupacion / aforoMax) * 100) : 0;
  if (pct >= 100) {
    return { key: "llena", label: "Aforo máx.", fill: "fill-red", pct };
  } else if (pct >= 60) {
    return { key: "ocupada", label: "Ocupada", fill: "fill-amber", pct };
  } else {
    return { key: "disponible", label: "Disponible", fill: "fill-green", pct };
  }
}

function timeAgo(timestamp) {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 60) return `hace ${diff} seg`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} d`;
}

// ---------- Llamadas a la API ----------
async function fetchSalas() {
  const res = await fetch(`${API_BASE}/salas`, { credentials: "include" });
  if (res.status === 401) {
    window.location.href = "/login";
    return [];
  }
  if (!res.ok) throw new Error("Error al obtener salas");
  return res.json();
}

async function fetchSala(salaId) {
  const res = await fetch(`${API_BASE}/salas/${salaId}`, { credentials: "include" });
  if (res.status === 401) {
    window.location.href = "/login";
    return null;
  }
  if (!res.ok) throw new Error("Error al obtener la sala");
  return res.json();
}

async function fetchEventos(salaId, limit = 10) {
  const res = await fetch(`${API_BASE}/salas/${salaId}/eventos?limit=${limit}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Error al obtener eventos");
  return res.json();
}

async function fetchSensores(salaId) {
  const res = await fetch(`${API_BASE}/salas/${salaId}/sensores`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Error al obtener sensores");
  return res.json();
}

async function fetchHistorialHoy(salaId) {
  const res = await fetch(`${API_BASE}/salas/${salaId}/historial?periodo=hoy`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Error al obtener historial");
  return res.json();
}

// ---------- Render: tarjetas de sala ----------
function renderRoomCard(sala) {
  const status = getStatusInfo(sala.ocupacion_actual, sala.aforo_max);
  const card = document.createElement("div");
  card.className = `room-card status-${status.key}`;
  card.onclick = () => (window.location.href = `/sala/${sala.id}`);

  card.innerHTML = `
    <div class="room-card-header">
      <div>
        <div class="room-card-name">${sala.nombre}</div>
        <div class="room-card-floor">Piso ${sala.piso} — Edificio ${sala.edificio}</div>
      </div>
      <span class="status-pill status-${status.key}">${status.label}</span>
    </div>
    <div class="progress-bg">
      <div class="progress-fill ${status.fill}" style="width:${status.pct}%"></div>
    </div>
    <div class="room-card-stats">
      <span>${sala.ocupacion_actual} / ${sala.aforo_max} personas</span>
      <span>${status.pct}%</span>
    </div>
    <div class="room-card-footer">
      <button class="btn-primary btn">Ver detalle</button>
    </div>
  `;
  return card;
}

// ---------- Render: fila de la lista/tabla ----------
function renderListRow(sala) {
  const status = getStatusInfo(sala.ocupacion_actual, sala.aforo_max);
  const row = document.createElement("div");
  row.className = "list-row";
  row.onclick = () => (window.location.href = `/sala/${sala.id}`);

  row.innerHTML = `
    <span style="font-weight:500;">${sala.nombre}</span>
    <span class="status-pill status-${status.key}">${status.label}</span>
    <div class="mini-bar-bg"><div class="mini-bar ${status.fill}" style="width:${status.pct}%"></div></div>
    <span style="color:var(--text-secondary);">${sala.ocupacion_actual}</span>
    <span style="color:var(--text-secondary);">${sala.aforo_max}</span>
  `;
  return row;
}

// ---------- Carga del Dashboard ----------
async function loadDashboard() {
  const cardsContainer = document.getElementById("roomCards");
  const listContainer = document.getElementById("roomList");
  if (!cardsContainer) return;

  try {
    const salas = await fetchSalas();

    // Métricas resumen
    const total = salas.length;
    const disponibles = salas.filter(
      (s) => getStatusInfo(s.ocupacion_actual, s.aforo_max).key === "disponible"
    ).length;
    const ocupadas = salas.filter(
      (s) => getStatusInfo(s.ocupacion_actual, s.aforo_max).key === "ocupada"
    ).length;
    const llenas = salas.filter(
      (s) => getStatusInfo(s.ocupacion_actual, s.aforo_max).key === "llena"
    ).length;

    document.getElementById("metricTotal").textContent = total;
    document.getElementById("metricDisponibles").textContent = disponibles;
    document.getElementById("metricOcupadas").textContent = ocupadas;
    document.getElementById("metricLlenas").textContent = llenas;

    // Tarjetas
    cardsContainer.innerHTML = "";
    if (salas.length === 0) {
      cardsContainer.innerHTML = `<div class="empty-state">Aún no hay salas registradas.</div>`;
    } else {
      salas.forEach((sala) => cardsContainer.appendChild(renderRoomCard(sala)));
    }

    // Lista
    if (listContainer) {
      listContainer.innerHTML = "";
      salas.forEach((sala) => listContainer.appendChild(renderListRow(sala)));
    }

    window._allSalas = salas; // para los filtros
  } catch (err) {
    console.error(err);
    cardsContainer.innerHTML = `<div class="empty-state">No se pudo conectar con el servidor.</div>`;
  }
}

// ---------- Filtros del dashboard ----------
function setupFilters() {
  const badges = document.querySelectorAll(".filter-badge");
  badges.forEach((badge) => {
    badge.addEventListener("click", () => {
      badges.forEach((b) => b.classList.remove("active"));
      badge.classList.add("active");
      const filter = badge.dataset.filter;
      const salas = window._allSalas || [];
      const filtered =
        filter === "todas"
          ? salas
          : salas.filter((s) => getStatusInfo(s.ocupacion_actual, s.aforo_max).key === filter);

      const cardsContainer = document.getElementById("roomCards");
      cardsContainer.innerHTML = "";
      if (filtered.length === 0) {
        cardsContainer.innerHTML = `<div class="empty-state">No hay salas en este estado.</div>`;
      } else {
        filtered.forEach((sala) => cardsContainer.appendChild(renderRoomCard(sala)));
      }
    });
  });
}

// ---------- Carga del Detalle de sala ----------
async function loadDetalleSala(salaId) {
  try {
    const sala = await fetchSala(salaId);
    if (!sala) return;

    const status = getStatusInfo(sala.ocupacion_actual, sala.aforo_max);

    document.getElementById("salaNombre").textContent = sala.nombre;
    document.getElementById("salaUbicacion").textContent = `Piso ${sala.piso} — Edificio ${sala.edificio}`;
    document.getElementById("salaUpdated").textContent = timeAgo(sala.updated_at);
    document.getElementById("salaStatusPill").textContent = status.label;
    document.getElementById("salaStatusPill").className = `status-pill status-${status.key}`;

    document.getElementById("ocupacionNumero").textContent = sala.ocupacion_actual;
    document.getElementById("ocupacionNumero").style.color =
      status.key === "llena" ? "var(--red)" : status.key === "ocupada" ? "var(--amber)" : "var(--green)";
    document.getElementById("ocupacionLabel").textContent = `personas de ${sala.aforo_max} máximo`;
    document.getElementById("ocupacionBar").style.width = `${status.pct}%`;
    document.getElementById("ocupacionBar").className = `progress-fill ${status.fill}`;
    document.getElementById("ocupacionPct").textContent = `${status.pct}% ocupado`;

    // Sensores
    const sensores = await fetchSensores(salaId);
    const sensorContainer = document.getElementById("sensorList");
    sensorContainer.innerHTML = "";
    sensores.forEach((s) => {
      const dotClass = s.estado === "activo" ? "dot-ok" : s.estado === "calibrando" ? "dot-warn" : "dot-error";
      const row = document.createElement("div");
      row.className = "sensor-row";
      row.innerHTML = `
        <div class="sensor-dot ${dotClass}"></div>
        <span class="sensor-name">${s.tipo} (${s.modelo})</span>
        <span class="sensor-val">${s.estado}</span>
      `;
      sensorContainer.appendChild(row);
    });

    // Eventos recientes
    const eventos = await fetchEventos(salaId, 8);
    const eventContainer = document.getElementById("eventList");
    eventContainer.innerHTML = "";
    eventos.forEach((ev) => {
      const isIn = ev.tipo === "entrada";
      const row = document.createElement("div");
      row.className = "event-row";
      row.innerHTML = `
        <div class="event-icon ${isIn ? "event-in" : "event-out"}">${isIn ? "→" : "←"}</div>
        <span class="event-text">${isIn ? "Ingreso registrado" : "Salida registrada"}</span>
        <span class="event-time">${new Date(ev.timestamp).toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
      `;
      eventContainer.appendChild(row);
    });

    // Historial por hora
    const historial = await fetchHistorialHoy(salaId);
    renderBarChart(historial, sala.aforo_max);
  } catch (err) {
    console.error(err);
  }
}

function renderBarChart(historial, aforoMax) {
  const container = document.getElementById("barChart");
  if (!container) return;
  container.innerHTML = "";

  historial.forEach((punto) => {
    const pct = aforoMax > 0 ? Math.min(100, (punto.ocupacion / aforoMax) * 100) : 0;
    const col = document.createElement("div");
    col.className = "bar-col";
    col.innerHTML = `
      <div class="bar-track">
        <div class="bar-rect" style="height:${pct}%; ${pct >= 100 ? "background:var(--red);opacity:1;" : ""}"></div>
      </div>
      <span class="bar-label">${punto.hora}h</span>
    `;
    container.appendChild(col);
  });
}

// ---------- Login ----------
async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const errorBox = document.getElementById("loginError");
  const btn = document.getElementById("loginBtn");

  btn.disabled = true;
  btn.textContent = "Ingresando...";

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      window.location.href = "/dashboard";
    } else {
      const data = await res.json().catch(() => ({}));
      errorBox.textContent = data.error || "Credenciales incorrectas.";
      errorBox.classList.add("show");
      btn.disabled = false;
      btn.textContent = "Ingresar";
    }
  } catch (err) {
    errorBox.textContent = "No se pudo conectar con el servidor.";
    errorBox.classList.add("show");
    btn.disabled = false;
    btn.textContent = "Ingresar";
  }
}

async function handleLogout() {
  await fetch(`${API_BASE}/logout`, { method: "POST", credentials: "include" });
  window.location.href = "/login";
}

// ---------- Auto-refresh (tiempo real simple por polling) ----------
function startAutoRefresh(callback, intervalMs = 5000) {
  setInterval(callback, intervalMs);
}

// ---------- Inicialización según la página ----------
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;

  if (page === "dashboard") {
    loadDashboard();
    setupFilters();
    startAutoRefresh(loadDashboard, 8000);
  }

  if (page === "detalle") {
    const salaId = document.body.dataset.salaId;
    loadDetalleSala(salaId);
    startAutoRefresh(() => loadDetalleSala(salaId), 5000);
  }

  if (page === "login") {
    document.getElementById("loginForm").addEventListener("submit", handleLogin);
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);
});
