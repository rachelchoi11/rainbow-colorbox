# 부보호자(Secondary Guardian) 기능/정책 명세

작성일: 2026-04-24
- silvertoktok-server HEAD: `20e969a` (SMS 발송 결과 검증 + 본문 축약)
- silvertoktok-app HEAD: `c2ecce4` (부보호자 연락처 선택 화면 개선)

본 문서는 코드 정적 분석 기반. 정책 해석이 모호한 부분은 ❓로 표시.

---

## 1. 개요

### 1.1 부보호자란
환자(요양/입원)에 대해 **주보호자가 아닌 추가 보호자**. 주보호자가 자기 권한으로 부보호자를 초대하고, 부보호자는 환자의 면회/상태/알림에 접근한다.

### 1.2 주보호자 vs 부보호자 차이
| 항목 | 주보호자 (guardianType=0) | 부보호자 (guardianType=1) |
|---|---|---|
| 등록 경로 | 환자 등록 시점에 주보호자 가입코드로 등록 (`CmPatient.rxPatientAdd` → `PatientGuardianCodeTable.rxPutCodeForMainGuardian`) | 주보호자가 부보호자 메뉴에서 초대 (`secondaryGuardianCodeReq`) |
| 한 환자당 인원 | 1명 (활성 주보호자 중복 차단: `CmPatientGuardian.rxHasActiveMainGuardian`) | ❓ 코드에서 상한 체크 없음 (5.4 참조) |
| 부보호자 관리 메뉴 | 노출 (`mypage_router.dart:104` `_isMainGuardian`) | 미노출 |
| 부보호자 초대 | 가능 | 불가 (`SecondaryGuardians.kt:54` 권한 체크) |
| 면회 강제 취소 | 가능 (`visitationApplyCancelByMain`) | 불가 |
| 비정규화 필드 | `PatientInfoTable.mainGuardianUIDX`에 동기화 (`rxGuardianUpdate` best-effort) | 없음 |
| 환자 목록 조회 | 표시 | 표시 (Fix-1 memory: `rxScanForUidx`의 guardianType=0 필터 제거됨) |

### 1.3 관련 용어
- **guardianType**: tinyint, 0=main, 1=sub (`PatientGuardiansTable.sql` comment)
- **myGuardianType**: 앱이 받는 환자 row 내 필드. 현재 로그인 사용자 기준 본인의 type. 구버전 서버에선 null → 앱이 fallback 처리 (`mypage_router.dart:144-145`)
- **대리보호자**: bd2a3e7 commit 메시지에 등장. 코드상 별도 식별 키 없음. 부보호자와 동일 의미로 추정
- **sourceType**: ❓ 부보호자와 **무관**. e879a88은 `PartnerVisitApplyV2Table.sourceType (varchar(10))` — 면회 예약 출처(app/cms) 구분용. 부보호자 관련 컬럼 아님 (grep 결과 SecondaryGuardians/PatientGuardian 코드에 sourceType 사용 0건 확인)

---

## 2. 데이터 모델

### 2.1 관련 테이블

#### `PatientGuardiansTable` (DDL: `dbCreationSql/PatientGuardiansTable.sql`)
```sql
CREATE TABLE PatientGuardiansTable (
  patientID int,
  uidx int,
  guardianType tinyint comment '0 - main, 1- sub',
  PRIMARY KEY (patientID, uidx),
  index u(uidx)
);
```
- `(patientID, uidx)` 복합 PK → 한 환자×한 사용자 조합 1건
- guardianType은 같은 (patientID, uidx) 조합 내 1개만 가능. 같은 사용자가 한 환자에 대해 main과 sub를 동시에 가질 수 없음
- `index u(uidx)` → 사용자 기준 환자 목록 조회 빠름

#### `PatientGuardianCodeTable` (DDL: `dbCreationSql/PatientGuardianCodeTable.sql`)
```sql
CREATE TABLE PatientGuardianCodeTable (
  ID int AUTO_INCREMENT primary key,
  patientID int,
  code varchar(10),
  guardianType tinyint,
  phone varchar(20),
  UNIQUE INDEX u_code(code)
);
```
- 6자리 영숫자 코드(`generateRandomString(6)`)이지만 컬럼은 varchar(10) — 향후 확장 여지
- `UNIQUE INDEX u_code(code)` → 동일 코드 중복 발급 방지 (race window 시 INSERT 실패 가능성)
- ❓ **DDL에 `deletedAt`, `invitationCancelAt` 필드 없음**. 그러나 `SecondaryGuardians.kt:96`에서 `JsonObject().put("deletedAt", ...).put("invitationCancelAt", ...)` 사용 + `CmPatientGuardian.rxSecondaryGuardianScanByUnregistered`에서 `pg2.deletedAt is null` WHERE 절. → **프로덕션에 ALTER TABLE로 추가됐을 가능성 높음** (memory: feedback-ddl-vs-production-db.md "DDL에 없는 컬럼이 프로덕션에 존재할 수 있음" 패턴과 일치)
- 운영자 ALTER 확인 필요 항목: `ALTER TABLE PatientGuardianCodeTable ADD COLUMN deletedAt bigint NULL, ADD COLUMN invitationCancelAt bigint NULL`

#### `UsersInfoTable` (가입자 식별)
- `secondaryGuardianCodeReq` (`SecondaryGuardians.kt:58`) — `WHERE phone='$normalizedPhone'`로 가입 여부 체크
- `deletedAt`이 NULL인 활성 사용자만 카운트 (`CmPatientGuardian.rxSecondaryGuardianScan` L106)

#### `PatientInfoTable` (환자 정보)
- `mainGuardianUIDX` 비정규화 필드 — 주보호자 변경 시 `rxGuardianUpdate` (PatientGuardiansTable.kt:71) best-effort 동기화 (실패 시 drift)
- 부보호자에 대해서는 비정규화 필드 없음

### 2.2 관계도 (ASCII)

```
                              [PatientInfoTable]
                                    │ ID
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       │                                                        │
[PatientGuardiansTable]                            [PatientGuardianCodeTable]
  patientID, uidx ───┐                              patientID, code, phone, guardianType
  guardianType (0/1) │                                 │ phone (정규화)
                     │ uidx                            │
                     ▼                                 ▼ 회원가입 시 코드 검증
              [UsersInfoTable]  ◀──── 가입 후 PatientGuardiansTable에 INSERT
                  uidx, phone, name, deletedAt
```

흐름:
- 부보호자 초대 직후: `PatientGuardianCodeTable`에만 (phone, code, guardianType=1) row 존재 (사용자가 아직 가입 안 함)
- 부보호자 가입 후: `UsersInfoTable`에 신규 사용자 + `PatientGuardiansTable`에 (patientID, uidx, guardianType=1) row 추가 + `PatientGuardianCodeTable`의 코드 row는 삭제됨 (`CmPatientGuardian.rxPatientGuardianDBSetting` → `PatientGuardianCodeTable.rxDelWhere` L202)
- 이미 가입자: 코드 단계 생략. 즉시 `PatientGuardiansTable`에 INSERT (`PatientGuardiansTable.rxSecondaryGuardianAdd` L80)

### 2.3 FK 없음 정책 (memory: db-no-fk-no-redis-cache.md)
- 4 테이블 모두 외래키 제약 없음. 정합성은 앱 레벨에서 관리
- 환자 삭제 시 12 연관 테이블 선삭제 필수 (memory: db-patient-dependency.md)

---

## 3. API (클라이언트-서버 계약)

모든 API는 `POST /api` + JSON `{command, params, utk}` 패턴. 본 섹션의 4 command는 모두 App API (CMS 측 부보호자 관리 command 없음 — 5.7 참조).

`silvertoktok-server/.../app/api/SecondaryGuardians.kt`에서 정의 (L17-L23, ApiBinder).

### 3.1 `secondaryGuardiansGet` — 부보호자 목록 조회
- Request: `params` 불필요, utk만
- Response: `{ret:true, items:[...]}` — 가입자 + 미가입자 합쳐서 반환
- 가입자: `CmPatientGuardian.rxSecondaryGuardianScan` (L82-L119) — patientID + uidx + userName + patientName + partnerName
- 미가입자: `CmPatientGuardian.rxSecondaryGuardianScanByUnregistered` (L124-L155) — ID(코드 row) + phone + patientID + patientName + partnerName
- 권한: 호출자 본인이 주보호자(guardianType=0)인 환자들의 부보호자만 조회

### 3.2 `secondaryGuardianCodeReq` — 부보호자 초대
- Request: `params: {phone: String, patientID: Int}`
- Response 분기:
  - 호출자 권한 부족: `{ret:false, msg:"환자의 주보호자가 아닙니다."}`
  - 미가입자 + SMS 성공: `{ret:true, message:"인증코드가 전송되었습니다."}`
  - 미가입자 + SMS 실패: `{ret:false, msg:"초대코드 SMS 발송에 실패했습니다. 잠시 후 다시 시도해주세요."}`
  - 가입자 + 등록 성공: `{ret:true, message:"부보호자로 등록되었습니다."}`
- Side effect:
  - 미가입자: PatientGuardianCodeTable에 (patientID, code, phone, guardianType=1) UPSERT (이전 같은 (patientID, phone, guardianType=1) 삭제 후 INSERT) + SMS 발송
  - 가입자: PatientGuardiansTable에 (patientID, uidx, guardianType=1) INSERT (트랜잭션 + guardianType=0 중복 체크) + FCM 푸시 ("부보호자 등록")

### 3.3 `secondaryGuardianInviteCancel` — 초대 취소 (미가입자)
- Request: `params: {ID: Int}` — PatientGuardianCodeTable의 ID
- Response: `{ret:true}` 또는 `{ret:false, msg:"환자의 주보호자가 아닙니다."}`
- Side effect: PatientGuardianCodeTable에 `deletedAt=now() + invitationCancelAt=now()` UPDATE (soft delete)
- 권한: PatientGuardianCodeTable에서 ID로 patientID 조회 → 호출자가 그 환자의 주보호자인지 검증 (`SecondaryGuardians.kt:90-95`)

### 3.4 `secondaryGuardianDelete` — 부보호자 삭제 (가입자)
- Request: `params: {patientID: Int, uidx: Int}`
- Response: `{ret:true}` 또는 `{ret:false, msg:"환자의 주보호자가 아닙니다."}`
- Side effect: PatientGuardiansTable에서 `WHERE patientID=$patientID AND uidx=$targetUidx AND guardianType=1` DELETE (hard delete)
- 권한: 주보호자 검증 (L111)

⚠️ **API 명명 주의**: 클라이언트 메서드는 `secondaryGuardianDelete(patientID, uidx)`, 서버 핸들러는 `secondaryGuardianDelete`. 서버 본문은 params에서 두 번 `params.int("uidx")`를 호출하며 한 번은 호출자 본인 uidx(json.uidx)와 다른 변수명을 씀 (`SecondaryGuardians.kt:107-108`). `targetUidx = params.int("uidx")` — 즉 params 안의 uidx가 삭제 대상이고 호출자는 outer json.uidx. 명명 충돌은 없으나 헷갈림.

---

## 4. 플로우

### 4.1 부보호자 추가 (미가입자)

| Step | 위치 | 동작 |
|---|---|---|
| 1 | App `mypage_router.dart:104-105` | "부 보호자 관리" 메뉴 표시 (주보호자만, `_isMainGuardian` 체크) → tap |
| 2 | App `secondary_guardian_router.dart` | `ManageSecondaryGuardianRouter` 진입. AppBar의 "+" 버튼 (L46-L51) → `addSecondaryGuardian()` (L110-L114) |
| 3 | App `select_patient_router.dart` | `SelectPatientRouter` — 본인이 주보호자인 환자(`Patients.inst.isMainGuardian` 필터)만 표시 (L18-L22) |
| 4 | App `select_patient_router.dart:54` | 환자 tap → `ContactPickerRouter(patientID: ...)` push |
| 5 | App `contact_picker_router.dart:30` | `_loadContacts()` — `flutter_contacts` 권한 요청 → `getAll(properties: {phone})` |
| 6 | App `contact_picker_router.dart:108` | "연락처 검색" TextField + 한글 초성 매칭 (`_matchHangul`) + 폰번호 매칭 (`_matchContact`) |
| 7 | App `contact_picker_router.dart:191` | contact tap → `_onSelect(phone, label: hasName ? rawName : null)` |
| 8 | App `contact_picker_router.dart:213-225` | `confirm("부보호자 인증 코드 전송", "$label님께($phone) 인증코드를 보내시겠습니까?")` → 확인 → Loading.show |
| 9 | App `contact_picker_router.dart:224` | `Api.inst.secondaryGuardianCodeReq(phone, patientID)` (api.dart:114) |
| 10 | Server `SecondaryGuardians.kt:46-81` | `secondaryGuardianCodeReq` 핸들러 진입 |
| 11 | Server `SecondaryGuardians.kt:51` | `Utils.formattedPhoneNumber(phone)` 정규화 |
| 12 | Server `SecondaryGuardians.kt:54` | 호출자 주보호자 검증 (`PatientGuardiansTable.rxScan("uidx=$uidx and patientID=$patientID and guardianType=0")`) |
| 13 | Server `SecondaryGuardians.kt:58` | 가입자 조회 (`UsersInfoTable.rxScan("phone='$normalizedPhone'")`) → empty → 미가입자 분기 |
| 14 | Server `PatientGuardianCodeTable.kt:26-32` | `rxPutCodeForSecondaryGuardian(patientID, phone)` — `(patientID, phone, guardianType=1)` 기존 row DELETE 후 (patientID, code, guardianType=1, phone) INSERT |
| 15 | Server `SecondaryGuardians.kt:61-62` | `PatientInfoTable.rxPatientScan` → patientName 조회 |
| 16 | Server `SecondaryGuardians.kt:63` | `Utils.smsSend(phone, "[실버톡톡] $patientName 부보호자 초대코드: $code\n※ 부보호자 가입 전용 코드")` |
| 17 | Server `Utils.kt:317-344` | `smsSendInternal` → smsi_Lib `Send_Sms` → `SmsResult(success, raw, reason, elapsedMs)` |
| 18 | Server `SecondaryGuardians.kt:65-70` | success 분기 → `{ret:true, message:"인증코드가 전송되었습니다."}` / fail 분기 → `[SECONDARY-GUARDIAN-SMS-FAIL]` 로그 + `{ret:false, msg:"초대코드 SMS 발송에 실패했습니다. ..."}` |
| 19 | App `contact_picker_router.dart:226-231` | toast + `Get.back(result: phone)` 또는 snackbar 오류 |
| 20 | (미가입 부보호자) | SMS 수신 → 앱 다운로드 (별도 안내 경로 — SMS 본문에 링크 없음, 5.3 참조) → 회원가입 (`Signup6CompletedRouter.dart:179` "보호자 코드 입력") → 6자리 코드 입력 |
| 21 | Server `CmUsers.kt:240+` `rxSignup` | `PatientGuardianCodeTable.rxScan("code='$patientCode'")` → guardianType=1 추출 → `rxPatientGuardianDBSetting(code, uidx, patientID, 1)` |
| 22 | Server `CmPatientGuardian.kt:199-228` | `rxPatientGuardianDBSetting` — guardianType≠0이므로 바로 `proceed`: `PatientGuardiansTable.rxGuardianUpdate(patientID, uidx, 1)` (INSERT) + `PatientGuardianCodeTable.rxDelWhere("code='$code'")` (코드 소비) |

### 4.2 부보호자 추가 (가입자)

Step 1-13 동일. 그 다음:
- Server `SecondaryGuardians.kt:67-78`: 미가입자 분기 대신 즉시 등록
  - `PatientGuardiansTable.rxSecondaryGuardianAdd(patientID, targetUidx)` (`PatientGuardiansTable.kt:80-114`):
    - 트랜잭션 begin
    - `SELECT COUNT(*) FROM ... WHERE patientID=? AND guardianType=0 AND uidx=?` — 본인이 이미 주보호자면 INSERT 스킵 (idempotent)
    - 아니면 `INSERT INTO ... (patientID, uidx, guardianType) VALUES (?, ?, 1)`
    - commit
  - `CmAlarmsAndPush.rxPushTo(targetUidx, "부보호자 등록", "$pName 환자의 부보호자로 등록되었습니다.", null)` FCM 푸시
- 응답: `{ret:true, message:"부보호자로 등록되었습니다."}`

⚠️ **본인 동의 절차 없음** (가설 vs 정책 — 5.6 참조). 부보호자 본인 휴대폰에 "수락" 액션 없이 즉시 등록 + 푸시만.

### 4.3 부보호자 해제

#### 미가입자 (초대 취소)
- App `secondary_guardian_router.dart:116-126` `_onInviteCancel` → `confirm("초대를 취소하시겠습니까?")` → `Api.inst.secondaryGuardianInviteCancel(item["ID"])` → 성공 시 _refresh + toast
- Server: PatientGuardianCodeTable의 row를 deletedAt + invitationCancelAt UPDATE (soft delete)
- 미가입자가 그 코드로 가입 시도하면? `CmUsers.kt:240`의 `PatientGuardianCodeTable.rxScan("code='$patientCode'")`가 deletedAt 필터 없음 → soft-deleted 코드도 매칭 가능. ❓ 주의 필요

#### 가입자 (삭제)
- App `secondary_guardian_router.dart:128-138` `_onDelete` → `confirm("부보호자를 삭제하시겠습니까?")` → `Api.inst.secondaryGuardianDelete(patientID, uidx)` → 성공 시 toast + _refresh
- Server: PatientGuardiansTable에서 `WHERE patientID=? AND uidx=? AND guardianType=1` DELETE (hard delete)
- 부보호자 본인에게 삭제 알림? FCM 푸시 등 알림 코드 없음 (`SecondaryGuardians.kt:105-118`에서 push 없음) — 본인은 자기가 부보호자에서 빠진 사실을 모를 수 있음

### 4.4 sourceType 차이 (app vs cms)

❓ **부보호자와 무관**. e879a88(2026-04-17) commit "면회 예약 출처 구분: sourceType 컬럼 추가 (app/cms)"는 면회 시스템(`PartnerVisitApplyV2Table`) 전용. 부보호자 코드/초대/관리에 sourceType 컬럼 없음. 두 변경이 같은 시점에 들어가서 사용자가 혼동했을 가능성.

---

## 5. 정책 규칙 (코드에서 추출)

### 5.1 권한 체크
- 부보호자 초대/취소/삭제 모두 **호출자가 해당 환자의 주보호자(guardianType=0)인지** PatientGuardiansTable로 검증 (SecondaryGuardians.kt:54, 92, 111)
- 운영자(DV/OP) 우회 경로 ❓ 없음 (CMS API에 부보호자 관리 command 없음 — grep 결과)

### 5.2 초대 코드 정책
- **포맷**: 6자리 영숫자 (대문자 A-Z + 숫자 0-9), `PatientGuardianCodeTable.kt:34-39 generateRandomString(6)`
- **유니크 제약**: `UNIQUE INDEX u_code(code)` — 동일 코드 발급 시 INSERT 실패. 코드 충돌 race window 시 RETRY 로직 ❓ 없음 — 천문학적 확률(36^6 ≈ 21억)이라 무시 가능
- **만료 기간**: ❓ DDL에 expiresAt 없음. 코드에서 `code = '$code'` 조회 시 시간 필터 없음 → 영구 유효
- **재발송 정책**: 같은 (patientID, phone, guardianType=1)로 재호출 시 `rxPutCodeForSecondaryGuardian`이 기존 row DELETE 후 새 코드 INSERT → **이전 코드 무효화 + 새 코드 발급** (코드 누적 없음, Fix-4 패턴)
- **soft delete**: `secondaryGuardianInviteCancel`이 `deletedAt + invitationCancelAt` 업데이트하지만 회원가입 흐름의 코드 검증(`CmUsers.kt:249`)은 deletedAt 필터 없음 → ❓ 취소된 코드도 가입에 사용 가능 (잠재 결함)

### 5.3 SMS 본문 (배포 버전 기준 — commit 20e969a)

```
[실버톡톡] {환자명} 부보호자 초대코드: {6자리코드}
※ 부보호자 가입 전용 코드
```

- 발신번호: `07048005004` (`Utils.kt:39 SMS_SENDER_PHONE`)
- 게이트웨이: smsi_Lib (audiopub 계정)
- 호출: `Utils.smsSend(...)` (SMS, LMS 아님)
- byte 길이 (CP949 기준): 환자명 3글자=70B, 7글자=78B → SMS 90B 한도 내 안전 (T-020 검증)
- ⚠️ **앱 다운로드 링크 미포함** (T-017 rollback 결과 — 사용자 결정: "주보호자가 카톡/구두로 따로 안내하는 관행 + 통합 URL 부재")

### 5.4 부보호자 인원 상한
- ❓ **코드에서 명시 상한 체크 없음** (`secondaryGuardianCodeReq` / `rxSecondaryGuardianAdd` / `rxPutCodeForSecondaryGuardian` 모두 COUNT 후 차단 로직 없음)
- 한 환자에 대해 무제한 부보호자 등록 가능 (이론상)
- 실무상 상한 필요하면 정책 결정 후 코드 추가 필요

### 5.5 권한 범위 (부보호자가 볼 수 있는 데이터)
코드 grep 결과 부보호자에 대한 명시적 권한 분리 케이스:
- ✅ "부 보호자 관리" 메뉴: 주보호자만 (`mypage_router.dart:104` `_isMainGuardian`)
- ✅ 면회 강제 취소: 주보호자만 (Fix-11 `visitationApplyCancelByMain`, memory)
- ❓ 그 외 환자 정보/면회 조회/채팅/문서/푸시 알림 등은 부보호자도 동일 접근 (별도 차단 코드 없음)
- Fix-1(memory): `rxScanForUidx`의 guardianType=0 필터 제거 → 부보호자도 자기 환자 목록 정상 표시
- 정확한 권한 매트릭스는 `silvertoktok-app/lib/`의 각 화면별 `myGuardianType` / `isMainGuardian` 사용처 전수조사 필요 (본 문서 범위 외)

### 5.6 본인 동의 절차 (가입자 즉시 등록 시)
- ❓ **현재 코드: 본인 동의 없이 즉시 등록 + FCM 푸시 1회만** (`SecondaryGuardians.kt:67-77`)
- 정책인지 결함인지 사용자 확인 필요:
  - 정책이라면: SMS 인증/푸시 클릭 동의 등 추가 흐름 불필요
  - 결함이라면: 부보호자 본인이 푸시 클릭으로 "수락" 단계 추가 필요. 거부하면 등록 취소
- 보안/UX 관점: 누군가 임의로 타인 휴대폰을 부보호자로 등록하면 그 사람은 본인 인지 없이 환자 정보 노출 → 동의 필요성 ↑

### 5.7 CMS 측 부보호자 관리
- grep `secondaryGuardian|sourceType` 결과: `silvertoktok-server/.../cms/` 0건
- CMS 측 부보호자 직접 관리 기능 **없음**. CMS는 주보호자 코드 발급/재발급(`PartnerGuardian.guardianCodeIssue/Scan`)만 처리

---

## 6. 알려진 이슈 / deferred 항목

본 세션(ws-11)에서 식별된 항목:

### 6.1 CmPatient 환자 등록 원자성 (codex T-024 진행 중)
- `CmPatient.rxPatientAdd`: PatientInfoTable.rxPut 후 SMS 실패 → 환자 row 남고 ret:false → orphan
- 부보호자 미가입자 흐름에도 **유사 리스크 존재**: PatientGuardianCodeTable INSERT(L60) 후 SMS 실패(L63-L67) → 코드 row 남고 ret:false. 단 `rxPutCodeForSecondaryGuardian`이 idempotent (DELETE-first) → 재시도 시 자동 회복. 주보호자 가입 케이스보다 영향 작음
- 별도 PR: 트랜잭션 보상 로직 또는 코드 재발송 API

### 6.2 [SMS-SEND*] 로그 timestamp/thread 부재
- 현재 `println` 기반. `[Redis-CONN-DEBUG]` 같은 통합 로그 포맷 (timestamp + thread) 없음
- 공통 logger 함수로 이동 권장

### 6.3 Utils.mmsSend 호출자 0건
- L3 rollback(T-017) 후 모든 SMS는 smsSend로 환원. mmsSend 정의만 유지
- 정리할지(YAGNI vs 보존) 사용자 결정

### 6.4 SMS 발송 실패 시나리오 (codex T-024 별도 조사)
- M3 측정(p50/p95) → eventloop 블로킹 우려 시 `vertx.rxExecuteBlocking` 도입

### 6.5 본 명세 작성 중 발견 신규 ❓
- (a) PatientGuardianCodeTable DDL에 `deletedAt`/`invitationCancelAt` 없으나 코드에서 사용 → 프로덕션 DDL 동기화 확인 필요
- (b) 회원가입 시 코드 검증(`CmUsers.kt:249`)이 `deletedAt` 필터 없음 → soft-deleted 코드도 가입 가능 (잠재 결함)
- (c) 부보호자 가입자 즉시 등록 시 본인 동의 절차 없음 (5.6) — 정책 결정 필요
- (d) 부보호자 인원 상한 미체크 (5.4) — 정책 결정 필요
- (e) 부보호자 삭제 시 본인 알림 없음 (4.3 가입자) — UX 결함 가능성

---

## 7. 최근 변경 이력

### git log (관련 commit)
| Hash | 일자 | 변경 |
|---|---|---|
| `c2ecce4` (app) | 2026-04-23 | 부보호자 연락처 선택 화면 개선 (검색 빈 박스 수정 + 한글 초성 매칭 + displayName fallback) |
| `20e969a` (server) | 2026-04-23 | SMS 발송 결과 검증 + 본문 축약 (모든 caller가 SmsResult 확인) |
| `e879a88` (server) | 2026-04-17 | 면회 예약 출처 구분 sourceType (부보호자 무관) |
| `940a05f` (server) | 2026-04-17 | 면회 정책: 예약 공유 조회 + 주보호자 강제 취소 (Fix-10/11) |
| `60a6224` (server) | 2026-04-17 | 부보호자 시스템 Phase 2: DDL 정합성 + 코드 경고 + 비정규화 동기화 |
| `2198d0d` (server) | 2026-04-17 | 부보호자 시스템 핫픽스: guardianType 필터 제거 + 주보호자 보호 + SMS 역할 명시 (Fix-1~9) |
| `86c7f50` (app) | 2026-04 | 부보호자 UX: myGuardianType 기반 배지/메뉴/필터 (Fix-7) |
| `bd2a3e7` (app) | 2026-04 이전 | 대리보호자 기능 추가 (초기 도입) |

### 본 세션(ws-11)에서 진행한 부보호자 관련 task
- T-014: 연락처 선택 화면 + SMS 경로 조사
- T-015: 앱 H1+L1+L2+M2 (filter-then-build, 한글 초성, 빈 상태 안내, displayName fallback)
- T-016 / T-016-resume: 서버 SMS 결과 검증 (M1) + 측정 로깅 (M3) + 본문 LMS 전환 (L3)
- T-017: L3 rollback (앱 다운로드 링크 제거 — 사용자 정책 결정)
- T-020: SMS 본문 축약(byte 19B 절약) + displayName 빈/공백 trim fallback
- T-023: 배포 (서버 20e969a + iOS TestFlight 업로드 c2ecce4)
- T-024: codex 진행 중 (SMS 실패 추가 조사)
- T-025: 본 문서

---

## 8. 관련 CMS 페이지

- ❌ **CMS에 부보호자 직접 관리 기능 없음**
- CMS가 다루는 인접 기능:
  - 주보호자 코드 발급: `PartnerGuardian.guardianCodeIssue` (CMS API, role: DV/OP/PN)
  - 주보호자 코드 조회: `PartnerGuardian.guardianCodeScan`
  - 보호자 비밀번호 초기화: 2026-04-17 세션에서 추가 (memory 참조)
- 부보호자 운영 시 사용자 측 직접 추가/삭제 화면 필요해지면 별도 CMS 작업 필요

---

## 9. 운영 모니터링 포인트

### 로그 grep
| 태그 | 의미 | 위치 |
|---|---|---|
| `[SECONDARY-GUARDIAN-SMS-FAIL]` | 부보호자 초대 SMS 발송 실패 | `SecondaryGuardians.kt:66` |
| `[SMS-SEND]` | 모든 SMS 발송 (성공/실패 무관, elapsedMs 포함) | `Utils.kt:336` |
| `[SMS-SEND-FAIL]` | SMS 게이트웨이 실패 (raw + reason) | `Utils.kt:339` |
| `[SMS-SEND-SLOW]` | 500ms 초과 발송 (eventloop 블로킹 신호) | `Utils.kt:342` |

### DB 쿼리 (서비스 건강성)
```sql
-- 활성 부보호자 수
SELECT COUNT(*) FROM PatientGuardiansTable WHERE guardianType = 1;

-- 미가입 초대 코드 수 (소비 안 된 + 취소 안 된)
SELECT COUNT(*) FROM PatientGuardianCodeTable
WHERE guardianType = 1 AND deletedAt IS NULL;

-- 환자별 부보호자 인원 분포 (상한 정책 결정 자료)
SELECT patientID, COUNT(*) AS cnt
FROM PatientGuardiansTable WHERE guardianType = 1
GROUP BY patientID ORDER BY cnt DESC LIMIT 20;

-- 코드 발급 vs 가입 전환율 (지난 30일)
-- (PatientGuardianCodeTable에 createdAt 없으면 ID auto_increment로 시간 추정)
```

### 운영 알림 권장
- `[SECONDARY-GUARDIAN-SMS-FAIL]` 로그가 시간당 N건 이상이면 SMS 게이트웨이 점검
- PatientGuardiansTable의 guardianType=1 row가 갑자기 줄어들면 (대량 삭제 의심) 알림
- PatientGuardianCodeTable에 deletedAt이 NULL이고 ID가 매우 오래된 row가 누적되면 (가입 미완) 정리 정책 필요

---

## 10. 사용자 확인 필요 항목 (❓ 정리)

본 문서에서 코드만으로 판단 불가능한 정책/모호 영역:

1. **부보호자 인원 상한** (5.4): 한 환자당 최대 N명? 정책 결정 후 코드 가드 필요
2. **본인 동의 절차** (5.6): 가입자 즉시 등록이 정책인가, 결함인가?
3. **부보호자 권한 범위** (5.5): 면회/채팅/문서/푸시 등 영역별 차등 권한 필요한가?
4. **soft-deleted 코드 회원가입 차단** (5.2 b): `CmUsers.kt:249`의 코드 검증에 deletedAt 필터 추가할 것인가?
5. **PatientGuardianCodeTable DDL ↔ 프로덕션 차이** (2.1 b): `deletedAt`/`invitationCancelAt` 컬럼이 실제 프로덕션 DB에 존재하는지 운영자 확인. 없으면 secondaryGuardianInviteCancel이 운영 환경에서 실패 (에러 응답)
6. **부보호자 삭제 시 본인 알림** (4.3): 푸시 알림으로 "부보호자에서 해제되었습니다" 등 통보 추가할 것인가?
7. **SMS 본문에 환자명 노출**: 개인정보 보호 측면에서 "{환자명} 부보호자 초대" 표현이 적절한가? (현재 메시지 받는 사람이 가입 안 된 일반 사용자임을 고려)
8. **대리보호자 vs 부보호자 용어 통일**: 코드에는 둘 다 등장. UI/문서/SMS 본문에서 일관 용어 채택 필요

---

## 11. 코드 위치 빠른 참조

### App
- 진입: `lib/routers/main_routers/mypage_routers/mypage_router.dart:104`
- 목록: `lib/routers/main_routers/mypage_routers/secondary_guardian/secondary_guardian_router.dart`
- 환자 선택: `lib/routers/main_routers/mypage_routers/secondary_guardian/select_patient_router.dart`
- 연락처 선택: `lib/routers/main_routers/mypage_routers/secondary_guardian/contact_picker_router.dart`
- item 위젯: `lib/routers/main_routers/mypage_routers/secondary_guardian/secondary_guardian_item.dart`
- 데이터 캐시: `lib/data/secondaryGuardians.dart` (Singleton + Sembast)
- API: `lib/api/api.dart:112-116`

### Server
- App API: `src/main/kotlin/com/trus/silvertoktok/app/api/SecondaryGuardians.kt`
- 비즈니스: `src/main/kotlin/com/trus/silvertoktok/common/patient/CmPatientGuardian.kt`
- DB:
  - `src/main/kotlin/com/trus/silvertoktok/db/patient/PatientGuardiansTable.kt`
  - `src/main/kotlin/com/trus/silvertoktok/db/patient/PatientGuardianCodeTable.kt`
- DDL:
  - `src/main/resources/dbCreationSql/PatientGuardiansTable.sql`
  - `src/main/resources/dbCreationSql/PatientGuardianCodeTable.sql`
- SMS 인프라: `src/main/kotlin/utils/Utils.kt:25-355` (SmsResult, smsSendInternal, smsSend)
- 회원가입 시 코드 검증: `src/main/kotlin/com/trus/silvertoktok/common/CmUsers.kt:240+`
