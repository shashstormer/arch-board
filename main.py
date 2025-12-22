from logging import basicConfig, DEBUG
from contextlib import asynccontextmanager
from authtuna import init_app
from fastapi import FastAPI
from utils.config import RELOAD_SERVER, config
from routers import static_router, pages_router, system_router, hyprland_router, presets_router
from utils.lib.background import bg_service, register_default_tasks
from xtracto import Builder


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
app.include_router(static_router)
app.include_router(pages_router)
app.include_router(system_router)
app.include_router(hyprland_router)
app.include_router(presets_router)


if __name__ == "__main__":
    import uvicorn
    if config.production:
        Builder().build()
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=RELOAD_SERVER,
                reload_excludes=["components", "pages", "assets"], workers=4)
