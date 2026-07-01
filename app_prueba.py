"""
SmartRoom / SATOM — Backend de PRUEBA (sin base de datos real)
"""
import uuid
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = "clave-de-prueba-solo-para-desarrollo"

# Usuarios en memoria
USUARIOS = {
    "test@udp.cl": {
        "id": "1",
        "nombre": "Alejandro Arias",
        "email": "test@udp.cl",
        "password_hash": generate_password_hash("1234")
    }
}

def login_required(view_func):
    from functools import wraps
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
    return render_template("inicio.html")

@app.route("/dashboard")
def dashboard_page():
    # Público — no requiere login
    nombre = session.get("user_name", "")
    return render_template("dashboard.html", usuario_nombre=nombre)

@app.route("/login")
def login_page():
    if "user_id" in session:
        return redirect(url_for("dashboard_page"))
    return render_template("login.html")

@app.route("/registro")
def registro_page():
    if "user_id" in session:
        return redirect(url_for("dashboard_page"))
    return render_template("registro.html")

@app.route("/sala/<sala_id>")
def detalle_page(sala_id):
    nombre = session.get("user_name", "")
    return render_template("detalle.html", sala_id=sala_id, usuario_nombre=nombre)

@app.route("/historial")
@login_required
def historial_page():
    return render_template("historial.html", usuario_nombre=session.get("user_name", ""))

@app.route("/manifest.json")
def manifest():
    return app.send_static_file("manifest.json")

@app.route("/service-worker.js")
def service_worker():
    return app.send_static_file("service-worker.js")

# ============================================================
# API
# ============================================================

@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json(silent=True) or {}
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")
    user = USUARIOS.get(email)
    if not user or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Credenciales incorrectas"}), 401
    session["user_id"]   = user["id"]
    session["user_name"] = user["nombre"]
    return jsonify({"ok": True})

@app.route("/api/registro", methods=["POST"])
def api_registro():
    data     = request.get_json(silent=True) or {}
    nombre   = data.get("nombre", "").strip()
    email    = data.get("email", "").strip().lower()
    password = data.get("password", "")
    if not nombre or not email or not password:
        return jsonify({"error": "Todos los campos son obligatorios"}), 400
    if len(password) < 6:
        return jsonify({"error": "La contraseña debe tener mínimo 6 caracteres"}), 400
    if email in USUARIOS:
        return jsonify({"error": "Ya existe una cuenta con ese correo"}), 409
    USUARIOS[email] = {
        "id":            str(uuid.uuid4()),
        "nombre":        nombre,
        "email":         email,
        "password_hash": generate_password_hash(password)
    }
    return jsonify({"ok": True}), 201

@app.route("/api/logout", methods=["POST"])
def api_logout():
    session.clear()
    return jsonify({"ok": True})

if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    print("\n" + "=" * 50)
    print("  SmartRoom — servidor de PRUEBA")
    print("=" * 50)
    print(f"  http://localhost:{port}")
    print("  Usuario: test@udp.cl / 1234")
    print("=" * 50 + "\n")
    app.run(host="0.0.0.0", debug=False, port=port)
