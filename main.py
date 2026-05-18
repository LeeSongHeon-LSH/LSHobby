import sqlite3

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import db
from db import Gender
import quiz

app = FastAPI(title="Spanish Practice")


# ── Pydantic models ────────────────────────────────────
class WordIn(BaseModel):
    word: str
    gender: str
    meaning: str


class AnswerIn(BaseModel):
    word: str
    correct: bool


# ── Startup ────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    db.init_db()


# ── Static ─────────────────────────────────────────────
@app.get("/")
async def index():
    return FileResponse("index.html")


# ── Words ──────────────────────────────────────────────
@app.get("/api/words")
async def get_words():
    return db.get_all_words()


@app.post("/api/words", status_code=201)
async def add_word(body: WordIn):
    try:
        gender = Gender(body.gender)
    except ValueError:
        raise HTTPException(422, detail=f"invalid_gender: {body.gender}")
    try:
        db.add_word(body.word, gender, body.meaning)
    except ValueError as e:
        raise HTTPException(422, detail=str(e))
    except sqlite3.IntegrityError:
        raise HTTPException(409, detail="duplicate")
    return {"ok": True}


@app.delete("/api/words/{word}")
async def delete_word(word: str):
    db.delete_word(word)
    return {"ok": True}


# ── Quiz ───────────────────────────────────────────────
@app.get("/api/quiz/pick")
async def pick():
    word = quiz.pick_word()
    if word is None:
        raise HTTPException(404, detail="no_words")
    return word


@app.post("/api/quiz/answer")
async def answer(body: AnswerIn):
    quiz.submit_answer(body.word, body.correct)
    return {"ok": True}
