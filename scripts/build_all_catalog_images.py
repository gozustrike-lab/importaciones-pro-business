import os
import shutil
from PIL import Image, ImageDraw, ImageFont

CATALOG_DIR = os.path.abspath("public/catalog")
os.makedirs(CATALOG_DIR, exist_ok=True)

def create_banner_card(source_img_path, output_path, title, subtitle, badge_text="TIKTOK LIVE", badge_color=(16, 185, 129)):
    """
    Renders an 800x800 high-res card with the centered product image
    and an elegant dark banner with model name across the bottom.
    """
    raw = Image.open(source_img_path).convert("RGBA")
    w, h = raw.size

    target_w, target_h = 800, 800
    canvas = Image.new("RGBA", (target_w, target_h), (255, 255, 255, 255))

    # Scale image to fit inside top area
    max_img_h = target_h - 130
    scale = min((target_w - 60) / w, max_img_h / h)
    new_w, new_h = int(w * scale), int(h * scale)
    im_resized = raw.resize((new_w, new_h), Image.Resampling.LANCZOS)

    pos_x = (target_w - new_w) // 2
    pos_y = (max_img_h - new_h) // 2 + 15
    canvas.paste(im_resized, (pos_x, pos_y), im_resized)

    # Bottom banner
    draw = ImageDraw.Draw(canvas)
    banner_h = 92
    banner_y = target_h - banner_h

    # Deep slate navy bar
    draw.rectangle([0, banner_y, target_w, target_h], fill=(15, 23, 42, 250))
    # Accent top border
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
                font_title = ImageFont.truetype(fp, 23)
                font_sub = ImageFont.truetype(fp, 15)
                font_badge = ImageFont.truetype(fp, 14)
                break
            except:
                pass

    if not font_title:
        font_title = ImageFont.load_default()
        font_sub = font_title
        font_badge = font_title

    # Draw Title & Subtitle
    draw.text((24, banner_y + 16), title.upper(), fill=(255, 255, 255), font=font_title)
    draw.text((24, banner_y + 52), subtitle, fill=(148, 163, 184), font=font_sub)

    # Badge pill on right
    badge_w = 150
    badge_x = target_w - badge_w - 20
    badge_y = banner_y + 24
    draw.rounded_rectangle([badge_x, badge_y, badge_x + badge_w, badge_y + 42], radius=6, fill=badge_color)
    draw.text((badge_x + 16, badge_y + 11), badge_text, fill=(15, 23, 42), font=font_badge)

    canvas.convert("RGB").save(output_path, "PNG", optimize=True)
    print(f"[OK Banner] -> {os.path.basename(output_path)}")

def save_clean_image(source_img_path, output_path):
    """Saves secondary slots as clean PNGs."""
    raw = Image.open(source_img_path)
    if raw.mode != "RGB" and raw.mode != "RGBA":
        raw = raw.convert("RGBA")
    raw.save(output_path, "PNG", optimize=True)
    print(f"[OK Slot] -> {os.path.basename(output_path)}")

def main():
    print("Generating comprehensive catalog images with model banners...")

    # 1. iPad Pro 12.9" 2nd Gen (A1670)
    create_banner_card(
        "test_ipad129.jpg",
        os.path.join(CATALOG_DIR, "ipad-pro-129-1.png"),
        "Apple iPad Pro 12.9\" Retina",
        "256GB • 120Hz ProMotion • Chip A10X Fusion",
        "TIKTOK LIVE",
        (16, 185, 129)
    )
    shutil.copyfile(os.path.join(CATALOG_DIR, "ipad-pro-129-1.png"), os.path.join(CATALOG_DIR, "ipad-pro-129.png"))
    save_clean_image("test_ipad129_cv11d.jpg", os.path.join(CATALOG_DIR, "ipad-pro-129-2.png"))
    save_clean_image("test_greenfox.jpg", os.path.join(CATALOG_DIR, "ipad-pro-129-3.png"))

    # 2. iPad Mini 5 (A2133 / A2124)
    create_banner_card(
        "test_ipadmini5_sd.jpg",
        os.path.join(CATALOG_DIR, "ipad-mini-5-1.png"),
        "Apple iPad Mini 5 (256GB WiFi)",
        "Retina 7.9\" • Chip A12 Bionic • + Mica de Pantalla",
        "S/ 1,200 PEN",
        (16, 185, 129)
    )
    shutil.copyfile(os.path.join(CATALOG_DIR, "ipad-mini-5-1.png"), os.path.join(CATALOG_DIR, "ipad-mini-5.png"))
    save_clean_image("test_ipadmini5cv11d.jpg", os.path.join(CATALOG_DIR, "ipad-mini-5-2.png"))
    save_clean_image("test_ipadmini5_bd.jpg", os.path.join(CATALOG_DIR, "ipad-mini-5-3.png"))

    # 3. iPad Pro 10.5" (A1701 / A1709)
    create_banner_card(
        os.path.join(CATALOG_DIR, "ipad-pro-105-1.png"),
        os.path.join(CATALOG_DIR, "ipad-pro-105-1.png"),
        "Apple iPad Pro 10.5\" Retina",
        "120Hz ProMotion • WiFi S/950 | Con Chip 4G S/1,050",
        "OFERTA LIVE",
        (16, 185, 129)
    )
    shutil.copyfile(os.path.join(CATALOG_DIR, "ipad-pro-105-1.png"), os.path.join(CATALOG_DIR, "ipad-pro-105.png"))
    save_clean_image("test_ipad105_amazon.jpg", os.path.join(CATALOG_DIR, "ipad-pro-105-2.png"))
    save_clean_image(os.path.join(CATALOG_DIR, "ipad-pro-105-2.png"), os.path.join(CATALOG_DIR, "ipad-pro-105-3.png"))

    # 4. iPad 9na Gen 10.2" (A2602 / A2603)
    create_banner_card(
        "test_ipad9__sd.jpg",
        os.path.join(CATALOG_DIR, "ipad-9-1.png"),
        "Apple iPad 9na Gen 10.2\" Retina",
        "Chip A13 Bionic • 64GB • Cámara Ultra Wide 12MP",
        "TIKTOK LIVE",
        (16, 185, 129)
    )
    shutil.copyfile(os.path.join(CATALOG_DIR, "ipad-9-1.png"), os.path.join(CATALOG_DIR, "ipad-9.png"))
    save_clean_image("test_ipad9_cv11d.jpg", os.path.join(CATALOG_DIR, "ipad-9-2.png"))
    save_clean_image("test_ipad9__sd.jpg", os.path.join(CATALOG_DIR, "ipad-9-3.png"))

    # 5. Dell Latitude 3330 (Core i5 11va Gen)
    create_banner_card(
        os.path.join(CATALOG_DIR, "dell-latitude-3330-1.png"),
        os.path.join(CATALOG_DIR, "dell-latitude-3330-1.png"),
        "Laptop Dell Latitude 3330 FHD",
        "Intel Core i5 11va Gen • 8GB RAM • 256GB SSD",
        "TIKTOK LIVE",
        (16, 185, 129)
    )
    shutil.copyfile(os.path.join(CATALOG_DIR, "dell-latitude-3330-1.png"), os.path.join(CATALOG_DIR, "dell-latitude-3330.png"))
    save_clean_image("test_dell_lid.png", os.path.join(CATALOG_DIR, "dell-latitude-3330-2.png"))
    save_clean_image("test_dell_kb.png", os.path.join(CATALOG_DIR, "dell-latitude-3330-3.png"))

    # 6. MacBook Pro 16" Touch Bar (A2141)
    create_banner_card(
        os.path.join(CATALOG_DIR, "macbook-pro-16-1.png"),
        os.path.join(CATALOG_DIR, "macbook-pro-16-1.png"),
        "Apple MacBook Pro 16\" Touch Bar",
        "Intel Core i7 • 16GB RAM • 512GB SSD • 6 Parlantes",
        "TIKTOK LIVE",
        (16, 185, 129)
    )
    shutil.copyfile(os.path.join(CATALOG_DIR, "macbook-pro-16-1.png"), os.path.join(CATALOG_DIR, "macbook-pro-16.png"))

    # 7. MacBook Pro 15.4" Touch Bar (A1990)
    create_banner_card(
        os.path.join(CATALOG_DIR, "macbook-pro-15-1.png"),
        os.path.join(CATALOG_DIR, "macbook-pro-15-1.png"),
        "Apple MacBook Pro 15.4\" Touch Bar",
        "Intel Core i7 6-Core • 16GB RAM • 512GB SSD",
        "TIKTOK LIVE",
        (16, 185, 129)
    )
    shutil.copyfile(os.path.join(CATALOG_DIR, "macbook-pro-15-1.png"), os.path.join(CATALOG_DIR, "macbook-pro-15.png"))

    # 8. MacBook Pro 13.3" Touch Bar (A2251 / A2159)
    create_banner_card(
        os.path.join(CATALOG_DIR, "macbook-pro-13-1.png"),
        os.path.join(CATALOG_DIR, "macbook-pro-13-1.png"),
        "Apple MacBook Pro 13.3\" Touch Bar",
        "Retina Display True Tone • Touch ID • Thunderbolt 3",
        "TIKTOK LIVE",
        (16, 185, 129)
    )
    shutil.copyfile(os.path.join(CATALOG_DIR, "macbook-pro-13-1.png"), os.path.join(CATALOG_DIR, "macbook-pro-13.png"))

    # 9. iPad Air 3ra Gen (A2152 / A2153)
    create_banner_card(
        os.path.join(CATALOG_DIR, "ipad-air-3-1.png"),
        os.path.join(CATALOG_DIR, "ipad-air-3-1.png"),
        "Apple iPad Air 3ra Gen 10.5\"",
        "Chip Apple A12 Bionic • 256GB • Pantalla True Tone",
        "TIKTOK LIVE",
        (16, 185, 129)
    )
    shutil.copyfile(os.path.join(CATALOG_DIR, "ipad-air-3-1.png"), os.path.join(CATALOG_DIR, "ipad-air-3.png"))

    # 10. Apple Cargador 96W USB-C
    create_banner_card(
        os.path.join(CATALOG_DIR, "charger-96w-2.png"),
        os.path.join(CATALOG_DIR, "charger-96w-1.png"),
        "Cargador Original Apple 96W USB-C",
        "Power Adapter • Carga Rápida • Original Garantizado",
        "TIKTOK LIVE",
        (16, 185, 129)
    )
    shutil.copyfile(os.path.join(CATALOG_DIR, "charger-96w-1.png"), os.path.join(CATALOG_DIR, "charger-96w.png"))

    print("\nAll catalog images successfully updated and branded!")

if __name__ == "__main__":
    main()
