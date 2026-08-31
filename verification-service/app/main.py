from fastapi import FastAPI

app = FastAPI(title="Verification Service")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
