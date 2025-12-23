import re
import json

# --- Token Types ---
T_WHITESPACE = "WHITESPACE"
T_COMMENT = "COMMENT"
T_STRING = "STRING"
T_NUMBER = "NUMBER"
T_BOOLEAN = "BOOLEAN"
T_NULL = "NULL"
T_LBRACE = "LBRACE"  # {
T_RBRACE = "RBRACE"  # }
T_LBRACKET = "LBRACKET"  # [
T_RBRACKET = "RBRACKET"  # ]
T_COMMA = "COMMA"
T_COLON = "COLON"
T_EOF = "EOF"


class Token:
    def __init__(self, type, value, start, end):
        self.type = type
        self.value = value
        self.start = start
        self.end = end

    def __repr__(self):
        return f"Token({self.type}, {repr(self.value)})"


class Lexer:
    def __init__(self, text):
        self.text = text
        self.pos = 0
        self.length = len(text)
        # Pre-compile regexes for performance
        self.re_ws = re.compile(r'\s+')
        self.re_comment_single = re.compile(r'//.*')
        self.re_comment_block = re.compile(r'/\*[\s\S]*?\*/')
        self.re_string = re.compile(r'"(?:[^"\\]|\\.)*"')
        self.re_number = re.compile(r'-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?')
        self.re_true = re.compile(r'true')
        self.re_false = re.compile(r'false')
        self.re_null = re.compile(r'null')

    def match(self, regex):
        match = regex.match(self.text, self.pos)
        if match:
            return match.group(0)
        return None

    def next_token(self):
        if self.pos >= self.length:
            return Token(T_EOF, "", self.pos, self.pos)

        # Whitespace
        ws = self.match(self.re_ws)
        if ws:
            start = self.pos
            self.pos += len(ws)
            return Token(T_WHITESPACE, ws, start, self.pos)

        # Comments
        comment = self.match(self.re_comment_single) or self.match(self.re_comment_block)
        if comment:
            start = self.pos
            self.pos += len(comment)
            return Token(T_COMMENT, comment, start, self.pos)

        char = self.text[self.pos]
        start = self.pos

        # Structural Chars
        if char == '{': self.pos += 1; return Token(T_LBRACE, char, start, self.pos)
        if char == '}': self.pos += 1; return Token(T_RBRACE, char, start, self.pos)
        if char == '[': self.pos += 1; return Token(T_LBRACKET, char, start, self.pos)
        if char == ']': self.pos += 1; return Token(T_RBRACKET, char, start, self.pos)
        if char == ',': self.pos += 1; return Token(T_COMMA, char, start, self.pos)
        if char == ':': self.pos += 1; return Token(T_COLON, char, start, self.pos)

        # String
        if char == '"':
            s_match = self.match(self.re_string)
            if s_match:
                self.pos += len(s_match)
                return Token(T_STRING, s_match, start, self.pos)
            raise SyntaxError(f"Unterminated string at {self.pos}")

        # Boolean / Null
        if char == 't':
            m = self.match(self.re_true)
            if m: self.pos += 4; return Token(T_BOOLEAN, "true", start, self.pos)
        if char == 'f':
            m = self.match(self.re_false)
            if m: self.pos += 5; return Token(T_BOOLEAN, "false", start, self.pos)
        if char == 'n':
            m = self.match(self.re_null)
            if m: self.pos += 4; return Token(T_NULL, "null", start, self.pos)

        # Number
        n_match = self.match(self.re_number)
        if n_match:
            self.pos += len(n_match)
            return Token(T_NUMBER, n_match, start, self.pos)

        raise SyntaxError(f"Unexpected character at position {self.pos}: {char}")

    def tokenize(self):
        tokens = []
        while True:
            t = self.next_token()
            tokens.append(t)
            if t.type == T_EOF:
                break
        return tokens


# --- AST Nodes ---

class Node:
    def __init__(self):
        self.before = []  # List of trivia tokens (whitespace/comments)
        self.after = []


class ValueNode(Node):
    def __init__(self, value, raw_value=None):
        super().__init__()
        self.value = value
        self.raw_value = raw_value


class ObjectNode(Node):
    def __init__(self):
        super().__init__()
        # List of tuples: (KeyNode, ValueNode, CommaTokenOrNone)
        self.children = []


class ArrayNode(Node):
    def __init__(self):
        super().__init__()
        # List of tuples: (ValueNode, CommaTokenOrNone)
        self.children = []


class KeyNode(Node):
    def __init__(self, value, raw_value):
        super().__init__()
        self.value = value
        self.raw_value = raw_value


# --- Parser ---

class JSONCParser:
    def __init__(self, text):
        self.lexer = Lexer(text)
        self.tokens = self.lexer.tokenize()
        self.pos = 0

    def peek(self, offset=0):
        if self.pos + offset < len(self.tokens):
            return self.tokens[self.pos + offset]
        return self.tokens[-1]

    def consume(self):
        t = self.tokens[self.pos]
        self.pos += 1
        return t

    def collect_trivia(self):
        trivia = []
        while self.pos < len(self.tokens) and self.peek().type in (T_WHITESPACE, T_COMMENT):
            trivia.append(self.consume())
        return trivia

    def parse(self):
        trivia = self.collect_trivia()
        root = self.parse_value()
        root.before = trivia + root.before
        trailing = self.collect_trivia()
        root.after = trailing
        return root

    def parse_value(self):
        trivia = self.collect_trivia()
        token = self.peek()
        node = None

        if token.type == T_LBRACE:
            node = self.parse_object()
        elif token.type == T_LBRACKET:
            node = self.parse_array()
        elif token.type == T_STRING:
            self.consume()
            node = ValueNode(json.loads(token.value), token.value)
        elif token.type == T_NUMBER:
            self.consume()
            is_float = '.' in token.value or 'e' in token.value or 'E' in token.value
            node = ValueNode(float(token.value) if is_float else int(token.value), token.value)
        elif token.type == T_BOOLEAN:
            self.consume()
            node = ValueNode(token.value == 'true', token.value)
        elif token.type == T_NULL:
            self.consume()
            node = ValueNode(None, token.value)
        else:
            raise SyntaxError(f"Unexpected token {token}")

        node.before = trivia
        return node

    def parse_object(self):
        obj = ObjectNode()
        self.consume()  # eat {

        while True:
            trivia = self.collect_trivia()
            if self.peek().type == T_RBRACE:
                self.consume()
                # Attach trivia inside empty object to the object itself if needed
                # or handle logic to attach to previous child
                break

            if self.peek().type != T_STRING:
                raise SyntaxError(f"Expected string key, got {self.peek()}")

            key_token = self.consume()
            key_node = KeyNode(json.loads(key_token.value), key_token.value)
            key_node.before = trivia

            middle_trivia = self.collect_trivia()
            if self.peek().type != T_COLON:
                raise SyntaxError("Expected colon")
            self.consume()

            val_node = self.parse_value()
            val_node.before = middle_trivia + val_node.before

            comma = None
            comma_trivia = self.collect_trivia()
            if self.peek().type == T_COMMA:
                comma = self.consume()
                val_node.after = comma_trivia  # Attach trivia before comma to the value

            obj.children.append((key_node, val_node, comma))

            if not comma:
                # Expect closing brace
                end_trivia = self.collect_trivia()
                if self.peek().type == T_RBRACE:
                    if obj.children:
                        obj.children[-1][1].after += end_trivia
                    self.consume()
                    break
                else:
                    raise SyntaxError("Expected comma or object end")
        return obj

    def parse_array(self):
        arr = ArrayNode()
        self.consume()  # eat [

        while True:
            trivia = self.collect_trivia()
            if self.peek().type == T_RBRACKET:
                self.consume()
                break

            # Handle case where comments/whitespace exist before a closing bracket
            # Check if next significant token is RBRACKET
            is_closing = False
            lookahead = self.pos
            while lookahead < len(self.tokens):
                t = self.tokens[lookahead]
                if t.type not in (T_WHITESPACE, T_COMMENT):
                    if t.type == T_RBRACKET:
                        is_closing = True
                    break
                lookahead += 1

            if is_closing:
                # Attach gathered trivia to the last element if exists
                if arr.children:
                    arr.children[-1][0].after += trivia
                else:
                    # Empty array with comments inside
                    pass

                    # Consume the trivia
                self.collect_trivia()
                self.consume()  # eat ]
                break

            val_node = self.parse_value()
            val_node.before = trivia + val_node.before

            comma = None
            if self.peek().type == T_COMMA:
                # Handle trivia between value and comma
                val_node.after += self.collect_trivia()
                comma = self.consume()

            arr.children.append((val_node, comma))

            if not comma:
                # Logic to handle closing bracket will be hit at start of next loop
                # or we check here
                pass

        return arr


# --- Printer ---

class Printer:
    def __init__(self):
        self.parts = []

    def print_trivia(self, trivia_list):
        for t in trivia_list:
            self.parts.append(t.value)

    def print_node(self, node):
        self.print_trivia(node.before)

        if isinstance(node, (ValueNode, KeyNode)):
            if node.raw_value is not None:
                self.parts.append(node.raw_value)
            else:
                self.parts.append(json.dumps(node.value))
            self.print_trivia(node.after)

        elif isinstance(node, ObjectNode):
            self.parts.append("{")
            for key, val, comma in node.children:
                self.print_node(key)
                self.parts.append(":")
                self.print_node(val)
                if comma:
                    self.parts.append(",")
            self.parts.append("}")
            self.print_trivia(node.after)

        elif isinstance(node, ArrayNode):
            self.parts.append("[")
            for val, comma in node.children:
                self.print_node(val)
                if comma:
                    self.parts.append(",")
            self.parts.append("]")
            self.print_trivia(node.after)

    def to_string(self, root):
        self.parts = []
        self.print_node(root)
        return "".join(self.parts)


# --- Helpers ---

def parse(text):
    parser = JSONCParser(text)
    return parser.parse()


def to_string(root):
    printer = Printer()
    return printer.to_string(root)


def update_key(root, key_path, new_value):
    """
    Updates a key in the AST.
    key_path: list of keys/indices e.g. ["modules-left", 0]
    new_value: python object (dict, list, str, int...)
    """

    def create_ast_from_python(obj, indent_level=1):
        """Recursively converts python obj to AST nodes with basic formatting."""
        indent = "\n" + "    " * indent_level
        prev_indent = "\n" + "    " * (indent_level - 1)

        if isinstance(obj, dict):
            node = ObjectNode()
            items = list(obj.items())
            for i, (k, v) in enumerate(items):
                k_node = KeyNode(k, json.dumps(k))
                k_node.before = [Token(T_WHITESPACE, indent, 0, 0)]

                v_node = create_ast_from_python(v, indent_level + 1)
                v_node.before = [Token(T_WHITESPACE, " ", 0, 0)]

                comma = Token(T_COMMA, ",", 0, 0) if i < len(items) - 1 else None
                node.children.append((k_node, v_node, comma))

            # Formatting for closing brace
            if node.children:
                node.children[-1][1].after = [Token(T_WHITESPACE, prev_indent, 0, 0)]
            return node

        elif isinstance(obj, list):
            node = ArrayNode()
            for i, v in enumerate(obj):
                v_node = create_ast_from_python(v, indent_level + 1)
                v_node.before = [Token(T_WHITESPACE, indent, 0, 0)]
                comma = Token(T_COMMA, ",", 0, 0) if i < len(obj) - 1 else None
                node.children.append((v_node, comma))

            if node.children:
                node.children[-1][0].after = [Token(T_WHITESPACE, prev_indent, 0, 0)]
            return node
        else:
            return ValueNode(obj, json.dumps(obj))

    ptr = root

    for i, key in enumerate(key_path):
        is_last = (i == len(key_path) - 1)

        if isinstance(ptr, ObjectNode):
            found = False
            for idx, entry in enumerate(ptr.children):
                k_node, v_node, c = entry
                if k_node.value == key:
                    if is_last:
                        # UPDATE EXISTING
                        new_node = create_ast_from_python(new_value)
                        # Preserve formatting of old value
                        new_node.before = v_node.before
                        new_node.after = v_node.after
                        ptr.children[idx] = (k_node, new_node, c)
                        return True
                    else:
                        ptr = v_node
                        found = True
                        break

            if not found and is_last:
                # INSERT NEW KEY
                new_key_node = KeyNode(key, json.dumps(key))
                # Simple heuristic for formatting: copy indent from previous sibling or default
                indent = "\n    "
                if ptr.children:
                    # ensure previous last element gets a comma
                    prev_k, prev_v, prev_c = ptr.children[-1]
                    if not prev_c:
                        ptr.children[-1] = (prev_k, prev_v, Token(T_COMMA, ",", 0, 0))

                    # try to steal indent from previous sibling
                    if prev_k.before and prev_k.before[0].type == T_WHITESPACE:
                        indent = prev_k.before[0].value

                new_key_node.before = [Token(T_WHITESPACE, indent, 0, 0)]
                new_val_node = create_ast_from_python(new_value)
                new_val_node.before = [Token(T_WHITESPACE, " ", 0, 0)]

                # If the list was not empty, we might need to fix the closing brace indent
                # (This is a simplified formatter, complex cases might need more logic)

                ptr.children.append((new_key_node, new_val_node, None))
                return True
            elif not found:
                return False  # Path invalid

        elif isinstance(ptr, ArrayNode):
            if isinstance(key, int) and 0 <= key < len(ptr.children):
                v_node, c = ptr.children[key]
                if is_last:
                    new_node = create_ast_from_python(new_value)
                    new_node.before = v_node.before
                    new_node.after = v_node.after
                    ptr.children[key] = (new_node, c)
                    return True
                else:
                    ptr = v_node
            else:
                return False

    return False
