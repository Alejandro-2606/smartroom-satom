"""
Genera los íconos necesarios para la PWA de SmartRoom.
Crea un ícono simple con las iniciales "SR" sobre fondo oscuro,
en los tamaños que exige el estándar PWA.

Uso:
    python generar_iconos.py
"""

from PIL import Image, ImageDraw, ImageFont

BG_COLOR = (17, 17, 17)        # #111111 — mismo fondo que el sitio
ACCENT_COLOR = (229, 201, 126)  # #e5c97e — color acento dorado
TEXT_COLOR = (255, 255, 255)

TAMANOS = [192, 512]


def crear_icono(size: int, salida: str):
    img = Image.new("RGB", (size, size), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Círculo decorativo de acento
    margin = size * 0.08
    draw.ellipse(
        [margin, margin, size - margin, size - margin],
        outline=ACCENT_COLOR,
        width=max(2, size // 60),
    )

    # Texto "SR"
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", int(size * 0.32))
    except Exception:
        font = ImageFont.load_default()

    text = "SR"
    bbox = draw.textbbox((0, 0), text, font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    draw.text(
        ((size - w) / 2 - bbox[0], (size - h) / 2 - bbox[1]),
        text,
        font=font,
        fill=TEXT_COLOR,
    )

    img.save(salida)
    print(f"✅ Ícono generado: {salida} ({size}x{size})")


if __name__ == "__main__":
    for tamano in TAMANOS:
        crear_icono(tamano, f"icon-{tamano}.png")
