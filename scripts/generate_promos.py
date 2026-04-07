from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ModuleNotFoundError as error:
    raise SystemExit("Missing dependency: Pillow. Install it with `python3 -m pip install Pillow`.") from error


REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "docs" / "final"
ICON_PATH = REPO_ROOT / "icons" / "icon128.png"
PLATFORMS = ["ChatGPT", "Gemini", "Claude", "Doubao"]
PALETTE = {
    "mint_bg_top": (243, 250, 247),
    "mint_bg_bottom": (219, 240, 235),
    "mint_panel": (247, 252, 250),
    "mint_surface": (233, 245, 241),
    "mint_border": (180, 217, 210),
    "mint_border_strong": (136, 198, 187),
    "mint_primary": (126, 203, 197),
    "mint_primary_deep": (92, 168, 200),
    "mint_primary_soft": (168, 221, 215),
    "mint_shadow": (120, 168, 160),
    "text_primary": (44, 62, 80),
    "text_secondary": (104, 129, 140),
    "text_muted": (132, 155, 176),
}

OUT_DIR.mkdir(parents=True, exist_ok=True)


def load_font(size, bold=False):
    font_candidates = [
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Songti.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/segoeui.ttf",
        "C:/Windows/Fonts/arial.ttf",
    ]
    bold_candidates = [
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/System/Library/Fonts/Songti.ttc",
        "/System/Library/Fonts/Helvetica.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "C:/Windows/Fonts/segoeuib.ttf",
        "C:/Windows/Fonts/arialbd.ttf",
    ]

    candidates = bold_candidates if bold else font_candidates
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size)
    return ImageFont.load_default()


def load_icon():
    if ICON_PATH.exists():
        return Image.open(ICON_PATH).convert("RGBA")
    return Image.new("RGBA", (128, 128), (255, 255, 255, 0))


def draw_vertical_gradient(image, top_color, bottom_color):
    draw = ImageDraw.Draw(image)
    width, height = image.size
    for y in range(height):
        ratio = y / max(height - 1, 1)
        color = tuple(
            int(top + (bottom - top) * ratio)
            for top, bottom in zip(top_color, bottom_color)
        )
        draw.line((0, y, width, y), fill=color)


def draw_platform_badges(draw, start_x, y, font):
    current_x = start_x
    for platform in PLATFORMS:
        text_bbox = draw.textbbox((0, 0), platform, font=font)
        badge_width = (text_bbox[2] - text_bbox[0]) + 22
        draw.rounded_rectangle(
            (current_x, y, current_x + badge_width, y + 28),
            radius=14,
            fill=(247, 252, 250),
            outline=PALETTE["mint_border"],
            width=1,
        )
        draw.text(
            (current_x + 11, y + 6),
            platform,
            fill=PALETTE["text_secondary"],
            font=font,
        )
        current_x += badge_width + 10


def draw_chat_bubble(draw, x, y, width, height, fill, outline=None):
    draw.rounded_rectangle((x, y, x + width, y + height), radius=18, fill=fill, outline=outline)
    tail = [(x + 24, y + height - 6), (x + 8, y + height + 10), (x + 40, y + height)]
    draw.polygon(tail, fill=fill)


def draw_arrow_button(draw, center_x, center_y, kind, active=False):
    radius = 19
    fill = PALETTE["mint_panel"] if not active else (255, 255, 255)
    outline = PALETTE["mint_border"] if not active else PALETTE["mint_primary"]
    draw.ellipse(
        (center_x - radius, center_y - radius, center_x + radius, center_y + radius),
        fill=fill,
        outline=outline,
        width=2,
    )

    stroke = PALETTE["text_muted"] if not active else PALETTE["mint_primary_deep"]
    if kind == "double_up":
        polylines = [
            [(center_x - 6, center_y + 1), (center_x, center_y - 5), (center_x + 6, center_y + 1)],
            [(center_x - 6, center_y + 8), (center_x, center_y + 2), (center_x + 6, center_y + 8)],
        ]
    elif kind == "up":
        polylines = [[(center_x - 6, center_y + 3), (center_x, center_y - 3), (center_x + 6, center_y + 3)]]
    elif kind == "down":
        polylines = [[(center_x - 6, center_y - 3), (center_x, center_y + 3), (center_x + 6, center_y - 3)]]
    else:
        polylines = [
            [(center_x - 6, center_y - 8), (center_x, center_y - 2), (center_x + 6, center_y - 8)],
            [(center_x - 6, center_y - 1), (center_x, center_y + 5), (center_x + 6, center_y - 1)],
        ]

    for line in polylines:
        draw.line(line, fill=stroke, width=3, joint="curve")


def draw_mock_sidebar(draw, x, y):
    draw.rounded_rectangle(
        (x, y, x + 58, y + 244),
        radius=28,
        fill=(255, 255, 255),
        outline=PALETTE["mint_border"],
        width=2,
    )

    buttons = [
        ("double_up", False),
        ("up", False),
        ("down", True),
        ("double_down", False),
    ]
    for index, (kind, active) in enumerate(buttons):
        draw_arrow_button(draw, x + 29, y + 38 + index * 48, kind, active=active)

    counter_text = "2 / 9"
    counter_font = load_font(13, bold=True)
    counter_bbox = draw.textbbox((0, 0), counter_text, font=counter_font)
    counter_x = x + (58 - (counter_bbox[2] - counter_bbox[0])) / 2
    draw.text((counter_x, y + 214), counter_text, fill=PALETTE["text_muted"], font=counter_font)


def draw_outline_panel(draw, x, y, width=214, height=246):
    draw.rounded_rectangle(
        (x, y, x + width, y + height),
        radius=22,
        fill=(255, 255, 255),
        outline=PALETTE["mint_border"],
        width=2,
    )
    draw.rounded_rectangle(
        (x + 14, y + 14, x + width - 14, y + 52),
        radius=14,
        fill=(246, 251, 249),
    )
    draw.text((x + 24, y + 24), "Outline", fill=PALETTE["text_primary"], font=load_font(17, bold=True))
    draw.ellipse((x + width - 44, y + 24, x + width - 34, y + 34), fill=PALETTE["mint_border"])
    draw.ellipse((x + width - 28, y + 24, x + width - 18, y + 34), fill=PALETTE["mint_primary_soft"])

    item_y = y + 70
    for index in range(5):
        active = index == 2
        item_fill = (245, 251, 249) if not active else (236, 247, 244)
        item_outline = None if not active else PALETTE["mint_primary_soft"]
        draw.rounded_rectangle(
            (x + 14, item_y, x + width - 14, item_y + 30),
            radius=14,
            fill=item_fill,
            outline=item_outline,
        )
        dot_fill = PALETTE["mint_primary"] if active else PALETTE["mint_border_strong"]
        draw.ellipse((x + 24, item_y + 10, x + 34, item_y + 20), fill=dot_fill)
        line_fill = PALETTE["mint_primary_deep"] if active else (184, 205, 198)
        draw.rounded_rectangle(
            (x + 44, item_y + 9, x + width - 34, item_y + 15),
            radius=3,
            fill=line_fill,
        )
        draw.rounded_rectangle(
            (x + 44, item_y + 18, x + width - 74, item_y + 23),
            radius=2,
            fill=(206, 224, 218),
        )
        item_y += 34


def generate_small_promo(icon):
    image = Image.new("RGB", (440, 280), PALETTE["mint_bg_top"])
    draw_vertical_gradient(image, PALETTE["mint_bg_top"], PALETTE["mint_bg_bottom"])
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((28, 28, 412, 252), radius=34, fill=(255, 255, 255), outline=PALETTE["mint_border"], width=1)
    draw.ellipse((90, 18, 350, 232), fill=(228, 244, 239))
    draw.ellipse((126, 42, 314, 206), fill=(213, 238, 231))

    icon_resized = icon.resize((110, 110), Image.Resampling.LANCZOS)
    image.paste(icon_resized, (62, 54), icon_resized)

    draw_mock_sidebar(draw, 334, 48)

    eyebrow_font = load_font(16, bold=True)
    title_font = load_font(31, bold=True)
    feature_font = load_font(15, bold=True)
    body_font = load_font(16)
    badge_font = load_font(13)

    draw.text((186, 60), "CHATDOT", fill=PALETTE["mint_primary_deep"], font=eyebrow_font)
    draw.text((186, 82), "AI 对话导航", fill=PALETTE["text_primary"], font=title_font)
    draw.text(
        (186, 124),
        "长对话不再来回翻找\n右侧一栏，直接跳到目标提问",
        fill=PALETTE["text_secondary"],
        font=body_font,
        spacing=6,
    )
    draw.text((60, 188), "箭头侧栏", fill=PALETTE["mint_primary_deep"], font=feature_font)
    draw.text((144, 188), "•", fill=PALETTE["mint_border_strong"], font=feature_font)
    draw.text((158, 188), "消息大纲", fill=PALETTE["mint_primary_deep"], font=feature_font)
    draw.text((246, 188), "•", fill=PALETTE["mint_border_strong"], font=feature_font)
    draw.text((260, 188), "悬浮预览", fill=PALETTE["mint_primary_deep"], font=feature_font)
    draw.rounded_rectangle((60, 214, 280, 242), radius=14, fill=(247, 252, 250), outline=PALETTE["mint_border"], width=1)
    draw.text((74, 220), "更多平台逐步接入中", fill=PALETTE["text_secondary"], font=badge_font)

    output_path = OUT_DIR / "small_promo.jpg"
    image.save(output_path, quality=95)
    return output_path


def generate_marquee_promo(icon):
    image = Image.new("RGB", (1400, 560), PALETTE["mint_bg_top"])
    draw_vertical_gradient(image, (244, 251, 248), (220, 240, 235))
    draw = ImageDraw.Draw(image)

    draw.ellipse((620, -120, 1380, 560), fill=(233, 246, 242))
    draw.ellipse((860, 90, 1460, 620), fill=(210, 236, 229))
    draw.rounded_rectangle((64, 64, 648, 496), radius=40, fill=(255, 255, 255), outline=PALETTE["mint_border"], width=1)

    icon_large = icon.resize((104, 104), Image.Resampling.LANCZOS)
    image.paste(icon_large, (124, 104), icon_large)

    title_font = load_font(76, bold=True)
    headline_font = load_font(38, bold=True)
    subtitle_font = load_font(28)
    badge_font = load_font(18)
    eyebrow_font = load_font(18, bold=True)
    feature_font = load_font(24, bold=True)

    draw.text((126, 90), "LIGHT MINT NAVIGATION", fill=PALETTE["mint_primary_deep"], font=eyebrow_font)
    draw.text((244, 110), "ChatDot", fill=PALETTE["text_primary"], font=title_font)
    draw.text((128, 214), "长对话不再翻找", fill=PALETTE["text_primary"], font=headline_font)
    draw.text(
        (128, 262),
        "箭头侧栏精准跳转，打开大纲快速定位，\n悬浮预览不丢上下文。",
        fill=PALETTE["text_secondary"],
        font=subtitle_font,
        spacing=6,
    )
    draw.text(
        (128, 336),
        "箭头导航  •  消息大纲  •  悬浮预览",
        fill=PALETTE["text_muted"],
        font=feature_font,
    )
    draw_platform_badges(draw, 128, 388, badge_font)

    ui_x, ui_y = 760, 74
    ui_w, ui_h = 564, 412
    draw.rounded_rectangle(
        (ui_x, ui_y, ui_x + ui_w, ui_y + ui_h),
        radius=28,
        fill=PALETTE["mint_panel"],
        outline=PALETTE["mint_border"],
        width=2,
    )
    draw.rounded_rectangle(
        (ui_x + 24, ui_y + 20, ui_x + ui_w - 24, ui_y + 54),
        radius=17,
        fill=(255, 255, 255),
    )
    for dot_x in (ui_x + 44, ui_x + 60, ui_x + 76):
        draw.ellipse((dot_x, ui_y + 31, dot_x + 8, ui_y + 39), fill=PALETTE["mint_border_strong"])

    bubble_specs = [
        (ui_x + 34, ui_y + 82, 286, 52, (224, 241, 236), None),
        (ui_x + 188, ui_y + 156, 262, 52, (255, 255, 255), PALETTE["mint_border"]),
        (ui_x + 34, ui_y + 236, 320, 52, (224, 241, 236), None),
        (ui_x + 164, ui_y + 310, 300, 52, (255, 255, 255), PALETTE["mint_border"]),
    ]
    for x, y, width, height, fill, outline in bubble_specs:
        draw_chat_bubble(draw, x, y, width, height, fill, outline=outline)

    highlight_x = ui_x + 158
    highlight_y = ui_y + 304
    draw.rounded_rectangle(
        (highlight_x - 10, highlight_y - 10, highlight_x + 324, highlight_y + 68),
        radius=24,
        outline=PALETTE["mint_primary"],
        width=3,
    )
    draw.rounded_rectangle(
        (highlight_x - 2, highlight_y - 2, highlight_x + 316, highlight_y + 60),
        radius=20,
        outline=PALETTE["mint_primary_soft"],
        width=2,
    )

    preview_x, preview_y = ui_x + 18, ui_y + 286
    draw.rounded_rectangle(
        (preview_x, preview_y, preview_x + 230, preview_y + 82),
        radius=18,
        fill=(255, 255, 255),
        outline=PALETTE["mint_border"],
        width=2,
    )
    draw.text((preview_x + 16, preview_y + 14), "Preview", fill=PALETTE["text_muted"], font=load_font(14, bold=True))
    draw.text(
        (preview_x + 16, preview_y + 38),
        "Jump to the previous user prompt\nwithout losing context.",
        fill=PALETTE["text_secondary"],
        font=load_font(18),
        spacing=4,
    )
    draw.polygon(
        [(preview_x + 230, preview_y + 36), (preview_x + 248, preview_y + 46), (preview_x + 230, preview_y + 56)],
        fill=(255, 255, 255),
        outline=PALETTE["mint_border"],
    )

    draw_outline_panel(draw, ui_x + ui_w - 308, ui_y + 98)
    draw_mock_sidebar(draw, ui_x + ui_w - 78, ui_y + 86)

    output_path = OUT_DIR / "marquee_promo.jpg"
    image.save(output_path, quality=95)
    return output_path


def main():
    icon = load_icon()
    small_path = generate_small_promo(icon)
    marquee_path = generate_marquee_promo(icon)

    print(f"Generated: {small_path}")
    print(f"Generated: {marquee_path}")


if __name__ == "__main__":
    main()
