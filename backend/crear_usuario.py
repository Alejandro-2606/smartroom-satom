"""
Script para crear el primer usuario (admin) en la base de datos.

Uso:
    python crear_usuario.py
"""

import os
import getpass
import psycopg2
from werkzeug.security import generate_password_hash
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get("DATABASE_URL")

def main():
    if not DATABASE_URL:
        print("ERROR: define DATABASE_URL en tu archivo .env primero.")
        return

    nombre = input("Nombre del usuario: ").strip()
    email = input("Correo: ").strip().lower()
    password = getpass.getpass("Contraseña: ")

    password_hash = generate_password_hash(password)

    conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO usuarios (nombre, email, password_hash)
                VALUES (%s, %s, %s)
                ON CONFLICT (email) DO UPDATE
                SET password_hash = EXCLUDED.password_hash
                """,
                (nombre, email, password_hash),
            )
        conn.commit()
        print(f"✅ Usuario '{email}' creado/actualizado correctamente.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
