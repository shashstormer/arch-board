import json
import re


class TokenType:
    WHITESPACE = 'WHITESPACE'
    COMMENT = 'COMMENT'
    STRING = 'STRING'
    NUMBER = 'NUMBER'
    TRUE = 'TRUE'
    FALSE = 'FALSE'
    NULL = 'NULL'
    LBRACE = 'LBRACE'
    RBRACE = 'RBRACE'
    LBRACKET = 'LBRACKET'
    RBRACKET = 'RBRACKET'
    COLON = 'COLON'
    COMMA = 'COMMA'
    EOF = 'EOF'


class Token:
    def __init__(self, type, value, line, column, pos):
        self.type = type
        self.value = value
        self.line = line
        self.column = column
        self.pos = pos

    def __repr__(self):
        return f"Token({self.type}, {repr(self.value)}, ln={self.line}, col={self.column})"


class Lexer:
    def __init__(self, text):
        self.text = text
        self.pos = 0
        self.line = 1
        self.col = 1

        self.rules = [
            (TokenType.WHITESPACE, r'[ \t\r\n]+'),
            (TokenType.COMMENT, r'//.*|/\*[\s\S]*?\*/'),
            (TokenType.STRING, r'"(?:[^"\\]|\\.)*"'),
            (TokenType.NUMBER, r'-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?'),
            (TokenType.TRUE, r'true'),
            (TokenType.FALSE, r'false'),
            (TokenType.NULL, r'null'),
            (TokenType.LBRACE, r'\{'),
            (TokenType.RBRACE, r'\}'),
            (TokenType.LBRACKET, r'\['),
            (TokenType.RBRACKET, r'\]'),
            (TokenType.COLON, r':'),
            (TokenType.COMMA, r','),
        ]

        regex_parts = []
        for name, pattern in self.rules:
            regex_parts.append(f'(?P<{name}>{pattern})')
        self.regex = re.compile('|'.join(regex_parts))

    def tokenize(self):
        tokens = []
        while self.pos < len(self.text):
            match = self.regex.match(self.text, self.pos)
            if not match:
                char = self.text[self.pos]
                raise SyntaxError(f"Illegal character '{char}' at line {self.line}, col {self.col}")

            kind = match.lastgroup
            value = match.group(kind)

            tokens.append(Token(kind, value, self.line, self.col, self.pos))

            self.pos += len(value)

            newlines = value.count('\n')
            if newlines > 0:
                self.line += newlines
                self.col = len(value) - value.rfind('\n')
            else:
                self.col += len(value)

        tokens.append(Token(TokenType.EOF, "", self.line, self.col, self.pos))
        return tokens


class Node:
    def __init__(self):
        self.leading_trivia = []
        self.trailing_trivia = []


class ValueNode(Node):
    def __init__(self, value, raw_text):
        super().__init__()
        self.value = value
        self.raw_text = raw_text


class DictNode(Node):
    def __init__(self):
        super().__init__()
        self.children = []


class ListNode(Node):
    def __init__(self):
        super().__init__()
        self.children = []


class KeyNode(Node):
    def __init__(self, value, raw_text):
        super().__init__()
        self.value = value
        self.raw_text = raw_text


class Parser:
    def __init__(self, tokens):
        self.tokens = tokens
        self.pos = 0

    def peek(self, offset=0):
        if self.pos + offset >= len(self.tokens):
            return self.tokens[-1]
        return self.tokens[self.pos + offset]

    def consume(self):
        t = self.tokens[self.pos]
        self.pos += 1
        return t

    def collect_trivia(self):
        trivia = []
        while self.peek().type in (TokenType.WHITESPACE, TokenType.COMMENT):
            trivia.append(self.consume())
        return trivia

    def parse(self):
        leading = self.collect_trivia()
        if self.peek().type == TokenType.EOF:
            return None
        root = self.parse_element()
        root.leading_trivia = leading + root.leading_trivia
        root.trailing_trivia = self.collect_trivia()
        return root

    def parse_element(self):
        trivia = self.collect_trivia()
        token = self.peek()
        node = None

        if token.type == TokenType.LBRACE:
            node = self.parse_object()
        elif token.type == TokenType.LBRACKET:
            node = self.parse_array()
        elif token.type == TokenType.STRING:
            self.consume()
            node = ValueNode(json.loads(token.value, strict=False), token.value)
        elif token.type == TokenType.NUMBER:
            self.consume()

            try:
                val = int(token.value)
            except ValueError:
                val = float(token.value)
            node = ValueNode(val, token.value)
        elif token.type == TokenType.TRUE:
            self.consume();
            node = ValueNode(True, "true")
        elif token.type == TokenType.FALSE:
            self.consume();
            node = ValueNode(False, "false")
        elif token.type == TokenType.NULL:
            self.consume();
            node = ValueNode(None, "null")
        else:
            raise SyntaxError(f"Unexpected token {token.type} at line {token.line}")

        node.leading_trivia = trivia
        return node

    def parse_object(self):
        obj = DictNode()
        self.consume()

        while True:

            trivia = self.collect_trivia()
            if self.peek().type == TokenType.RBRACE:

                if obj.children:
                    pass
                self.consume()
                break

            if self.peek().type != TokenType.STRING:
                raise SyntaxError(f"Expected string key at line {self.peek().line}")

            key_token = self.consume()
            key_node = KeyNode(json.loads(key_token.value, strict=False), key_token.value)
            key_node.leading_trivia = trivia

            middle_trivia = self.collect_trivia()
            if self.peek().type != TokenType.COLON:
                raise SyntaxError(f"Expected ':' at line {self.peek().line}")
            self.consume()

            val_node = self.parse_element()

            val_node.leading_trivia = middle_trivia + val_node.leading_trivia

            comma_trivia = self.collect_trivia()
            comma = None
            if self.peek().type == TokenType.COMMA:
                comma = self.consume()
                val_node.trailing_trivia = comma_trivia
            else:
                val_node.trailing_trivia = comma_trivia

            obj.children.append((key_node, val_node, comma))

            if not comma:
                pass

        return obj

    def parse_array(self):
        arr = ListNode()
        self.consume()

        while True:
            trivia = self.collect_trivia()
            if self.peek().type == TokenType.RBRACKET:
                self.consume()
                break

            current_token = self.peek()

            val_node = self.parse_element_with_trivia(trivia)

            comma = None
            comma_trivia = self.collect_trivia()
            if self.peek().type == TokenType.COMMA:
                comma = self.consume()
                val_node.trailing_trivia = comma_trivia
            else:
                val_node.trailing_trivia = comma_trivia

            arr.children.append((val_node, comma))

        return arr

    def parse_element_with_trivia(self, pre_trivia):

        node = self.parse_element()
        node.leading_trivia = pre_trivia + node.leading_trivia
        return node


class Printer:
    def __init__(self):
        self.output = []

    def write(self, text):
        self.output.append(text)

    def print_trivia(self, trivia_list):
        for t in trivia_list:
            self.write(t.value)

    def print_node(self, node):
        if not node: return
        self.print_trivia(node.leading_trivia)

        if isinstance(node, DictNode):
            self.write("{")
            for key, val, comma in node.children:
                self.print_node(key)
                self.write(":")
                self.print_node(val)
                if comma:
                    self.write(",")
            self.write("}")

        elif isinstance(node, ListNode):
            self.write("[")
            for val, comma in node.children:
                self.print_node(val)
                if comma:
                    self.write(",")
            self.write("]")

        elif isinstance(node, (ValueNode, KeyNode)):
            self.write(node.raw_text)

        self.print_trivia(node.trailing_trivia)

    def to_string(self, root):
        self.output = []
        self.print_node(root)
        return "".join(self.output)


def parse(text):
    lexer = Lexer(text)
    tokens = lexer.tokenize()
    parser = Parser(tokens)
    return parser.parse()


def to_string(node):
    return Printer().to_string(node)


def detect_indent(node):
    """
    Scans the AST to find the most common indentation string (e.g. "  " or "\t").
    Default is 4 spaces.
    """
    counts = {}

    def walk(n):
        if not n: return
        for t in n.leading_trivia:
            if t.type == TokenType.WHITESPACE and '\n' in t.value:

                indent = t.value.split('\n')[-1]
                if indent:
                    counts[indent] = counts.get(indent, 0) + 1

        if isinstance(n, DictNode):
            for k, v, _ in n.children:
                walk(k);
                walk(v)
        elif isinstance(n, ListNode):
            for v, _ in n.children:
                walk(v)

    walk(node)
    if not counts:
        return "    "
    return max(counts, key=counts.get)


def python_to_ast(obj, indent_str="    ", level=0):
    """
    Converts a Python object (dict, list, str...) into an AST node 
    with proper formatting (newlines and indentation).
    """
    current_indent = "\n" + (indent_str * level)
    next_indent = "\n" + (indent_str * (level + 1))

    if isinstance(obj, dict):
        node = DictNode()
        items = list(obj.items())
        for i, (k, v) in enumerate(items):
            k_node = KeyNode(k, json.dumps(k))
            k_node.leading_trivia = [Token(TokenType.WHITESPACE, next_indent, 0, 0, 0)]

            v_node = python_to_ast(v, indent_str, level + 1)
            v_node.leading_trivia = [Token(TokenType.WHITESPACE, " ", 0, 0, 0)]

            comma = Token(TokenType.COMMA, ",", 0, 0, 0) if i < len(items) - 1 else None
            node.children.append((k_node, v_node, comma))

        if node.children:
            last_val = node.children[-1][1]
            last_val.trailing_trivia.append(Token(TokenType.WHITESPACE, current_indent, 0, 0, 0))

        return node

    elif isinstance(obj, list):
        node = ListNode()
        for i, v in enumerate(obj):
            v_node = python_to_ast(v, indent_str, level + 1)
            v_node.leading_trivia = [Token(TokenType.WHITESPACE, next_indent, 0, 0, 0)]
            comma = Token(TokenType.COMMA, ",", 0, 0, 0) if i < len(obj) - 1 else None
            node.children.append((v_node, comma))

        if node.children:
            last_val = node.children[-1][0]
            last_val.trailing_trivia.append(Token(TokenType.WHITESPACE, current_indent, 0, 0, 0))
        return node

    else:

        val_str = json.dumps(obj)
        return ValueNode(obj, val_str)


def set_value(root, path, value):
    """
    Upserts a value at a specific path.
    path: list of keys/indices e.g. ["modules-left", 0]
    value: python object
    """
    indent_str = detect_indent(root)

    current = root
    for i, key in enumerate(path):
        is_last = (i == len(path) - 1)

        if isinstance(current, DictNode):
            found_idx = -1
            for idx, (k_node, v_node, _) in enumerate(current.children):
                if k_node.value == key:
                    found_idx = idx
                    break

            if found_idx != -1:

                k_node, v_node, comma = current.children[found_idx]
                if is_last:
                    new_node = python_to_ast(value, indent_str, level=i + 1)

                    new_node.leading_trivia = v_node.leading_trivia
                    new_node.trailing_trivia = v_node.trailing_trivia
                    current.children[found_idx] = (k_node, new_node, comma)
                    return
                else:
                    current = v_node
            else:

                if is_last:
                    new_node = python_to_ast(value, indent_str, level=i + 1)
                else:

                    next_key = path[i + 1]
                    new_node = DictNode() if isinstance(next_key, str) else ListNode()

                k_node = KeyNode(key, json.dumps(key))

                if not current.children:

                    k_node.leading_trivia = [Token(TokenType.WHITESPACE, "\n" + indent_str * (i + 1), 0, 0, 0)]


                else:

                    prev_k, prev_v, prev_c = current.children[-1]
                    if not prev_c:
                        current.children[-1] = (prev_k, prev_v, Token(TokenType.COMMA, ",", 0, 0, 0))

                    k_node.leading_trivia = [Token(TokenType.WHITESPACE, "\n" + indent_str * (i + 1), 0, 0, 0)]

                new_node.leading_trivia = [Token(TokenType.WHITESPACE, " ", 0, 0, 0)]
                current.children.append((k_node, new_node, None))

                if is_last:
                    return
                current = new_node

        elif isinstance(current, ListNode):
            if isinstance(key, int):
                if 0 <= key < len(current.children):
                    v_node, comma = current.children[key]
                    if is_last:
                        new_node = python_to_ast(value, indent_str, level=i + 1)
                        new_node.leading_trivia = v_node.leading_trivia
                        new_node.trailing_trivia = v_node.trailing_trivia
                        current.children[key] = (new_node, comma)
                        return
                    else:
                        current = v_node
                else:
                    raise IndexError(f"List index {key} out of range")
            else:
                raise TypeError(f"Cannot access list with non-integer key {key}")

def to_python(node):
    """
    Converts an AST node back to a Python object (dict, list, str, int, etc.).
    """
    if isinstance(node, DictNode):
        obj = {}
        for k_node, v_node, _ in node.children:
            obj[k_node.value] = to_python(v_node)
        return obj
    elif isinstance(node, ListNode):
        arr = []
        for v_node, _ in node.children:
            arr.append(to_python(v_node))
        return arr
    elif isinstance(node, ValueNode):
        return node.value
    elif isinstance(node, KeyNode):
        return node.value
    else:
        return None
