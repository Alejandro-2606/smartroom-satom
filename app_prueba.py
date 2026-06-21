"""
SmartRoom / SATOM — Backend de PRUEBA (sin base de datos real)
================================================================
Esta versión simula los datos en memoria, para que puedas ver
el sitio funcionando completo (login, dashboard, detalle, historial)
SIN necesitar conectar NeonTech todavía.

Cuando tu compañero tenga la base de datos lista, usan el archivo
"app.py" real (el que sí se conecta a NeonTech) en vez de este.

Cómo correrlo:
    pip install flask
    python app_prueba.py

Luego abre tu navegador en: http://localhost:5000

Usuario de prueba:
    correo:     test@udp.cl
    contraseña: 1234
"""

import uuid
from datetime import datetime, timedelta
from functools import wraps

from flask import Flask, render_template, request, jsonify, session, redirect, url_for

app = Flask(__name__)
app.secret_key = "clave-de-prueba-solo-para-desarrollo"

# ============================================================
# "BASE DE DATOS" FALSA — todo vive en memoria mientras el
# servidor está corriendo. Al reiniciar, se resetea.
# ============================================================

USUARIO_PRUEBA = {"email": "test@udp.cl", "password": "1234", "nombre": "Alejandro Arias"}

SALAS = {
    "1": {"id": "1", "nombre": "Sala A-101", "piso": 1, "edificio": "A", "aforo_max": 30, "ocupacion_actual": 9, "estado": "disponible", "updated_at": datetime.now().isoformat()},
    "2": {"id": "2", "nombre": "Sala A-204", "piso": 2, "edificio": "A", "aforo_max": 40, "ocupacion_actual": 40, "estado": "llena", "updated_at": datetime.now().isoformat()},
    "3": {"id": "3", "nombre": "Sala B-301", "piso": 3, "edificio": "B", "aforo_max": 25, "ocupacion_actual": 18, "estado": "ocupada", "updated_at": datetime.now().isoformat()},
    "4": {"id": "4", "nombre": "Sala C-102", "piso": 1, "edificio": "C", "aforo_max": 20, "ocupacion_actual": 3, "estado": "disponible", "updated_at": datetime.now().isoformat()},
    "5": {"id": "5", "nombre": "Sala C-205", "piso": 2, "edificio": "C", "aforo_max": 40, "ocupacion_actual": 24, "estado": "ocupada", "updated_at": datetime.now().isoformat()},
}

SENSORES = {
    "1": [
        {"id": "s1", "tipo": "ToF_VL53L0X", "modelo": "VL53L0X", "estado": "activo", "ultima_lectura": datetime.now().isoformat()},
        {"id": "s2", "tipo": "Radar_LD2410C", "modelo": "HLK-LD2410C", "estado": "activo", "ultima_lectura": datetime.now().isoformat()},
    ],
}

EVENTOS = {
    "1": [
        {"id": str(uuid.uuid4()), "tipo": "entrada", "timestamp": (datetime.now() - timedelta(minutes=2)).isoformat(), "conteo_post": 9, "sensor_origen": "ToF_VL53L0X"},
        {"id": str(uuid.uuid4()), "tipo": "entrada", "timestamp": (datetime.now() - timedelta(minutes=5)).isoformat(), "conteo_post": 8, "sensor_origen": "ToF_VL53L0X"},
        {"id": str(uuid.uuid4()), "tipo": "salida", "timestamp": (datetime.now() - timedelta(minutes=9)).isoformat(), "conteo_post": 7, "sensor_origen": "ToF_VL53L0X"},
    ],
}

HISTORIAL_HOY = {
    "1": [
        {"hora": 8, "ocupacion": 2}, {"hora": 9, "ocupacion": 5}, {"hora": 10, "ocupacion": 12},
        {"hora": 11, "ocupacion": 9}, {"hora": 12, "ocupacion": 15}, {"hora": 13, "ocupacion": 9},
    ],
}


def datos_sala_por_defecto(sala_id):
    """Para salas sin sensores/eventos definidos arriba, genera datos genéricos."""
    return [], []


# ============================================================
# Login requerido (igual que en el backend real)
# ============================================================
def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "No autenticado"}), 401
            return redirect(url_for("login_page"))
        return view_func(*args, **kwargs)

    return wrapped


# ============================================================
# RUTAS DE PÁGINAS
# ============================================================

@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("dashboard_page"))
    return redirect(url_for("login_page"))


@app.route("/login")
def login_page():
    if "user_id" in session:
        return redirect(url_for("dashboard_page"))
    return render_template("login.html")


@app.route("/dashboard")
@login_required
def dashboard_page():
    return render_template("dashboard.html", usuario_nombre=session.get("user_name", "Usuario"))


@app.route("/sala/<sala_id>")
@login_required
def detalle_page(sala_id):
    return render_template("detalle.html", sala_id=sala_id, usuario_nombre=session.get("user_name", "Usuario"))


@app.route("/historial")
@login_required
def historial_page():
    return render_template("historial.html", usuario_nombre=session.get("user_name", "Usuario"))


@app.route("/manifest.json")
def manifest():
    return app.send_static_file("manifest.json")


@app.route("/service-worker.js")
def service_worker():
    return app.send_static_file("service-worker.js")


# ============================================================
# API — igual que el backend real, pero leyendo de las
# variables en memoria de arriba en vez de NeonTech
# ============================================================

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if email == USUARIO_PRUEBA["email"] and password == USUARIO_PRUEBA["password"]:
        session["user_id"] = "1"
        session["user_name"] = USUARIO_PRUEBA["nombre"]
        return jsonify({"ok": True})

    return jsonify({"error": "Credenciales incorrectas. Usa test@udp.cl / 1234"}), 401


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/salas", methods=["GET"])
@login_required
def api_salas():
    return jsonify(list(SALAS.values()))


@app.route("/api/salas/<sala_id>", methods=["GET"])
@login_required
def api_sala_detalle(sala_id):
    sala = SALAS.get(sala_id)
    if not sala:
        return jsonify({"error": "Sala no encontrada"}), 404
    return jsonify(sala)


@app.route("/api/salas/<sala_id>/sensores", methods=["GET"])
@login_required
def api_sala_sensores(sala_id):
    return jsonify(SENSORES.get(sala_id, []))


@app.route("/api/salas/<sala_id>/eventos", methods=["GET"])
@login_required
def api_sala_eventos(sala_id):
    return jsonify(EVENTOS.get(sala_id, []))


@app.route("/api/salas/<sala_id>/historial", methods=["GET"])
@login_required
def api_sala_historial(sala_id):
    return jsonify(HISTORIAL_HOY.get(sala_id, []))


if __name__ == "__main__":
    import os as _os
    port = int(_os.environ.get("PORT", 5000))
    print("\n" + "=" * 50)
    print("  SmartRoom — servidor de PRUEBA (sin base de datos)")
    print("=" * 50)
    print(f"  Puerto: {port}")
    print("  Usuario: test@udp.cl")
    print("  Contraseña: 1234")
    print("=" * 50 + "\n")
    app.run(host="0.0.0.0", debug=False, port=port)
