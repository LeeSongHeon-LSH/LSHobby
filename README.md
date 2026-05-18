# Spanish Practice

스페인어 단어를 저장하고 퀴즈로 학습하는 프로그램입니다.

## 기능

### 단어 관리
- 스페인어 단어, 한국어 뜻, 성별을 함께 저장
- 성별: 남성(`m`), 여성(`f`), 양성(`n`), 없음(`none` — 동사 등)
- 단어와 뜻은 필수 입력, 성별은 선택 (미선택 시 `none` 자동 지정)

### 퀴즈
- 스페인어 → 한국어 / 한국어 → 스페인어 방향을 매 문제마다 랜덤 선택
- 카드에 단어와 성별 표시, 텍스트 입력으로 정답 비교
- 정답률이 낮은 단어에 가중치를 부여해 더 자주 출제 (Laplace smoothing)

### UI
- 브라우저에서 실행되는 단일 HTML 파일 (`index.html`)
- 표시 언어 전환: 한국어 / Español / English (우측 상단 ⚙)
- 스페인어 특수문자 단축키 (단어 입력창 / 퀴즈 답 입력창):
  - `Alt + N` → ñ
  - `Alt + /` → ¿
  - `Alt + 1` → ¡

## 프로젝트 구조

```
Spanish-Practice/
├── main.py        # FastAPI 서버
├── db.py          # SQLite 데이터베이스 모듈
├── quiz.py        # 퀴즈 로직 (가중치 랜덤 출제)
├── index.html     # 웹 UI
├── requirements.txt
├── spanish.db     # SQLite DB 파일 (자동 생성)
└── tests/
    ├── conftest.py
    ├── test_db.py
    └── test_quiz.py
```

## 실행 방법

### 요구 사항

- Python 3.10 이상
- 웹 브라우저

### 설치

```bash
pip install -r requirements.txt
```

### 서버 실행

```bash
uvicorn main:app --reload
```

브라우저에서 `http://localhost:8000` 으로 접속합니다.

`spanish.db`는 최초 실행 시 자동으로 생성되며, 이전 버전 DB가 있으면 스키마가 자동 마이그레이션됩니다.

### Python 모듈 직접 사용

```python
import db
from db import Gender

db.init_db()

# 단어 추가
db.add_word("casa", Gender.FEMININE, "집")
db.add_word("hablar", Gender.NONE, "말하다")

# 전체 단어 조회
db.get_all_words()

# 출제 결과 기록
db.record_attempt("casa", correct=True)
```

```python
import quiz

# 가중치 기반 랜덤 출제
word = quiz.pick_word()

# 정답 기록
quiz.submit_answer(word["word"], correct=True)
```

### 테스트 실행

```bash
pip install pytest
python -m pytest tests/ -v
```

## 데이터베이스 스키마

```sql
CREATE TABLE words (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    word          TEXT    NOT NULL UNIQUE,
    gender        TEXT    NOT NULL CHECK(gender IN ('m', 'f', 'n', 'none')),
    meaning       TEXT    NOT NULL CHECK(length(meaning) > 0),
    test_count    INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0
);
```
