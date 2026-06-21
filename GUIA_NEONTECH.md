# Cómo conectar SmartRoom a NeonTech (PostgreSQL)

Esta guía te lleva paso a paso desde crear la cuenta hasta ver el sitio
funcionando con datos reales.

---

## 1. Crear el proyecto en NeonTech

1. Entra a **https://neon.tech** y crea una cuenta (puedes usar GitHub).
2. Click en **"Create a project"**.
3. Ponle un nombre, por ejemplo `smartroom-satom`.
4. Elige la región más cercana (por ejemplo, alguna de US East).
5. Neon crea automáticamente una base de datos llamada `neondb`. Puedes
   dejarla así o crear una nueva llamada `smartroom` desde el dashboard.

## 2. Obtener el connection string

1. En el dashboard de tu proyecto, ve a **"Connection Details"**.
2. Copia el **Connection string**. Se ve algo así:

   ```
   postgresql://usuario:password@ep-xxxxx-pooler.us-east-2.aws.neon.tech/smartroom?sslmode=require
   ```

3. Guarda ese string, lo vas a necesitar en el paso 4.

> 💡 Usa el connection string que dice **"Pooled connection"** si tu app
> va a recibir muchas peticiones (como las del ESP32 enviando datos
> seguido). Si solo estás probando, cualquiera de los dos funciona.

## 3. Crear las tablas

Tienes dos formas de hacerlo:

**Opción A — Desde el navegador (más fácil):**
1. En el dashboard de Neon, ve a la pestaña **"SQL Editor"**.
2. Abre el archivo `backend/schema.sql` de este proyecto, copia todo
   su contenido y pégalo en el editor.
3. Click en **"Run"**. Esto crea las tablas `usuarios`, `salas`,
   `eventos` y `sensores`, además de algunos datos de prueba.

**Opción B — Desde tu computador con psql:**
```bash
psql "postgresql://usuario:password@ep-xxxxx.neon.tech/smartroom?sslmode=require" -f backend/schema.sql
```

## 4. Configurar el proyecto Flask

1. Dentro de la carpeta del proyecto, copia `.env.example` y renómbralo
   a `.env`:

   ```bash
   cp .env.example .env
   ```

2. Abre `.env` y reemplaza `DATABASE_URL` con el connection string que
   copiaste en el paso 2.

3. Cambia `SECRET_KEY` por cualquier texto largo y aleatorio (esto
   firma las sesiones de login, no necesita relación con la base de
   datos).

4. Deja `DEVICE_API_KEY` con cualquier clave; es la que usará el ESP32
   para autenticarse cuando mande datos (ver paso 7).

## 5. Instalar dependencias y crear el primer usuario

```bash
# Crea un entorno virtual (recomendado)
python -m venv venv
source venv/bin/activate      # En Windows: venv\Scripts\activate

# Instala las dependencias
pip install -r requirements.txt

# Crea tu usuario de acceso al dashboard
python backend/crear_usuario.py
```

Te va a pedir nombre, correo y contraseña. Con eso vas a poder iniciar
sesión en la página web.

## 6. Correr el servidor

```bash
python app.py
```

Abre tu navegador en **http://localhost:5000** — debería redirigirte al
login. Inicia sesión con el usuario que creaste y ya deberías ver el
dashboard con las salas de prueba que vienen en `schema.sql`.

## 7. Conectar el ESP32 (cuando tengan el hardware listo)

El backend ya expone un endpoint pensado para que el ESP32 le mande los
eventos directamente:

```
POST /api/ingest
Headers:
    Content-Type: application/json
    X-API-Key: <el mismo valor que pusiste en DEVICE_API_KEY>
Body (JSON):
    {
      "sala_id": "uuid-de-la-sala",
      "tipo": "entrada",          // o "salida"
      "sensor_origen": "ToF_VL53L0X"
    }
```

Ejemplo de código en el ESP32 (usando la librería `HTTPClient` de
Arduino) para enviar esto por Wi-Fi:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

void enviarEvento(String salaId, String tipo) {
  HTTPClient http;
  http.begin("http://TU_SERVIDOR:5000/api/ingest");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-API-Key", "clave-secreta-para-el-esp32");

  String body = "{\"sala_id\":\"" + salaId + "\",\"tipo\":\"" + tipo + "\",\"sensor_origen\":\"ToF_VL53L0X\"}";
  int httpCode = http.POST(body);

  Serial.println(httpCode);
  http.end();
}
```

Cada vez que este endpoint reciba una llamada:
- Suma o resta 1 a `ocupacion_actual` de la sala.
- Actualiza el `estado` (disponible / ocupada / llena) automáticamente.
- Guarda el evento en la tabla `eventos` con su timestamp.
- Actualiza `ultima_lectura` del sensor correspondiente.

## 8. Instalar SmartRoom como app en el celular (PWA)

El sitio ya está configurado como **Progressive Web App (PWA)**, así que
no necesitas publicarlo en Play Store ni App Store para que se sienta
como una app de verdad.

**En Android (Chrome):**
1. Abre la URL del sitio en Chrome.
2. Va a aparecer un banner abajo que dice "Instalar". Tócalo.
   (Si no aparece, toca el menú ⋮ → "Instalar app" o "Agregar a pantalla de inicio").
3. Listo — queda un ícono en el celular que abre la app en pantalla
   completa, sin la barra del navegador.

**En iPhone (Safari):**
1. Abre la URL del sitio en Safari (tiene que ser Safari, no Chrome).
2. Toca el botón de **Compartir** (el cuadrado con la flecha hacia arriba).
3. Selecciona **"Agregar a pantalla de inicio"**.
4. Listo — mismo resultado, ícono propio y pantalla completa.

**¿Qué incluye la versión instalada?**
- Ícono propio (`static/icons/icon-192.png` y `icon-512.png`) — puedes
  regenerarlos editando `static/icons/generar_iconos.py` si quieres un
  logo distinto.
- Navegación inferior tipo app (Inicio / Historial / Salir) que solo
  aparece en pantallas pequeñas.
- Carga rápida gracias al `service-worker.js`, que guarda en caché el
  CSS, JS e íconos. **Los datos de ocupación nunca se cachean** — siempre
  se piden en vivo a la API para que la información esté actualizada.
- Funciona sin necesidad de re-publicar nada: como es la misma página
  web, cualquier cambio que hagan en el servidor se refleja
  automáticamente en la app instalada la próxima vez que la abran.



Para que el sitio sea accesible fuera de tu computador (y el ESP32
pueda mandarle datos desde cualquier lugar), pueden desplegar el
backend Flask en un servicio gratuito como:

- **Render.com** (recomendado, soporta Flask + variables de entorno fácil)
- **Railway.app**
- **PythonAnywhere**

En cualquiera de ellos, el proceso es similar:
1. Suben su código a GitHub.
2. Conectan el repositorio al servicio.
3. Configuran las mismas variables de entorno del archivo `.env`
   (DATABASE_URL, SECRET_KEY, DEVICE_API_KEY) en el panel del servicio.
4. El servicio instala `requirements.txt` y corre `app.py` automáticamente.

NeonTech no requiere ningún cambio para esto — su base de datos ya es
accesible desde internet con el connection string que usaste.

---

## Resumen de la estructura del proyecto

```
smartroom/
├── app.py                  ← servidor Flask (rutas + API)
├── requirements.txt
├── .env                    ← tus credenciales (no subir a git)
├── .env.example
├── backend/
│   ├── schema.sql           ← crea las tablas en NeonTech
│   └── crear_usuario.py     ← crea usuarios de login
├── templates/
│   ├── login.html
│   ├── dashboard.html
│   ├── detalle.html
│   └── historial.html
└── static/
    ├── css/style.css
    └── js/app.js
```
