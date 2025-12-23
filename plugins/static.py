from fastapi import APIRouter
from fastapi.responses import FileResponse
from fastapi.exceptions import HTTPException
from utils.tailwind import generate_tailwind_css
from xtracto import Config
import os
from xtracto._images import favicon

config = Config()
static_router = APIRouter()


@static_router.get("/tailwind.css")
async def get_output():
    if not config.production:
        generate_tailwind_css()
    return FileResponse("assets/css/tailwind.css", media_type="text/css")

@static_router.get("/global.css")
async def get_global():
    return FileResponse("assets/css/global.css", media_type="text/css")

@static_router.get("/scripts/{filename}")
async def get_scripts(filename: str):
    if not filename.endswith(".js"):
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.exists(f"scripts/{filename}"):
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.abspath(f"scripts/{filename}").startswith(os.path.abspath("scripts")):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(os.path.abspath(f"scripts/{filename}"))

@static_router.get("/assets/css/{filename}")
async def get_assets(filename: str):
    if not filename.endswith(".css"):
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.exists(f"assets/css/{filename}"):
        raise HTTPException(status_code=404, detail="File not found")
    if not os.path.abspath(f"assets/css/{filename}").startswith(os.path.abspath("assets/css")):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(os.path.abspath(f"assets/css/{filename}"))

@static_router.get("/favicon.ico")
async def get_favicon():
    return favicon
