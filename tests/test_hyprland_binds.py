from fastapi.testclient import TestClient

def test_get_binds(client: TestClient):
    response = client.get("/hyprland/binds")
    assert response.status_code == 200
    data = response.json()
    assert "binds" in data
    binds = data["binds"]
    assert len(binds) > 0

    # Check for "bind = SUPER, Q, exec, kitty"
    q_bind = next((b for b in binds if b["key"] == "Q" and b["dispatcher"] == "exec"), None)
    assert q_bind is not None
    assert q_bind["mods"] == "SUPER"
    assert q_bind["params"] == "kitty"

def test_add_bind(client: TestClient):
    new_bind = {
        "action": "add",
        "type": "bind",
        "mods": "SUPER",
        "key": "T",
        "dispatcher": "exec",
        "params": "thunar"
    }
    response = client.post("/hyprland/binds", json=new_bind)
    assert response.status_code == 200

    # Verify
    response = client.get("/hyprland/binds")
    binds = response.json()["binds"]
    t_bind = next((b for b in binds if b["key"] == "T"), None)
    assert t_bind is not None
    assert t_bind["dispatcher"] == "exec"
    assert t_bind["params"] == "thunar"

def test_update_bind(client: TestClient):
    # Update SUPER+Q to launch alacritty instead of kitty
    # First get the raw string
    response = client.get("/hyprland/binds")
    binds = response.json()["binds"]
    q_bind = next(b for b in binds if b["key"] == "Q")

    update = {
        "action": "update",
        "type": "bind",
        "mods": "SUPER",
        "key": "Q",
        "dispatcher": "exec",
        "params": "alacritty",
        "old_raw": q_bind["raw"]
    }
    response = client.post("/hyprland/binds", json=update)
    assert response.status_code == 200

    # Verify
    response = client.get("/hyprland/binds")
    binds = response.json()["binds"]
    q_bind = next(b for b in binds if b["key"] == "Q")
    assert q_bind["params"] == "alacritty"

def test_delete_bind(client: TestClient):
    # Delete SUPER+M
    response = client.get("/hyprland/binds")
    binds = response.json()["binds"]
    m_bind = next(b for b in binds if b["key"] == "M")

    update = {
        "action": "delete",
        "type": "bind",
        "mods": "SUPER",
        "key": "M",
        "dispatcher": "exit",
        "old_raw": m_bind["raw"]
    }
    response = client.post("/hyprland/binds", json=update)
    assert response.status_code == 200

    # Verify
    response = client.get("/hyprland/binds")
    binds = response.json()["binds"]
    m_bind = next((b for b in binds if b["key"] == "M"), None)
    assert m_bind is None
