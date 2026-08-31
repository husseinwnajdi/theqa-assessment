from math import radians, sin, cos, sqrt, atan2

from app.schemas import ScoreRequest, ScoreResponse


def haversine_meters(lat1, lng1, lat2, lng2):
    R = 6371000
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi/2)**2 + cos(phi1) * cos(phi2) * sin(dlambda/2)**2
    return 2 * R * atan2(sqrt(a), sqrt(1 - a))


def score_visit(target_lat, target_lng, radius_meters, pings, report_text):
    reasons = []

    if not pings:
        return {"confidenceScore": 0, "reasons": ["No location pings recorded"]}

    # Filter out spoofing-suspicious jumps (>200 km/h implied speed)
    valid_pings = [pings[0]]
    excluded = 0
    for prev, curr in zip(pings, pings[1:]):
        dist = haversine_meters(prev["lat"], prev["lng"], curr["lat"], curr["lng"])
        dt_seconds = (curr["timestamp"] - prev["timestamp"]).total_seconds()
        if dt_seconds > 0:
            speed_kmh = (dist / dt_seconds) * 3.6
            if speed_kmh > 200:
                excluded += 1
                continue
        valid_pings.append(curr)

    if excluded:
        reasons.append(f"{excluded} ping(s) excluded as outliers (impossible jump)")

    # % within radius
    within = [
        p for p in valid_pings
        if haversine_meters(p["lat"], p["lng"], target_lat, target_lng) <= radius_meters
    ]
    pct_within = len(within) / len(valid_pings)
    reasons.append(f"{len(within)}/{len(valid_pings)} pings within {radius_meters}m")

    # avg accuracy
    avg_accuracy = sum(p["accuracyMeters"] for p in valid_pings) / len(valid_pings)
    reasons.append(f"avg GPS accuracy {avg_accuracy:.0f}m")

    # Weighted score
    proximity_score = pct_within * 70
    accuracy_score = max(0, 30 - avg_accuracy / 5)  # penalize poor accuracy
    confidence = round(min(100, proximity_score + accuracy_score))

    if not report_text or len(report_text.strip()) < 10:
        confidence = max(0, confidence - 15)
        reasons.append("Report text missing or too short")

    return {"confidenceScore": confidence, "reasons": reasons}


def compute_score(payload: ScoreRequest) -> ScoreResponse:
    pings = [p.model_dump(by_alias=True) for p in payload.pings]
    result = score_visit(
        payload.target_lat,
        payload.target_lng,
        payload.radius_meters,
        pings,
        payload.report_text,
    )
    return ScoreResponse.model_validate(result)
