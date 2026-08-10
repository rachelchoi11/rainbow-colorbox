# -*- coding: utf-8 -*-
"""작품명 정규화 엔진 v2 — 회의 결정: 권·화·시리즈 표기를 모두 '시리즈 단위 제목'으로 통일
22년 수작업 정답지 38,063행 기준 자동 일치율 78.8% 검증
"""
import re

_RULES = [
    (re.compile(r"\*[^*]*\*"), " "),                                   # *세트구매* 류
    (re.compile(r"\([^)]*\)|\[[^]]*\]|\{[^}]*\}"), " "),               # 괄호류 병기·태그 전부
    # ── 권/화/회 번호는 제목 어디에 있든 제거 (28권 29권 → 같은 작품으로 통합) ──
    (re.compile(r"[0-9]+\s*[-~]\s*[0-9]+\s*[화권회편]?"), " "),          # 20-8화 류 범위
    (re.compile(r"[0-9]+\s*부\s*[0-9]*\s*[화권회편]?"), " "),            # N부 M화
    (re.compile(r"(시즌|season)\s*[0-9]+", re.I), " "),                 # 시즌N
    (re.compile(r"[0-9]+\s*[권화회편卷話]"), " "),                       # 28권·30화 (위치 무관)
    (re.compile(r"[0-9]+\s*[:：]"), " "),                              # '27 : 광월야'의 권 번호
    (re.compile(r"(특별\s*외전|외전|번외편|단편집?|완결)\s*[0-9]*\s*$"), " "),  # 외전류 말미
    (re.compile(r"[\s]*[0-9]+\s*[권화부회편]?\s*$"), " "),               # 말미 잔여 번호
    (re.compile(r"[\s](상|중|하)\s*$"), " "),                           # 상·중·하권
]
_STRIP_ALL = re.compile(r"[\s\W_]+")


def norm_title(s):
    """정규화 키 생성: 시리즈 매칭용. 빈 문자열이면 매칭 불가."""
    s = str(s or "")
    prev = None
    # 접미 규칙은 중첩 가능('3부 1222화') → 수렴할 때까지 반복
    while prev != s:
        prev = s
        for pat, rep in _RULES:
            s = pat.sub(rep, s)
        s = s.strip()
    return _STRIP_ALL.sub("", s).lower()


_AUTHOR_TAG = re.compile(r"\[[^\]]*\]")              # 대괄호 태그 [정천] → 내용까지 제거
_AUTHOR_PAREN_NOHANGUL = re.compile(r"[(（][^)）]*[)）]")  # 괄호 병기 (한글 없을 때만 제거)
_CJK = re.compile(r"[㐀-䶿一-鿿豈-﫿]")  # CJK 한자
_LATIN = re.compile(r"[A-Za-z]")
_AUTHOR_PUNCT = re.compile(r"[.·・ㆍ·∙‧`'\"~!?]")    # 마침표·가운뎃점 등 (쉼표는 공동작가라 보존)
_HANGUL = re.compile(r"[가-힣]")


def norm_author(s):
    """작가명 정규화 키 (E2 강화) — 표기변형 통합으로 동명이작 과탐·작가 분산 해소.
    규칙:
    - [정천]=정천 (대괄호 태그 제거)
    - 한글 이름의 병기 통합: 필환(筆煥)=필환, 무영武映=무영, 로체니콥(rocheni-cob)=로체니콥
      (단, 괄호 안에 한글이 있으면 필명 가능 → 보존: 이윤정(탠저린))
    - 끝/중간 구두점·물결 제거 (로체니콥.=로체니콥). 쉼표는 공동작가 구분자라 보존.
    - 순수 영문/숫자 이름(Magoing 등)은 한글 없으므로 한자·영문 제거를 적용하지 않음(보존)."""
    s = str(s or "").strip()
    inner = _AUTHOR_TAG.sub("", s).strip()             # 대괄호 태그 제거 시도
    s = inner if inner else re.sub(r"[\[\]]", "", s)   # 다 지워지면(전체가 [..]) 괄호문자만 제거 → [정천]=정천
    # 괄호 병기: 괄호 안에 한글이 없으면(한자·영문·로마자 표기) 제거, 있으면 필명일 수 있어 보존
    s = _AUTHOR_PAREN_NOHANGUL.sub(lambda m: m.group(0) if _HANGUL.search(m.group(0)) else "", s)
    if _HANGUL.search(s):                              # 한글 이름이면 붙어있는 한자·로마자 병기 제거
        s = _CJK.sub("", s)
        s = _LATIN.sub("", s)
    s = _AUTHOR_PUNCT.sub("", s)                       # 구두점 제거 (쉼표 제외)
    s = s.replace(" ", "")                             # 공백 제거
    return s.strip().lower()


def strip_tags_keep_title(s):
    """표시용 시리즈 제목: 태그·권수만 제거하고 본 제목은 보존"""
    s = str(s or "")
    prev = None
    while prev != s:
        prev = s
        for pat, rep in _RULES:
            s = pat.sub(rep, s)
        s = re.sub(r"\s{2,}", " ", s).strip(" -–—·,")
    return s.strip()
