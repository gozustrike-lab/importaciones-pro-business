import os
import urllib.request
import io
from PIL import Image, ImageDraw, ImageFont

def draw_banner_on_image(input_img_path, output_img_path, title, subtitle, badge_text="TIKTOK LIVE", badge_color=(16, 185, 129)):
    """
    Overlays a sleek, professional e-commerce product banner on the image.
    Canvas: 800x800 square, perfectly formatted for WhatsApp catalogs, TikTok Live, and PDF print.
    """
    if input_img_path.startswith("http://") or input_img_path.startswith("https://"):
        req = urllib.request.Request(input_img_path, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            raw = Image.open(io.BytesIO(resp.read()))
    else:
        raw = Image.open(input_img_path)

    raw = raw.convert("RGBA")
    w, h = raw.size

    target_w, target_h = 800, 800
    canvas = Image.new("RGBA", (target_w, target_h), (255, 255, 255, 255))

    # Scale image nicely into top area
    max_img_h = target_h - 130
    scale = min((target_w - 60) / w, max_img_h / h)
    new_w, new_h = int(w * scale), int(h * scale)
    im_resized = raw.resize((new_w, new_h), Image.Resampling.LANCZOS)

    pos_x = (target_w - new_w) // 2
    pos_y = (max_img_h - new_h) // 2 + 15
    canvas.paste(im_resized, (pos_x, pos_y), im_resized)

    # Draw bottom banner
    draw = ImageDraw.Draw(canvas)
    banner_h = 92
    banner_y = target_h - banner_h

    # Deep dark slate bar
    draw.rectangle([0, banner_y, target_w, target_h], fill=(15, 23, 42, 248))
    # Emerald accent top highlight bar
    draw.rectangle([0, banner_y, target_w, banner_y + 4], fill=badge_color)

    # Fonts
    font_paths = [
        "C:\\Windows\\Fonts\\segoeuib.ttf",
        "C:\\Windows\\Fonts\\arialbd.ttf",
        "C:\\Windows\\Fonts\\arial.ttf"
    ]
    font_title = None
    font_sub = None
    font_badge = None

    for fp in font_paths:
        if os.path.exists(fp):
            try:
                font_title = ImageFont.truetype(fp, 24)
                font_sub = ImageFont.truetype(fp, 15)
                font_badge = ImageFont.truetype(fp, 14)
                break
            except:
                pass

    if not font_title:
        font_title = ImageFont.load_default()
        font_sub = font_title
        font_badge = font_title

    # Draw title and subtitle
    draw.text((24, banner_y + 16), title.upper(), fill=(255, 255, 255), font=font_title)
    draw.text((24, banner_y + 52), subtitle, fill=(148, 163, 184), font=font_sub)

    # Draw right pill badge
    badge_w = 150
    badge_x = target_w - badge_w - 20
    badge_y = banner_y + 24
    draw.rounded_rectangle([badge_x, badge_y, badge_x + badge_w, badge_y + 42], radius=6, fill=badge_color)
    draw.text((badge_x + 16, badge_y + 11), badge_text, fill=(15, 23, 42), font=font_badge)

    os.makedirs(os.path.dirname(os.path.abspath(output_img_path)), exist_ok=True)
    canvas.convert("RGB").save(output_img_path, "PNG", optimize=True)
    print(f"Generated: {output_img_path}")

if __name__ == "__main__":
    draw_banner_on_image(
        "test_ipad129.jpg",
        "test_banner_ipad129.png",
        "Apple iPad Pro 12.9\" Retina",
        "256GB • 120Hz ProMotion • Chip A10X",
        "TIKTOK LIVE",
        (16, 185, 129)
    )
