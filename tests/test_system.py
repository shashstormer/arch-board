from fastapi.testclient import TestClient

def test_get_system_info(client: TestClient):
    # This might fail or return empty because bg_service might not be running or collecting in test mode
    # But it should return 200
    response = client.get("/system/info")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, dict)
