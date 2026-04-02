import os
from PIL import Image, ImageDraw, ImageFont

# Output directory targeting docs/final
out_dir = r"g:\vibe\chatdot\docs\final"
os.makedirs(out_dir, exist_ok=True)

# Find Microsoft YaHei font for Windows
font_path = r"C:\Windows\Fonts\msyh.ttf"
bold_font_path = r"C:\Windows\Fonts\msyhbd.ttf"
if not os.path.exists(font_path):
    font_path = None
    bold_font_path = None

icon_path = r"g:\vibe\chatdot\icons\icon128.png"
if os.path.exists(icon_path):
    try:
        icon = Image.open(icon_path).convert("RGBA")
    except:
        icon = Image.new("RGBA", (128, 128), (255, 255, 255, 0))
else:
    icon = Image.new("RGBA", (128, 128), (255, 255, 255, 0))

########################################
# 1. Small Promo Tile (440x280)
########################################
# Background: High saturation deep tech blue 
small = Image.new("RGB", (440, 280), (15, 35, 75))
draw_small = ImageDraw.Draw(small)

# Draw a subtle glow/circle in the center
draw_small.ellipse((120, 40, 320, 240), fill=(25, 55, 105))

# Paste the icon centered
if icon:
    icon_resized = icon.resize((140, 140), Image.Resampling.LANCZOS)
    small.paste(icon_resized, (440//2 - 70, 280//2 - 70), icon_resized)

small_path = os.path.join(out_dir, "small_promo.jpg")
small.save(small_path, quality=95)
print(f"Generated: {small_path}")

########################################
# 2. Marquee Promo Tile (1400x560)
########################################
# Background: Deep dark slate for geek/tech vibe
marquee = Image.new("RGB", (1400, 560), (10, 15, 30))
draw = ImageDraw.Draw(marquee)

# Draw a large subtle geometric shape (tech feel)
draw.polygon([(800, 0), (1400, 0), (1400, 560), (600, 560)], fill=(15, 25, 45))

# Load fonts
font_large = None
font_small = None
if bold_font_path:
    font_large = ImageFont.truetype(bold_font_path, 100)
    font_small = ImageFont.truetype(font_path, 42)
else:
    font_large = ImageFont.load_default()
    font_small = ImageFont.load_default()

# Draw title text & Slogan securely
title_x, title_y = 200, 220
draw.text((title_x, title_y), "ChatDot", fill=(255, 255, 255), font=font_large)

slogan_text = "流畅穿梭你的 AI 对话"
slogan_y = title_y + 130
draw.text((title_x + 8, slogan_y), slogan_text, fill=(160, 180, 210), font=font_small)

# Draw an abstract representation of the Chat UI + the Sidebar Navigation on the right side
ui_x, ui_y = 750, 80
ui_w, ui_h = 550, 400
# Main UI Window frame
draw.rounded_rectangle((ui_x, ui_y, ui_x + ui_w, ui_y + ui_h), radius=16, fill=(20, 30, 50), outline=(40, 60, 90), width=3)

# Abstract chat bubbles
for i in range(4):
    b_y = ui_y + 40 + i * 80
    b_w = 280 if i % 2 == 0 else 380
    # Alternating Left (Bot) and Right (User)
    b_x = ui_x + 30 if i % 2 == 1 else (ui_x + ui_w - b_w - 90)
    b_color = (30, 45, 70) if i % 2 == 1 else (45, 110, 200) # User bubble is brighter blue
    draw.rounded_rectangle((b_x, b_y, b_x + b_w, b_y + 50), radius=12, fill=b_color)

# Highlight effect on a user bubble (like the plugin feature)
highlight_y = ui_y + 40 + 2 * 80 # The 3rd bubble
draw.rounded_rectangle((ui_x + ui_w - 280 - 90 - 4, highlight_y - 4, ui_x + ui_w - 90 + 4, highlight_y + 54), radius=14, outline=(100, 200, 255), width=2)

# Abstract Navigation Sidebar over the right edge
nav_x, nav_y = ui_x + ui_w - 60, ui_y + 20
nav_w, nav_h = 50, 360
draw.rounded_rectangle((nav_x, nav_y, nav_x + nav_w, nav_y + nav_h), radius=10, fill=(15, 25, 45), outline=(59, 130, 246), width=2)

# Navigation nodes (dots) inside the sidebar
for i in range(5):
    dot_y = nav_y + 40 + i * 60
    d_color = (200, 220, 255) if i == 2 else (60, 90, 130)  # Highlight the active node corresponding to the bubble
    draw.ellipse((nav_x + 18, dot_y, nav_x + 32, dot_y + 14), fill=d_color)

# Paste icon next to the title
if icon:
    icon_m = icon.resize((96, 96), Image.Resampling.LANCZOS)
    marquee.paste(icon_m, (title_x - 120, title_y + 10), icon_m)

marquee_path = os.path.join(out_dir, "marquee_promo.jpg")
marquee.save(marquee_path, quality=95)
print(f"Generated: {marquee_path}")
