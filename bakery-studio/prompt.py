"""Compose the image-editing instruction from a style definition."""

REFERENCE = (
    "You are given two images. The FIRST image is my product photo. The SECOND image "
    "is a STYLE REFERENCE ONLY: match its background color and material, lighting "
    "direction and softness, shadows, depth, how small the product sits in the frame, "
    "and its color grade as closely as possible - but do NOT copy its pastries or any "
    "object from it. The result must show only the product from the FIRST image.\n\n"
)

BASE = (
    "Transform this photo into a professional, high-end food photograph of the same "
    "baked good, as if it were re-shot by a top commercial food photographer on a "
    "styled studio set.\n\n"
    "PRESERVE THE PRODUCT EXACTLY: keep the identical bread/pastry - same shape, size "
    "proportions, scoring pattern, crust color and texture, crumb, glaze, toppings, "
    "seeds, fillings and number of pieces. Do not invent, remove or redesign any part "
    "of the product. Only the set, lighting, camera and color grading change.\n\n"
)

# Product-type presets: key -> (Hebrew label, framing instruction)
PRODUCT_TYPES = {
    "": ("כללי", ""),
    "loaf": (
        "כיכר גדולה",
        "Large loaf: show the ENTIRE loaf uncropped, centered, about 45% of the frame "
        "width, generous empty space on all sides. Camera slightly elevated (~15 "
        "degrees) so the scoring on top is visible. Flour dusting stays ON the crust "
        "only, never on the surface around it. Not a close-up.",
    ),
    "small": (
        "מאפה קטן",
        "Small pastry: show the ENTIRE pastry uncropped, centered, about 30-35% of the "
        "frame width with lots of empty space around it. Eye-level side view so the "
        "layers are visible. Keep true-to-life scale - do not enlarge it to fill the "
        "frame.",
    ),
    "filled": (
        "מאפה עם פירות או קרם",
        "Pastry with fruit or cream: do not add, remove or move any fruit, cream or "
        "topping. Show the ENTIRE pastry uncropped, centered, about 35% of the frame "
        "width with lots of empty space. Camera slightly elevated (~20 degrees) so the "
        "filling is visible. Fruit keeps natural vivid color while the background "
        "stays muted.",
    ),
}

QUALITY = (
    "\n\nMake it look delicious and appetizing: crisp crust texture, visible flaky "
    "layers or open crumb where present, natural glossy highlights, fresh-from-the-oven "
    "feel. Photorealistic, sharp focus on the product, natural color, clean "
    "composition, magazine / advertising quality. No text, no watermark, no logos, "
    "no hands, no people, no artificial or plastic look."
)


def build_prompt(style, notes="", product_type="", has_reference=False):
    lines = [
        ("Product framing", PRODUCT_TYPES.get(product_type, PRODUCT_TYPES[""])[1]),
        ("Set / surface", style.get("surface")),
        ("Lighting", style.get("lighting")),
        ("Props & styling", style.get("props")),
        ("Camera", style.get("camera")),
        ("Mood & color grade", style.get("mood")),
        ("Additional direction", style.get("extra")),
        ("Notes for this photo", notes),
    ]
    body = "\n".join(f"- {label}: {value.strip()}" for label, value in lines
                     if value and value.strip())
    return (REFERENCE if has_reference else "") + BASE + "STYLE:\n" + body + QUALITY
