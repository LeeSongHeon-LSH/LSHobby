# 서버 세팅 & 재설치 가이드

컴퓨터를 초기화하거나 새 컴퓨터로 옮길 때 이 문서대로 따라 하면 전체 환경이 복구된다.
이 문서는 git에 포함되어 있으므로 GitHub(`LeeSongHeon-LSH/LSHobby`)에 항상 남아 있다.

## 시스템 개요

```
[휴대폰/다른 기기] ── Tailscale VPN ──> 이 컴퓨터 (lshcontroller)
                                        ├─ tailscale serve: https://lshcontroller.tailc7c4e0.ts.net → 127.0.0.1:8000
                                        ├─ systemd 서비스: uvicorn (FastAPI) :8000 상시 실행
                                        ├─ systemd 타이머: 2분마다 GitHub 확인 → 자동 배포
                                        └─ spanish.db (SQLite, git 미포함 — 백업 필요!)

[아무 기기에서 git push] ──> GitHub main ──> Actions CI (pytest) ──> 2분 내 자동 배포
```

## 현재 설정 값

| 항목 | 값 |
|---|---|
| 접속 주소 (Tailscale, 권장) | `https://lshcontroller.tailc7c4e0.ts.net` |
| 접속 주소 (집 안 LAN) | `http://10.100.100.110:8000` |
| 서비스 이름 | `spanish-practice` (앱), `spanish-practice-deploy.timer` (배포) |
| 프로젝트 경로 | `/home/lshcontroller/projects/Spanish-Practice` |
| DB 파일 | `spanish.db` (프로젝트 폴더 안, **git에 없음**) |
| Tailscale 계정 | leesongheon1209@gmail.com |

## ⚠️ 초기화 전에 반드시 할 것

**`spanish.db` 백업** — 학습 데이터(단어, 정답률, 복습 스케줄)는 git에 없다.
USB, 클라우드 등 컴퓨터 밖으로 복사해 둘 것:

```bash
cp ~/projects/Spanish-Practice/spanish.db ~/spanish-backup-$(date +%Y%m%d).db
# 이 파일을 구글 드라이브/USB 등에 복사
```

## 재설치 절차 (Ubuntu 기준)

### 1. 기본 도구 설치

```bash
sudo apt update
sudo apt install -y git python3 python3-venv curl
```

### 2. 프로젝트 복원

```bash
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/LeeSongHeon-LSH/LSHobby.git Spanish-Practice
cd Spanish-Practice

# 가상환경 + 의존성
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/pip install pytest httpx   # 배포 스크립트가 테스트 실행에 사용

# 백업해 둔 DB 복원 (없으면 빈 DB로 자동 생성됨)
cp /백업위치/spanish-backup-XXXXXXXX.db spanish.db
```

### 3. systemd 서비스 등록 (상시 실행 + 자동 배포)

서비스 파일들은 저장소에 포함되어 있다.

```bash
mkdir -p ~/.config/systemd/user
cp spanish-practice.service spanish-practice-deploy.service spanish-practice-deploy.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now spanish-practice              # 앱 서버
systemctl --user enable --now spanish-practice-deploy.timer # 자동 배포 (2분 간격)
loginctl enable-linger                                      # 로그아웃해도 계속 실행
```

> **사용자명이 `lshcontroller`가 아니면**: 서비스 파일 3개와 `deploy.sh` 안의
> `/home/lshcontroller/...` 경로를 새 경로로 수정한 뒤 위 명령을 실행할 것.

확인:

```bash
systemctl --user status spanish-practice     # active (running) 이어야 함
curl http://localhost:8000                   # HTML이 나와야 함
```

### 4. Tailscale 재설치 (외부 접속 + https 도메인)

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up        # 출력되는 URL을 브라우저로 열어 leesongheon1209@gmail.com 로그인
sudo tailscale serve --bg 8000   # https://<기기명>.tailc7c4e0.ts.net → :8000 프록시
```

- 기기 이름이 같으면(`lshcontroller`) 주소도 그대로 유지된다.
  다르면 [Tailscale 관리 콘솔](https://login.tailscale.com/admin/machines)에서 기기 이름을 바꾸면 된다.
- `serve` 설정은 재부팅해도 유지된다.

확인:

```bash
tailscale serve status   # https://... → 127.0.0.1:8000 프록시가 보여야 함
curl -s -o /dev/null -w "%{http_code}" https://lshcontroller.tailc7c4e0.ts.net/   # 200
```

### 5. (선택) GitHub CLI

CI 상태 확인이나 push를 이 컴퓨터에서 하려면:

```bash
sudo apt install -y gh
gh auth login
```

## Tailscale 연결 후 — 휴대폰에서 쓰는 법

1. 휴대폰에 **Tailscale 앱** 설치 (App Store / Play 스토어)
2. `leesongheon1209@gmail.com` 계정으로 로그인 → VPN 연결 켜기
3. 브라우저에서 `https://lshcontroller.tailc7c4e0.ts.net` 접속
4. **앱으로 설치 (PWA)**:
   - Android Chrome: 메뉴(⋮) → "홈 화면에 추가" → "설치"
   - iOS Safari: 공유 버튼 → "홈 화면에 추가"
5. 이후 홈 화면 아이콘(금색 Ñ)으로 전체화면 앱처럼 실행된다.
   Tailscale VPN이 켜져 있으면 집 밖에서도 접속된다.

## CI/CD 동작 방식

- **CI**: main에 push하면 GitHub Actions가 `pytest`를 실행 (`.github/workflows/ci.yml`)
- **CD**: 이 컴퓨터의 `spanish-practice-deploy.timer`가 2분마다 `deploy.sh` 실행:
  1. `origin/main`에 새 커밋이 있는지 확인 (없으면 종료)
  2. 로컬 작업 트리가 dirty면 건너뜀 (개발 중 보호)
  3. pull → 의존성 설치 → 테스트 실행
  4. **테스트 통과 시에만** 서비스 재시작. 실패하면 이전 버전이 계속 돈다.

### 문제 해결 명령어

```bash
systemctl --user status spanish-practice            # 앱 서버 상태
journalctl --user -u spanish-practice -n 50         # 앱 서버 로그
journalctl --user -u spanish-practice-deploy -n 30  # 배포 로그
systemctl --user restart spanish-practice           # 수동 재시작
systemctl --user start spanish-practice-deploy      # 배포 즉시 실행 (타이머 안 기다리고)
tailscale status                                    # VPN 연결 상태
```

배포가 "tests failed — service NOT restarted" 로그를 남기고 멈춰 있으면:
코드를 고쳐 다시 push하거나, 로컬에서 `.venv/bin/python -m pytest tests/`로 원인 확인.
