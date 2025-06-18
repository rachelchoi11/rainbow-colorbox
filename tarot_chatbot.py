import random

def greet():
    print("안녕하세요! 타로 챗봇입니다.")
    name = input("이름을 알려주세요: ")
    gender = input("성별을 알려주세요 (선택 사항): ")
    age = input("나이를 알려주세요 (선택 사항): ")
    job = input("하고 있는 일을 알려주세요 (선택 사항): ")
    question = input("오늘의 고민이나 질문을 입력해주세요: ")
    print(f"\n{name}님, 질문해주셔서 감사합니다.")
    print(f"질문: {question}")
    return question

def draw_card():
    print("\n마스터가 카드를 뽑았습니다...")
    drawn_card = random.choice(tarot_cards)
    return drawn_card

def interpret_card(card):
    interpretations = {
        "The Fool": "새로운 시작, 모험, 순수함",
        "The Magician": "능력, 의지, 창조력",
        "The High Priestess": "직관, 비밀, 잠재력",
        "The Empress": "풍요, 창조, 자연",
        "The Emperor": "권위, 질서, 통제",
        "The Hierophant": "전통, 가르침, 사회적 규범",
        "The Lovers": "사랑, 선택, 조화",
        "The Chariot": "의지, 성공, 통제력",
        "Strength": "용기, 인내, 내면의 힘",
        "The Hermit": "내성, 지혜, 고독",
        "Wheel of Fortune": "운명, 변화, 주기",
        "Justice": "정의, 공정, 균형",
        "The Hanged Man": "희생, 인내, 새로운 시각",
        "Death": "변화, 끝, 새로운 시작",
        "Temperance": "균형, 조화, 절제",
        "The Devil": "욕망, 집착, 유혹",
        "The Tower": "파괴, 변화, 깨달음",
        "The Star": "희망, 영감, 가능성",
        "The Moon": "직관, 환상, 두려움",
        "The Sun": "성공, 기쁨, 활력",
        "Judgment": "부활, 심판, 새로운 시작",
        "The World": "완성, 성취, 통합"
    }
    if card in interpretations:
        interpretation = interpretations[card]
    else:
        interpretation = "아직 이 카드에 대한 해석이 준비되지 않았습니다."
    return interpretation

def main():
    while True:
        greet()
        question = greet()
        drawn_card = draw_card()
        interpretation = interpret_card(drawn_card)
        print(f"뽑힌 카드: {drawn_card}")
        print(f"해석: {interpretation}")
        print("\n오늘의 타로 상담이었습니다.")

        another = input("다른 질문이 있으신가요? (네/아니요): ")
        if another.lower() != "네":
            print("챗봇을 종료합니다.")
            break

if __name__ == "__main__":
    tarot_cards = [
        "The Fool", "The Magician", "The High Priestess", "The Empress", "The Emperor",
        "The Hierophant", "The Lovers", "The Chariot", "Strength", "The Hermit",
        "Wheel of Fortune", "Justice", "The Hanged Man", "Death", "Temperance",
        "The Devil", "The Tower", "The Star", "The Moon", "The Sun",
        "Judgment", "The World"
    ]
    main()