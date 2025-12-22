"""
Frontend Plugin Registry
Manages navigation items and frontend components for plugins.
"""
from typing import Dict, List, Optional
from dataclasses import dataclass, field, asdict


@dataclass
class NavItem:
    """A navigation item for the sidebar."""
    id: str
    title: str
    url: str
    icon: str = "default"  # Icon key (svg name) or use icon_svg for custom
    icon_svg: Optional[str] = None  # Custom SVG markup (takes priority over icon key)
    group: Optional[str] = None  # Group ID (e.g., "config") or None for top-level
    order: int = 100  # Lower = appears first
    
    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class NavGroup:
    """A collapsible group in the sidebar."""
    id: str
    title: str
    icon: str
    icon_svg: Optional[str] = None  # Custom SVG markup (takes priority over icon key)
    order: int = 50
    items: List[NavItem] = field(default_factory=list)
    
    def to_dict(self) -> dict:
        sorted_items = sorted(self.items, key=lambda x: x.order)
        return {
            "id": self.id,
            "title": self.title,
            "icon": self.icon,
            "icon_svg": self.icon_svg,
            "order": self.order,
            "items": [item.to_dict() for item in sorted_items],
            "item_ids": [item.id for item in sorted_items]  # Pre-computed for template
        }


class FrontendRegistry:
    """
    Registry for frontend navigation and components.
    Plugins register their navigation items here.
    """
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._groups: Dict[str, NavGroup] = {}
        self._top_level_items: List[NavItem] = []
        # Note: Routers self-register their navigation items
    
    def register_nav_group(self, group: NavGroup):
        """Register a navigation group (skips if already exists)."""
        if group.id not in self._groups:
            self._groups[group.id] = group
    
    def register_nav_item(self, item: NavItem):
        """Register a navigation item."""
        if item.group:
            if item.group not in self._groups:
                # Auto-create group if it doesn't exist
                self._groups[item.group] = NavGroup(
                    id=item.group,
                    title=item.group.title(),
                    icon="default"
                )
            self._groups[item.group].items.append(item)
        else:
            self._top_level_items.append(item)
    
    def get_navigation(self) -> dict:
        """
        Get the complete navigation structure for rendering.
        Returns a dict with 'items' (top-level) and 'groups'.
        """
        # Sort top-level items by order
        sorted_items = sorted(self._top_level_items, key=lambda x: x.order)
        
        # Sort groups by order
        sorted_groups = sorted(self._groups.values(), key=lambda x: x.order)
        
        # Build the navigation structure
        navigation = []
        item_index = 0
        group_index = 0
        
        # Interleave items and groups based on order
        while item_index < len(sorted_items) or group_index < len(sorted_groups):
            # Get next item and group orders
            item_order = sorted_items[item_index].order if item_index < len(sorted_items) else float('inf')
            group_order = sorted_groups[group_index].order if group_index < len(sorted_groups) else float('inf')
            
            if item_order <= group_order:
                navigation.append({
                    "type": "item",
                    **sorted_items[item_index].to_dict()
                })
                item_index += 1
            else:
                navigation.append({
                    "type": "group",
                    **sorted_groups[group_index].to_dict()
                })
                group_index += 1
        
        return {"navigation": navigation}
    
    def get_group_items(self, group_id: str) -> List[dict]:
        """Get items for a specific group (for template rendering)."""
        if group_id in self._groups:
            return [item.to_dict() for item in sorted(self._groups[group_id].items, key=lambda x: x.order)]
        return []
    
    def get_all_page_ids(self) -> List[str]:
        """Get all registered page IDs (for active state detection)."""
        ids = [item.id for item in self._top_level_items]
        for group in self._groups.values():
            ids.extend([item.id for item in group.items])
        return ids


# Singleton instance
frontend_registry = FrontendRegistry()


def register_navigation(items: List[NavItem], groups: List[NavGroup] = None):
    """
    Helper function for plugins to register navigation.
    
    Example usage in a plugin:
        from utils.plugins_frontend import register_navigation, NavItem
        
        register_navigation([
            NavItem(id="my_tool", title="My Tool", url="/my-tool", group="tools")
        ])
    """
    if groups:
        for group in groups:
            frontend_registry.register_nav_group(group)
    for item in items:
        frontend_registry.register_nav_item(item)
