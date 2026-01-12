"""
Hyprland Config Migration - Converts legacy window rules to new syntax (v0.53+).

Supports:
- windowrulev2 -> windowrule (new syntax)
- Legacy windowrule -> windowrule (new syntax)
- layerrule -> layerrule (new syntax)
- misc:new_window_takes_over_fullscreen -> misc:on_focus_under_fullscreen
- master:inherit_fullscreen -> misc:on_focus_under_fullscreen
"""

from __future__ import annotations
import subprocess
import os
import time
from pathlib import Path
from typing import Optional, List, Dict, Tuple
from dataclasses import dataclass

from plugins.hyprland.helpers.hyprlang import HyprConf, HyprLine, HyprValue


@dataclass
class MigrationResult:
    """Result of a migration operation."""
    migrated_rules: int
    renamed_options: int
    backup_path: Optional[Path] = None


@dataclass
class HyprlandVersion:
    """Represents a Hyprland version."""
    major: int
    minor: int
    patch: int
    
    @classmethod
    def detect(cls) -> Optional['HyprlandVersion']:
        """Detect Hyprland version via hyprctl."""
        try:
            result = subprocess.run(
                ['hyprctl', 'version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                return cls.parse(result.stdout)
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        return None
    
    @classmethod
    def parse(cls, output: str) -> Optional['HyprlandVersion']:
        """Parse version from hyprctl output."""
        for line in output.splitlines():
                                        
            if "Hyprland l" in line:
                continue
            
                                                  
            if 'v' in line:
                pos = line.find('v')
                version_part = line[pos + 1:]
                
                                                                
                version_str = ""
                for c in version_part:
                    if c.isdigit() or c == '.':
                        version_str += c
                    else:
                        break
                
                nums = version_str.split('.')
                if len(nums) >= 3:
                    try:
                        return cls(
                            major=int(nums[0]),
                            minor=int(nums[1]),
                            patch=int(nums[2])
                        )
                    except ValueError:
                        pass
            
                                                  
            line_stripped = line.strip()
            if line_stripped.startswith("Tag:"):
                parts = line_stripped.split()
                if len(parts) >= 2:
                    version_str = parts[1].lstrip('v')
                    nums = version_str.split('.')
                    if len(nums) >= 3:
                        try:
                            return cls(
                                major=int(nums[0]),
                                minor=int(nums[1]),
                                patch=int(nums[2])
                            )
                        except ValueError:
                            pass
        
        return None
    
    def supports_new_window_rules(self) -> bool:
        """Check if this version supports new window rule syntax."""
        return self.major > 0 or (self.major == 0 and self.minor >= 53)
    
    def __str__(self) -> str:
        return f"{self.major}.{self.minor}.{self.patch}"


V53_EFFECT_RENAMES = {
    # dynamic effects
    'persistent_size': 'persistent_size', # no change
    'nomaxsize': 'no_max_size',
    'stayfocused': 'stay_focused',
    'bordercolor': 'border_color',
    'idleinhibit': 'idle_inhibit',
    'maxsize': 'max_size',
    'minsize': 'min_size',
    'bordersize': 'border_size',
    'roundingpower': 'rounding_power',
    'allowsinput': 'allows_input',
    'dimaround': 'dim_around',
    'focusonactivate': 'focus_on_activate',
    'keepaspectratio': 'keep_aspect_ratio',
    'nearestneighbor': 'nearest_neighbor',
    'noanim': 'no_anim',
    'noblur': 'no_blur',
    'nodim': 'no_dim',
    'nofocus': 'no_focus',
    'nofollowmouse': 'no_follow_mouse',
    'noshadow': 'no_shadow',
    'noshortcutsinhibit': 'no_shortcuts_inhibit',
    'noscreenshare': 'no_screen_share',
    'novrr': 'no_vrr',
    'forcergbx': 'force_rgbx',
    'syncfullscreen': 'sync_fullscreen',
    'renderunfocused': 'render_unfocused',
    'scrollmouse': 'scroll_mouse',
    'scrolltouchpad': 'scroll_touchpad',
    
    # static effects
    'noinitialfocus': 'no_initial_focus',
    'suppressevent': 'suppress_event',
    'noclosefor': 'no_close_for',
    
    # layer rules
    'blurpopups': 'blur_popups',
    'ignorealpha': 'ignore_alpha',
    'abovelock': 'above_lock',
}


class ConfigMigrator:
    """Migrates Hyprland config from legacy syntax to new syntax."""
    
                                                            
    MATCH_KEYS = {
        'class', 'title', 'initialclass', 'initialtitle',
        'floating', 'xwayland', 'pinned', 'workspace',
        'fullscreen', 'monitor', 'address', 'pid', 'uid', 'group'
    }
    
                 
    KEY_RENAMES = {
        'floating': 'float',
    }
    
    @classmethod
    def needs_migration(cls, conf: HyprConf) -> bool:
        """Check if config contains legacy rules that need migration."""
        for line in conf.lines:
            key_lower = line.key.lower()
            
                                           
            if key_lower == 'windowrulev2':
                return True
            
                                                 
            if key_lower == 'windowrule' and 'match:' not in line.value.raw:
                return True
            
                                                
            if key_lower == 'layerrule' and 'match:' not in line.value.raw:
                return True
            
                                        
            if 'new_window_takes_over_fullscreen' in key_lower:
                return True
            
                                                                                          
            if key_lower == 'master:inherit_fullscreen':
                return True
        
        return False
    
    @classmethod
    def backup_config(cls, path: Path) -> Path:
        """Create a timestamped backup of the config file."""
        timestamp = int(time.time())
        backup_name = f"{path.name}.bak.{timestamp}"
        backup_path = path.parent / backup_name
        
        import shutil
        shutil.copy2(path, backup_path)
        
        return backup_path
    
    @classmethod
    def _split_respecting_grouping(cls, s: str, delimiter: str, max_splits: int = 0) -> List[str]:
        """Split string by delimiter, respecting parentheses/brackets/braces."""
        parts = []
        current = ""
        paren_depth = 0
        bracket_depth = 0
        brace_depth = 0
        splits = 0
        
        for c in s:
            if max_splits > 0 and splits >= max_splits:
                current += c
                continue
            
            if c == '(':
                paren_depth += 1
            elif c == ')':
                if paren_depth > 0:
                    paren_depth -= 1
            elif c == '[':
                bracket_depth += 1
            elif c == ']':
                if bracket_depth > 0:
                    bracket_depth -= 1
            elif c == '{':
                brace_depth += 1
            elif c == '}':
                if brace_depth > 0:
                    brace_depth -= 1
            
            if c == delimiter and paren_depth == 0 and bracket_depth == 0 and brace_depth == 0:
                parts.append(current.strip())
                current = ""
                splits += 1
            else:
                current += c
        
        parts.append(current.strip())
        return parts
    
    @classmethod
    def migrate(cls, conf: HyprConf) -> MigrationResult:
        """Migrate all legacy rules in the config to new syntax."""
        migrated_rules = 0
        renamed_options = 0
        
        for line in conf.lines:
            key_lower = line.key.lower()
            
            is_v2_key = key_lower == 'windowrulev2'
            is_legacy_windowrule = key_lower == 'windowrule' and 'match:' not in line.value.raw
            is_legacy_layerrule = key_lower == 'layerrule' and 'match:' not in line.value.raw
            
            if is_v2_key or is_legacy_windowrule:
                                                  
                line.key = 'windowrule'
                
                raw = line.value.raw
                parts = cls._split_respecting_grouping(raw, ',', max_splits=1)
                
                if len(parts) >= 2:
                    effect = parts[0]
                    match_part = parts[1]
                    
                    new_parts = []
                    
                                                                
                    secondary_parts = cls._split_respecting_grouping(match_part, ',', max_splits=0)
                    
                    all_parts = [effect] + secondary_parts
                    
                    for part in all_parts:
                        p = part.strip()
                        if not p:
                            continue
                        
                                                                                     
                        if ':' in p:
                            colon_pos = p.find(':')
                            k = p[:colon_pos].strip()
                            val = p[colon_pos + 1:].strip()
                            
                            if k.lower() in cls.MATCH_KEYS:
                                new_key = cls.KEY_RENAMES.get(k.lower(), k)
                                new_parts.append(f"match:{new_key} {val}")
                                continue
                        
                                                               
                        p_str = p
                        
                                                     
                        if p_str.startswith('ignorealpha'):
                            p_str = p_str.replace('ignorealpha', 'ignore_alpha', 1)
                        
                                                                            
                        if p_str.startswith('move onscreen cursor'):
                            subparts = p_str.split()
                            if len(subparts) >= 5:
                                x_arg = subparts[3]
                                y_arg = subparts[4]
                                
                                new_x = cls._transform_cursor_offset(x_arg, 'window_w')
                                new_y = cls._transform_cursor_offset(y_arg, 'window_h')
                                
                                new_parts.append(f"move cursor_x{new_x} cursor_y{new_y}")
                                continue
                        
                                                                  
                        effect_parts = p_str.split(None, 1)
                        if len(effect_parts) == 2:
                            new_parts.append(f"{effect_parts[0]} {effect_parts[1]}")
                        else:
                            new_parts.append(f"{p_str} on")
                    
                                                                                           
                    any_explicit_match = any(s.startswith('match:') for s in new_parts)
                    if not any_explicit_match and new_parts:
                        last = new_parts.pop()
                        raw_regex = last.rstrip(' on')
                        new_parts.append(f"match:class {raw_regex}")
                    
                    new_raw = ', '.join(new_parts)
                    line.value = HyprValue(raw=new_raw, parts=[])
                
                migrated_rules += 1
            
            elif is_legacy_layerrule:
                                                 
                raw = line.value.raw
                parts = cls._split_respecting_grouping(raw, ',', max_splits=1)
                
                if len(parts) >= 2:
                    effect = parts[0].strip()
                    match_part = parts[1].strip()
                    
                                            
                    if effect == 'stayfocused':
                        effect = 'stay_focused'
                    elif effect == 'ignorezero':
                        effect = 'ignore_alpha 0'
                    elif effect.startswith('ignorealpha'):
                        effect = effect.replace('ignorealpha', 'ignore_alpha', 1)
                    
                    new_parts = []
                    
                                              
                    if ' ' in effect:
                        new_parts.append(effect)
                    else:
                        new_parts.append(f"{effect} on")
                    
                                         
                    new_parts.append(f"match:namespace {match_part}")
                    
                    new_raw = ', '.join(new_parts)
                    line.value = HyprValue(raw=new_raw, parts=[])
                    
                    migrated_rules += 1
            
                                                                                            
            if 'misc:new_window_takes_over_fullscreen' in line.key.lower():
                line.key = 'misc:on_focus_under_fullscreen'
                renamed_options += 1
            
                                                                                
            if line.key.lower() == 'master:inherit_fullscreen':
                line.key = 'misc:on_focus_under_fullscreen'
                renamed_options += 1
        
        return MigrationResult(
            migrated_rules=migrated_rules,
            renamed_options=renamed_options
        )
    
    @classmethod
    def _transform_cursor_offset(cls, arg: str, dimension: str) -> str:
        """Transform cursor offset argument to new format."""
        if arg.endswith('%'):
            try:
                val = float(arg.rstrip('%')) / 100.0
                sign = '+' if val >= 0 else ''
                if abs(val) < 1:
                    return f"{sign}{dimension}*{val:g}".replace('+-', '-')
                else:
                    return f"{sign}{dimension}*{val:g}".replace('+-', '-')
            except ValueError:
                pass
        
                                                  
        if not arg.startswith('-') and not arg.startswith('+'):
            return f"+{arg}"
        return arg.replace('+-', '-')
    
    @classmethod
    def get_migration_summary(cls, conf: HyprConf) -> str:
        """Get a human-readable summary of what needs to be migrated."""
        rule_count = sum(
            1 for l in conf.lines
            if l.key.lower() == 'windowrulev2' or
               (l.key.lower() == 'windowrule' and 'match:' not in l.value.raw)
        )
        
        layer_count = sum(
            1 for l in conf.lines
            if l.key.lower() == 'layerrule' and 'match:' not in l.value.raw
        )
        
        old_fullscreen_option = any(
            'new_window_takes_over_fullscreen' in l.key.lower()
            for l in conf.lines
        )
        
        old_inherit_fullscreen = any(
            l.key.lower() == 'master:inherit_fullscreen'
            for l in conf.lines
        )
        
        summary_parts = []
        if rule_count > 0:
            summary_parts.append(f"• {rule_count} legacy window rules → windowrule (new syntax)")
        if layer_count > 0:
            summary_parts.append(f"• {layer_count} legacy layer rules → layerrule (new syntax)")
        if old_fullscreen_option:
            summary_parts.append("• misc:new_window_takes_over_fullscreen → misc:on_focus_under_fullscreen")
        if old_inherit_fullscreen:
            summary_parts.append("• master:inherit_fullscreen → misc:on_focus_under_fullscreen")
        
        return '\n'.join(summary_parts)
