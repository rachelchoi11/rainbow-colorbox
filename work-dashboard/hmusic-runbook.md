# HMERP 온보딩 런북 (제로 → 로컬 개발서버 실행)

> 처음 받는 사람이 **그대로 따라 하면 로컬에서 개발서버가 뜨도록** 정리한 단계별 가이드. 명령어를 전부 포함하고, 각 단계가 "왜" 필요한지도 짧게 붙였다.
> 더 깊은 배경(인프라/배포/시크릿 인벤토리)은 [`handover-base.md`](handover-base.md), 코드 구조는 [`project-structure.md`](project-structure.md) 참고.
> macOS(Apple Silicon) 기준. 명령어는 `Terminal` 앱에 한 줄씩 붙여넣고 Enter.

---

## 0. 먼저 아는 용어 (아주 짧게)

- **터미널/명령어**: 글자로 컴퓨터에 시키는 도구. 한 줄 = 한 명령.
- **sudo**: "관리자 권한으로" 실행. Mac 로그인 비번을 물어봄(입력 시 화면에 안 보이는 게 정상).
- **Homebrew(`brew`)**: Mac용 프로그램 설치 도구(명령어판 앱스토어). 없으면 https://brew.sh 참고.
- **Tailscale**: 회사 서버에만 안전하게 들어가는 사설망(테일넷). **켜져 있어야** 서버·DB에 접속됨.
- **자바(JDK)**: 이 프로그램은 자바로 만들어져 "자바 실행기"가 필요. 이 프로젝트는 **반드시 8버전**.
- **Gradle / `./gradlew`**: 소스코드를 실행 형태로 만들고(빌드) 실행해주는 도구. `./gradlew`는 프로젝트에 포함된 실행 스크립트(버전 자동 사용).
- **개발서버(로컬 실행)**: 내 Mac에서 띄워보는 것. 실제 서비스(운영 `hdm.kr`)와는 분리.
- **레포(repository)**: 소스코드 저장소. 여기선 GitHub `Violetdusk/hdm`(**PRIVATE**), 로컬 위치 `~/workspace/hdm`.

---

## 1. Tailscale 연결 (원격 접속망)

서버·DB가 테일넷 안에만 있어서, 먼저 이 Mac을 테일넷에 합류시켜야 한다.

- **흔한 문제**: 로그인 시 `Unable to add a new user`가 뜨는데, macOS가 Tailscale "네트워크 확장" 승인을 기다리는 상태다(**재부팅으론 안 풀림**).
- **해결(클릭)**: 시스템 설정 → 개인정보 보호 및 보안 → 맨 아래 **"보안"** → "Tailscale 시스템 소프트웨어" 허용/세부사항 → 켜기.

```shell
# Tailscale 연결 상태 + 서버가 보이는지
/Applications/Tailscale.app/Contents/MacOS/Tailscale status

# 시스템 확장 승인 상태 (enabled 면 정상)
systemextensionsctl list | grep -i tailscale

# 내 테일넷 IP (100.x.x.x 가 나오면 연결됨)
ifconfig | grep 'inet 100.'
```

목록에 `hmerp2-test`(100.117.232.37), `hmerp2-production`(100.86.123.77)이 보이면 OK.

---

## 2. 개발 도구 설치 — IntelliJ + 자바(JDK 8)

IntelliJ IDEA = 코드를 보고 실행하는 프로그램(IDE). 자바 8은 **SDKMAN**이라는 "자바 버전 관리자"로 설치한다.

```shell
# 1) IntelliJ IDEA Ultimate 설치 (유료 — 결제는 jetbrains.com 계정에서)
brew install --cask intellij-idea

# 2) SDKMAN 설치 (최신 bash가 필요해 먼저 설치)
brew install bash
curl -s "https://get.sdkman.io" | /opt/homebrew/bin/bash

# 3) 새 터미널을 열거나, 아래 한 줄로 SDKMAN 활성화
source ~/.sdkman/bin/sdkman-init.sh

# 4) 자바 8 (Amazon Corretto) 설치 + 기본값 지정
sdk install java 8.0.472-amzn

# 5) 확인 (1.8.0_472 가 나오면 성공)
sdk current java
java -version
```

**IntelliJ에서 자바 지정(클릭)**: `File → Project Structure → SDKs → + → Add JDK` → 경로 `~/.sdkman/candidates/java/8.0.472-amzn` 선택. 이어서 `Settings → Build Tools → Gradle → Gradle JVM`도 같은 Corretto 8로.

> 💡 **왜 8버전?** 이 프로젝트의 빌드 도구(Gradle 6.7.1)가 최신 자바(20 등)에선 작동하지 않는다. 8이 아니면 빌드가 깨진다. (`IllegalAccessError: ... com.sun.tools.javac...` 에러가 그 신호)
>
> ⚠️ SDKMAN으로 깐 자바는 macOS `/usr/libexec/java_home`에 자동 등록되지 않는다. 그래서 IntelliJ에서 **경로로 직접 추가**해야 하고, CLI에서는 `JAVA_HOME`을 SDKMAN 경로로 줘야 한다(아래 4번).

---

## 3. 소스코드 받기 & 최신화

```shell
# (최초) 클론 — 이미 받았다면 생략
# git clone https://github.com/Violetdusk/hdm.git ~/workspace/hdm

# 프로젝트 폴더로 이동
cd ~/workspace/hdm

# 최신 코드로 갱신
git checkout main
git pull
```

가장 중요한 참고서: `docs/handover-base.md`, `docs/project-structure.md`.

---

## 4. 개발서버 띄우기 (핵심)

**사전 준비** ① Tailscale가 켜져 있을 것 ② `/etc/hosts`에 서버 주소 한 줄 추가.

`/etc/hosts` = 특정 "주소이름"을 어떤 IP로 연결할지 적는 시스템 파일. `ht.vdsk.me`라는 이름이 테일넷 dev 서버를 가리키게 해야 한다(이 이름은 공개 DNS에 없음).

```shell
# 서버 주소 한 줄 추가 (sudo → Mac 비번 입력)
echo "100.117.232.37 ht.vdsk.me hmerp2-test" | sudo tee -a /etc/hosts

# 잘 들어갔는지 확인 (이 한 줄이 'IP로 시작'해서 보이면 OK)
grep ht.vdsk.me /etc/hosts
```

> ⚠️ **주의**: 기존 `/etc/hosts` 마지막 줄에 "개행(엔터)"이 없으면 새 내용이 그 줄 끝에 붙어버린다. 확인했을 때 IP로 시작하는 독립된 한 줄이 아니면 그 줄을 고쳐야 한다.

**서버 실행:**

```shell
cd ~/workspace/hdm
export JAVA_HOME=~/.sdkman/candidates/java/8.0.472-amzn
export NS_HMERP_ENV=local
export VERTXWEB_ENVIRONMENT=dev
./gradlew run
```

**성공 신호**: 로그에 `💪Successfully Initialized!` 와 `ERPServer ... 9092`, `WebServer ... 9091` 이 보이면 정상 기동. (`local` 프로필은 tailnet 너머의 원격 dev DB/HBase/Redis에 붙는다 — 그래서 1번 Tailscale이 전제)

**잘 떴는지 확인** (새 터미널 창에서). `200`이 나오면 성공:

```shell
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9092/sign_in   # ERP(본사)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:9091/          # 독자웹
```

**끄기**: IntelliJ로 실행했으면 빨간 Stop 버튼. 명령어로 띄웠으면:

```shell
ps aux | grep -E "java.*hmerp|GradleDaemon" | grep -v grep | awk '{print $2}' | xargs kill
```

> 참고: IntelliJ의 Run Configuration **"dev"**로 실행하면 AWS 키 등 환경변수가 자동 주입되어 더 편하다(레포 `.run/dev.run.xml`). 프론트 자산을 처음 빌드해야 하는 경우 등 추가 절차는 `handover-base.md` §3 참고.

---

## 5. 자주 나는 문제 (증상 → 원인 → 조치)

| 증상 | 원인 | 조치 |
|---|---|---|
| `Unable to add a new user` (Tailscale) | 네트워크 확장 승인 안 됨 | 1번의 시스템 설정에서 허용 |
| `IllegalAccessError: ... javac` | 자바가 8이 아님 | `JAVA_HOME`을 Corretto 8로 (2·4번) |
| `Connection refused` / 멈춤 | Tailscale가 꺼져 있음 | 켜고 `tailscale status` 확인 |
| DB·서버 못 찾음 | `/etc/hosts`의 `ht.vdsk.me` 줄 없음/깨짐 | 4번 확인 |
| 정적 JS/CSS가 옛 버전 | 템플릿 캐시버스팅 누락 | `handover-base.md` §5 참고 |

---

## 6. 보안 (꼭 지킬 것)

> 🔐 이 레포에는 **DB 비번·결제(Iamport) 키·AWS 키가 코드에 평문**으로 들어 있다. 지금은 **PRIVATE**라 안전하지만, **절대 public으로 바꾸지 말 것.** 인계 마무리 때 키를 새로 발급·교체(로테이션)하는 작업이 예정돼 있다 — 상세·절차는 `handover-base.md` §8.

- SSH 접속용 키는 `ssh-keygen -t ed25519`로 만들고 **공개키(`.pub`)만** 관리자에게 전달(개인키 절대 공유 금지).
- 단말 분실/감염 의심 시 빠른 차단 절차(약 30분): Tailscale 콘솔에서 디바이스 제거 → Redis ERP 토큰 플러시 → DB 비번 로테이션 → Iamport 키 재발급 (`handover-base.md` §7).
