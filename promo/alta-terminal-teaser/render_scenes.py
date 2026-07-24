from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import math

ROOT = Path(__file__).resolve().parent
SIZE = (1920, 1080)
GREEN = "#00C805"
INK = "#050708"
WHITE = "#F7F8F5"
MUTED = "#8B9099"
FONT = "/System/Library/Fonts/SFNS.ttf"
MONO = "/System/Library/Fonts/SFNSMono.ttf"


def font(size: int, mono: bool = False):
    return ImageFont.truetype(MONO if mono else FONT, size=size)


def text(draw, xy, value, size, fill, *, mono=False, anchor=None, spacing=10):
    draw.multiline_text(
        xy,
        value,
        font=font(size, mono),
        fill=fill,
        anchor=anchor,
        spacing=spacing,
    )


def alta_logo(draw, x, y, size, color=WHITE, width=7):
    """Match src/components/alta-logo.tsx: outlined A with a curved base."""
    def point(px, py):
        return (x + size * px / 100, y + size * py / 100)

    draw.line([point(50, 14), point(84, 84)], fill=color, width=width)
    draw.line([point(50, 14), point(16, 84)], fill=color, width=width)

    curve = []
    for i in range(31):
        t = i / 30
        px = (1 - t) ** 2 * 20 + 2 * (1 - t) * t * 50 + t**2 * 80
        py = (1 - t) ** 2 * 80 + 2 * (1 - t) * t * 60 + t**2 * 80
        curve.append(point(px, py))
    draw.line(curve, fill=color, width=width, joint="curve")

    radius = width // 2
    for px, py in [point(50, 14), point(84, 84), point(16, 84), point(20, 80), point(80, 80)]:
        draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill=color)


def base(color=INK):
    return Image.new("RGB", SIZE, color)


def save(image, name):
    image.save(ROOT / name, quality=96)


def centered_line(draw, y, value, size, fill, *, mono=False):
    face = font(size, mono)
    bbox = draw.textbbox((0, 0), value, font=face)
    width = bbox[2] - bbox[0]
    draw.text(((SIZE[0] - width) / 2 - bbox[0], y), value, font=face, fill=fill)


def screenshot_scene(source_name, title, kicker, *, background=INK, light=False, crop_x=0):
    canvas = base(background)
    shot = Image.open(ROOT / source_name).convert("RGB")
    # Remove UI Lab and mock-data banners.
    shot = shot.crop((0, 60, shot.width, shot.height))
    target_w, target_h = 1600, 933
    scale = max(target_w / shot.width, target_h / shot.height)
    shot = shot.resize((round(shot.width * scale), round(shot.height * scale)), Image.Resampling.LANCZOS)
    left = max(0, (shot.width - target_w) // 2 + crop_x)
    shot = shot.crop((left, 0, left + target_w, target_h))

    # Soft lift behind the application window.
    shadow = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((148, 126, 1772, 1080), radius=28, fill=(0, 0, 0, 120))
    shadow = shadow.filter(ImageFilter.GaussianBlur(26))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), shadow)

    frame = Image.new("RGBA", (1624, 957), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    frame_fill = (248, 249, 247, 255) if light else (13, 15, 18, 255)
    fd.rounded_rectangle((0, 0, 1624, 957), radius=24, fill=frame_fill)
    frame.paste(shot, (12, 12))
    canvas.alpha_composite(frame, (148, 126))

    # Small header above the app; nothing covers the product.
    od = ImageDraw.Draw(canvas)
    text_color = "#050708" if light else WHITE
    alta_logo(od, 148, 42, 55, text_color, 5)
    text(od, (222, 52), "ALTA TERMINAL", 20, text_color, mono=True)
    text(od, (222, 82), kicker.upper(), 14, GREEN, mono=True)
    text(od, (1772, 57), title, 38, text_color, anchor="ra")
    return canvas.convert("RGB")


def render():
    intro = base()
    d = ImageDraw.Draw(intro)
    alta_logo(d, 906, 155, 108, WHITE, 9)
    centered_line(d, 326, "ALTA GROUP PRESENTS", 20, GREEN, mono=True)
    centered_line(d, 455, "THE MARKET", 84, WHITE)
    centered_line(d, 555, "MOVES DIFFERENTLY.", 84, WHITE)
    d.rounded_rectangle((800, 736, 1120, 742), radius=3, fill=GREEN)
    centered_line(d, 805, "INTRODUCING ALTA TERMINAL", 19, MUTED, mono=True)
    save(intro, "scene-01-intro.png")

    save(
        screenshot_scene(
            "terminal-dark.png",
            "See the whole market.",
            "Portfolio",
            background="#080A0B",
        ),
        "scene-02-portfolio-dark.png",
    )

    save(
        screenshot_scene(
            "terminal-light.png",
            "Light. Dark. Your call.",
            "Personal",
            background="#EBEDE8",
            light=True,
        ),
        "scene-03-portfolio-light.png",
    )

    save(
        screenshot_scene(
            "terminal-markets.png",
            "Track every move.",
            "Markets",
            background="#080A0B",
        ),
        "scene-04-markets.png",
    )

    save(
        screenshot_scene(
            "terminal-security.png",
            "From quote to order.",
            "Trading",
            background="#080A0B",
            crop_x=0,
        ),
        "scene-05-order.png",
    )

    outro = base()
    d = ImageDraw.Draw(outro)
    alta_logo(d, 918, 175, 84, WHITE, 7)
    centered_line(d, 340, "ALTA TERMINAL", 26, GREEN, mono=True)
    centered_line(d, 470, "COMING TO NEWPORT", 78, WHITE)
    centered_line(d, 600, "Markets, positions, and orders—without the noise.", 27, MUTED)
    d.rounded_rectangle((760, 735, 1160, 795), radius=30, fill=GREEN)
    button = "POWERED BY ALTA GROUP"
    face = font(17, True)
    bbox = d.textbbox((0, 0), button, font=face)
    d.text((960 - (bbox[2] - bbox[0]) / 2 - bbox[0], 756), button, font=face, fill="#001900")
    save(outro, "scene-06-outro.png")

    # Social/website poster frame.
    save(outro, "alta-terminal-teaser-poster.png")


if __name__ == "__main__":
    render()
