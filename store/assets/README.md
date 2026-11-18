# Store graphics

These assets extend authorC's existing green-and-cream C mark. The two promotional graphics are branding artwork, not screenshots of the extension.

| File | Use | Size |
| --- | --- | --- |
| `store-icon-128.png` | Store icon; transparent background | 128 × 128 |
| `promo-small-440x280.png` | Optional small promotional tile; RGB PNG | 440 × 280 |
| `promo-marquee-1400x560.png` | Optional marquee promotional image; RGB PNG | 1400 × 560 |

The SVG files are editable vector sources with lettering outlined so they do not depend on fonts when opened. The matching extension icons are in `assets/icon-{16,32,48,128}.png`. The 128-pixel icon uses an approximately 112-pixel circle with transparent padding.

Dimensions follow [Chrome's image specifications](https://developer.chrome.com/docs/webstore/images). At least one actual extension screenshot is still required; promotional artwork does not replace it.

Regenerate on this Mac with the existing TC26 environment:

```sh
/Users/cg6622/miniconda3/envs/TC26/bin/python scripts/generate-assets.py
```

The renderer uses installed matplotlib/Pillow and macOS Georgia/Arial fonts. It generates both SVG and PNG directly from vector primitives and does not modify user screenshots.
