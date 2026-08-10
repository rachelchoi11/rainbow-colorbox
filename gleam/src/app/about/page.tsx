export default function AboutPage() {
  return (
    <div className="prose prose-invert max-w-none space-y-8">
      <h1 className="text-3xl font-bold">컨셉 — 별의아이들이란?</h1>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold text-[#ffd97a]">프레임 전환</h2>
        <p>
          한국 학생의 13.6%, 약 <strong>80만 명</strong>은 <em>느린학습자</em>로 분류됩니다.
          특수교육 대상도 아니고, 일반교육에서도 따라가지 못해 사실상 방치되는 회색지대.
          기존 시스템은 이 학생들을 <em>"부진하다"</em>는 결핍 프레임으로만 봅니다.
        </p>
        <p>
          하지만 인지심리학·교육학 연구는 일관되게 다른 그림을 보여줍니다.
          느린학습자의 상당수는 <strong>이중특수성(twice-exceptional, 2e)</strong> —
          한 영역은 영재, 다른 한 영역은 학습장애·ADHD·정서불안 — 케이스이며,
          학교 시험이라는 단일 측정에서는 끝까지 발견되지 않습니다.
        </p>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold text-[#ffd97a]">측정의 재구성</h2>
        <p>별의아이들은 다음 두 가지 새로운 측정 차원을 도입합니다.</p>
        <ol className="list-decimal pl-6 space-y-2">
          <li><strong>가드너 8지능 신호</strong> — 5분 게임 4종으로 언어·논리수학·시각공간·음악·신체운동·대인관계·자기성찰·자연친화 영역의 미세 신호를 추출합니다.</li>
          <li><strong>학교 점수 ↔ 강점 격차</strong> — 학교 평균 점수가 낮지만 한 지능 영역이 8점 이상이면, 시스템은 자동으로 영재교육원 의뢰서를 생성합니다.</li>
        </ol>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold text-[#ffd97a]">이론적 한계 인정</h2>
        <p className="text-sm text-[#9ba3c7]">
          가드너 다중지능 이론은 <strong>진단 도구가 아닌 탐색 프레임</strong>입니다.
          학계의 메타분석은 8지능의 통계적 분리도와 신뢰도가 약하다는 비판을 제기해왔습니다.
          별의아이들은 이를 인지하고, AI가 만든 <em>강점 신호</em>를 *최종 판정*이 아닌
          *영재교육원·학습클리닉이 정밀 진단할 후보 식별 트리거*로만 사용합니다.
          모든 의뢰서에는 이 한계가 명시됩니다.
        </p>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold text-[#ffd97a]">교육 공공데이터 결합 방식</h2>
        <table className="w-full text-sm">
          <thead className="border-b border-[#1f2547]">
            <tr><th className="text-left py-2">데이터</th><th className="text-left py-2">활용</th></tr>
          </thead>
          <tbody className="divide-y divide-[#1f2547]">
            <tr><td className="py-2">도서관정보나루 인기대출</td><td className="py-2">또래 연령·지역 인기도서 → 강점 매칭 추천</td></tr>
            <tr><td className="py-2">도서관정보나루 ISBN 분석</td><td className="py-2">함께 읽힌 책 그래프로 다음 책 추천</td></tr>
            <tr><td className="py-2">NEIS 학교 메타</td><td className="py-2">학교 코드 → 학교 정보 자동 매칭</td></tr>
            <tr><td className="py-2">학교알리미 시설</td><td className="py-2">우리 학교 도서관 1인당 장서 격차 분석</td></tr>
            <tr><td className="py-2">학교알리미 다문화 비율</td><td className="py-2">언어 강점 보너스 시그널 (모국어 자원)</td></tr>
            <tr><td className="py-2">국립어린이청소년도서관 사서추천</td><td className="py-2">신뢰 기반 추천 보강</td></tr>
            <tr><td className="py-2">위키문헌 한국 PD 본문</td><td className="py-2">저작권 안전 책 본문 (중·고 정전 65% 커버)</td></tr>
          </tbody>
        </table>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-semibold text-[#ffd97a]">기대 효과</h2>
        <ul className="list-disc pl-6 space-y-2">
          <li><strong>잠재 2e 영재 발굴</strong> — 13.6% 회색지대 중 약 12%는 2e 가능성. 약 9.6만 명을 정밀 진단으로 연결.</li>
          <li><strong>학부모 자기효능감</strong> — 약자 프레임이 아닌 강점 프레임 리포트.</li>
          <li><strong>교사 행정 부담 경감</strong> — 의뢰서 자동 작성으로 행정 시간 절감.</li>
          <li><strong>정책 시그널</strong> — 영재교육원 선발 다양화 + 기초학력보장법 보완.</li>
        </ul>
      </section>

      <p className="text-center pt-4">
        <a href="/onboard" className="btn btn-primary glow">진단 시작하기 →</a>
      </p>
    </div>
  )
}
