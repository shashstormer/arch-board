from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import JSONResponse, FileResponse
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
import json
import shutil
import uuid
import time
from pathlib import Path

images_router = APIRouter(prefix="/images", tags=["images"])

from fastapi.responses import HTMLResponse
from xtracto import Parser
from utils.config import get_context
from utils.plugins_frontend import register_navigation, NavItem, NavGroup

register_navigation(
    items=[
        NavItem(
            id="images",
            title="Images",
            url="/images/library",
            icon="images",
            icon_svg='<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>',
            group="library",
            order=10
        )
    ],
    groups=[
        NavGroup(
            id="library",
            title="Library",
            icon="library",
            icon_svg='<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>',
            order=20
        )
    ]
)


@images_router.get("/library", response_class=HTMLResponse)
async def library_page():
    parser = Parser(path="library.pypx")
    parser.render(context=get_context({
        "current_page": "images",
        "page_title": "ArchBoard - Image Library",
        "page_header": "Image Library",
        "page_description": "Manage your images",
        "title": "Images - ArchBoard",
        "description": "Image Library",
        "page_id": "images",
    }))
    return HTMLResponse(parser.html_content)


IMAGES_DIR = os.path.expanduser("~/.archboard/images")
MAPPING_FILE = os.path.join(IMAGES_DIR, "filesystem.json")


class FileSystemManager:
    def __init__(self):
        self.ensure_dirs()
        self.fs = self.load_fs()
        self.migrate_if_needed()

    def ensure_dirs(self):
        os.makedirs(IMAGES_DIR, exist_ok=True)

        os.makedirs(os.path.join(IMAGES_DIR, "storage"), exist_ok=True)

    def load_fs(self) -> Dict:
        try:
            with open(MAPPING_FILE, "r") as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"items": {}}

    def save_fs(self):
        with open(MAPPING_FILE, "w") as f:
            json.dump(self.fs, f, indent=2)

    def migrate_if_needed(self):

        old_mapping_file = os.path.join(IMAGES_DIR, "mapping.json")
        if os.path.exists(old_mapping_file):
            try:
                with open(old_mapping_file, "r") as f:
                    old_data = json.load(f)

                for img_id, img_data in old_data.get("images", {}).items():
                    if img_id not in self.fs["items"]:
                        self.fs["items"][img_id] = {
                            "id": img_id,
                            "parent_id": None,
                            "type": "file",
                            "name": img_data.get("name", "Unknown"),
                            "path": img_data.get("path"),
                            "created_at": time.time()
                        }

                for folder_id, folder_data in old_data.get("folders", {}).items():
                    if folder_id not in self.fs["items"]:
                        self.fs["items"][folder_id] = {
                            "id": folder_id,
                            "parent_id": None,
                            "type": "folder",
                            "name": folder_data.get("name", "Unknown Folder"),
                            "created_at": time.time()
                        }

                self.save_fs()

                os.rename(old_mapping_file, old_mapping_file + ".bak")
            except Exception as e:
                print(f"Migration failed: {e}")

    def list_items(self, parent_id: Optional[str] = None) -> List[Dict]:
        result = []
        needs_save = False

        import os
        from PIL import Image

        for item_id, item in self.fs["items"].items():
            if item.get("parent_id") != parent_id:
                continue

            if item["type"] == "file":
                changed = False
                path = item.get("path")

                if "size" not in item or item["size"] == 0:
                    if path and os.path.exists(path):
                        try:
                            item["size"] = os.path.getsize(path)
                            changed = True
                        except:
                            pass

                if "width" not in item or "height" not in item or item["width"] == 0:
                    if path and os.path.exists(path):
                        try:
                            with Image.open(path) as img:
                                item["width"], item["height"] = img.size
                                changed = True
                        except Exception:
                            pass

                if changed:
                    needs_save = True

            if item["type"] == "folder" and "path" not in item:
                item["path"] = None
                needs_save = True

            result.append(item)

        if needs_save:
            self.save_fs()

        result.sort(key=lambda x: (x["type"] != "folder", x["name"].lower()))
        return result

    def get_item(self, item_id: str) -> Optional[Dict]:
        return self.fs["items"].get(item_id)

    def create_folder(self, name: str, parent_id: Optional[str] = None) -> Dict:
        folder_id = str(uuid.uuid4())

        folder_path = self._build_folder_path(parent_id, name)
        os.makedirs(folder_path, exist_ok=True)

        folder = {
            "id": folder_id,
            "parent_id": parent_id,
            "type": "folder",
            "name": name,
            "path": folder_path,
            "created_at": time.time()
        }
        self.fs["items"][folder_id] = folder
        self.save_fs()
        return folder

    def _build_folder_path(self, parent_id: Optional[str], name: str) -> str:
        """Build filesystem path for a folder based on parent hierarchy."""
        folders_root = os.path.join(IMAGES_DIR, "folders")
        os.makedirs(folders_root, exist_ok=True)

        if parent_id:
            parent = self.get_item(parent_id)
            if parent and parent.get("path"):
                return os.path.join(parent["path"], name)

        return os.path.join(folders_root, name)

    def add_file(self, file: UploadFile, parent_id: Optional[str] = None) -> Dict:
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename)[1] or ".png"
        storage_path = os.path.join(IMAGES_DIR, "storage", f"{file_id}{ext}")
        os.makedirs(os.path.dirname(storage_path), exist_ok=True)
        with open(storage_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        if parent_id:
            parent = self.get_item(parent_id)
            if parent and parent.get("path"):
                symlink_path = os.path.join(parent["path"], f"{file_id}{ext}")
                os.makedirs(os.path.dirname(symlink_path), exist_ok=True)
                if not os.path.exists(symlink_path):
                    os.symlink(storage_path, symlink_path)

        size = 0
        width = 0
        height = 0

        try:
            size = os.path.getsize(storage_path)
            from PIL import Image
            with Image.open(storage_path) as img:
                width, height = img.size
        except:
            pass

        item = {
            "id": file_id,
            "parent_id": parent_id,
            "type": "file",
            "name": file.filename,
            "path": storage_path,
            "created_at": time.time(),
            "size": size,
            "width": width,
            "height": height
        }
        self.fs["items"][file_id] = item
        self.save_fs()
        return item

    def delete_item(self, item_id: str):
        if item_id not in self.fs["items"]:
            return False

        item = self.fs["items"][item_id]

        if item["type"] == "folder":
            children = [i["id"] for i in self.fs["items"].values() if i.get("parent_id") == item_id]
            for child_id in children:
                self.delete_item(child_id)
        else:

            if item.get("path") and os.path.exists(item["path"]):
                os.remove(item["path"])

        del self.fs["items"][item_id]
        self.save_fs()
        return True

    def move_item(self, item_id: str, target_parent_id: Optional[str]):
        if item_id not in self.fs["items"]:
            return False
        if item_id == target_parent_id:
            return False

        if target_parent_id:
            current = self.fs["items"].get(target_parent_id)
            while current:
                if current["id"] == item_id:
                    return False
                current = self.fs["items"].get(current.get("parent_id"))

        item = self.fs["items"][item_id]
        old_parent_id = item.get("parent_id")

        if item["type"] == "file" and item.get("path"):
            storage_path = item["path"]
            filename = os.path.basename(storage_path)

            if old_parent_id:
                old_parent = self.fs["items"].get(old_parent_id)
                if old_parent and old_parent.get("path"):
                    old_symlink = os.path.join(old_parent["path"], filename)
                    if os.path.islink(old_symlink):
                        os.remove(old_symlink)

            if target_parent_id:
                target = self.fs["items"].get(target_parent_id)
                if target and target.get("path"):
                    new_symlink = os.path.join(target["path"], filename)
                    os.makedirs(os.path.dirname(new_symlink), exist_ok=True)
                    if not os.path.exists(new_symlink):
                        os.symlink(storage_path, new_symlink)

        item["parent_id"] = target_parent_id
        self.save_fs()
        return True

    def rename_item(self, item_id: str, new_name: str):
        if item_id not in self.fs["items"]:
            return False

        self.fs["items"][item_id]["name"] = new_name
        self.save_fs()
        return True

    def get_parents(self, item_id: str) -> List[Dict]:

        chain = []
        curr_id = item_id

        for _ in range(20):
            if not curr_id: break
            item = self.fs["items"].get(curr_id)
            if not item: break
            chain.insert(0, item)
            curr_id = item.get("parent_id")

        return chain


manager = FileSystemManager()


class ItemResponse(BaseModel):
    id: str
    parent_id: Optional[str]
    type: str
    name: str
    created_at: float
    path: Optional[str]
    size: Optional[int] = 0
    width: Optional[int] = 0
    height: Optional[int] = 0


class ListResponse(BaseModel):
    items: List[ItemResponse]
    breadcrumbs: List[ItemResponse]


class CreateFolderRequest(BaseModel):
    name: str
    parent_id: Optional[str] = None


class MoveRequest(BaseModel):
    target_parent_id: Optional[str] = None


class RenameRequest(BaseModel):
    name: str


@images_router.get("/fs/list", response_model=ListResponse)
async def list_fs(parent_id: Optional[str] = None):
    items = manager.list_items(parent_id)
    breadcrumbs = []
    if parent_id:
        breadcrumbs = manager.get_parents(parent_id)
    return {"items": items, "breadcrumbs": breadcrumbs}


@images_router.post("/fs/folder", response_model=ItemResponse)
async def create_folder(req: CreateFolderRequest):
    return manager.create_folder(req.name, req.parent_id)


@images_router.post("/upload")
async def upload_files(
        files: List[UploadFile] = File(...),
        parent_id: Optional[str] = Form(None),
        paths: Optional[List[str]] = Form(None)
):
    if parent_id == "" or parent_id == "null":
        parent_id = None

    results = []

    def get_target_parent(base_parent_id, rel_path):
        parts = rel_path.strip("/").split("/")

        if len(parts) <= 1:
            return base_parent_id

        folder_names = parts[:-1]
        current_parent_id = base_parent_id

        for name in folder_names:

            existing = None
            for item in manager.list_items(current_parent_id):
                if item["type"] == "folder" and item["name"] == name:
                    existing = item
                    break

            if existing:
                current_parent_id = existing["id"]
            else:

                new_folder = manager.create_folder(name, current_parent_id)
                current_parent_id = new_folder["id"]

        return current_parent_id

    for idx, file in enumerate(files):
        target_parent = parent_id
        if paths and idx < len(paths):
            target_parent = get_target_parent(parent_id, paths[idx])

        item = manager.add_file(file, target_parent)
        results.append(item)
    return results


@images_router.delete("/fs/{item_id}")
async def delete_item(item_id: str):
    success = manager.delete_item(item_id)
    if not success:
        raise HTTPException(404, "Item not found")
    return {"status": "success"}


@images_router.put("/fs/{item_id}/move")
async def move_item(item_id: str, req: MoveRequest):
    success = manager.move_item(item_id, req.target_parent_id)
    if not success:
        raise HTTPException(400, "Move failed")
    return {"status": "success"}


@images_router.put("/fs/{item_id}/rename")
async def rename_item(item_id: str, req: RenameRequest):
    success = manager.rename_item(item_id, req.name)
    if not success:
        raise HTTPException(404, "Item not found")
    return {"status": "success"}


@images_router.get("/raw/{image_id}")
async def get_raw_image(image_id: str):
    import mimetypes

    item = manager.get_item(image_id)
    if item and item["type"] == "file" and os.path.exists(item["path"]):
        mime, _ = mimetypes.guess_type(item["path"])
        return FileResponse(item["path"], media_type=mime)

    raise HTTPException(404, "Image not found")


@images_router.get("/list")
async def list_legacy():
    items = [i for i in manager.fs["items"].values() if i["type"] == "file"]
    return {"images": items, "folders": []}
