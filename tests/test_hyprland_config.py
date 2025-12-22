from fastapi.testclient import TestClient

def test_get_config_schema(client: TestClient):
    response = client.get("/hyprland/schema")
    assert response.status_code == 200
    data = response.json()
    assert "schema" in data
    assert isinstance(data["schema"], list)
    assert len(data["schema"]) > 0
    assert data["schema"][0]["id"] == "general"

def test_get_config(client: TestClient):
    response = client.get("/hyprland/config")
    assert response.status_code == 200
    data = response.json()
    assert "config" in data
    config = data["config"]
    assert config["general:gaps_in"] == "5"
    assert config["decoration:blur:enabled"] == "true"

def test_update_config(client: TestClient):
    # Update a value
    response = client.post("/hyprland/config", json={
        "path": "general:gaps_in",
        "value": 10
    })
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify update
    response = client.get("/hyprland/config")
    config = response.json()["config"]
    assert config["general:gaps_in"] == "10"

def test_bulk_update_config(client: TestClient):
    updates = {
        "general:gaps_out": 30,
        "decoration:rounding": 5
    }
    response = client.post("/hyprland/config/bulk", json={"updates": updates})
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify updates
    response = client.get("/hyprland/config")
    config = response.json()["config"]
    assert config["general:gaps_out"] == "30"
    assert config["decoration:rounding"] == "5"
