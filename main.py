import os.path
import shutil
from contextlib import asynccontextmanager

from authtuna import init_app
from fastapi import FastAPI
from xtracto import Builder

from utils.config import RELOAD_SERVER, config
from utils.lib.background import bg_service, register_default_tasks
from utils.plugins import get_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register and start background services
    register_default_tasks()
    bg_service.start()
    yield
    # Cleanup on shutdown
    bg_service.stop()

app = FastAPI(docs_url=None, redoc_url=None, lifespan=lifespan)
init_app(app)
for router in get_routers():
    app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    # if config.production:
    #     if os.path.exists(config.build_dir):
    #         shutil.rmtree(os.path.abspath(config.build_dir))
    #     Builder().build()
    # Source - https://superuser.com/a
    # Posted by Martin Monperrus
    # Retrieved 2026-01-08, License - CC BY-SA 4.0

    import unicodedata
    import os

    fonts = []

    for root, dirs, files in os.walk("/usr/share/fonts/"):
        for file in files:
            if file.endswith(".ttf"): fonts.append(os.path.join(root, file))

    from fontTools.ttLib import TTFont


    def char_in_font(unicode_char, font):
        for cmap in font['cmap'].tables:
            if cmap.isUnicode():
                if ord(unicode_char) in cmap.cmap:
                    return True
        return False


    def test(char):
        for fontpath in fonts:
            font = TTFont(fontpath)  # specify the path to the font in question
            if char_in_font(char, font):
                name = "unknown"
                try:
                    name = unicodedata.name(char)
                except ValueError:
                    pass
                print(char + " " + name + " in " + fontpath)


    test(u"")

    uvicorn.run(
        "main:app", host="0.0.0.0", port=5000, reload=RELOAD_SERVER,
                reload_excludes=["components", "pages", "assets"] if RELOAD_SERVER else None,
                # workers=4
                )
