import re

class CSSParser:
    def __init__(self, content):
        self.content = content
        # Basic regex to find selector blocks: selector { content }
        # This is not a full CSS parser, but sufficient for simple module styling
        # It attempts to preserve comments and formatting by operating on the raw string
        
    def set_property(self, selector, prop, value):
        """
        Updates or adds a property to a specific selector block.
        """
        # 1. Find the block for the selector
        # regex to match: selector \s* { ... }
        # escape the selector just in case, but usually it's simple
        escaped_selector = re.escape(selector)
        
        # Pattern: (selector)\s*(\{)(content)(\})
        # We need to handle nested braces? No, waybar css is usually flat.
        
        pattern = re.compile(fr"({escaped_selector})\s*\{{", re.MULTILINE)
        match = pattern.search(self.content)
        
        if not match:
            # Selector not found, append it
            new_block = f"\n\n{selector} {{\n    {prop}: {value};\n}}"
            self.content += new_block
            return
            
        start_idx = match.end()
        # Find closing brace, respecting simple nesting if any (unlikely for modules)
        # Scan forward
        balance = 1
        end_idx = start_idx
        for i in range(start_idx, len(self.content)):
            char = self.content[i]
            if char == '{':
                balance += 1
            elif char == '}':
                balance -= 1
                if balance == 0:
                    end_idx = i
                    break
        
        if balance != 0:
            raise ValueError("Unbalanced braces in CSS")
            
        block_content = self.content[start_idx:end_idx]
        
        # 2. Update property in block_content
        # Regex for property: (prop)\s*:\s*(value)\s*;
        prop_pattern = re.compile(fr"({re.escape(prop)})\s*:\s*([^;]+);")
        
        if prop_pattern.search(block_content):
            # Update existing
            def replace_func(m):
                return f"{prop}: {value};"
            new_block_content = prop_pattern.sub(replace_func, block_content)
        else:
            # Append property
            # add before the last character or just append
            if block_content.strip() == "":
                new_block_content = f"\n    {prop}: {value};\n"
            else:
                # Try to preserve indentation?
                new_block_content = block_content.rstrip() + f"\n    {prop}: {value};\n"
        
        self.content = self.content[:start_idx] + new_block_content + self.content[end_idx:]

    def to_string(self):
        return self.content

def parse_css(content):
    return CSSParser(content)
