from fastapi.testclient import TestClient

def test_get_env(client: TestClient):
    response = client.get("/hyprland/env")
    assert response.status_code == 200
    data = response.json()
    assert "env" in data
    envs = data["env"]
    assert len(envs) > 0

    assert any(e["name"] == "XCURSOR_SIZE" and e["value"] == "24" for e in envs)
    assert any(e["name"] == "QT_QPA_PLATFORMTHEME" and e["value"] == "qt5ct" for e in envs)

def test_add_env(client: TestClient):
    update = {
        "action": "add",
        "name": "MOZ_ENABLE_WAYLAND",
        "value": "1"
    }
    response = client.post("/hyprland/env", json=update)
    assert response.status_code == 200

    # Verify
    response = client.get("/hyprland/env")
    envs = response.json()["env"]
    assert any(e["name"] == "MOZ_ENABLE_WAYLAND" and e["value"] == "1" for e in envs)

def test_update_env(client: TestClient):
    update = {
        "action": "update",
        "name": "XCURSOR_SIZE",
        "value": "32",
        "old_name": "XCURSOR_SIZE"
    }
    response = client.post("/hyprland/env", json=update)
    assert response.status_code == 200

    # Verify
    response = client.get("/hyprland/env")
    envs = response.json()["env"]
    assert any(e["name"] == "XCURSOR_SIZE" and e["value"] == "32" for e in envs)

def test_delete_env(client: TestClient):
    update = {
        "action": "delete",
        "name": "QT_QPA_PLATFORMTHEME"
    }
    response = client.post("/hyprland/env", json=update)
    assert response.status_code == 200

    # Verify
    response = client.get("/hyprland/env")
    envs = response.json()["env"]
    assert not any(e["name"] == "QT_QPA_PLATFORMTHEME" for e in envs)
