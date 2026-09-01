# This is the only module with real logic in the verification service (the
# confidence-scoring algorithm): the /score route is thin plumbing already
# verified manually end-to-end, so score_visit is the one place unit tests
# earn their keep here. Coverage: pings all inside the radius (high score),
# all outside (low score), a missing/short report (penalty applied), a
# spoofed/outlier ping (excluded from scoring, noted in reasons), and an
# empty pings list (returns 0 with a clear reason instead of crashing).

from datetime import datetime, timedelta

from app.scoring import score_visit

TARGET_LAT = 48.8584
TARGET_LNG = 2.2945
RADIUS_METERS = 100

BASE_TIME = datetime(2026, 8, 31, 10, 0, 0)


def ping(lat, lng, accuracy_meters, minutes_offset):
    return {
        "lat": lat,
        "lng": lng,
        "accuracyMeters": accuracy_meters,
        "timestamp": BASE_TIME + timedelta(minutes=minutes_offset),
    }


def test_all_pings_within_radius_scores_high():
    pings = [
        ping(TARGET_LAT, TARGET_LNG, 5, 0),
        ping(TARGET_LAT, TARGET_LNG, 5, 1),
    ]

    result = score_visit(
        TARGET_LAT, TARGET_LNG, RADIUS_METERS, pings, "Visited the location, all good."
    )

    assert result["confidenceScore"] == 99
    assert "2/2 pings within 100m" in result["reasons"]
    assert "avg GPS accuracy 5m" in result["reasons"]


def test_all_pings_outside_radius_scores_low():
    far_lat, far_lng = TARGET_LAT + 5, TARGET_LNG + 5  # hundreds of km away
    pings = [
        ping(far_lat, far_lng, 20, 0),
        ping(far_lat, far_lng, 20, 1),
        ping(far_lat, far_lng, 20, 2),
    ]

    result = score_visit(
        TARGET_LAT, TARGET_LNG, RADIUS_METERS, pings, "Visited the location, all good."
    )

    assert result["confidenceScore"] == 26
    assert "0/3 pings within 100m" in result["reasons"]


def test_missing_report_text_applies_penalty():
    pings = [
        ping(TARGET_LAT, TARGET_LNG, 5, 0),
        ping(TARGET_LAT, TARGET_LNG, 5, 1),
    ]

    result = score_visit(TARGET_LAT, TARGET_LNG, RADIUS_METERS, pings, "")

    assert result["confidenceScore"] == 84  # 99 - 15 penalty
    assert "Report text missing or too short" in result["reasons"]


def test_spoofed_outlier_ping_excluded_and_noted():
    pings = [
        ping(TARGET_LAT, TARGET_LNG, 5, 0),
        ping(TARGET_LAT + 5, TARGET_LNG + 5, 5, 1),  # ~780km away, 1 min later
    ]

    result = score_visit(
        TARGET_LAT, TARGET_LNG, RADIUS_METERS, pings, "Visited the location, all good."
    )

    assert "1 ping(s) excluded as outliers (impossible jump)" in result["reasons"]
    assert "1/1 pings within 100m" in result["reasons"]


def test_empty_pings_returns_zero_with_clear_reason():
    result = score_visit(TARGET_LAT, TARGET_LNG, RADIUS_METERS, [], "Visited the location.")

    assert result == {"confidenceScore": 0, "reasons": ["No location pings recorded"]}
