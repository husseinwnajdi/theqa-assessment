from datetime import datetime

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Ping(CamelModel):
    lat: float
    lng: float
    accuracy_meters: float
    timestamp: datetime


class ScoreRequest(CamelModel):
    target_lat: float
    target_lng: float
    radius_meters: int
    pings: list[Ping]
    report_text: str


class ScoreResponse(CamelModel):
    confidence_score: int
    reasons: list[str]
