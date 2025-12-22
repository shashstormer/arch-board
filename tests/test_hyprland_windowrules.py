from fastapi.testclient import TestClient

def test_update_windowrule(client: TestClient):
    # Find existing rule
    response = client.get("/hyprland/windowrules")
    rules = response.json()["windowrules"]
    rule = next(r for r in rules if r["type"] == "windowrule" and "kitty" in r["match"])

    update = {
        "action": "update",
        "type": "windowrule",
        "effect": "center",
        "match": "^(kitty)$",
        "old_raw": rule["raw"]
    }

    response = client.post("/hyprland/windowrules", json=update)
    assert response.status_code == 200

    # Verify
    response = client.get("/hyprland/windowrules")
    rules = response.json()["windowrules"]

    assert any(r["match"] == "^(kitty)$" and r["effect"] == "center" for r in rules)
