"""
SmartRoom / SATOM — Backend Flask
==================================
Sirve las páginas HTML y expone una API REST que lee/escribe
en la base de datos PostgreSQL alojada en NeonTech.

Cómo correrlo:
    pip install flask psycopg2-binary python-dotenv werkzeug
    python app.py

Variables de entorno requeridas (ver archivo .env.example):
    DATABASE_URL=postgresql://usuario:password@host/dbname?sslmode=require
    SECRET_KEY=alguna_clave_secreta
"""

import os
from datetime import datetime, timedelta
from functools import wraps

import psycopg2
import psycopg2.extras
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import check_password_hash
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-cambia-esto")

DATABASE_URL = os.environ.get("DATABASE_URL")


def get_db_connection():
    """Abre una nueva conexión a NeonTech (PostgreSQL)."""
    conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    return conn


# ----------------------------------------------------
# Decorador para proteger rutas que requieren login
# ----------------------------------------------------
def login_required(view_func):
    @wraps(view_func)
    def wrapped(*args, **kwargs):
        if "user_id" not in session:
            if request.path.startswith("/api/"):
                return jsonify({"error": "No autenticado"}), 401
            return redirect(url_for("login_page"))
        return view_func(*args, **kwargs)

    return wrapped


# ======================================================
# RUTAS DE PÁGINAS (HTML)
# ======================================================

@app.route("/")
def index():
    if "user_id" in session:
        return redirect(url_for("dashboard_page"))
    return redirect(url_for("login_page"))


@app.route("/service-worker.js")
def service_worker():
    """
    Se sirve desde la raíz (no desde /static/) para que su 'scope'
    cubra todo el sitio y no solo la carpeta /static/.
    """
    return app.send_static_file("service-worker.js")


@app.route("/manifest.json")
def manifest():
    return app.send_static_file("manifest.json")


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
    return render_template(
        "detalle.html", sala_id=sala_id, usuario_nombre=session.get("user_name", "Usuario")
    )


@app.route("/historial")
@login_required
def historial_page():
    return render_template("historial.html", usuario_nombre=session.get("user_name", "Usuario"))


# ======================================================
# API — AUTENTICACIÓN
# ======================================================

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Correo y contraseña son obligatorios"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                "SELECT id, nombre, password_hash FROM usuarios WHERE email = %s",
                (email,),
            )
            user = cur.fetchone()
    finally:
        conn.close()

    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Credenciales incorrectas"}), 401

    session["user_id"] = user["id"]
    session["user_name"] = user["nombre"]
    return jsonify({"ok": True})


@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok": True})


# ======================================================
# API — SALAS
# ======================================================

@app.route("/api/salas", methods=["GET"])
@login_required
def api_salas():
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, nombre, piso, edificio, aforo_max,
                       ocupacion_actual, estado, updated_at
                FROM salas
                ORDER BY edificio, piso, nombre
                """
            )
            salas = cur.fetchall()
    finally:
        conn.close()

    return jsonify([dict(s) for s in salas])


@app.route("/api/salas/<sala_id>", methods=["GET"])
@login_required
def api_sala_detalle(sala_id):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, nombre, piso, edificio, aforo_max,
                       ocupacion_actual, estado, updated_at
                FROM salas WHERE id = %s
                """,
                (sala_id,),
            )
            sala = cur.fetchone()
    finally:
        conn.close()

    if not sala:
        return jsonify({"error": "Sala no encontrada"}), 404

    return jsonify(dict(sala))


@app.route("/api/salas/<sala_id>/sensores", methods=["GET"])
@login_required
def api_sala_sensores(sala_id):
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, tipo, modelo, estado, ultima_lectura
                FROM sensores WHERE sala_id = %s
                ORDER BY tipo
                """,
                (sala_id,),
            )
            sensores = cur.fetchall()
    finally:
        conn.close()

    return jsonify([dict(s) for s in sensores])


@app.route("/api/salas/<sala_id>/eventos", methods=["GET"])
@login_required
def api_sala_eventos(sala_id):
    limit = request.args.get("limit", 10, type=int)
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, tipo, timestamp, conteo_post, sensor_origen
                FROM eventos
                WHERE sala_id = %s
                ORDER BY timestamp DESC
                LIMIT %s
                """,
                (sala_id, limit),
            )
            eventos = cur.fetchall()
    finally:
        conn.close()

    return jsonify([dict(e) for e in eventos])


@app.route("/api/salas/<sala_id>/historial", methods=["GET"])
@login_required
def api_sala_historial(sala_id):
    """Devuelve la ocupación agrupada por hora para el día de hoy."""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT EXTRACT(HOUR FROM timestamp)::int AS hora,
                       MAX(conteo_post) AS ocupacion
                FROM eventos
                WHERE sala_id = %s
                  AND timestamp >= CURRENT_DATE
                GROUP BY hora
                ORDER BY hora
                """,
                (sala_id,),
            )
            filas = cur.fetchall()
    finally:
        conn.close()

    return jsonify([{"hora": f["hora"], "ocupacion": f["ocupacion"]} for f in filas])


# ======================================================
# API — INGESTA DE DATOS DESDE EL ESP32
# (este endpoint lo llama el microcontrolador, no el navegador)
# ======================================================

@app.route("/api/ingest", methods=["POST"])
def api_ingest():
    """
    Endpoint que el ESP32 llama cada vez que detecta un evento.
    Protegido con una API key simple en el header X-API-Key.
    """
    api_key = request.headers.get("X-API-Key")
    if api_key != os.environ.get("DEVICE_API_KEY"):
        return jsonify({"error": "API key inválida"}), 401

    data = request.get_json(silent=True) or {}
    sala_id = data.get("sala_id")
    tipo = data.get("tipo")  # "entrada" o "salida"
    sensor_origen = data.get("sensor_origen", "ToF_VL53L0X")

    if not sala_id or tipo not in ("entrada", "salida"):
        return jsonify({"error": "sala_id y tipo ('entrada'/'salida') son obligatorios"}), 400

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Actualiza el contador de la sala
            delta = 1 if tipo == "entrada" else -1
            cur.execute(
                """
                UPDATE salas
                SET ocupacion_actual = GREATEST(0, ocupacion_actual + %s),
                    updated_at = NOW()
                WHERE id = %s
                RETURNING ocupacion_actual, aforo_max
                """,
                (delta, sala_id),
            )
            resultado = cur.fetchone()

            if not resultado:
                conn.rollback()
                return jsonify({"error": "Sala no encontrada"}), 404

            nuevo_conteo = resultado["ocupacion_actual"]
            aforo_max = resultado["aforo_max"]

            # Actualiza el estado textual de la sala
            if nuevo_conteo >= aforo_max:
                nuevo_estado = "llena"
            elif nuevo_conteo >= aforo_max * 0.6:
                nuevo_estado = "ocupada"
            else:
                nuevo_estado = "disponible"

            cur.execute("UPDATE salas SET estado = %s WHERE id = %s", (nuevo_estado, sala_id))

            # Inserta el evento
            cur.execute(
                """
                INSERT INTO eventos (sala_id, tipo, timestamp, conteo_post, sensor_origen)
                VALUES (%s, %s, NOW(), %s, %s)
                """,
                (sala_id, tipo, nuevo_conteo, sensor_origen),
            )

            # Actualiza última lectura del sensor
            cur.execute(
                """
                UPDATE sensores SET ultima_lectura = NOW(), estado = 'activo'
                WHERE sala_id = %s AND tipo = %s
                """,
                (sala_id, sensor_origen),
            )

        conn.commit()
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()

    return jsonify({"ok": True, "ocupacion_actual": nuevo_conteo, "estado": nuevo_estado})


if __name__ == "__main__":
    # host="0.0.0.0" permite que otros dispositivos en tu misma red Wi-Fi
    # (como un iPad o celular) accedan al sitio usando tu IP local.
    app.run(host="0.0.0.0", debug=True, port=5000)
