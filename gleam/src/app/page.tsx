// 홈 페이지 — 교사 중심 메시지로 피봇
export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="text-center pt-10 pb-20">
        <p className="text-sm text-[#8b9aff] tracking-widest uppercase mb-4">제8회 교육공공데이터 AI활용대회 · 일반부</p>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
          한 학기가 걸리는 일을<br />
          <span className="text-[#ffd97a]">한 시간으로</span>.
        </h1>
        <p className="text-lg text-[#9ba3c7] max-w-2xl mx-auto leading-relaxed">
          전국 6,000개 학교, 매년 발생하는 <strong className="text-white">80만 명의 느린학습자</strong>는
          *모르는 것*이 문제가 아니라 <strong className="text-white">발견·매칭할 시간이 학교에 없는 것</strong>이 문제입니다.
          별의아이들은 학생 5분 게임 → 교사용 한 페이지 카드 → 학습종합클리닉 자동 매칭까지,
          한 학기를 한 시간으로 줄이는 <strong className="text-[#ffd97a]">교사용 AI 도구</strong>입니다.
        </p>
        <div className="mt-10 flex justify-center gap-4 flex-wrap">
          <a href="/onboard" className="btn btn-primary glow">데모 시작 →</a>
          <a href="/about" className="btn btn-ghost">컨셉 자세히</a>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <div className="card">
          <p className="text-3xl mb-2">🎮</p>
          <h3 className="font-semibold mb-2">학생: 거부감 0의 5분 게임</h3>
          <p className="text-sm text-[#9ba3c7] leading-relaxed">
            단어 폭포 · 이야기 이어쓰기 · 어떤 장면이 끌려? · 시간과 패턴 — 4가지 짧은 활동만으로
            *진단처럼 안 느껴지는* 진단을 수행합니다.
          </p>
        </div>
        <div className="card">
          <p className="text-3xl mb-2">📋</p>
          <h3 className="font-semibold mb-2">교사: 한 페이지 학생 카드</h3>
          <p className="text-sm text-[#9ba3c7] leading-relaxed">
            강점 영역 신호 · 흥미 코드(Holland) · 학교 또래 분포 위치 ·
            <strong className="text-white">추가 관찰 권장 포인트 3개</strong>가 자동으로 출력됩니다.
            의뢰 결정은 교사가, AI는 행정 부담을 가져갑니다.
          </p>
        </div>
        <div className="card">
          <p className="text-3xl mb-2">🏛️</p>
          <h3 className="font-semibold mb-2">학습종합클리닉 자동 매칭</h3>
          <p className="text-sm text-[#9ba3c7] leading-relaxed">
            전국 학습종합클리닉센터 분포와 결합해 거리·전문영역·대기 기준 매칭.
            의뢰서 초안까지 DOCX로 자동 생성됩니다.
          </p>
        </div>
      </section>

      <section className="card bg-gradient-to-br from-[#131831] to-[#1a2046] space-y-4">
        <h2 className="text-2xl font-semibold">5종 교육공공데이터 입력단 결합</h2>
        <p className="text-sm text-[#9ba3c7]">
          공공데이터를 *추천 재료*가 아닌 *진단의 입력*으로 사용합니다.
          학생 결과는 항상 *학교 단위 또래 분포 안에서의 상대 위치*로 해석됩니다.
        </p>
        <ul className="space-y-2 text-sm text-[#c8cfe8]">
          <li>📚 <strong>도서관정보나루</strong> — 학생 ISBN 이력으로 흥미 영역 추정 + 또래 인기도서</li>
          <li>🏫 <strong>NEIS 교육정보 개방</strong> — 학교 메타·학사일정 자동 매칭</li>
          <li>📊 <strong>학교알리미</strong> — 학교별 도서관 시설·학생수·다문화 비율 → 결과 해석 컨텍스트</li>
          <li>📈 <strong>KLISS 학교도서관 통계</strong> — 학교 단위 추세·평균 비교</li>
          <li>👁️ <strong>국립어린이청소년도서관 사서추천</strong> — 사서 검증된 큐레이션 보강</li>
        </ul>
      </section>

      <section className="card border-l-4 border-[#ffd97a]">
        <h2 className="text-xl font-semibold mb-3">학술적·윤리적 방어선</h2>
        <ul className="space-y-2 text-sm text-[#c8cfe8] leading-relaxed">
          <li>• 가드너 다중지능 이론은 *내부 분석 프레임*으로만 사용. 사용자 노출 표면은 OECD 21세기 스킬 + Holland 코드.</li>
          <li>• 모든 신호는 ±1.5점 신뢰구간으로 표시. <strong>"진단 아님 — 5분 탐색 결과"</strong> 명시.</li>
          <li>• 영재교육원·학습클리닉 의뢰는 <strong>교사 검토 후 발행</strong>. AI 자동 발송 금지.</li>
          <li>• 다문화 학생 가중치 사용 안 함. 다문화는 *해석 신뢰도 페널티*로만 작동.</li>
        </ul>
      </section>

      <section className="text-center pb-10">
        <p className="text-[#9ba3c7] mb-6">교사 행정 부담을 빼면, 학생의 강점이 보입니다.</p>
        <a href="/onboard" className="btn btn-primary glow">데모 시작 →</a>
      </section>
    </div>
  )
}
