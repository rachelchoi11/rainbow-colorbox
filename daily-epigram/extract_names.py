import os
import openai
from docx import Document
from tqdm import tqdm

# 1. OpenAI API 키 설정
openai.api_key = os.getenv("OPENAI_API_KEY")  # 환경변수에 API 키 저장 권장

# 2. docx 파일에서 텍스트 추출
def extract_text_from_docx(docx_path):
    doc = Document(docx_path)
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return paragraphs

# 3. ChatGPT API로 사람 이름 추출
def extract_names_from_text(text):
    prompt = (
        "아래 텍스트에서 등장하는 사람 이름만 한글로 리스트로 반환해줘. "
        "예시: [\"홍길동\", \"김철수\"]\n\n"
        f"{text}"
    )
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=256,
        temperature=0
    )
    # 응답에서 이름 리스트 추출
    content = response.choices[0].message.content
    try:
        names = eval(content)
        if isinstance(names, list):
            return [n.strip() for n in names]
    except Exception:
        pass
    return []

# 4. 전체 파이프라인
def extract_names_from_docx(docx_path):
    paragraphs = extract_text_from_docx(docx_path)
    all_names = set()
    for para in tqdm(paragraphs, desc="Extracting names"):
        names = extract_names_from_text(para)
        all_names.update(names)
    return sorted(all_names)

if __name__ == "__main__":
    docx_path = "sample.docx"  # 분석할 파일명
    names = extract_names_from_docx(docx_path)
    print("추출된 이름 목록:")
    for name in names:
        print(name)