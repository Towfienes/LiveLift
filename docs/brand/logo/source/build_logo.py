"""Builds the LiveLift logo files (SVG, text converted to outlines) from Be Vietnam Pro Medium.
Run:  python3 build_logo.py   (needs fonttools + brotli; writes next to this file's parent folder)."""
import io, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE)
FONT = os.path.join(HERE, "..", "..", "..", "..", "next", "src", "components", "livedesk", "fonts", "be-vietnam-pro-latin-500-normal.woff2")

INK, CREAM, BRICK, KRAFT = "#2A2522", "#F6F3EE", "#9E3B2B", "#C9B48A"
PAPER = "#FBF9F5"
D_INK, D_PAPER, D_BRICK, D_LINE = "#2A2522", "#2A2522", "#D4624A", "#F3ECE1"

def outline(text, size, x, y, spacing=0.0):
    f = TTFont(FONT); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm
    k = size / upm; pen_x = 0.0; paths = []
    for ch in text:
        g = cmap[ord(ch)]; p = SVGPathPen(gs)
        gs[g].draw(TransformPen(p, (k, 0, 0, -k, x + pen_x, y)))
        paths.append(p.getCommands()); pen_x += gs[g].width * k + spacing * size
    return " ".join(paths), pen_x

def mark(ink, paper, brick, tape=KRAFT, mono=False, photo="#E4DACB"):
    """A product card lifted off a stack and pinned with tape, with a LIVE dot. Only the front card and tape tilt."""
    back = f'<rect x="8.5" y="22" width="34" height="38" fill="none" stroke="{ink}" stroke-width="1.6" transform="rotate(3 26 41)"/>'
    image = (f'<rect x="26" y="17" width="22" height="16" fill="none" stroke="{ink}" stroke-width="1.6"/>' if mono
             else f'<rect x="26" y="17" width="22" height="16" fill="{photo}"/>')
    dot = f'<circle cx="31" cy="22" r="3.1" fill="{ink if mono else brick}"/>'
    bars = (f'<rect x="26" y="38" width="22" height="3.6" fill="{ink}"/><rect x="26" y="45" width="12" height="3.6" fill="{ink}"/>')
    front = f'<g transform="rotate(-6 37 31)"><rect x="20" y="10" width="34" height="42" fill="{paper}" stroke="{ink}" stroke-width="3"/>{image}{dot}{bars}</g>'
    tape_el = (f'<rect x="26" y="3.5" width="22" height="10.5" fill="none" stroke="{ink}" stroke-width="2" transform="rotate(4 37 9)"/>'
               if mono else f'<rect x="26" y="3.5" width="22" height="10.5" fill="{tape}" opacity="0.92" transform="rotate(4 37 9)"/>')
    return back + front + tape_el

def svg(w, h, body, title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="{title}">'
            f'<title>{title}</title>{body}</svg>\n')

def lockup(ink, paper, brick, lift, mono=False):
    size = 40; base = 47
    live, wl = outline("Live", size, 74, base, -0.01)
    lft, wf = outline("Lift", size, 74 + wl, base, -0.01)
    width = int(74 + wl + wf + 6)
    body = mark(ink, paper, brick, mono=mono, photo=("#3D352F" if ink == D_LINE else "#E4DACB")) + f'<path d="{live}" fill="{ink}"/><path d="{lft}" fill="{lift}"/>'
    return svg(width, 64, body, "LiveLift"), width

def write(name, content):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh: fh.write(content)

write("logo-mark.svg", svg(64, 64, mark(INK, PAPER, BRICK), "LiveLift"))
write("logo-mark-dark.svg", svg(64, 64, mark(D_LINE, D_PAPER, D_BRICK, photo="#3D352F"), "LiveLift"))
write("logo-mark-mono.svg", svg(64, 64, mark(INK, "none", INK, mono=True), "LiveLift"))
s, w = lockup(INK, PAPER, BRICK, BRICK); write("logo-lockup.svg", s)
s, _ = lockup(D_LINE, D_PAPER, D_BRICK, D_BRICK); write("logo-lockup-dark.svg", s)
s, _ = lockup(INK, "none", INK, INK, mono=True); write("logo-lockup-mono.svg", s)
# favicon: heavier strokes and no back card or bars, so it holds at 16 px
fav = (f'<g transform="rotate(-6 32 34)"><rect x="12" y="12" width="40" height="46" fill="{PAPER}" stroke="{INK}" stroke-width="5"/>'
       f'<rect x="21" y="21" width="22" height="17" fill="#E4DACB"/><circle cx="27.5" cy="27" r="4.2" fill="{BRICK}"/>'
       f'<rect x="21" y="44" width="22" height="5" fill="{INK}"/></g>'
       f'<rect x="19.5" y="2.5" width="25" height="12" fill="{KRAFT}" transform="rotate(4 32 8)"/>')
write("favicon.svg", svg(64, 64, fav, "LiveLift"))
print("lockup width", w)
