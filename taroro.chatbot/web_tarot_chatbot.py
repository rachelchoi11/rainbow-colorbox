from flask import Flask, render_template, request, session
import random

app = Flask(__name__)
app.secret_key = "secret_key"  # 세션 사용을 위한 비밀 키 설정

tarot_cards = [
    "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor",
    "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit",
    "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance",
    "The Devil", "The Tower", "The Star", "The Moon", "The Sun",
    "Judgment", "The World"
]

interpretations = {
    "The Fool": "새로운 시작, 모험, 순수함. 새로운 가능성을 향해 뛰어드는 용기를 가지세요.",
    "The Magician": "능력, 의지, 창조력. 당신의 잠재력을 최대한 발휘하여 목표를 달성하세요.",
    "The High Priestess": "직관, 비밀, 잠재력. 내면의 소리에 귀 기울이고, 숨겨진 진실을 찾아보세요.",
    "The Empress": "풍요, 창조, 자연. 풍요로운 삶을 누리고, 창의적인 에너지를 발휘하세요.",
    "The Emperor": "권위, 질서, 통제. 책임감을 가지고 상황을 통제하며 안정적인 기반을 만드세요.",
    "The Hierophant": "전통, 가르침, 사회적 규범. 기존의 질서와 가치를 존중하며 조화로운 관계를 유지하세요.",
    "The Lovers": "사랑, 선택, 조화. 중요한 결정을 앞두고 신중하게 선택하고 조화를 이루세요.",
    "The Chariot": "의지, 성공, 통제력. 강한 의지로 어려움을 극복하고 성공을 향해 나아가세요.",
    "Strength": "용기, 인내, 내면의 힘. 내면의 힘을 믿고 어려움을 극복하며 인내심을 가지세요.",
    "The Hermit": "내성, 지혜, 고독. 혼자만의 시간을 통해 내면을 성찰하고 지혜를 얻으세요.",
    "Wheel of Fortune": "운명, 변화, 주기. 운명의 흐름에 따라 변화를 받아들이고 새로운 기회를 잡으세요.",
    "Justice": "정의, 공정, 균형. 객관적인 시각으로 상황을 판단하고 공정한 결정을 내리세요.",
    "The Hanged Man": "희생, 인내, 새로운 시각. 헌신과 희생을 통해 새로운 시각을 얻고 성장을 이루세요.",
    "Death": "변화, 끝, 새로운 시작. 과거를 정리하고 새로운 시작을 준비하세요.",
    "Temperance": "균형, 조화, 절제. 균형 잡힌 삶을 추구하고 절제된 태도를 유지하세요.",
    "The Devil": "욕망, 집착, 유혹. 유혹에 빠지지 않도록 주의하고 욕망을 통제하세요.",
    "The Tower": "파괴, 변화, 깨달음. 예상치 못한 변화에 대비하고 깨달음을 얻으세요.",
    "The Star": "희망, 영감, 가능성. 희망을 잃지 않고 영감을 받아들이며 가능성을 펼치세요.",
    "The Moon": "직관, 환상, 두려움. 불안과 두려움을 극복하고 직관을 믿으세요.",
    "The Sun": "성공, 기쁨, 활력. 긍정적인 에너지를 발산하고 성공과 기쁨을 누리세요.",
    "Judgment": "부활, 심판, 새로운 시작. 과거를 되돌아보고 새로운 시작을 준비하세요.",
    "The World": "완성, 성취, 통합. 목표를 달성하고 완전한 조화를 이루세요."
}

@app.route("/", methods=["GET", "POST"])
def tarot_chat():
    if request.method == "POST":
        step = int(request.form["step"])
        if step == 1:
            session["name"] = request.form["name"]
            return render_template("tarot.html", step=2)
        elif step == 2:
            session["gender"] = request.form["gender"]
            return render_template("tarot.html", step=3)
        elif step == 3:
            session["age"] = request.form["age"]
            return render_template("tarot.html", step=4)
        elif step == 4:
            session["job"] = request.form["job"]
            return render_template("tarot.html", step=5)
        elif step == 5:
            session["question"] = request.form["question"]
            name = session.get("name")
            question = session.get("question")
            drawn_card = random.choice(tarot_cards)
            interpretation = interpretations[drawn_card]
            session.clear()  # 세션 데이터 초기화
            return render_template("tarot.html", name=name, question=question, drawn_card=drawn_card, interpretation=interpretation)
    return render_template("tarot.html", step=1)

if __name__ == "__main__":
    app.run(debug=True)