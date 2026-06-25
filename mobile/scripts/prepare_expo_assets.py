from pathlib import Path
from sys import argv

from PIL import Image


def main() -> None:
    if len(argv) != 2:
        raise SystemExit("Usage: python scripts/prepare_expo_assets.py <source-image>")

    source = Path(argv[1]).resolve()
    output_dir = Path(__file__).resolve().parents[1] / "assets" / "images"
    image = Image.open(source).convert("RGBA")

    output = output_dir / "icon.png"
    image.resize((1024, 1024), Image.Resampling.LANCZOS).save(output)
    print(f"wrote {output}")


if __name__ == "__main__":
    main()
