from fastapi import FastAPI

from app.schemas import ScoreRequest, ScoreResponse
from app.scoring import compute_score

app = FastAPI(title="Verification Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/score", response_model=ScoreResponse)
def score(payload: ScoreRequest) -> ScoreResponse:
    return compute_score(payload)
