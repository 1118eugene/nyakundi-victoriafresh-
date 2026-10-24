from pathlib import Path

from PIL import Image, ImageOps


root = Path(__file__).resolve().parents[1]
image_root = root / "public" / "images"
output_root = image_root / "optimized"
raster_formats = {".jpg", ".jpeg", ".png"}
maximum_dimensions = (1920, 1920)
quality = 82
original_bytes = 0
optimized_bytes = 0
processed = 0

for source in image_root.rglob("*"):
    if not source.is_file() or source.suffix.lower() not in raster_formats:
        continue
    if output_root in source.parents:
        continue

    relative_path = source.relative_to(image_root)
    output = output_root / relative_path.with_suffix(".webp")
    output.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original)
        image.thumbnail(maximum_dimensions, Image.Resampling.LANCZOS)
        image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
        image.save(output, "WEBP", quality=quality, method=6)

    original_bytes += source.stat().st_size
    optimized_bytes += output.stat().st_size
    processed += 1

if processed == 0:
    raise SystemExit("No source raster images were found.")

reduction = (1 - optimized_bytes / original_bytes) * 100
print(
    f"Created {processed} WebP copies: {original_bytes / 1024 / 1024:.2f} MB "
    f"to {optimized_bytes / 1024 / 1024:.2f} MB ({reduction:.1f}% smaller). "
    "Original images were preserved."
)
