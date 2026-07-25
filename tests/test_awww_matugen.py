from fastapi.testclient import TestClient
from main import app
from unittest.mock import patch, MagicMock

client = TestClient(app)

def test_matugen_current_endpoint():
    with patch("plugins.awww.get_first_screen_wallpaper") as mock_wallpaper, \
         patch("plugins.awww.run_matugen_json") as mock_matugen:
        mock_wallpaper.return_value = ("eDP-1", "/tmp/test_wallpaper.jpg")
        mock_matugen.return_value = {
            "colors": {
                "primary": {"dark": {"color": "#123456"}},
                "secondary": {"dark": {"color": "#654321"}}
            }
        }

        response = client.get("/awww/matugen/current")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        assert data["display"] == "eDP-1"
        assert "palette" in data
        assert data["colors"]["primary"] == "#123456"
        assert data["colors"]["secondary"] == "#654321"


def test_matugen_colors_endpoint():
    with patch("plugins.awww.get_first_screen_wallpaper") as mock_wallpaper, \
         patch("plugins.awww.run_matugen_json") as mock_matugen:
        mock_wallpaper.return_value = ("eDP-1", "/tmp/test_wallpaper.jpg")
        mock_matugen.return_value = {
            "colors": {
                "primary": {"dark": {"color": "#123456"}},
                "secondary": {"dark": {"color": "#654321"}}
            }
        }

        response = client.get("/awww/matugen/colors")
        assert response.status_code == 200
        colors = response.json()
        assert colors["primary"] == "#123456"
        assert colors["secondary"] == "#654321"


def test_matugen_image_endpoint():
    with patch("plugins.awww.get_first_screen_wallpaper") as mock_wallpaper, \
         patch("plugins.awww.run_matugen_json") as mock_matugen:
        mock_wallpaper.return_value = ("eDP-1", "/tmp/test_wallpaper.jpg")
        mock_matugen.return_value = {
            "colors": {
                "primary": {"dark": {"color": "#123456"}},
                "secondary": {"dark": {"color": "#654321"}}
            }
        }

        response = client.get("/awww/matugen/image")
        assert response.status_code == 200
        assert response.headers["content-type"] == "image/png"
        assert len(response.content) > 0
