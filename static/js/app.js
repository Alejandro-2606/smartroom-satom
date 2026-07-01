/* ============================================
   SmartRoom / SATOM — app.js
   Conectado a la API real del compañero:
   https://smartroom-api-nuhg.onrender.com
   ============================================ */

const API_EXTERNA = "https://smartroom-api-nuhg.onrender.com";
const API_BASE = "/api"; // para login/logout (sigue siendo Flask local)

// ---------- Normaliza los datos de la API real ----------
// La API del compañero usa nombre_sala, capacidad_maxima, id_sala
// Esta función los convierte al formato que usa el resto del código
function normalizarSala(sala) {
  const ocupacion = sala.ocupacion_actual ?? 0;
  const aforoMax  = sala.capacidad_maxima ?? sala.aforo_max ?? 0;
  const pct = aforoMax > 0 ? Math.round((ocupacion / aforoMax) * 100) : 0;
  return {
    id:               sala.id_sala ?? sala.id ?? sala.id_sala,
    nombre:           sala.nombre_sala ?? sala.nombre ?? "Sala",
    piso:             sala.piso ?? "—",
    edificio:         sala.edificio ?? "—",
    aforo_max:        aforoMax,
    ocupacion_actual: ocupacion,
    estado:           pct >= 100 ? "llena" : pct >= 60 ? "ocupada" : "disponible",
    updated_at:       sala.updated_at ?? new Date().toISOString(),
  };
}

// ---------- Estado visual según ocupación ----------
function getStatusInfo(ocupacion, aforoMax) {
  const pct = aforoMax > 0 ? Math.round((ocupacion / aforoMax) * 100) : 0;
  const pctVisual = Math.min(pct, 100); // la barra nunca supera el 100% visualmente
  if (pct >= 100) return { key: "llena",      label: "Aforo máx.", fill: "fill-red",   pct, pctVisual };
  if (pct >= 60)  return { key: "ocupada",    label: "Ocupada",    fill: "fill-amber", pct, pctVisual };
  return              { key: "disponible", label: "Disponible", fill: "fill-green", pct, pctVisual };
}

function timeAgo(timestamp) {
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 60)   return `hace ${diff} seg`;
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  return `hace ${Math.floor(diff / 3600)} h`;
}

// ---------- Llamadas a la API REAL del compañero ----------
async function fetchSalas() {
  const res = await fetch(`${API_EXTERNA}/api/salas`);
  if (!res.ok) throw new Error("Error al obtener salas");
  const data = await res.json();
  // El API devuelve un array — normalizamos cada sala
  return Array.isArray(data) ? data.map(normalizarSala) : [];
}

async function fetchSala(salaId) {
  // Obtenemos todas las salas y filtramos por id (la API no tiene endpoint individual aún)
  const salas = await fetchSalas();
  return salas.find(s => String(s.id) === String(salaId)) ?? null;
}

// Estos endpoints los pedirá tu compañero agregar cuando los tenga.
// Por ahora devuelven datos vacíos para que el sitio no rompa.
async function fetchEventos(salaId) {
  try {
    const res = await fetch(`${API_EXTERNA}/api/salas/${salaId}/eventos`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function fetchSensores(salaId) {
  try {
    const res = await fetch(`${API_EXTERNA}/api/salas/${salaId}/sensores`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

async function fetchHistorialHoy(salaId) {
  try {
    const res = await fetch(`${API_EXTERNA}/api/salas/${salaId}/historial`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

// ---------- Login / Logout ----------
async function fetchLoginAPI(email, password) {
  const res = await fetch(`${API_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  return res;
}

// ---------- Render: tarjeta de sala ----------
function renderRoomCard(sala) {
  const status = getStatusInfo(sala.ocupacion_actual, sala.aforo_max);
  const card = document.createElement("div");
  card.className = `room-card status-${status.key}`;
  card.onclick = () => (window.location.href = `/sala/${sala.id}`);
  card.innerHTML = `
    <div class="room-card-header">
      <div>
        <div class="room-card-name">${sala.nombre}</div>
        <div class="room-card-floor">Capacidad máx: ${sala.aforo_max} personas</div>
      </div>
      <span class="status-pill status-${status.key}">${status.label}</span>
    </div>
    <div class="progress-bg">
      <div class="progress-fill ${status.fill}" style="width:${status.pctVisual}%"></div>
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

// ---------- Render: fila de lista ----------
function renderListRow(sala) {
  const status = getStatusInfo(sala.ocupacion_actual, sala.aforo_max);
  const row = document.createElement("div");
  row.className = "list-row";
  row.onclick = () => (window.location.href = `/sala/${sala.id}`);
  row.innerHTML = `
    <span style="font-weight:500;">${sala.nombre}</span>
    <span class="status-pill status-${status.key}">${status.label}</span>
    <div class="mini-bar-bg"><div class="mini-bar ${status.fill}" style="width:${status.pctVisual}%"></div></div>
    <span style="color:var(--text-secondary);">${sala.ocupacion_actual}</span>
    <span style="color:var(--text-secondary);">${sala.aforo_max}</span>
  `;
  return row;
}

// ---------- Carga del Dashboard ----------
async function loadDashboard() {
  const cardsContainer = document.getElementById("roomCards");
  const listContainer  = document.getElementById("roomList");
  if (!cardsContainer) return;

  try {
    const salas = await fetchSalas();

    // Métricas
    const disponibles = salas.filter(s => getStatusInfo(s.ocupacion_actual, s.aforo_max).key === "disponible").length;
    const ocupadas    = salas.filter(s => getStatusInfo(s.ocupacion_actual, s.aforo_max).key === "ocupada").length;
    const llenas      = salas.filter(s => getStatusInfo(s.ocupacion_actual, s.aforo_max).key === "llena").length;

    document.getElementById("metricTotal").textContent       = salas.length;
    document.getElementById("metricDisponibles").textContent = disponibles;
    document.getElementById("metricOcupadas").textContent    = ocupadas;
    document.getElementById("metricLlenas").textContent      = llenas;

    // Tarjetas
    cardsContainer.innerHTML = "";
    if (salas.length === 0) {
      cardsContainer.innerHTML = `<div class="empty-state">No hay salas disponibles.</div>`;
    } else {
      salas.forEach(sala => cardsContainer.appendChild(renderRoomCard(sala)));
    }

    // Lista
    if (listContainer) {
      listContainer.innerHTML = "";
      salas.forEach(sala => listContainer.appendChild(renderListRow(sala)));
    }

    window._allSalas = salas;
  } catch (err) {
    console.error(err);
    cardsContainer.innerHTML = `<div class="empty-state">No se pudo conectar con la API. Intenta de nuevo.</div>`;
  }
}

// ---------- Filtros ----------
function setupFilters() {
  const badges = document.querySelectorAll(".filter-badge");
  badges.forEach(badge => {
    badge.addEventListener("click", () => {
      badges.forEach(b => b.classList.remove("active"));
      badge.classList.add("active");
      const filter = badge.dataset.filter;
      const salas  = window._allSalas || [];
      const filtered = filter === "todas"
        ? salas
        : salas.filter(s => getStatusInfo(s.ocupacion_actual, s.aforo_max).key === filter);

      const cardsContainer = document.getElementById("roomCards");
      cardsContainer.innerHTML = "";
      if (filtered.length === 0) {
        cardsContainer.innerHTML = `<div class="empty-state">No hay salas en este estado.</div>`;
      } else {
        filtered.forEach(sala => cardsContainer.appendChild(renderRoomCard(sala)));
      }
    });
  });
}

// ---------- Carga del Detalle de sala ----------
async function loadDetalleSala(salaId) {
  try {
    const sala = await fetchSala(salaId);
    if (!sala) {
      document.getElementById("salaNombre").textContent = "Sala no encontrada";
      return;
    }

    const status = getStatusInfo(sala.ocupacion_actual, sala.aforo_max);

    document.getElementById("salaNombre").textContent          = sala.nombre;
    document.getElementById("salaNombreBreadcrumb").textContent = sala.nombre;
    document.getElementById("salaUbicacion").textContent       = `Capacidad máxima: ${sala.aforo_max} personas`;
    document.getElementById("salaUpdated").textContent         = timeAgo(sala.updated_at);
    document.getElementById("salaStatusPill").textContent      = status.label;
    document.getElementById("salaStatusPill").className        = `status-pill status-${status.key}`;

    const numEl = document.getElementById("ocupacionNumero");
    numEl.textContent  = sala.ocupacion_actual;
    numEl.style.color  = status.key === "llena" ? "var(--red)" : status.key === "ocupada" ? "var(--amber)" : "var(--green)";
    document.getElementById("ocupacionLabel").textContent = `personas de ${sala.aforo_max} máximo`;
    document.getElementById("ocupacionBar").style.width   = `${status.pctVisual}%`;
    document.getElementById("ocupacionBar").className     = `progress-fill ${status.fill}`;
    document.getElementById("ocupacionPct").textContent   = `${status.pct}% ocupado`;

    // Sensores (cuando el compañero los agregue)
    const sensores = await fetchSensores(salaId);
    const sensorContainer = document.getElementById("sensorList");
    sensorContainer.innerHTML = "";
    if (sensores.length === 0) {
      // Mostramos los sensores conocidos del proyecto como referencia
      [
        { tipo: "ToF VL53L0X", modelo: "VL53L0X", estado: "activo" },
        { tipo: "Radar LD2410C", modelo: "HLK-LD2410C", estado: "activo" },
      ].forEach(s => {
        const row = document.createElement("div");
        row.className = "sensor-row";
        row.innerHTML = `
          <div class="sensor-dot dot-ok"></div>
          <span class="sensor-name">${s.tipo} (${s.modelo})</span>
          <span class="sensor-val">${s.estado}</span>
        `;
        sensorContainer.appendChild(row);
      });
    } else {
      sensores.forEach(s => {
        const dotClass = s.estado === "activo" ? "dot-ok" : s.estado === "calibrando" ? "dot-warn" : "dot-error";
        const row = document.createElement("div");
        row.className = "sensor-row";
        row.innerHTML = `
          <div class="sensor-dot ${dotClass}"></div>
          <span class="sensor-name">${s.tipo ?? s.modelo ?? "Sensor"}</span>
          <span class="sensor-val">${s.estado ?? "activo"}</span>
        `;
        sensorContainer.appendChild(row);
      });
    }

    // Eventos recientes
    const eventos = await fetchEventos(salaId);
    const eventContainer = document.getElementById("eventList");
    eventContainer.innerHTML = "";
    if (eventos.length === 0) {
      eventContainer.innerHTML = `<div class="empty-state">Sin eventos registrados aún.</div>`;
    } else {
      eventos.slice(0, 8).forEach(ev => {
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
    }

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
  if (!historial || historial.length === 0) {
    container.innerHTML = `<div class="empty-state" style="width:100%;">Sin historial disponible aún.</div>`;
    return;
  }
  historial.forEach(punto => {
    const pct = aforoMax > 0 ? Math.min(100, (punto.ocupacion / aforoMax) * 100) : 0;
    const col = document.createElement("div");
    col.className = "bar-col";
    col.innerHTML = `
      <div class="bar-track">
        <div class="bar-rect" style="height:${pct}%;${pct >= 100 ? "background:var(--red);opacity:1;" : ""}"></div>
      </div>
      <span class="bar-label">${punto.hora}h</span>
    `;
    container.appendChild(col);
  });
}

// ---------- Login ----------
async function handleLogin(event) {
  event.preventDefault();
  const email    = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const errorBox = document.getElementById("loginError");
  const btn      = document.getElementById("loginBtn");

  btn.disabled    = true;
  btn.textContent = "Ingresando...";

  try {
    const res = await fetchLoginAPI(email, password);
   if (res.ok) {
  window.location.replace("/dashboard?login=1"); } else {
      const data = await res.json().catch(() => ({}));
      errorBox.textContent = data.error || "Credenciales incorrectas.";
      errorBox.classList.add("show");
      btn.disabled    = false;
      btn.textContent = "Ingresar";
    }
  } catch (err) {
    errorBox.textContent = "No se pudo conectar con el servidor.";
    errorBox.classList.add("show");
    btn.disabled    = false;
    btn.textContent = "Ingresar";
  }
}

async function handleLogout() {
  await fetch(`${API_BASE}/logout`, { method: "POST", credentials: "include" });
  window.location.href = "/login";
}

// ---------- Auto-refresh ----------
function startAutoRefresh(callback, intervalMs = 8000) {
  setInterval(callback, intervalMs);
}

// ---------- Inicialización ----------
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
    startAutoRefresh(() => loadDetalleSala(salaId), 8000);
  }

  if (page === "historial") {
    loadDashboard();
  }

  if (page === "login") {
    document.getElementById("loginForm").addEventListener("submit", handleLogin);
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

  const bottomLogout = document.getElementById("bottomLogout");
  if (bottomLogout) bottomLogout.addEventListener("click", e => {
    e.preventDefault();
    handleLogout();
  });
});
