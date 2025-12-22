from fastapi.testclient import TestClient

def test_get_monitors(client: TestClient):
    response = client.get("/hyprland/monitors")
    assert response.status_code == 200
    data = response.json()
    assert "monitors" in data
    assert len(data["monitors"]) == 2

    m1 = data["monitors"][0]
    assert m1["name"] == "HDMI-A-1"
    assert m1["resolution"] == "1920x1080@60"
    assert m1["position"] == "0x0"
    assert m1["scale"] == "1"

    m2 = data["monitors"][1]
    assert m2["name"] == "DP-1"
    assert m2["resolution"] == "2560x1440@144"

def test_update_monitor(client: TestClient):
    # Update existing monitor
    update = {
        "name": "HDMI-A-1",
        "resolution": "1920x1080@144",
        "position": "0x0",
        "scale": "1"
    }
    response = client.post("/hyprland/monitors", json=update)
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify update
    response = client.get("/hyprland/monitors")
    monitors = response.json()["monitors"]
    m1 = next(m for m in monitors if m["name"] == "HDMI-A-1")
    assert m1["resolution"] == "1920x1080@144"

def test_add_monitor(client: TestClient):
    # Add new monitor
    update = {
        "name": "DP-2",
        "resolution": "3840x2160@60",
        "position": "4480x0",
        "scale": "1.5"
    }
    response = client.post("/hyprland/monitors", json=update)
    assert response.status_code == 200

    # Verify add
    response = client.get("/hyprland/monitors")
    monitors = response.json()["monitors"]
    assert len(monitors) == 3
    m3 = next(m for m in monitors if m["name"] == "DP-2")
    assert m3["resolution"] == "3840x2160@60"
