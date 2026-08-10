#!/usr/bin/env python3
"""out/raw 스티커에 흰색 누끼 테두리 + 한글 캡션 입히기 -> final/ 저장."""
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont, ImageFilter

FONT = "/System/Library/Fonts/AppleSDGothicNeo.ttc"

CAPTIONS = {
    "01_greet":   "안녕하세요~",
    "02_praise":  "참 잘했어요!",
    "03_best":    "최고예요!",
    "04_fighting":"화이팅!",
    "05_focus":   "집중!",
    "06_quiet":   "조용히~",
    "07_correct": "정답!",
    "08_love":    "사랑해요",
    "09_homework":"숙제 했나요?",
    "10_clap":    "대단해요!",
    "11_break":   "쉬는 시간~",
    "12_sleepy":  "졸려요~",
    "13_cheer":   "힘내요!",
    "14_ok":      "알겠죠?",
    "15_thanks":  "고마워요~",
    "16_wow":     "우와!",
}

BORDER = 18          # 흰색 테두리 두께(px)
CAP_COLOR = (60, 60, 70, 255)
CAP_OUTLINE = (255, 255, 255, 255)


def add_border(img, width=BORDER):
    """알파 채널 기준으로 흰색 die-cut 테두리 생성."""
    a = img.split()[3]
    # 알파를 확장(dilate)해서 외곽선 마스크 생성
    grown = a.filter(ImageFilter.MaxFilter(width * 2 + 1))
    # 흰색 실루엣
    white = Image.new("RGBA", img.size, (255, 255, 255, 0))
    white.putalpha(grown)
    wd = white.copy()
    wd.paste((255, 255, 255, 255), (0, 0), grown)
    wd.putalpha(grown)
    out = Image.alpha_composite(wd, img)
    return out


def fit_font(text, max_w, start=120):
    size = start
    while size > 30:
        f = ImageFont.truetype(FONT, size)
        if f.getlength(text) <= max_w:
            return f
        size -= 2
    return ImageFont.truetype(FONT, 30)


def add_caption(img, text):
    W, H = img.size
    f = fit_font(text, int(W * 0.82))
    d = ImageDraw.Draw(img)
    bbox = d.textbbox((0, 0), text, font=f)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (W - tw) / 2 - bbox[0]
    y = H - th - bbox[1] - int(H * 0.035)
    # 흰색 외곽선(가독성)
    for dx in range(-8, 9, 2):
        for dy in range(-8, 9, 2):
            d.text((x + dx, y + dy), text, font=f, fill=CAP_OUTLINE)
    d.text((x, y), text, font=f, fill=CAP_COLOR)
    return img


def process(path):
    name = os.path.splitext(os.path.basename(path))[0]
    cap = CAPTIONS.get(name, "")
    img = Image.open(path).convert("RGBA")
    img = add_border(img)
    if cap:
        img = add_caption(img, cap)
    os.makedirs("final", exist_ok=True)
    out = f"final/{name}.png"
    img.save(out)
    print("finished", out)


if __name__ == "__main__":
    args = sys.argv[1:]
    paths = []
    if args:
        for a in args:
            paths += glob.glob(f"out/{a}*.png")
    else:
        paths = sorted(glob.glob("out/*.png"))
    for p in sorted(set(paths)):
        process(p)
