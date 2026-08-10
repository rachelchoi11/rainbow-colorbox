# DB 이전 설계 — SQLite(볼륨) → Postgres (내부)

- 작성일: 2026년 8월 6일 · 작성: 최혜윤 · 용도: 실서비스 확장 대비 사전 설계(구현 아님)
- 현재: SQLite 파일(`/app/appdata/app.db`, WAL) + Railway 볼륨. 단일 인스턴스·무자격증명.

## 1. 왜 / 언제 이전하나 (트리거)
지금 SQLite로 충분하나, 아래 중 하나가 오면 이전한다.
- **앱 인스턴스 2대 이상** 필요(수평 확장·무중단 배포 겹침) → 파일 DB는 한 볼륨=한 서비스라 공유 불가.
- **외부 도구 직접 연결**(BI·메타베이스·데이터 분석·백오피스) 필요 → SQLite는 컨테이너 셸 진입해야만 봄.
- **동시 쓰기 부하 증가**(여러 운영자·계약사 대량 동시 업로드) → SQLite는 쓰기 직렬화(단일 writer).
- **가용성 요구 상승**(자동 페일오버·PITR) → 관리형 Postgres가 제공.

트리거 없으면 유지. 조기 이전은 운영 복잡도만 늘림.

## 2. 이전이 쉬운 이유 — 저장 계층이 이미 추상화됨
`db.py`는 **문서-블롭 KV 저장소**다: `read(collection, default)` / `write(collection, data)` 두 함수뿐. 엔진·API는 이 두 함수만 호출한다(컬렉션 = tenants·contracts·users·invites·aliases·splits·dist_cfg·tenant_dist·flags·settlement_runs·settings).

→ **SQLite를 Postgres로 바꿔도 이 인터페이스만 유지하면 호출부 무변경.** 실제 바꿀 파일은 `db.py` 하나.

## 3. 목표 스키마 (Postgres)
동일 KV 유지가 가장 단순(변경 최소):
```sql
CREATE TABLE kv (
  collection TEXT PRIMARY KEY,
  data       JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```
- `data`를 **JSONB**로 두면 지금 블롭 구조 그대로 이전 + 필요 시 JSONB 인덱싱/부분 질의 가능.
- 쓰기: `INSERT ... ON CONFLICT(collection) DO UPDATE`(현재와 동일 패턴).
- (선택·후속) 성장하면 자주 질의하는 컬렉션(계약·정산런)은 **정규화 테이블**로 분리. 단계적.

## 4. `db.py` 교체 설계
- 드라이버: `psycopg[binary]`(psycopg3) 또는 `asyncpg`. FastAPI 동기 호출부라 psycopg3 동기+커넥션 풀(`psycopg_pool`)이 무난.
- 접속: 환경변수 **`DATABASE_URL`**(Railway Postgres 플러그인이 자동 주입). `APP_DB`(SQLite 경로) 대신 `DATABASE_URL` 존재 시 Postgres 백엔드 선택.
- `read/write` 시그니처·동작 동일 유지. `_lock`(스레드락)은 DB 트랜잭션으로 대체.
- WAL/PRAGMA 등 SQLite 전용 코드 제거.

분기 예(개념):
```python
if os.environ.get("DATABASE_URL"):
    backend = PostgresKV(os.environ["DATABASE_URL"])
else:
    backend = SqliteKV(DB_PATH)   # 로컬·소규모 그대로
def read(c, d):  return backend.read(c, d)
def write(c, x): backend.write(c, x)
```
→ 로컬 개발은 SQLite, 배포는 Postgres로 **환경변수만으로 전환**.

## 5. 데이터 이관 절차 (1회)
1. Railway에 **Postgres 플러그인 추가** → `DATABASE_URL` 발급.
2. 이관 스크립트: 현재 `app.db`의 `kv` 전 행을 읽어 Postgres `kv`에 `INSERT`(컬렉션 단위 그대로 복사). 문서-블롭이라 **변환 없이 1:1**.
3. 앱에 `DATABASE_URL` 설정 → 재배포 → Postgres 백엔드로 기동.
4. 검증: 회원·테넌트(128)·계약·정산런 카운트 대조, 회귀 스크립트, 스모크 테스트.
5. 롤백: `DATABASE_URL` 제거하면 다시 SQLite(볼륨)로 복귀(이관 전 스냅샷 보존).

## 6. 세션 영속(B4)과의 관계
- 현재 업로드한 정산 데이터는 **메모리 세션**이라 재배포 시 소멸(재업로드 필요).
- Postgres 이전과 별개지만, **B4(정산 세션/스냅샷 영속)** 를 같이 설계하면 좋다: 표준화 결과(records/df)를 테넌트·기간 단위로 DB(또는 오브젝트 스토리지)에 저장 → 재배포·CP 로그인 시 재업로드 없이 조회. 데이터가 크므로 KV 블롭보다 **정규화 테이블 or 파케이/오브젝트 스토리지**가 적합.

## 7. 운영 차이 요약
| 항목 | 현재(SQLite+볼륨) | 이전 후(Postgres) |
|---|---|---|
| 접속 | 컨테이너 셸 → 파일 | `DATABASE_URL`(host/port/user/pass) · 사설망 |
| 확장 | 단일 인스턴스 | 다중 앱 인스턴스 공유 |
| 외부 연동 | 불가(셸만) | BI·백오피스 직접 연결 |
| 백업 | 볼륨 내 일 1회 덤프(구현됨) + Railway 볼륨 백업 | 관리형 자동 백업·PITR |
| 자격증명 | 없음 | 있음(로테이션 관리 필요) |
| 운영 난도 | 최저 | 중 |

## 8. 결론·권고
- **지금은 이전 불필요.** SQLite+볼륨+일 1회 백업으로 충분.
- 트리거(다중 인스턴스·외부연동·부하·가용성) 도달 시 **`db.py` 백엔드 교체 + `DATABASE_URL`** 로 저비용 이전. 저장 계층 추상화 덕에 리스크 작음.
- 이전 시 **B4 세션 영속**을 함께 설계 권장.
