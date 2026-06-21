"""
Genera un código QR que apunta al sitio de SmartRoom.

Uso:
    python generar_qr.py
    python generar_qr.py "https://smartroom-satom.onrender.com"

Si no le pasas una URL, usa http://localhost:5000 por defecto
(útil solo para pruebas en tu propio computador).
"""

import sys
import qrcode

URL_POR_DEFECTO = "http://localhost:5000"


def generar_qr(url: str, salida: str = "smartroom_qr.png"):
    qr = qrcode.QRCode(
        version=None,           # tamaño automático según el largo de la URL
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(salida)
    print(f"✅ QR generado: {salida}")
    print(f"   Apunta a: {url}")


if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else URL_POR_DEFECTO
    generar_qr(url)
