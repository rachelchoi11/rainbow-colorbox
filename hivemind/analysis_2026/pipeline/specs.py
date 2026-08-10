# -*- coding: utf-8 -*-
"""플랫폼별 파싱 스펙 25종
기준 2: 파일명 패턴 → 플랫폼 식별
기준 3: 헤더 '이름'으로 컬럼 매핑 (위치 불변 가정 안 함) + 플랫폼별 전처리 규칙
- fields 값: 후보 헤더명 리스트 (앞에서부터 정확 일치 → 포함 일치 순으로 탐색)
- calc 필드: callable(get) — get(필드후보들)로 숫자 취득
"""
import re

def _num(v):
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v or "").replace(",", "").strip()
    if s in ("", "-", "null", "None", "#N/A"):
        return None
    try:
        return float(s)
    except ValueError:
        return None

SUM_MARKERS = ("합계", "총합", "총합계", "sum", "total", "정산액 합계", "전산액 합계", "소계")

def _is_sum_row(cells):
    head = [str(c or "").strip().lower() for c in cells[:4]]
    return any(h in SUM_MARKERS for h in head)

def bt_tag(tag, when_present="단행본", when_absent="연재"):
    def f(title, row):
        return when_present if tag in str(title) else when_absent
    return f

SPECS = [
    dict(platform="에이블리", match=r"에이블리", kind="csv", header=(1, 1),
         fields=dict(title=["작품명"], author=["작가명"], label=["레이블"],
                     gross=["판매 금액 합계 (원)", "판매 금액 합계(원)"],
                     settle=["정산 금액 합계 (원)", "정산 금액 합계(원)"],
                     content_type=["분류"], sale_date=["판매일"]),
         book_type=lambda t, g: "연재" if _num(g("회차 판매가 (원)", "회차 판매가(원)")) == 100 else "단행본"),

    dict(platform="구루컴퍼니", match=r"구루컴퍼니", kind="csv", header=(1, 1),
         fields=dict(title=["작품명"], author=["작가"], label=["레이블"],
                     gross=["콘텐츠 매출금액"], settle=["콘텐츠 정산금액"],
                     content_type=["작품유형"]),
         book_type=lambda t, g: "연재"),

    dict(platform="네이버시리즈", match=r"네이버", kind="html", sheet="largest",
         header_find=["컨텐츠", "작가명", "출판사"], header_extra=1,
         fields=dict(title=["컨텐츠"], author=["작가명"], label=["출판사"], gross=["합계"]),
         settle_calc=lambda g: (lambda tot, fee: None if tot is None else (tot - (fee or 0)) * 0.7
                                )(g("합계"), g("마켓수수료(추정치)", "마켓수수료")),
         settle_basis="계산값[(합계-마켓수수료추정)×0.7]",
         book_type=bt_tag("[단행본]")),

    dict(platform="노벨피아", match=r"노벨피아.*\(1\)", kind="html", header=(1, 1),
         fields=dict(title=["상품명"], author=["작가명"], label=["출판사"],
                     gross=["판매합계"], settle=["정산금액"],
                     content_type=["컨텐츠유형"], sale_date=["날짜"],
                     book_type_col=["연재/단행"])),

    dict(platform="노벨피아", match=r"노벨피아", kind="html", header=(1, 1),
         fields=dict(title=["작품명"], author=["작가"], settle=["정산금"]),
         gross_calc=lambda g: None, gross_basis="미제공[조회수형 정산]",
         book_type=lambda t, g: "연재",
         note="주계정 조회수형 양식(년/월/작품명/작가/정산조회수/정산금)"),

    dict(platform="로망띠끄(단행본)", match=r"로망띠끄.*(단행본|전자책)", kind="html",
         header_find=["도서명", "정산액"],
         fields=dict(title=["도서명"], author=["저자"], label=["출판사명"],
                     gross=["판매액"], settle=["정산액"]),
         book_type=lambda t, g: "단행본"),

    dict(platform="로망띠끄(연재)", match=r"[로오]망띠끄.*연재", kind="html",
         header_find=["제목", "정산금액"],
         fields=dict(title=["제목"], author=["작가명"], label=["출판사명2"],
                     gross=["판매금액"], settle=["정산금액"]),
         book_type=lambda t, g: "연재"),

    dict(platform="리디", match=r"리디", kind="zip", header=(1, 1),
         fields=dict(title=["시리즈명", "제목"], author=["저자"], label=["출판사"],
                     settle=["정산액"], content_type=["카테고리1"]),
         gross_calc=lambda g: (g("판매액") or 0) + (g("취소액") or 0),
         gross_basis="계산값[판매액+취소액(음수)]",
         book_type=bt_tag("[e북]", "단행본", "연재")),

    dict(platform="무툰", match=r"무툰", kind="html", header_find=["타이틀", "정산액"], header_extra=1,
         fields=dict(title=["타이틀"], author=["작가"],
                     gross=["합계/금액"], settle=["정산액"]),
         book_type=bt_tag("[단행본]")),

    dict(platform="문피아", match=r"문피아", kind="xlsx", header=(1, 1),
         fields=dict(title=["작품명"], author=["작가명"],
                     gross=["판매 골드"], settle=["정산 금액"]),
         gross_basis="제공값[결제수수료 차감 후]",
         book_type=bt_tag("[단행본]")),

    dict(platform="미노벨", match=r"미노벨", kind="html", header=(1, 1),
         fields=dict(title=["타이틀"], author=["작가명"], label=["출판사"],
                     gross=["전체매출(원)"], settle=["총지급액(원)"]),
         book_type=lambda t, g: "연재"),

    dict(platform="미소설", match=r"미소설", kind="html", header=(1, 1),
         fields=dict(title=["타이틀"], author=["작가명"], label=["출판사"],
                     gross=["전체매출(원)"], settle=["총지급액(원)"],
                     book_type_col=["종류"])),

    dict(platform="미스터블루", match=r"미스터블루", kind="xlsx", sheet="작품별",
         header=(2, 5),
         fields=dict(title=["작품명"], author=["작가명"], label=["출판사"],
                     content_type=["콘텐츠"]),
         gross_calc=lambda g: (g("합계(정액+종량)/매출액") or 0) + (g("합계(정액+종량)/매출액/취소액", "합계(정액+종량)/취소액") or 0),
         gross_basis="계산값[합계매출액+취소액]",
         settle_calc=lambda g: g("합계(정액+종량)/매출액/취소액/정산액", "합계(정액+종량)/정산액", "정산액"),
         settle_basis="제공값[합계 정산액]",
         book_type=bt_tag("[단행본]")),

    dict(platform="밀리의서재", match=r"밀리의서재", kind="html", header=(1, 1),
         fields=dict(title=["콘텐츠명", "도서명"], author=["저자명"],
                     label=["레이블명", "브랜드명"], settle=["정산 금액"],
                     content_type=["콘텐츠 분류"],
                     sale_month=["발생 월"], settle_month=["정산 월"]),
         gross_calc=lambda g: None, gross_basis="미제공[구독제]",
         book_type=lambda t, g: "구분불가(구독제)"),

    dict(platform="북큐브", match=r"북큐브", kind="xlsx", header_find=["제목", "정산액"],
         fields=dict(title=["제목"], author=["저자"], label=["출판권자"],
                     gross=["판매액"], settle=["정산액"]),
         book_type=lambda t, g: "연재" if str(g.raw("판매처") or "") == "프리미엄" else "단행본",
         expected_cell=("정산액 합계", "settle")),

    dict(platform="블라이스", match=r"블라이스", kind="html", header_find=["작품명", "판매액"],
         fields=dict(title=["작품명"], author=["작가명"], gross=["판매액"],
                     content_type=["장르"], sale_date=["날짜"]),
         settle_calc=lambda g: None if g("판매액") is None else round(g("판매액") * 0.7),
         settle_basis="계산값[판매액×0.7]",
         note="26.6월 서비스 종료 예정 — 참고용"),

    dict(platform="신영미디어", match=r"신영미디어", kind="html", header=(1, 1),
         fields=dict(title=["제목"], author=["저자"], label=["소분류"],
                     gross=["합계"], settle=["소득액"]),
         book_type=lambda t, g: "단행본"),

    dict(platform="알라딘", match=r"알라딘", kind="csv", header=(1, 1),
         fields=dict(title=["제목", "도서명"], author=["저자명", "저자"], label=["출판사명", "출판사"],
                     gross=["판매가", "정가합"], settle=["정산액"], sale_date=["판매/취소일시", "발주일"],
                     supplier=["공급사"]),
         book_type=lambda t, g: "연재" if (_num(g("정가")) == 100 and re.search(r"\d+\s*화", str(t))) else "단행본",
         note="B2C(제목/판매가) + B2B 기관납품(도서명/정가합) 양식 모두 수용. ISBN·공급사 보유"),

    dict(platform="애니툰", match=r"애니툰", kind="xlsx", sheet="작품별 시트",
         header=(4, 5),
         fields=dict(title=["작품명"], author=["작가명"], label=["출판사"],
                     gross=["총매출액"], settle=["지급액"], book_type_col=["타입"]),
         book_type_map={"장르": "단행본", "연재": "연재"}),

    dict(platform="에피루스", match=r"에피루스", kind="html",
         columns_pos=dict(title=2, author=3, label=4, gross=6, settle=8),  # 원본에 헤더행 없음
         fields={},
         book_type=lambda t, g: "단행본"),

    dict(platform="예스24", match=r"예스24", kind="xls", header=(1, 1),
         fields=dict(title=["도서명"], settle=["총 정산액"]),
         gross_calc=lambda g: None, gross_basis="미제공",
         book_type=lambda t, g: "단행본"),

    dict(platform="올툰", match=r"올툰", kind="xlsx", sheet="전체 매출 내역", header=(1, 1),
         fields=dict(title=["작품명"], gross=["총 매출액(원)"],
                     settle=["정산대상금액(원, 전체 수수료 제)", "정산대상금액"]),
         book_type=lambda t, g: ""),  # 확인 필요: 타입 컬럼 부재

    dict(platform="원스토리", match=r"원스토[리어]", kind="xlsx", sheet="multimedia",
         header=(1, 2),
         fields=dict(title=["상품명"], author=["글작가"], label=["출판사"],
                     gross=["합계"], settle=["정산지급액"],
                     content_type=["카테고리"], book_type_col=["타입"])),

    dict(platform="조아라", match=r"조아라", kind="csv", header=(1, 1),
         fields=dict(title=["작품명"], author=["작가명"], settle=["정산금액"]),
         gross_calc=lambda g: None if g("단가") is None or g("판매건수") is None
                              else g("단가") * g("판매건수"),
         gross_basis="계산값[단가×판매건수]",
         book_type=lambda t, g: "연재"),

    dict(platform="카카오페이지", match=r"카카오페이지", kind="xlsx", header=(1, 2),
         fields=dict(title=["기초정보/시리즈명", "시리즈명"], author=["기초정보/작가명", "작가명"],
                     label=["기초정보/레이블", "레이블"],
                     gross=["거래액(원화)/총합계-원화", "총합계-원화"],
                     settle=["정산금액/공급대가", "공급대가"],
                     content_type=["기초정보/콘텐츠유형", "콘텐츠유형"]),
         gross_basis="제공값[거래액 원화, IAP수수료 차감 전]",
         book_type=bt_tag("[단행본]"),
         account_from_name=r"(선투자|일반)"),

    dict(platform="큐툰", match=r"큐툰", kind="html", header_find=["타이틀", "정산액"], header_extra=1,
         fields=dict(title=["타이틀"], author=["작가"],
                     gross=["합계/금액"], settle=["정산액"]),
         book_type=bt_tag("[단행본]")),

    dict(platform="판무림", match=r"[판팜]무림", kind="xlsx", header=(1, 2),
         fields=dict(title=["작품 제목"], author=["저자"], label=["출판사"],
                     gross=["판매금액"]),
         settle_calc=lambda g: None, settle_basis="미제공[행단위 정산액 없음 — 확인 필요]",
         book_type=lambda t, g: str(g.raw("카테고리/대분류", "카테고리") or "단행본"),
         account_from_name=r"([판팜]무림\s*\d)"),

    dict(platform="피우리", match=r"피우리", kind="xlsx", header=(2, 2),
         fields=dict(title=["제목"], author=["작가"], label=["출판사"],
                     gross=["매출액"], settle=["정산액"], sale_month=["판매년월"]),
         book_type=lambda t, g: "단행본" if str(g.raw("판매형태") or "") in ("단권", "세트") else "연재"),

    dict(platform="피플앤스토리", match=r"피플앤스토리", kind="html", header=(1, 1),
         fields=dict(title=["작품명"], author=["작가명"],
                     gross=["판매금액(원)"], settle=["정산금액(원)"]),
         book_type=bt_tag("[연재]", "연재", "단행본"),
         note="CP사≠레이블 — 레이블 미제공 취급"),

    dict(platform="하이북", match=r"하이북", kind="html", header=(1, 1),
         fields=dict(title=["작품명"], author=["작가명"], label=["출판사"],
                     gross=["판매금액"], settle=["정산금액"]),
         label_split=r"^(.*?)\((.*)\)$",  # "레이블명(출판사명)" 분리
         book_type=bt_tag("[단행본]")),

    # ── 신규 플랫폼 (과거 '취합 불가' → 본부장 직접 제공, 2026-06 고도화) ──
    dict(platform="모픽", match=r"모픽", kind="xlsx", header=(1, 1),
         fields=dict(title=["작품명"], author=["작가명"], label=["출판사"],
                     gross=["총 매출액", "총매출액"], settle=["정산액"],
                     content_type=["유형"], supplier=["제공사"]),
         book_type=bt_tag("[단행본]"),
         note="제공사=스토린랩(유통대행 신호). 합계행 없음 → 원본대사 생략"),

    dict(platform="교보문고", match=r"교보문고", kind="xlsx", header=(2, 2),
         fields=dict(title=["상품명"], author=["저자"], label=["출판사"],
                     gross=["정산대상판매가총액"], settle=["정산액"],
                     content_type=["상품구분"]),
         book_type=lambda t, g: "단행본",
         note="B2B 기관납품 — 상품×납품처 다중행→title_norm 합산. ISBN 보유(매칭키 후보)"),
]


def find_spec(filename_nfc):
    for sp in SPECS:
        if re.search(sp["match"], filename_nfc):
            return sp
    return None
