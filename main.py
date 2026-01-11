from contextlib import asynccontextmanager

from authtuna import init_app
from fastapi import FastAPI

from utils.config import RELOAD_SERVER
from utils.lib.background import bg_service, register_default_tasks
from utils.plugins import get_routers


@asynccontextmanager
async def lifespan(app: FastAPI):
    register_default_tasks()
    bg_service.start()
    yield
    bg_service.stop()

app = FastAPI(docs_url=None, redoc_url=None, lifespan=lifespan)
init_app(app)
for router in get_routers():
    app.include_router(router)

if __name__ == "__main__":
    import uvicorn
    # from xtracto import Config, Builder
    # config = Config()
    # import os, shutil
    # if config.production:
    #     if os.path.exists(config.build_dir):
    #         shutil.rmtree(os.path.abspath(config.build_dir))
    #     Builder().build()

    uvicorn.run(
        "main:app", host="0.0.0.0", port=5000, reload=RELOAD_SERVER,
                reload_excludes=["components", "pages", "assets"] if RELOAD_SERVER else None,
                workers=None if RELOAD_SERVER else 2
                )
