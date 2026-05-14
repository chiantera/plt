from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .demo_data import build_demo_case
from .models import CaseAnalysis

app = FastAPI(title="Pocket Legal Triage Alpha", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "plt-alpha-backend"}


@app.get("/api/demo-case", response_model=CaseAnalysis)
def get_demo_case() -> CaseAnalysis:
    return build_demo_case()
