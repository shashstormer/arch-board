r"""
Hyprlang Parser - Complete implementation for parsing hypr configuration files.

Supports:
- Basic assignments: key = value
- Variables: $VAR = value, with substitution
- Comments: # starts comment, ## escapes to literal #
- Categories: category { ... } with arbitrary nesting
- Special categories: category { key = A; ... } with key-based grouping
- Inline syntax: cat:var = val and cat[key]:var = val
- Arithmetic: {{VAR + 1}} with escaping \{{
- Conditionals: # hyprlang if VAR / # hyprlang endif
"""

from __future__ import annotations

import glob as glob_module
import os
import re
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Dict, List, Optional, Union, Set
             
                                                                               

class TokenType(Enum):
              
    IDENT = auto()                                 
    VARIABLE = auto()          
    NUMBER = auto()                     
    STRING = auto()                     
    
               
    EQUALS = auto()         
    COLON = auto()          
    LBRACE = auto()         
    RBRACE = auto()         
    LBRACKET = auto()       
    RBRACKET = auto()       
    COMMA = auto()          
    
             
    NEWLINE = auto()                 
    COMMENT = auto()                
    DIRECTIVE = auto()                   
    ARITHMETIC = auto()           
    EOF = auto()


@dataclass
class Token:
    type: TokenType
    value: str
    line: int
    col: int
    start_pos: int = 0                           
    
    def __repr__(self):
        return f"Token({self.type.name}, {self.value!r}, L{self.line})"


                                                                               
       
                                                                               

class Lexer:
    def __init__(self, text: str):
        self.text = text
        self.pos = 0
        self.line = 1
        self.col = 1
        self.tokens: List[Token] = []
    
    def peek(self, offset: int = 0) -> str:
        idx = self.pos + offset
        return self.text[idx] if idx < len(self.text) else ''
    
    def advance(self) -> str:
        ch = self.peek()
        self.pos += 1
        if ch == '\n':
            self.line += 1
            self.col = 1
        else:
            self.col += 1
        return ch
    
    def skip_whitespace(self):
        """Skip spaces and tabs (not newlines)."""
        while self.peek() in ' \t':
            self.advance()
    
    def add_token(self, type: TokenType, value: str, start_pos: int = None):
        pos = start_pos if start_pos is not None else self.pos - len(value)
        self.tokens.append(Token(type, value, self.line, self.col, pos))
    
    def read_until(self, stop_chars: str, include_newline: bool = False) -> str:
        """Read until one of stop_chars is found."""
        result = []
        while self.peek() and self.peek() not in stop_chars:
            if self.peek() == '\n' and not include_newline:
                break
            result.append(self.advance())
        return ''.join(result)
    
    def read_quoted_string(self) -> str:
        """Read a quoted string, handling escapes."""
        quote = self.advance()                         
        result = []
        while self.peek() and self.peek() != quote:
            if self.peek() == '\n':
                break
            if self.peek() == '\\' and self.peek(1) in (quote, '\\'):
                self.advance()                  
            result.append(self.advance())
        if self.peek() == quote:
            self.advance()                         
        return ''.join(result)
    
    def read_arithmetic(self) -> str:
        """Read {{...}} arithmetic expression."""
        self.advance()           
        self.advance()            
        result = []
        depth = 1
        while self.peek() and depth > 0:
            if self.peek() == '{' and self.peek(1) == '{':
                depth += 1
                result.append(self.advance())
                result.append(self.advance())
            elif self.peek() == '}' and self.peek(1) == '}':
                depth -= 1
                if depth > 0:
                    result.append(self.advance())
                    result.append(self.advance())
                else:
                    self.advance()                   
                    self.advance()                    
            else:
                result.append(self.advance())
        return ''.join(result)
    
    def tokenize(self) -> List[Token]:
        """Convert input text to tokens."""
        while self.pos < len(self.text):
            self.skip_whitespace()
            ch = self.peek()
            
            if not ch:
                break
            
                     
            if ch == '\n':
                self.add_token(TokenType.NEWLINE, '\n')
                self.advance()
                continue
            
                                  
            if ch == '#':
                self.advance()
                if self.peek() == '#':
                                                  
                    self.advance()
                    self.add_token(TokenType.IDENT, '#')
                else:
                                                  
                    self.skip_whitespace()
                    rest = self.read_until('\n')
                    if rest.startswith('hyprlang '):
                        self.add_token(TokenType.DIRECTIVE, rest[9:].strip())
                    else:
                        self.add_token(TokenType.COMMENT, rest)
                continue
            
                      
            if ch == '$':
                var_start = self.pos                     
                self.advance()
                name = self.read_until(' \t\n=:{}[]#,')
                self.add_token(TokenType.VARIABLE, name, start_pos=var_start)
                continue
            
                                   
            if ch == '{' and self.peek(1) == '{':
                                  
                expr = self.read_arithmetic()
                self.add_token(TokenType.ARITHMETIC, expr)
                continue
            
                                
            if ch == '=':
                pos = self.pos
                self.advance()
                self.add_token(TokenType.EQUALS, '=', start_pos=pos)
                continue
            if ch == ':':
                pos = self.pos
                self.advance()
                self.add_token(TokenType.COLON, ':', start_pos=pos)
                continue
            if ch == '{':
                pos = self.pos
                self.advance()
                self.add_token(TokenType.LBRACE, '{', start_pos=pos)
                continue
            if ch == '}':
                pos = self.pos
                self.advance()
                self.add_token(TokenType.RBRACE, '}', start_pos=pos)
                continue
            if ch == '[':
                pos = self.pos
                self.advance()
                self.add_token(TokenType.LBRACKET, '[', start_pos=pos)
                continue
            if ch == ']':
                pos = self.pos
                self.advance()
                self.add_token(TokenType.RBRACKET, ']', start_pos=pos)
                continue
            if ch == ',':
                pos = self.pos
                self.advance()
                self.add_token(TokenType.COMMA, ',', start_pos=pos)
                continue
            
                           
            if ch in '"\'':
                s = self.read_quoted_string()
                self.add_token(TokenType.STRING, s)
                continue
            
                                                                     
            ident = self.read_until(' \t\n=:{}[]#,')
            if ident:
                                  
                if re.match(r'^-?\d+(\.\d+)?$', ident):
                    self.add_token(TokenType.NUMBER, ident)
                else:
                    self.add_token(TokenType.IDENT, ident)
        
        self.add_token(TokenType.EOF, '')
        return self.tokens


                                                                               
           
                                                                               

@dataclass
class HyprValue:
    """Represents a value that may contain variable refs or arithmetic."""
    raw: str
    parts: List[Union[str, 'HyprVarRef', 'HyprArithmetic']] = field(default_factory=list)
    
    def resolve(self, variables: Dict[str, str]) -> str:
        """Resolve all variable references and arithmetic."""
        if not self.parts:
            return self.raw
        result = []
        for part in self.parts:
            if isinstance(part, str):
                result.append(part)
            elif isinstance(part, HyprVarRef):
                result.append(variables.get(part.name, f'${part.name}'))
            elif isinstance(part, HyprArithmetic):
                result.append(str(part.evaluate(variables)))
        return ''.join(result)


@dataclass
class HyprVarRef:
    """Reference to a variable like $VAR."""
    name: str


@dataclass
class HyprArithmetic:
    """Arithmetic expression like {{VAR + 1}}."""
    expr: str
    
    def evaluate(self, variables: Dict[str, str]) -> Union[int, float, str]:
        """Evaluate simple arithmetic: A op B."""
        expr = self.expr.strip()
                                         
        match = re.match(r'(\S+)\s*([+\-*/])\s*(\S+)', expr)
        if not match:
            return expr
        
        left, op, right = match.groups()
        
                           
        if left.startswith('$'):
            left = variables.get(left[1:], left)
        elif left in variables:
            left = variables[left]
            
        if right.startswith('$'):
            right = variables.get(right[1:], right)
        elif right in variables:
            right = variables[right]
        
        try:
            left_num = float(left)
            right_num = float(right)
            
            if op == '+':
                result = left_num + right_num
            elif op == '-':
                result = left_num - right_num
            elif op == '*':
                result = left_num * right_num
            elif op == '/':
                result = left_num / right_num if right_num != 0 else 0
            else:
                return expr
            
                                        
            return int(result) if result == int(result) else result
        except ValueError:
            return expr


@dataclass
class HyprLine:
    """A key=value assignment."""
    key: str
    value: HyprValue
    is_variable: bool = False                             
    
    def __repr__(self):
        prefix = '$' if self.is_variable else ''
        return f"HyprLine({prefix}{self.key} = {self.value.raw})"


@dataclass
class HyprCategory:
    """A category block with optional key and nested content."""
    name: str
    key: Optional[str] = None                                            
    lines: List[HyprLine] = field(default_factory=list)
    categories: List['HyprCategory'] = field(default_factory=list)
    
    def get_line(self, key: str) -> Optional[HyprLine]:
        for line in self.lines:
            if line.key == key:
                return line
        return None
    
    def get_category(self, name: str, key: Optional[str] = None) -> Optional['HyprCategory']:
        for cat in self.categories:
            if cat.name == name and (key is None or cat.key == key):
                return cat
        return None
    
    def __repr__(self):
        key_str = f'[{self.key}]' if self.key else ''
        return f"HyprCategory({self.name}{key_str}, {len(self.lines)} lines, {len(self.categories)} subcats)"


@dataclass
class HyprConf:
    """Root configuration container."""
    variables: Dict[str, HyprValue] = field(default_factory=dict)
    lines: List[HyprLine] = field(default_factory=list)
    categories: List[HyprCategory] = field(default_factory=list)
    
    def get_variable(self, name: str) -> Optional[str]:
        """Get resolved variable value."""
        if name in self.variables:
            return self.variables[name].resolve(self._get_var_dict())
                           
        return os.environ.get(name)
    
    def _get_var_dict(self) -> Dict[str, str]:
        """Get all variables as resolved strings."""
        result = {}
        for name, val in self.variables.items():
            result[name] = val.raw                                       
        return result
    
    def get(self, path: str) -> Optional[str]:
        """
        Get value by path.
        Examples:
            get("monitor") -> top-level line
            get("input:kb_layout") -> input category, kb_layout line
            get("device[keyboard]:enabled") -> device category with key, enabled line
        """
        parts = self._parse_path(path)
        if not parts:
            return None
        
                                         
        current_lines = self.lines
        current_cats = self.categories
        
        for i, (name, key) in enumerate(parts[:-1]):
            found = None
            for cat in current_cats:
                if cat.name == name and (key is None or cat.key == key):
                    found = cat
                    break
            if not found:
                return None
            current_lines = found.lines
            current_cats = found.categories
        
                             
        final_name, final_key = parts[-1]
        
                              
        for line in current_lines:
            if line.key == final_name:
                return line.value.resolve(self._get_var_dict())
        
        return None
    
    def set(self, path: str, value: str) -> bool:
        """Set value by path. Creates categories/lines if needed. Handles split categories."""
        parts = self._parse_path(path)
        if not parts:
            return False
        
        # Start search from root
        current_containers = [self]
        
        # Navigate categories (all parts except last)
        for i, (name, key) in enumerate(parts[:-1]):
            next_containers = []
            for container in current_containers:
                # Find all matching sub-categories in this container
                for cat in container.categories:
                    if cat.name == name and (key is None or cat.key == key):
                        next_containers.append(cat)
            
            if not next_containers:
                # Path segment missing. Create new category in the first available container.
                if not current_containers:
                    return False
                
                # Default to creating in the first container (e.g. root)
                target_parent = current_containers[0]
                new_cat = HyprCategory(name=name, key=key)
                target_parent.categories.append(new_cat)
                
                # Continue traversal with the new category
                next_containers = [new_cat]
            
            current_containers = next_containers
        
        # We are now at the level where the value should exist.
        # current_containers contains all matching categories (e.g. all 'general' blocks).
        final_name, final_key = parts[-1]
        
        # 1. Try to update existing key in ANY of the matching containers
        for container in current_containers:
            for line in container.lines:
                if line.key == final_name:
                    line.value = HyprValue(raw=value)
                    return True
        
        # 2. Key not found in any block. Append to the FIRST matching block.
        # (or create one if somehow empty, handled above)
        if current_containers:
            target_container = current_containers[0]
            new_line = HyprLine(key=final_name, value=HyprValue(raw=value))
            target_container.lines.append(new_line)
            return True
            
        return False
    
    def _parse_path(self, path: str) -> List[tuple]:
        """Parse path like 'cat[key]:subcat:var' into [(cat, key), (subcat, None), (var, None)]."""
        result = []
        parts = path.split(':')
        for part in parts:
                                              
            match = re.match(r'([^\[]+)(?:\[([^\]]+)\])?', part)
            if match:
                name = match.group(1)
                key = match.group(2)
                result.append((name, key))
        return result
    
    def to_string(self, indent: int = 0) -> str:
        """Serialize back to hyprlang format."""
        lines = []
        prefix = '    ' * indent
        var_dict = self._get_var_dict()
        
                         
        for name, val in self.variables.items():
            lines.append(f"{prefix}${name} = {val.raw}")
        
        if self.variables and (self.lines or self.categories):
            lines.append('')
        
                         
        for line in self.lines:
            var_prefix = '$' if line.is_variable else ''
            lines.append(f"{prefix}{var_prefix}{line.key} = {line.value.raw}")
        
                    
        for cat in self.categories:
            lines.append('')
            key_str = f'[{cat.key}]' if cat.key else ''
            lines.append(f"{prefix}{cat.name}{key_str} {{")
            lines.append(self._category_to_string(cat, indent + 1))
            lines.append(f"{prefix}}}\n")
        
        return '\n'.join(lines)
    
    def _category_to_string(self, cat: HyprCategory, indent: int) -> str:
        """Serialize a category's contents."""
        lines = []
        prefix = '    ' * indent
        
        for line in cat.lines:
            var_prefix = '$' if line.is_variable else ''
            lines.append(f"{prefix}{var_prefix}{line.key} = {line.value.raw}")
        
        for subcat in cat.categories:
            key_str = f'[{subcat.key}]' if subcat.key else ''
            lines.append(f"{prefix}{subcat.name}{key_str} {{")
            lines.append(self._category_to_string(subcat, indent + 1))
            lines.append(f"{prefix}}}")
        
        return '\n'.join(lines)


                                                                               
        
                                                                               

class Parser:
    def __init__(self, tokens: List[Token], source_text: str = "", 
                 base_dir: str = "", parsed_files: Optional[Set[str]] = None):
        self.tokens = tokens
        self.source_text = source_text
        self.pos = 0
        self.config = HyprConf()
        self.conditionals: List[bool] = []                               
        self.base_dir = base_dir or os.getcwd()                                               
        self.parsed_files = parsed_files if parsed_files is not None else set()                                                    
    
    def peek(self, offset: int = 0) -> Token:
        idx = self.pos + offset
        if idx < len(self.tokens):
            return self.tokens[idx]
        return Token(TokenType.EOF, '', 0, 0)
    
    def advance(self) -> Token:
        token = self.peek()
        self.pos += 1
        return token
    
    def skip_newlines(self):
        while self.peek().type == TokenType.NEWLINE:
            self.advance()
    
    def skip_to_newline(self):
        while self.peek().type not in (TokenType.NEWLINE, TokenType.EOF):
            self.advance()
    
    def parse(self) -> HyprConf:
        """Parse tokens into configuration."""
        while self.peek().type != TokenType.EOF:
            self.skip_newlines()
            if self.peek().type == TokenType.EOF:
                break

                                                   
            if self.conditionals and not self.conditionals[-1]:
                self._skip_conditional_block()
                continue
            
            self._parse_line(self.config.lines, self.config.categories)
        
        return self.config
    
    def _parse_line(self, lines: List[HyprLine], categories: List[HyprCategory]):
        """Parse a single line/statement."""
        token = self.peek()
        
                       
        if token.type == TokenType.COMMENT:
            self.advance()
            return
        
                           
        if token.type == TokenType.DIRECTIVE:
            self._handle_directive(token.value)
            self.advance()
            return
        
                                           
        if token.type == TokenType.VARIABLE:
            self._parse_variable()
            return
        
                                
                       
                            
                                           
        if token.type == TokenType.IDENT:
            self._parse_assignment_or_category(lines, categories)
            return
        
                      
        self.advance()
    
    def _parse_variable(self):
        """Parse $VAR = value."""
        var_token = self.advance()                
        var_name = var_token.value
        
        self.skip_newlines()
        
        if self.peek().type != TokenType.EQUALS:
            return
        self.advance()             
        
        value = self._parse_value()
        self.config.variables[var_name] = value
    
    def _parse_assignment_or_category(self, lines: List[HyprLine], categories: List[HyprCategory]):
        """Parse either key=value or category { }."""
                                                         
        path_parts = []
        
        while True:
            if self.peek().type == TokenType.IDENT:
                name = self.advance().value
                key = None
                
                                 
                if self.peek().type == TokenType.LBRACKET:
                    self.advance()     
                    if self.peek().type in (TokenType.IDENT, TokenType.STRING, TokenType.NUMBER):
                        key = self.advance().value
                    if self.peek().type == TokenType.RBRACKET:
                        self.advance()     
                
                path_parts.append((name, key))
                
                                               
                if self.peek().type == TokenType.COLON:
                    self.advance()
                    continue
            break
        
        if not path_parts:
            self.skip_to_newline()
            return
        
        self.skip_newlines()
        
                        
        if self.peek().type == TokenType.LBRACE:
            self._parse_category_block(path_parts, categories)
            return
        
                    
        if self.peek().type == TokenType.EQUALS:
            self.advance()             
            value = self._parse_value()
            
                                                 
            final_name, final_key = path_parts[-1]
            if final_name == "source" and len(path_parts) == 1:
                self._handle_source(value.raw)
                return
            
                                                            
            target_lines = lines
            target_cats = categories
            
            for i, (name, key) in enumerate(path_parts[:-1]):
                found = None
                for cat in target_cats:
                    if cat.name == name and cat.key == key:
                        found = cat
                        break
                if not found:
                    found = HyprCategory(name=name, key=key)
                    target_cats.append(found)
                target_lines = found.lines
                target_cats = found.categories
            
            line = HyprLine(key=final_name, value=value)
            target_lines.append(line)
            return
        
                             
        self.skip_to_newline()
    
    def _parse_category_block(self, path_parts: List[tuple], parent_cats: List[HyprCategory]):
        """Parse a category { ... } block."""
        self.advance()             
        
                                           
        target_cats = parent_cats
        for i, (name, key) in enumerate(path_parts):
            if i < len(path_parts) - 1:
                                       
                found = None
                for cat in target_cats:
                    if cat.name == name and cat.key == key:
                        found = cat
                        break
                if not found:
                    found = HyprCategory(name=name, key=key)
                    target_cats.append(found)
                target_cats = found.categories
            else:
                                                                     
                cat = HyprCategory(name=name, key=key)
                target_cats.append(cat)
                                
                self.skip_newlines()
                while self.peek().type not in (TokenType.RBRACE, TokenType.EOF):
                    self._parse_line(cat.lines, cat.categories)
                    self.skip_newlines()
                
                if self.peek().type == TokenType.RBRACE:
                    self.advance()             
    
    def _handle_source(self, path_pattern: str):
        """Handle source = path statements by parsing the sourced file(s).
        
        Supports:
        - Relative paths (resolved against current file's directory)
        - Tilde expansion (~)
        - Glob patterns (*, **, ?)
        """
                      
        path_pattern = os.path.expanduser(path_pattern)
        
                                                      
        if not os.path.isabs(path_pattern):
            path_pattern = os.path.join(self.base_dir, path_pattern)
        
                              
        matched_files = glob_module.glob(path_pattern, recursive=True)
        
                                      
        matched_files.sort()
        
        for file_path in matched_files:
                              
            if os.path.isdir(file_path):
                continue
            
                                      
            abs_path = os.path.abspath(file_path)
            
                                          
            if abs_path in self.parsed_files:
                continue
            
                                        
            if not os.path.exists(abs_path):
                continue
            
                            
            self.parsed_files.add(abs_path)
            
            try:
                                         
                with open(abs_path, 'r') as f:
                    source_text = f.read()
                
                          
                lexer = Lexer(source_text)
                tokens = lexer.tokenize()
                
                                                                                            
                sub_parser = Parser(
                    tokens, 
                    source_text=source_text,
                    base_dir=os.path.dirname(abs_path),
                    parsed_files=self.parsed_files
                )
                sub_config = sub_parser.parse()
                
                                                                 
                self._merge_config(sub_config)
                
            except Exception as e:
                                                          
                pass
    
    def _merge_config(self, other: HyprConf):
        """Merge another config's content into the current config."""
                         
        self.config.variables.update(other.variables)
        
                      
        self.config.lines.extend(other.lines)
        
                                                                    
        for other_cat in other.categories:
            existing_cat = None
            for cat in self.config.categories:
                if cat.name == other_cat.name and cat.key == other_cat.key:
                    existing_cat = cat
                    break
            
            if existing_cat:
                                               
                existing_cat.lines.extend(other_cat.lines)
                existing_cat.categories.extend(other_cat.categories)
            else:
                                     
                self.config.categories.append(other_cat)
    
    def _parse_value(self) -> HyprValue:
        """Parse a value (everything until newline or special char in context)."""
                                                                             
        if self.source_text and self.peek().type not in (TokenType.NEWLINE, TokenType.EOF):
            start_token = self.peek()
            start_pos = start_token.start_pos
            
                                                                     
            end_pos = start_pos
            while self.peek().type not in (TokenType.NEWLINE, TokenType.EOF, TokenType.RBRACE, TokenType.COMMENT):
                token = self.advance()
                
                # Correctly calculate length in source text
                length = len(token.value)
                if token.type == TokenType.VARIABLE:
                    length += 1 # $
                elif token.type == TokenType.STRING:
                    # Check for quotes in source
                    if token.start_pos < len(self.source_text) and self.source_text[token.start_pos] in '"\'':
                        length += 2 # Quotes
                elif token.type == TokenType.ARITHMETIC:
                    length += 4 # {{ }}
                
                end_pos = token.start_pos + length
            
                                          
            raw = self.source_text[start_pos:end_pos].strip()
            
                                           
            parts = []
            if '$' in raw or '{{' in raw:
                                                          
                import re
                remaining = raw
                while remaining:
                                       
                    var_match = re.match(r'\$(\w+)', remaining)
                    if var_match:
                        if remaining[:var_match.start()]:
                            parts.append(remaining[:var_match.start()])
                        parts.append(HyprVarRef(name=var_match.group(1)))
                        remaining = remaining[var_match.end():]
                        continue
                    
                                         
                    arith_match = re.match(r'\{\{(.+?)\}\}', remaining)
                    if arith_match:
                        if remaining[:arith_match.start()]:
                            parts.append(remaining[:arith_match.start()])
                        parts.append(HyprArithmetic(expr=arith_match.group(1)))
                        remaining = remaining[arith_match.end():]
                        continue
                    
                                                               
                    parts.append(remaining)
                    break
            
            return HyprValue(raw=raw, parts=parts if parts else [])
        
                                                                   
        parts = []
        raw_parts = []
        
        while self.peek().type not in (TokenType.NEWLINE, TokenType.EOF, TokenType.RBRACE, TokenType.COMMENT):
            token = self.peek()
            
            if token.type == TokenType.VARIABLE:
                self.advance()
                parts.append(HyprVarRef(name=token.value))
                raw_parts.append(f'${token.value}')
            elif token.type == TokenType.ARITHMETIC:
                self.advance()
                parts.append(HyprArithmetic(expr=token.value))
                raw_parts.append(f'{{{{{token.value}}}}}')
            elif token.type in (TokenType.IDENT, TokenType.STRING, TokenType.NUMBER):
                self.advance()
                parts.append(token.value)
                raw_parts.append(token.value)
            elif token.type == TokenType.COMMA:
                self.advance()
                parts.append(',')
                raw_parts.append(',')
            elif token.type in (TokenType.LBRACKET, TokenType.RBRACKET, TokenType.COLON):
                self.advance()
                parts.append(token.value)
                raw_parts.append(token.value)
            else:
                break
        
        raw = ' '.join(raw_parts) if raw_parts else ''
        return HyprValue(raw=raw.strip(), parts=parts if any(not isinstance(p, str) for p in parts) else [])
    
    def _handle_directive(self, directive: str):
        """Handle # hyprlang directives."""
        parts = directive.split()
        if not parts:
            return
        
        cmd = parts[0]
        
        if cmd == 'if':
            var_name = parts[1] if len(parts) > 1 else ''
            negate = var_name.startswith('!')
            if negate:
                var_name = var_name[1:]
            
                                         
            val = self.config.get_variable(var_name)
            is_true = val is not None and val != ''
            
            if negate:
                is_true = not is_true
            
            self.conditionals.append(is_true)
        
        elif cmd == 'endif':
            if self.conditionals:
                self.conditionals.pop()
        
        elif cmd == 'noerror':
                                                                
            pass
    
    def _skip_conditional_block(self):
        """Skip content when in a false conditional."""
        depth = 1
        while self.peek().type != TokenType.EOF and depth > 0:
            if self.peek().type == TokenType.DIRECTIVE:
                directive = self.peek().value
                if directive.startswith('if'):
                    depth += 1
                elif directive == 'endif':
                    depth -= 1
                    if depth == 0:
                        self.advance()                     
                        if self.conditionals:
                            self.conditionals.pop()
                        return
            self.advance()


                                                                               
                
                                                                               

class HyprLang:
    """Main interface for parsing hyprlang config files."""
    
    def __init__(self, file_path: str, limit=100000):
        self.file_path = file_path
        self.config: Optional[HyprConf] = None
        self.limit = limit
    
    def load(self) -> HyprConf:
        """Load and parse the config file."""
        abs_path = os.path.abspath(self.file_path)
        with open(abs_path, 'r') as f:
            text = f.read()
        if len(text) > self.limit:
            raise Exception(f"Config file '{self.file_path}' is too large (limit: {self.limit} chars)")
                                                                                      
        parsed_files: Set[str] = {abs_path}
        return self.parse(text, base_dir=os.path.dirname(abs_path), parsed_files=parsed_files)
    
    def parse(self, text: str, base_dir: str = "", parsed_files: Optional[Set[str]] = None) -> HyprConf:
        """Parse config from string."""
        lexer = Lexer(text)
        tokens = lexer.tokenize()
        parser = Parser(
            tokens, 
            source_text=text,
            base_dir=base_dir or os.getcwd(),
            parsed_files=parsed_files
        )
        self.config = parser.parse()
        return self.config
    
    def save(self, path: Optional[str] = None):
        """Save config back to file."""
        if not self.config:
            raise ValueError("No config loaded")
        
        output = self.config.to_string()
        if len(output) > self.limit:
            raise ValueError("Parser May have Bug raising error to prevent writes to disk wasting write cycles.")
        target = path or self.file_path
        with open(target, 'w') as f:
            f.write(output)
    
    @classmethod
    def from_string(cls, text: str) -> 'HyprLang':
        """Create HyprLang instance from string."""
        instance = cls('')
        instance.parse(text)
        return instance
    
    def __repr__(self):
        return f"HyprLang({self.file_path})"
