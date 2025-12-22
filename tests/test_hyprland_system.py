from fastapi.testclient import TestClient

def test_reload_hyprland(client: TestClient):
    # This should succeed because we have a fake hyprctl in path
    response = client.post("/hyprland/reload")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "ok" in data["stdout"]

def test_get_windows(client: TestClient):
    # This should return our mocked windows from fake hyprctl
    response = client.get("/hyprland/windows")
    assert response.status_code == 200
    data = response.json()
    assert "windows" in data
    windows = data["windows"]
    assert len(windows) > 0
    assert windows[0]["class"] == "kitty"
    assert windows[0]["address"] == "0x1234"
