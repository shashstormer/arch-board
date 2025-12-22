from fastapi.testclient import TestClient

def test_get_exec(client: TestClient):
    response = client.get("/hyprland/exec")
    assert response.status_code == 200
    data = response.json()
    assert "exec" in data
    execs = data["exec"]
    assert len(execs) > 0

    assert any(e["type"] == "exec-once" and e["command"] == "waybar" for e in execs)
    assert any(e["type"] == "exec" and e["command"] == "swaybg" for e in execs)

def test_add_exec(client: TestClient):
    update = {
        "action": "add",
        "type": "exec-once",
        "command": "dunst"
    }
    response = client.post("/hyprland/exec", json=update)
    assert response.status_code == 200

    # Verify
    response = client.get("/hyprland/exec")
    execs = response.json()["exec"]
    assert any(e["command"] == "dunst" for e in execs)

def test_update_exec(client: TestClient):
    update = {
        "action": "update",
        "type": "exec",
        "command": "swaybg -i wallpaper.png",
        "old_command": "swaybg"
    }
    response = client.post("/hyprland/exec", json=update)
    assert response.status_code == 200

    # Verify
    response = client.get("/hyprland/exec")
    execs = response.json()["exec"]
    assert any(e["command"] == "swaybg -i wallpaper.png" for e in execs)
    assert not any(e["command"] == "swaybg" for e in execs)

def test_delete_exec(client: TestClient):
    update = {
        "action": "delete",
        "type": "exec-once",
        "command": "waybar"
    }
    response = client.post("/hyprland/exec", json=update)
    assert response.status_code == 200

    # Verify
    response = client.get("/hyprland/exec")
    execs = response.json()["exec"]
    assert not any(e["command"] == "waybar" for e in execs)
