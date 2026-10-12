from app import app


def test_health_ok():
    r = app.test_client().get("/health")
    assert r.status_code == 200
    assert r.get_json()["status"] == "ok"


def test_home_page():
    r = app.test_client().get("/")
    assert r.status_code == 200
    assert b"Version" in r.data
