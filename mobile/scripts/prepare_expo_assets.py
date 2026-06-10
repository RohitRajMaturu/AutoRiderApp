from pathlib import Path
from sys import argv

from PIL import Image


def main() -> None:
    if len(argv) != 2:
        raise SystemExit("Usage: python scripts/prepare_expo_assets.py <source-image>")

    source = Path(argv[1]).resolve()
    output_dir = Path(__file__).resolve().parents[1] / "assets" / "images"
    image = Image.open(source).convert("RGBA")

    sizes = {
        "icon.png": (1024, 1024),
        "adaptive-icon.png": (1024, 1024),
        "splash-icon.png": (1024, 1024),
        "favicon.png": (128, 128),
    }
    for filename, size in sizes.items():
        image.resize(size, Image.Resampling.LANCZOS).save(output_dir / filename)
        print(f"wrote {output_dir / filename}")


if __name__ == "__main__":
    main()
