from fastapi.testclient import TestClient

def test_get_pages(client: TestClient):
    pages = ["/", "/hyprland", "/system", "/waybar", "/hyprlock", "/hypridle", "/wpaperd"]
    for page in pages:
        response = client.get(page)
        assert response.status_code == 200
        assert "text/html" in response.headers["content-type"]
        assert "<html" in response.text
