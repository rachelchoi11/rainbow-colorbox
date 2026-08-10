#!/usr/bin/env python3
"""선생님 이모티콘 세트 생성 - gpt-image-2 edit 사용, 텍스트는 후처리로 입힘."""
import sys, base64, glob
from openai import OpenAI

client = OpenAI()
REFS = ["crops/face_11.png", "crops/face_19.png"]

# (파일명, 표정/동작 설명) - 캡션은 finish.py 에서 입힘
SET = [
    ("01_greet",   "smiling warmly and waving one hand in a friendly hello gesture, head slightly tilted"),
    ("02_praise",  "big bright proud smile, giving a clear thumbs-up with one hand"),
    ("03_best",    "delighted excited expression with sparkling happy eyes, both hands giving thumbs-up"),
    ("04_fighting","energetic encouraging expression, one fist raised up cheering"),
    ("05_focus",   "focused attentive look, pointing forward with index finger to draw attention"),
    ("06_quiet",   "gentle shushing expression, one index finger held vertically over the lips"),
    ("07_correct", "happy approving expression, both arms raised making a big round O shape above the head"),
    ("08_love",    "loving sweet smile, both hands forming a small heart shape near the cheek"),
    ("09_homework","curious questioning look with raised eyebrow, one hand resting on the chin thinking"),
    ("10_clap",    "warm happy expression, hands together clapping in applause"),
    ("11_break",   "relaxed cheerful smile, looking comfortable and easygoing"),
    ("12_sleepy",  "sleepy tired expression, eyes half closed, rubbing one eye with a hand"),
    ("13_cheer",   "bright cheering expression, both fists raised in encouragement"),
    ("14_ok",      "gentle kind smile, head tilted, giving a small OK sign with fingers"),
    ("15_thanks",  "grateful warm expression, both hands politely together, a slight thankful bow"),
    ("16_wow",     "pleasantly surprised and amazed expression, mouth slightly open, eyes wide with wonder"),
]

PROMPT = (
    "Create a polished 2D digital cartoon ILLUSTRATION (clean vector / soft-anime style: smooth cel shading, "
    "crisp clean line art, flat pretty colors) of THIS Korean woman, an elementary school teacher in her early "
    "30s. This must look like a hand-drawn illustrated character, NOT a photo and NOT realistic. Keep her clearly "
    "recognizable — same face shape, brown shoulder-length straight hair, warm friendly eyes and bright smile — "
    "but render her as a PRETTY, clean, lovely idealized cartoon character: smooth flawless skin, big warm eyes, "
    "slim flattering proportions, approachable and charming. She wears a light blue collared shirt (sleeves "
    "rolled to the forearm) and navy slacks, a smart neat teacher outfit. Full body, standing, facing the viewer. "
    "She is {pose}. Soft warm lighting, gentle shading, cute and wholesome teacher vibe. Add a few small tasteful "
    "decorative doodles (tiny hearts, sparkles or stars) that match the emotion. The character is fully isolated "
    "on a TRANSPARENT background. Absolutely NO text, NO letters, NO words anywhere in the image."
)
SIZE = "1024x1536"

def gen(name, pose):
    files = [open(p, "rb") for p in REFS]
    try:
        r = client.images.edit(
            model="gpt-image-1",
            image=files,
            prompt=PROMPT.format(pose=pose),
            size=SIZE,
            quality="high",
            background="transparent",
        )
    finally:
        for f in files:
            f.close()
    data = base64.b64decode(r.data[0].b64_json)
    out = f"out/{name}.png"
    with open(out, "wb") as f:
        f.write(data)
    print("saved", out)

if __name__ == "__main__":
    sel = sys.argv[1:] if len(sys.argv) > 1 else [n for n, _ in SET]
    d = dict(SET)
    for n in sel:
        # allow passing prefix like "02"
        match = [k for k in d if k == n or k.startswith(n + "_") or k.split("_")[0] == n]
        key = match[0] if match else n
        print("generating", key, "...")
        gen(key, d[key])
