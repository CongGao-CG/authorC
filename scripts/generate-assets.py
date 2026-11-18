"""Render authorC's existing C mark and store artwork from vector primitives."""

from pathlib import Path
import os
import tempfile

os.environ.setdefault("MPLCONFIGDIR", str(Path(tempfile.gettempdir()) / "authorc-matplotlib"))

import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.font_manager import FontProperties
from matplotlib.patches import Circle, PathPatch
from matplotlib.textpath import TextPath
from matplotlib.transforms import Affine2D
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
STORE = ROOT / "store" / "assets"
GREEN = "#254e42"
DEEP_GREEN = "#1e4036"
CREAM = "#f6f0d8"
SAGE = "#a8c1a6"
FONTS = Path("/System/Library/Fonts/Supplemental")
SERIF = FontProperties(fname=str(FONTS / "Georgia Bold.ttf"))
SANS = FontProperties(fname=str(FONTS / "Arial.ttf"))
BOLD = FontProperties(fname=str(FONTS / "Arial Bold.ttf"))

matplotlib.rcParams.update({"svg.fonttype": "path", "svg.hashsalt": "authorc-brand-v1"})


def canvas(width, height, background=None):
    figure = plt.figure(figsize=(width / 100, height / 100), dpi=100)
    axes = figure.add_axes((0, 0, 1, 1))
    axes.set(xlim=(0, width), ylim=(height, 0))
    axes.axis("off")
    if background:
        figure.patch.set_facecolor(background)
    return figure, axes


def lettering(axes, text, x, y, size, color, font=SANS, center=False):
    path = TextPath((0, 0), text, size=size, prop=font)
    bounds = path.get_extents()
    if center:
        x -= bounds.width / 2
        y -= bounds.height / 2
    transform = Affine2D().scale(1, -1).translate(x - bounds.xmin, y + bounds.ymax)
    axes.add_patch(PathPatch(path, facecolor=color, linewidth=0, transform=transform + axes.transData))


def mark(axes, x, y, diameter, inverse=False):
    fill, letter = (CREAM, GREEN) if inverse else (GREEN, CREAM)
    axes.add_patch(Circle((x, y), diameter / 2, facecolor=fill, edgecolor=CREAM, linewidth=diameter / 112 * 0.7))
    lettering(axes, "C", x, y, diameter * 0.68, letter, SERIF, center=True)


def save(figure, destination, transparent=False):
    metadata = {"Date": None} if destination.suffix == ".svg" else {"Software": "authorC vector asset renderer"}
    figure.savefig(destination, dpi=100, transparent=transparent, pad_inches=0, metadata=metadata)
    if destination.suffix == ".png" and not transparent:
        with Image.open(destination) as rendered:
            rendered.convert("RGB").save(destination)


def icons():
    for size in (16, 32, 48, 128):
        figure, axes = canvas(size, size)
        mark(axes, size / 2, size / 2, size * 0.875)
        save(figure, ASSETS / f"icon-{size}.png", transparent=True)
        if size == 128:
            save(figure, ASSETS / "authorc-logo.svg", transparent=True)
            save(figure, STORE / "store-icon-128.png", transparent=True)
        plt.close(figure)


def small_promo():
    figure, axes = canvas(440, 280, DEEP_GREEN)
    axes.add_patch(Circle((449, 286), 118, facecolor="none", edgecolor="#345b4b", linewidth=1.0))
    axes.add_patch(Circle((449, 286), 145, facecolor="none", edgecolor="#345b4b", linewidth=0.7))
    mark(axes, 70, 71, 55, inverse=True)
    lettering(axes, "authorC", 113, 53, 42, CREAM, BOLD)
    lettering(axes, "Career citations.", 44, 149, 28, CREAM, BOLD)
    lettering(axes, "Alongside your reading.", 44, 190, 22, SAGE)
    save(figure, STORE / "promo-small-440x280.png")
    save(figure, STORE / "promo-small-440x280.svg")
    plt.close(figure)


def marquee():
    figure, axes = canvas(1400, 560, DEEP_GREEN)
    for radius, width in ((245, 1.2), (285, 1.0), (325, 0.7)):
        axes.add_patch(Circle((1445, 580), radius, facecolor="none", edgecolor="#345b4b", linewidth=width))
    mark(axes, 225, 270, 210, inverse=True)
    lettering(axes, "authorC", 395, 166, 112, CREAM, BOLD)
    lettering(axes, "Career citations.", 401, 302, 44, CREAM, BOLD)
    lettering(axes, "Alongside your reading.", 401, 365, 38, SAGE)
    save(figure, STORE / "promo-marquee-1400x560.png")
    save(figure, STORE / "promo-marquee-1400x560.svg")
    plt.close(figure)


if __name__ == "__main__":
    ASSETS.mkdir(exist_ok=True)
    STORE.mkdir(parents=True, exist_ok=True)
    icons()
    small_promo()
    marquee()
    print("Rendered extension icons, store icon, and two promotional graphics.")
