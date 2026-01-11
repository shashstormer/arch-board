import os
import configparser
from typing import Dict, Any, Optional

CONFIG_PATH = os.path.expanduser("~/.config/gammastep/config.ini")


class GammastepConfig:
    def __init__(self):
        self.config = configparser.ConfigParser()
        self.load()

    def load(self):
        if not os.path.exists(os.path.dirname(CONFIG_PATH)):
            os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)

        if os.path.exists(CONFIG_PATH):
            self.config.read(CONFIG_PATH)

        if 'general' not in self.config:
            self.config['general'] = {}
        if 'manual' not in self.config:
            self.config['manual'] = {}

    def save(self):
        with open(CONFIG_PATH, 'w') as configfile:
            self.config.write(configfile, space_around_delimiters=False)

    def get_all(self) -> Dict[str, Any]:
        """Return config as a dictionary for the frontend."""
        self.load()
        return {
            "temp_day": self.config['general'].getint('temp-day', fallback=5700),
            "temp_night": self.config['general'].getint('temp-night', fallback=3500),
            "fade": self.config['general'].get('fade', fallback="1"),
            "location_provider": self.config['general'].get('location-provider', fallback="manual"),
            "lat": self.config['manual'].getfloat('lat', fallback=0.0),
            "lon": self.config['manual'].getfloat('lon', fallback=0.0),
        }

    def update(self, data: Dict[str, Any]):
        """Update config from dictionary."""
        gen = self.config['general']
        if 'temp_day' in data: gen['temp-day'] = str(data['temp_day'])
        if 'temp_night' in data: gen['temp-night'] = str(data['temp_night'])
        if 'fade' in data: gen['fade'] = str(data['fade'])
        if 'location_provider' in data: gen['location-provider'] = str(data['location_provider'])

        if 'lat' in data or 'lon' in data:
            if 'manual' not in self.config:
                self.config['manual'] = {}
            if 'lat' in data: self.config['manual']['lat'] = str(data['lat'])
            if 'lon' in data: self.config['manual']['lon'] = str(data['lon'])

        self.save()


gammastep_config = GammastepConfig()
