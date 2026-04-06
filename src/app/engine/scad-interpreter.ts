/**
 * OpenSCAD Interpreter – Tokenizer, Parser & Evaluator.
 * Evaluates SCAD source into CSG geometry.
 * Supports: variables, expressions, primitives, transforms, CSG ops,
 * modules, functions, for/if, extrusions, list comprehensions, let expressions.
 */

import {
  CSG, Vec3, Vertex, Polygon,
  mat4Identity, mat4Translate, mat4RotateX, mat4RotateY, mat4RotateZ,
  mat4Scale, mat4Multiply
} from "./csg";
import { getImage, sampleBrightness } from "./image-registry";

// ═══════════════════════════════════════════════════════════════════════════════
// TOKENIZER
// ═══════════════════════════════════════════════════════════════════════════════

type TokenType =
  | "NUMBER" | "BOOL" | "STRING" | "IDENT" | "SPECIAL"
  | "LPAREN" | "RPAREN" | "LBRACKET" | "RBRACKET" | "LBRACE" | "RBRACE"
  | "SEMICOLON" | "COMMA" | "DOT" | "COLON"
  | "ASSIGN" | "PLUS" | "MINUS" | "STAR" | "SLASH" | "PERCENT" | "CARET"
  | "LT" | "GT" | "LTE" | "GTE" | "EQ" | "NEQ" | "AND" | "OR" | "NOT"
  | "QUESTION" | "HASH"
  | "KW_MODULE" | "KW_FUNCTION" | "KW_IF" | "KW_ELSE" | "KW_FOR" | "KW_LET"
  | "KW_TRUE" | "KW_FALSE" | "KW_UNDEF" | "KW_EACH"
  | "EOF";

interface Token { type: TokenType; value: string; line: number; }

const KEYWORDS: Record<string, TokenType> = {
  module: "KW_MODULE", function: "KW_FUNCTION",
  if: "KW_IF", else: "KW_ELSE", for: "KW_FOR", let: "KW_LET",
  true: "KW_TRUE", false: "KW_FALSE", undef: "KW_UNDEF",
  each: "KW_EACH",
};

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0, line = 1;

  while (i < src.length) {
    // Whitespace
    if (/\s/.test(src[i])) {
      if (src[i] === "\n") line++;
      i++; continue;
    }
    // Line comment
    if (src[i] === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    // Block comment
    if (src[i] === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length - 1 && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") line++;
        i++;
      }
      i += 2; continue;
    }
    // Number
    if (/[\d.]/.test(src[i]) && !(src[i] === "." && !/\d/.test(src[i + 1] || ""))) {
      let num = "";
      while (i < src.length && /[\d.]/.test(src[i])) num += src[i++];
      if (i < src.length && /[eE]/.test(src[i])) {
        num += src[i++];
        if (i < src.length && /[+-]/.test(src[i])) num += src[i++];
        while (i < src.length && /\d/.test(src[i])) num += src[i++];
      }
      tokens.push({ type: "NUMBER", value: num, line }); continue;
    }
    // String
    if (src[i] === '"') {
      let s = ""; i++;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\\") { i++; s += src[i++]; } else s += src[i++];
      }
      i++; tokens.push({ type: "STRING", value: s, line }); continue;
    }
    // Ident / keyword / special
    if (/[a-zA-Z_$]/.test(src[i])) {
      let id = "";
      while (i < src.length && /[a-zA-Z0-9_$]/.test(src[i])) id += src[i++];
      const kw = KEYWORDS[id];
      if (kw) tokens.push({ type: kw, value: id, line });
      else if (id.startsWith("$")) tokens.push({ type: "SPECIAL", value: id, line });
      else tokens.push({ type: "IDENT", value: id, line });
      continue;
    }
    // Multi-char operators
    const c2 = src.slice(i, i + 2);
    if (c2 === "<=") { tokens.push({ type: "LTE", value: c2, line }); i += 2; continue; }
    if (c2 === ">=") { tokens.push({ type: "GTE", value: c2, line }); i += 2; continue; }
    if (c2 === "==") { tokens.push({ type: "EQ", value: c2, line }); i += 2; continue; }
    if (c2 === "!=") { tokens.push({ type: "NEQ", value: c2, line }); i += 2; continue; }
    if (c2 === "&&") { tokens.push({ type: "AND", value: c2, line }); i += 2; continue; }
    if (c2 === "||") { tokens.push({ type: "OR", value: c2, line }); i += 2; continue; }
    // Single chars
    const single: Record<string, TokenType> = {
      "(": "LPAREN", ")": "RPAREN", "[": "LBRACKET", "]": "RBRACKET",
      "{": "LBRACE", "}": "RBRACE", ";": "SEMICOLON", ",": "COMMA",
      ".": "DOT", ":": "COLON", "=": "ASSIGN", "+": "PLUS", "-": "MINUS",
      "*": "STAR", "/": "SLASH", "%": "PERCENT", "^": "CARET",
      "<": "LT", ">": "GT", "?": "QUESTION", "!": "NOT", "#": "HASH",
    };
    if (single[src[i]]) {
      tokens.push({ type: single[src[i]], value: src[i], line }); i++; continue;
    }
    i++; // skip unknown
  }
  tokens.push({ type: "EOF", value: "", line });
  return tokens;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AST NODES
// ═══════════════════════════════════════════════════════════════════════════════

type ASTNode =
  | { type: "program"; body: ASTNode[] }
  | { type: "assign"; name: string; expr: ASTNode }
  | { type: "number"; value: number }
  | { type: "bool"; value: boolean }
  | { type: "string"; value: string }
  | { type: "undef" }
  | { type: "ident"; name: string }
  | { type: "array"; elements: ASTNode[] }
  | { type: "index"; object: ASTNode; index: ASTNode }
  | { type: "binary"; op: string; left: ASTNode; right: ASTNode }
  | { type: "unary"; op: string; operand: ASTNode }
  | { type: "ternary"; cond: ASTNode; then: ASTNode; else: ASTNode }
  | { type: "call"; name: string; args: ASTNode[]; namedArgs: Record<string, ASTNode> }
  | { type: "module_call"; name: string; args: ASTNode[]; namedArgs: Record<string, ASTNode>; children: ASTNode[] }
  | { type: "module_def"; name: string; params: { name: string; default?: ASTNode }[]; body: ASTNode[] }
  | { type: "function_def"; name: string; params: { name: string; default?: ASTNode }[]; body: ASTNode }
  | { type: "for_loop"; variable: string; range: ASTNode; body: ASTNode[]; variables?: { name: string; range: ASTNode }[] }
  | { type: "if_stmt"; cond: ASTNode; then: ASTNode[]; else?: ASTNode[] }
  | { type: "block"; body: ASTNode[] }
  | { type: "list_comp"; variable: string; range: ASTNode; letBindings: { name: string; expr: ASTNode }[]; body: ASTNode; condition?: ASTNode }
  | { type: "let_expr"; bindings: { name: string; expr: ASTNode }[]; body: ASTNode };

// ═══════════════════════════════════════════════════════════════════════════════
// PARSER
// ═══════════════════════════════════════════════════════════════════════════════

class Parser {
  private pos = 0;
  constructor(private tokens: Token[]) {}

  private peek(): Token { return this.tokens[this.pos]; }
  private advance(): Token { return this.tokens[this.pos++]; }
  private expect(type: TokenType): Token {
    const t = this.advance();
    if (t.type !== type) throw new Error(`Expected ${type} but got ${t.type} (${t.value}) at line ${t.line}`);
    return t;
  }
  private match(...types: TokenType[]): boolean {
    return types.includes(this.peek().type);
  }

  parse(): ASTNode {
    const body: ASTNode[] = [];
    while (!this.match("EOF")) {
      const stmt = this.parseStatement();
      if (stmt) body.push(stmt);
    }
    return { type: "program", body };
  }

  private parseStatement(): ASTNode | null {
    const t = this.peek();

    if (t.type === "SEMICOLON") { this.advance(); return null; }

    // Skip use/include statements (file imports not supported in Vorea)
    if (t.type === "IDENT" && (t.value === "use" || t.value === "include")) {
      this.advance();
      while (this.pos < this.tokens.length && !this.match("SEMICOLON", "EOF")) {
        if (this.peek().type === "LT") {
          while (this.pos < this.tokens.length && !this.match("GT", "SEMICOLON", "EOF")) this.advance();
          if (this.match("GT")) this.advance();
        } else {
          this.advance();
        }
      }
      if (this.match("SEMICOLON")) this.advance();
      return null;
    }

    if (t.type === "KW_MODULE") return this.parseModuleDef();
    if (t.type === "KW_FUNCTION") return this.parseFunctionDef();
    if (t.type === "KW_IF") return this.parseIf();
    if (t.type === "KW_FOR") return this.parseFor();

    // Assignment: name = expr;
    if ((t.type === "IDENT" || t.type === "SPECIAL") && this.tokens[this.pos + 1]?.type === "ASSIGN") {
      const name = this.advance().value;
      this.advance(); // =
      const expr = this.parseExpression();
      this.expect("SEMICOLON");
      return { type: "assign", name, expr };
    }

    // Module call or expression statement
    if (t.type === "IDENT" || t.type === "SPECIAL" || t.type === "HASH") {
      return this.parseModuleCallOrExpr();
    }

    // Block
    if (t.type === "LBRACE") return this.parseBlock();

    // Skip unrecognized
    this.advance();
    return null;
  }

  private parseModuleDef(): ASTNode {
    this.advance(); // module
    const name = this.advance().value;
    this.expect("LPAREN");
    const params = this.parseParamList();
    this.expect("RPAREN");
    const body = this.parseBlockBody();
    return { type: "module_def", name, params, body };
  }

  private parseFunctionDef(): ASTNode {
    this.advance(); // function
    const name = this.advance().value;
    this.expect("LPAREN");
    const params = this.parseParamList();
    this.expect("RPAREN");
    this.expect("ASSIGN");
    const body = this.parseExpression();
    this.expect("SEMICOLON");
    return { type: "function_def", name, params, body };
  }

  private parseParamList(): { name: string; default?: ASTNode }[] {
    const params: { name: string; default?: ASTNode }[] = [];
    while (!this.match("RPAREN", "EOF")) {
      const name = this.advance().value;
      let def: ASTNode | undefined;
      if (this.match("ASSIGN")) {
        this.advance();
        def = this.parseExpression();
      }
      params.push({ name, default: def });
      if (this.match("COMMA")) this.advance();
    }
    return params;
  }

  private parseIf(): ASTNode {
    this.advance(); // if
    this.expect("LPAREN");
    const cond = this.parseExpression();
    this.expect("RPAREN");
    const then = this.parseBlockBody();
    let elseBody: ASTNode[] | undefined;
    if (this.match("KW_ELSE")) {
      this.advance();
      elseBody = this.parseBlockBody();
    }
    return { type: "if_stmt", cond, then, else: elseBody };
  }

  private parseFor(): ASTNode {
    this.advance(); // for
    this.expect("LPAREN");
    // Parse first variable
    const variable = this.advance().value;
    this.expect("ASSIGN");
    const range = this.parseExpression();

    // Check for multi-variable: for (x = range, y = range, ...)
    const variables: { name: string; range: ASTNode }[] = [{ name: variable, range }];
    while (this.match("COMMA")) {
      this.advance(); // ,
      if ((this.peek().type === "IDENT" || this.peek().type === "SPECIAL") &&
          this.tokens[this.pos + 1]?.type === "ASSIGN") {
        const vName = this.advance().value;
        this.expect("ASSIGN");
        const vRange = this.parseExpression();
        variables.push({ name: vName, range: vRange });
      } else {
        break;
      }
    }

    this.expect("RPAREN");
    const body = this.parseBlockBody();

    if (variables.length > 1) {
      return { type: "for_loop", variable, range, body, variables };
    }
    return { type: "for_loop", variable, range, body };
  }

  private parseBlockBody(): ASTNode[] {
    if (this.match("LBRACE")) {
      this.advance();
      const body: ASTNode[] = [];
      while (!this.match("RBRACE", "EOF")) {
        const s = this.parseStatement();
        if (s) body.push(s);
      }
      this.expect("RBRACE");
      return body;
    }
    const s = this.parseStatement();
    return s ? [s] : [];
  }

  private parseBlock(): ASTNode {
    const body = this.parseBlockBody();
    return { type: "block", body };
  }

  private parseModuleCallOrExpr(): ASTNode {
    // Skip optional '#' prefix (highlight modifier)
    if (this.match("HASH")) { this.advance(); }

    const name = this.advance().value;

    if (!this.match("LPAREN")) {
      // Might be a simple expression statement ending with ;
      if (this.match("SEMICOLON")) { this.advance(); }
      return { type: "module_call", name, args: [], namedArgs: {}, children: [] };
    }

    this.advance(); // (
    const { positional, named } = this.parseCallArgs();
    this.expect("RPAREN");

    // Check for children (block or chained call)
    let children: ASTNode[] = [];
    if (this.match("LBRACE")) {
      children = this.parseBlockBody();
    } else if (this.match("SEMICOLON")) {
      this.advance();
    } else if (!this.match("EOF", "RBRACE")) {
      // Chained module call: translate([...]) cube(...)
      const child = this.parseModuleCallOrExpr();
      if (child) children = [child];
    }

    return { type: "module_call", name, args: positional, namedArgs: named, children };
  }

  private parseCallArgs(): { positional: ASTNode[]; named: Record<string, ASTNode> } {
    const positional: ASTNode[] = [];
    const named: Record<string, ASTNode> = {};

    while (!this.match("RPAREN", "EOF")) {
      // Check for named arg: ident = expr
      if ((this.peek().type === "IDENT" || this.peek().type === "SPECIAL") &&
          this.tokens[this.pos + 1]?.type === "ASSIGN") {
        const key = this.advance().value;
        this.advance(); // =
        named[key] = this.parseExpression();
      } else {
        positional.push(this.parseExpression());
      }
      if (this.match("COMMA")) this.advance();
    }
    return { positional, named };
  }

  // ─── List comprehension: [for (var = range) let(...) each expr] ────
  private parseListComprehension(): ASTNode {
    this.advance(); // for
    this.expect("LPAREN");
    const variable = this.advance().value;
    this.expect("ASSIGN");
    const range = this.parseExpression();

    // Check for multi-variable: [for (x = range, y = range) ...]
    const extraVars: { name: string; range: ASTNode }[] = [];
    while (this.match("COMMA")) {
      this.advance();
      if ((this.peek().type === "IDENT" || this.peek().type === "SPECIAL") &&
          this.tokens[this.pos + 1]?.type === "ASSIGN") {
        const vName = this.advance().value;
        this.expect("ASSIGN");
        const vRange = this.parseExpression();
        extraVars.push({ name: vName, range: vRange });
      } else {
        break;
      }
    }

    this.expect("RPAREN");

    // Collect optional let bindings and if conditions
    const letBindings: { name: string; expr: ASTNode }[] = [];
    let condition: ASTNode | undefined;

    // Also store extra variables in letBindings for the evaluator (hack but works)
    for (const ev of extraVars) {
      letBindings.push({ name: `__for_${ev.name}`, expr: ev.range });
      letBindings.push({ name: ev.name, expr: { type: "undef" } }); // placeholder
    }

    while (this.match("KW_LET") || this.match("KW_IF")) {
      if (this.match("KW_LET")) {
        this.advance(); // let
        this.expect("LPAREN");
        while (!this.match("RPAREN", "EOF")) {
          const name = this.advance().value;
          this.expect("ASSIGN");
          const expr = this.parseExpression();
          letBindings.push({ name, expr });
          if (this.match("COMMA")) this.advance();
        }
        this.expect("RPAREN");
      } else if (this.match("KW_IF")) {
        this.advance(); // if
        this.expect("LPAREN");
        condition = this.parseExpression();
        this.expect("RPAREN");
      }
    }

    // Check for `each` keyword before body expression
    let hasEach = false;
    if (this.match("KW_EACH")) {
      this.advance();
      hasEach = true;
    }

    const body = this.parseExpression();
    this.expect("RBRACKET");

    // Store `each` flag in the node via a special let binding
    if (hasEach) {
      letBindings.push({ name: "__each", expr: { type: "bool", value: true } });
    }

    return { type: "list_comp", variable, range, letBindings, body, condition };
  }

  // ─── let() expression: let(a = expr, ...) expr ────────────────────
  private parseLetExpr(): ASTNode {
    this.advance(); // let
    this.expect("LPAREN");
    const bindings: { name: string; expr: ASTNode }[] = [];
    while (!this.match("RPAREN", "EOF")) {
      const name = this.advance().value;
      this.expect("ASSIGN");
      const expr = this.parseExpression();
      bindings.push({ name, expr });
      if (this.match("COMMA")) this.advance();
    }
    this.expect("RPAREN");
    const body = this.parseExpression();
    return { type: "let_expr", bindings, body };
  }

  // ─── Expression parsing (precedence climbing) ─────────────────────────

  private parseExpression(): ASTNode {
    return this.parseTernary();
  }

  private parseTernary(): ASTNode {
    let node = this.parseOr();
    if (this.match("QUESTION")) {
      this.advance();
      const then = this.parseExpression();
      this.expect("COLON");
      const elseExpr = this.parseExpression();
      node = { type: "ternary", cond: node, then, else: elseExpr };
    }
    return node;
  }

  private parseOr(): ASTNode {
    let left = this.parseAnd();
    while (this.match("OR")) { this.advance(); left = { type: "binary", op: "||", left, right: this.parseAnd() }; }
    return left;
  }

  private parseAnd(): ASTNode {
    let left = this.parseEquality();
    while (this.match("AND")) { this.advance(); left = { type: "binary", op: "&&", left, right: this.parseEquality() }; }
    return left;
  }

  private parseEquality(): ASTNode {
    let left = this.parseComparison();
    while (this.match("EQ", "NEQ")) {
      const op = this.advance().value;
      left = { type: "binary", op, left, right: this.parseComparison() };
    }
    return left;
  }

  private parseComparison(): ASTNode {
    let left = this.parseAddition();
    while (this.match("LT", "GT", "LTE", "GTE")) {
      const op = this.advance().value;
      left = { type: "binary", op, left, right: this.parseAddition() };
    }
    return left;
  }

  private parseAddition(): ASTNode {
    let left = this.parseMultiplication();
    while (this.match("PLUS", "MINUS")) {
      const op = this.advance().value;
      left = { type: "binary", op, left, right: this.parseMultiplication() };
    }
    return left;
  }

  private parseMultiplication(): ASTNode {
    let left = this.parsePower();
    while (this.match("STAR", "SLASH", "PERCENT")) {
      const op = this.advance().value;
      left = { type: "binary", op, left, right: this.parsePower() };
    }
    return left;
  }

  private parsePower(): ASTNode {
    let left = this.parseUnary();
    if (this.match("CARET")) {
      this.advance();
      const right = this.parseUnary();
      left = { type: "binary", op: "^", left, right };
    }
    return left;
  }

  private parseUnary(): ASTNode {
    if (this.match("MINUS")) {
      this.advance();
      return { type: "unary", op: "-", operand: this.parseUnary() };
    }
    if (this.match("NOT")) {
      this.advance();
      return { type: "unary", op: "!", operand: this.parseUnary() };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): ASTNode {
    let node = this.parsePrimary();
    while (this.match("LBRACKET")) {
      this.advance();
      const index = this.parseExpression();
      this.expect("RBRACKET");
      node = { type: "index", object: node, index };
    }
    // Also handle .x .y .z member access
    while (this.match("DOT")) {
      this.advance();
      const member = this.advance().value;
      const idxMap: Record<string, number> = { x: 0, y: 1, z: 2 };
      if (member in idxMap) {
        node = { type: "index", object: node, index: { type: "number", value: idxMap[member] } };
      }
    }
    return node;
  }

  private parsePrimary(): ASTNode {
    const t = this.peek();

    if (t.type === "NUMBER") { this.advance(); return { type: "number", value: Number(t.value) }; }
    if (t.type === "KW_TRUE") { this.advance(); return { type: "bool", value: true }; }
    if (t.type === "KW_FALSE") { this.advance(); return { type: "bool", value: false }; }
    if (t.type === "KW_UNDEF") { this.advance(); return { type: "undef" }; }
    if (t.type === "STRING") { this.advance(); return { type: "string", value: t.value }; }

    if (t.type === "LBRACKET") {
      this.advance();
      // List comprehension: [for (var = range) ...]
      if (this.match("KW_FOR")) {
        return this.parseListComprehension();
      }
      const elements: ASTNode[] = [];
      while (!this.match("RBRACKET", "EOF")) {
        elements.push(this.parseExpression());
        if (this.match("COMMA")) this.advance();
        // Range: [start : end] or [start : step : end]
        if (this.match("COLON")) {
          this.advance();
          const second = this.parseExpression();
          if (this.match("COLON")) {
            this.advance();
            const third = this.parseExpression();
            this.expect("RBRACKET");
            return { type: "call", name: "__range", args: [elements[0], second, third], namedArgs: {} };
          }
          this.expect("RBRACKET");
          return { type: "call", name: "__range", args: [elements[0], { type: "number", value: 1 }, second], namedArgs: {} };
        }
      }
      this.expect("RBRACKET");
      return { type: "array", elements };
    }

    if (t.type === "LPAREN") {
      this.advance();
      const expr = this.parseExpression();
      this.expect("RPAREN");
      return expr;
    }

    // let() expression: let(a = expr, ...) expr
    if (t.type === "KW_LET") {
      return this.parseLetExpr();
    }

    if (t.type === "IDENT" || t.type === "SPECIAL") {
      const name = this.advance().value;
      if (this.match("LPAREN")) {
        this.advance();
        const { positional, named } = this.parseCallArgs();
        this.expect("RPAREN");
        return { type: "call", name, args: positional, namedArgs: named };
      }
      return { type: "ident", name };
    }

    // skip
    this.advance();
    return { type: "undef" };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EVALUATOR
// ═══════════════════════════════════════════════════════════════════════════════

type ScadValue = number | boolean | string | ScadValue[] | undefined;

interface ScadModule {
  params: { name: string; default?: ASTNode }[];
  body: ASTNode[];
}

interface ScadFunction {
  params: { name: string; default?: ASTNode }[];
  body: ASTNode;
}

class Environment {
  vars: Map<string, ScadValue> = new Map();
  modules: Map<string, ScadModule> = new Map();
  functions: Map<string, ScadFunction> = new Map();
  parent: Environment | null;

  constructor(parent?: Environment) {
    this.parent = parent ?? null;
  }

  get(name: string): ScadValue {
    if (this.vars.has(name)) return this.vars.get(name)!;
    if (this.parent) return this.parent.get(name);
    return undefined;
  }

  set(name: string, value: ScadValue) { this.vars.set(name, value); }

  getModule(name: string): ScadModule | undefined {
    if (this.modules.has(name)) return this.modules.get(name)!;
    if (this.parent) return this.parent.getModule(name);
    return undefined;
  }

  getFunction(name: string): ScadFunction | undefined {
    if (this.functions.has(name)) return this.functions.get(name)!;
    if (this.parent) return this.parent.getFunction(name);
    return undefined;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIBRARY STUBS — Provide fallback BOSL2/common library modules & functions
// so that models using `include <BOSL2/std.scad>` etc. can still render basic
// geometry instead of silently producing nothing.
// ═══════════════════════════════════════════════════════════════════════════════

function registerLibraryStubs(env: Environment) {
  // ─── BOSL2 Utility Functions ───────────────────────────────────
  // These are pure-value functions that many BOSL2 models use inline.
  const stubFunctions: Record<string, ScadFunction> = {
    // first_defined([a, b, c]) → first non-undef value
    first_defined: {
      params: [{ name: "vals" }],
      body: { type: "ident", name: "vals" } as ASTNode, // placeholder — handled in evalFunctionCall
    },
    // is_def(x) → true if x !== undef
    is_def: {
      params: [{ name: "x" }],
      body: { type: "ident", name: "x" } as ASTNode,
    },
    // default(x, dflt) → x if defined, else dflt
    default: {
      params: [{ name: "x" }, { name: "dflt" }],
      body: { type: "ident", name: "x" } as ASTNode,
    },
    // force_list(x) → wrap scalar in list
    force_list: {
      params: [{ name: "x" }],
      body: { type: "ident", name: "x" } as ASTNode,
    },
    // scalar_vec3(x) → [x,x,x]
    scalar_vec3: {
      params: [{ name: "x" }, { name: "dflt" }],
      body: { type: "ident", name: "x" } as ASTNode,
    },
    // v_abs(v) → [abs(x), abs(y), abs(z)]
    v_abs: {
      params: [{ name: "v" }],
      body: { type: "ident", name: "v" } as ASTNode,
    },
  };

  for (const [name, fn] of Object.entries(stubFunctions)) {
    env.functions.set(name, fn);
  }

  // ─── BOSL2 Module Stubs ─────────────────────────────────────────
  // Provide fallback geometry for common BOSL2 modules.
  // These map to OpenSCAD native primitives with equivalent parameters.
  // Format: module name → body statements that use standard primitives.

  // cuboid(size, center, ...) → cube(size, center)
  env.modules.set("cuboid", {
    params: [{ name: "size" }, { name: "center" }, { name: "anchor" }, { name: "spin" }, { name: "orient" }],
    body: parseQuick("cube(size=is_list(size)?size:[size,size,size], center=true);"),
  });

  // cyl(h, r, r1, r2, d, d1, d2, ...) → cylinder(h, r, r1, r2, ...)
  env.modules.set("cyl", {
    params: [{ name: "h" }, { name: "r" }, { name: "r1" }, { name: "r2" }, { name: "d" }, { name: "d1" }, { name: "d2" }, { name: "center" }, { name: "anchor" }],
    body: parseQuick("cylinder(h=h, r=r, r1=r1, r2=r2, d=d, d1=d1, d2=d2, center=true);"),
  });

  // rect(size, center, ...) → square(size, center)
  env.modules.set("rect", {
    params: [{ name: "size" }, { name: "center" }, { name: "anchor" }],
    body: parseQuick("square(size=size, center=true);"),
  });

  // oval(r, d, ...) → circle(r, d)
  env.modules.set("oval", {
    params: [{ name: "r" }, { name: "d" }, { name: "anchor" }],
    body: parseQuick("circle(r=r, d=d);"),
  });

  // prismoid(size1, size2, h, ...) → cube approximation
  env.modules.set("prismoid", {
    params: [{ name: "size1" }, { name: "size2" }, { name: "h" }, { name: "shift" }, { name: "anchor" }],
    body: parseQuick("cube(size=[size1[0], size1[1], h], center=true);"),
  });

  // tube(h, or, ir, ...) → difference of two cylinders
  env.modules.set("tube", {
    params: [{ name: "h" }, { name: "or" }, { name: "ir" }, { name: "center" }, { name: "anchor" }],
    body: parseQuick("difference() { cylinder(h=h, r=or, center=true); cylinder(h=h+1, r=ir, center=true); }"),
  });

  // left/right/fwd/back/up/down — BOSL2 positional modules → translate
  for (const [dir, vec] of [["left", "[-x,0,0]"], ["right", "[x,0,0]"], ["fwd", "[0,-x,0]"], ["back", "[0,x,0]"], ["up", "[0,0,x]"], ["down", "[0,0,-x]"]] as const) {
    env.modules.set(dir, {
      params: [{ name: "x" }],
      body: parseQuick(`translate(${vec}) children();`),
    });
  }

  // xrot/yrot/zrot — BOSL2 rotation modules → rotate
  env.modules.set("xrot", { params: [{ name: "a" }], body: parseQuick("rotate([a,0,0]) children();") });
  env.modules.set("yrot", { params: [{ name: "a" }], body: parseQuick("rotate([0,a,0]) children();") });
  env.modules.set("zrot", { params: [{ name: "a" }], body: parseQuick("rotate([0,0,a]) children();") });

  // xflip/yflip/zflip → mirror
  env.modules.set("xflip", { params: [], body: parseQuick("mirror([1,0,0]) children();") });
  env.modules.set("yflip", { params: [], body: parseQuick("mirror([0,1,0]) children();") });
  env.modules.set("zflip", { params: [], body: parseQuick("mirror([0,0,1]) children();") });

  // tag/recolor/attachable/position — pass-through modules (cosmetic only)
  for (const name of ["tag", "recolor", "attachable", "position", "attach", "edge_mask", "corner_mask", "show_anchors"]) {
    env.modules.set(name, {
      params: [{ name: "_a" }, { name: "_b" }, { name: "_c" }],
      body: parseQuick("children();"),
    });
  }

  // rounding_edge_mask/rounding_corner_mask → small sphere approximation
  env.modules.set("rounding_edge_mask", {
    params: [{ name: "r" }, { name: "l" }],
    body: parseQuick("cylinder(h=l, r=r, center=true);"),
  });
}

/**
 * Quick-parse a snippet of SCAD code into AST body statements.
 * Used for library stub module bodies.
 */
function parseQuick(src: string): ASTNode[] {
  try {
    const tokens = tokenize(src);
    const parser = new Parser(tokens);
    const ast = parser.parse();
    return ast.type === "program" ? ast.body.filter(s => s !== null) : [];
  } catch {
    return [];
  }
}

export interface CompileResult {
  geometry: CSG;
  error?: string;
  time: number;
}

export function compileScad(
  source: string,
  overrides?: Record<string, number | boolean | string | number[]>
): CompileResult {
  const start = performance.now();
  try {
    const tokens = tokenize(source);
    const parser = new Parser(tokens);
    const ast = parser.parse();

    const env = new Environment();
    // Default special vars
    env.set("$fn", 24);
    env.set("$fa", 12);
    env.set("$fs", 2);
    env.set("$preview", true);
    env.set("PI", Math.PI);

    // ─── BOSL2 / Library Stub Functions ────────────────────────────────────
    // These provide fallback implementations for common BOSL2 functions so that
    // models using `include <BOSL2/std.scad>` can still render basic geometry.
    registerLibraryStubs(env);

    const evaluator = new Evaluator(env);

    // First pass: collect all module and function definitions, and variable assignments
    if (ast.type === "program") {
      for (const stmt of ast.body) {
        if (stmt.type === "module_def") {
          env.modules.set(stmt.name, { params: stmt.params, body: stmt.body });
        } else if (stmt.type === "function_def") {
          env.functions.set(stmt.name, { params: stmt.params, body: stmt.body });
        } else if (stmt.type === "assign") {
          env.set(stmt.name, evaluator.evalExpr(stmt.expr));
        }
      }
    }

    // Apply overrides
    if (overrides) {
      for (const [k, v] of Object.entries(overrides)) {
        // Cap $fn for performance in browser
        if (k === "$fn" && typeof v === "number") {
          env.set(k, Math.min(v, 48));
        } else {
          env.set(k, v as ScadValue);
        }
      }
    }

    // Re-evaluate assignments that depend on overridden values (calculated vars)
    if (ast.type === "program") {
      for (const stmt of ast.body) {
        if (stmt.type === "assign") {
          env.set(stmt.name, evaluator.evalExpr(stmt.expr));
        }
      }
    }

    // Second pass: execute geometry statements
    // Use polygon concatenation (not BSP union) at the top level.
    // BSP union is destructive — it clips polygons against each other's trees,
    // which is catastrophically wrong for non-overlapping geometry (e.g. hull + text).
    // OpenSCAD's implicit top-level union just combines all objects.
    let geometry = new CSG();
    if (ast.type === "program") {
      for (const stmt of ast.body) {
        let csg: CSG | null = null;
        if (stmt.type === "module_call") {
          csg = evaluator.evalModuleCall(stmt);
        } else if (stmt.type === "if_stmt") {
          csg = evaluator.evalIfGeometry(stmt);
        } else if (stmt.type === "for_loop") {
          csg = evaluator.evalForGeometry(stmt);
        }
        if (csg && csg.polygons.length > 0) {
          // Simple concatenation — no BSP clipping
          geometry = CSG.fromPolygons(geometry.polygons.concat(csg.polygons));
        }
      }
    }

    return { geometry, time: performance.now() - start };
  } catch (e: any) {
    return {
      geometry: new CSG(),
      error: e?.message || String(e),
      time: performance.now() - start,
    };
  }
}

class Evaluator {
  constructor(private env: Environment) {}

  evalExpr(node: ASTNode): ScadValue {
    switch (node.type) {
      case "number": return node.value;
      case "bool": return node.value;
      case "string": return node.value;
      case "undef": return undefined;
      case "ident": return this.env.get(node.name);
      case "array": return node.elements.map(e => this.evalExpr(e));

      case "index": {
        const obj = this.evalExpr(node.object);
        const idx = this.evalExpr(node.index);
        if (Array.isArray(obj) && typeof idx === "number") return obj[idx];
        return undefined;
      }

      case "unary": {
        const val = this.evalExpr(node.operand);
        if (node.op === "-") return -(val as number);
        if (node.op === "!") return !val;
        return val;
      }

      case "binary": {
        const l = this.evalExpr(node.left);
        const r = this.evalExpr(node.right);
        const ln = l as number, rn = r as number;
        switch (node.op) {
          case "+":
            // Support vector addition
            if (Array.isArray(l) && Array.isArray(r)) {
              return l.map((v, i) => (v as number) + ((r[i] as number) || 0));
            }
            return ln + rn;
          case "-":
            if (Array.isArray(l) && Array.isArray(r)) {
              return l.map((v, i) => (v as number) - ((r[i] as number) || 0));
            }
            return ln - rn;
          case "*":
            // scalar * vector
            if (typeof l === "number" && Array.isArray(r)) {
              return r.map(v => l * (v as number));
            }
            if (Array.isArray(l) && typeof r === "number") {
              return l.map(v => (v as number) * r);
            }
            return ln * rn;
          case "/": return rn !== 0 ? ln / rn : 0;
          case "%": return ln % rn;
          case "^": return Math.pow(ln, rn);
          case "<": return ln < rn;
          case ">": return ln > rn;
          case "<=": return ln <= rn;
          case ">=": return ln >= rn;
          case "==": return l === r;
          case "!=": return l !== r;
          case "&&": return l && r;
          case "||": return l || r;
          default: return undefined;
        }
      }

      case "ternary": {
        const cond = this.evalExpr(node.cond);
        return cond ? this.evalExpr(node.then) : this.evalExpr(node.else);
      }

      case "call": return this.evalFunctionCall(node.name, node.args, node.namedArgs);

      // List comprehension: [for (var = range) let(...) each expr]
      case "list_comp": {
        const rangeVal = this.evalExpr(node.range);
        if (!Array.isArray(rangeVal)) return [];
        const result: ScadValue[] = [];
        // Detect `each` flag
        const hasEach = node.letBindings.some(b => b.name === "__each");
        // Detect multi-var for bindings
        const multiVarBindings = node.letBindings.filter(b => b.name.startsWith("__for_"));

        for (const item of rangeVal) {
          const childEnv = new Environment(this.env);
          childEnv.set(node.variable, item);
          const ev = new Evaluator(childEnv);

          // Handle multi-variable for — resolve nested ranges
          if (multiVarBindings.length > 0) {
            // For each extra variable, iterate over its range
            const extraRanges: { name: string; values: ScadValue[] }[] = [];
            for (const b of multiVarBindings) {
              const varName = b.name.replace("__for_", "");
              const vals = ev.evalExpr(b.expr);
              if (Array.isArray(vals)) {
                extraRanges.push({ name: varName, values: vals });
              }
            }
            // Cartesian product iteration
            const iterateExtra = (idx: number) => {
              if (idx >= extraRanges.length) {
                // Apply remaining let bindings (non __for_ and non __each)
                for (const b of node.letBindings) {
                  if (!b.name.startsWith("__for_") && b.name !== "__each" && b.name !== extraRanges.find(r => r.name === b.name)?.name) {
                    childEnv.set(b.name, ev.evalExpr(b.expr));
                  }
                }
                if (node.condition) {
                  if (!ev.evalExpr(node.condition)) return;
                }
                const val = ev.evalExpr(node.body);
                if (hasEach && Array.isArray(val)) {
                  result.push(...val);
                } else {
                  result.push(val);
                }
                return;
              }
              const { name, values } = extraRanges[idx];
              for (const v of values) {
                childEnv.set(name, v);
                iterateExtra(idx + 1);
              }
            };
            iterateExtra(0);
          } else {
            // Single variable — original path
            for (const b of node.letBindings) {
              if (b.name !== "__each") {
                childEnv.set(b.name, ev.evalExpr(b.expr));
              }
            }
            if (node.condition) {
              const condVal = ev.evalExpr(node.condition);
              if (!condVal) continue;
            }
            const val = ev.evalExpr(node.body);
            if (hasEach && Array.isArray(val)) {
              result.push(...val);
            } else {
              result.push(val);
            }
          }
        }
        return result;
      }

      // let() expression: let(a = expr, ...) expr
      case "let_expr": {
        const childEnv = new Environment(this.env);
        const ev = new Evaluator(childEnv);
        for (const b of node.bindings) {
          childEnv.set(b.name, ev.evalExpr(b.expr));
        }
        return ev.evalExpr(node.body);
      }

      default: return undefined;
    }
  }

  private evalFunctionCall(name: string, argNodes: ASTNode[], namedNodes: Record<string, ASTNode>): ScadValue {
    const args = argNodes.map(a => this.evalExpr(a));

    // Built-in math functions
    switch (name) {
      case "len":
        if (typeof args[0] === "string") return (args[0] as string).length;
        return Array.isArray(args[0]) ? (args[0] as any[]).length : 0;
      case "ceil": return Math.ceil(args[0] as number);
      case "floor": return Math.floor(args[0] as number);
      case "round": return Math.round(args[0] as number);
      case "abs": return Math.abs(args[0] as number);
      case "sqrt": return Math.sqrt(args[0] as number);
      case "pow": return Math.pow(args[0] as number, args[1] as number);
      case "sin": return Math.sin((args[0] as number) * Math.PI / 180);
      case "cos": return Math.cos((args[0] as number) * Math.PI / 180);
      case "tan": return Math.tan((args[0] as number) * Math.PI / 180);
      case "asin": return Math.asin(args[0] as number) * 180 / Math.PI;
      case "acos": return Math.acos(args[0] as number) * 180 / Math.PI;
      case "atan": return Math.atan(args[0] as number) * 180 / Math.PI;
      case "atan2": return Math.atan2(args[0] as number, args[1] as number) * 180 / Math.PI;
      case "min": return Math.min(...(args as number[]));
      case "max": return Math.max(...(args as number[]));
      case "log": return Math.log(args[0] as number);
      case "ln": return Math.log(args[0] as number);
      case "exp": return Math.exp(args[0] as number);
      case "sign": return Math.sign(args[0] as number);
      case "norm": {
        if (Array.isArray(args[0])) {
          const v = args[0] as number[];
          return Math.sqrt(v.reduce((s, x) => s + x * x, 0));
        }
        return Math.abs(args[0] as number);
      }
      case "cross": {
        const a = args[0] as number[];
        const b = args[1] as number[];
        if (Array.isArray(a) && Array.isArray(b) && a.length >= 3 && b.length >= 3) {
          return [
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0],
          ];
        }
        return undefined;
      }
      case "lookup": {
        const key = args[0] as number;
        const table = args[1] as number[][];
        if (!Array.isArray(table) || table.length === 0) return 0;
        // Linear interpolation lookup
        for (let i = 0; i < table.length - 1; i++) {
          const k0 = (table[i] as number[])[0], v0 = (table[i] as number[])[1];
          const k1 = (table[i + 1] as number[])[0], v1 = (table[i + 1] as number[])[1];
          if (key >= k0 && key <= k1) {
            const t = (key - k0) / (k1 - k0);
            return v0 + t * (v1 - v0);
          }
        }
        return (table[table.length - 1] as number[])[1];
      }
      case "str": return args.map(a => String(a ?? "")).join("");
      case "chr": return String.fromCharCode(args[0] as number);
      case "ord": return typeof args[0] === "string" ? (args[0] as string).charCodeAt(0) : 0;
      case "is_undef": return args[0] === undefined;
      case "is_list": return Array.isArray(args[0]);
      case "is_num": return typeof args[0] === "number" && !isNaN(args[0] as number);
      case "is_string": return typeof args[0] === "string";
      case "is_bool": return typeof args[0] === "boolean";
      case "is_function": return false; // functions not first-class here
      case "select": {
        const list = args[0] as ScadValue[];
        const idx = args[1] as number;
        if (!Array.isArray(list)) return undefined;
        // OpenSCAD select wraps around: select([1,2,3], -1) → 3
        const len = list.length;
        if (len === 0) return undefined;
        const normalizedIdx = ((idx % len) + len) % len;
        if (args.length > 2) {
          // select(list, start, end) — range select
          const end = args[2] as number;
          const normalizedEnd = ((end % len) + len) % len;
          if (normalizedIdx <= normalizedEnd) {
            return list.slice(normalizedIdx, normalizedEnd + 1);
          }
          return [...list.slice(normalizedIdx), ...list.slice(0, normalizedEnd + 1)];
        }
        return list[normalizedIdx];
      }
      case "flatten": {
        if (!Array.isArray(args[0])) return args[0];
        const result: ScadValue[] = [];
        for (const item of args[0] as ScadValue[]) {
          if (Array.isArray(item)) result.push(...item);
          else result.push(item);
        }
        return result;
      }

      // ─── BOSL2 Utility Functions (native implementations) ───────────
      case "first_defined": {
        // first_defined([a, b, c]) → first non-undef value
        const vals = args[0];
        if (Array.isArray(vals)) {
          for (const v of vals as ScadValue[]) {
            if (v !== undefined) return v;
          }
        }
        return undefined;
      }
      case "is_def": return args[0] !== undefined;
      case "default": return args[0] !== undefined ? args[0] : args[1];
      case "force_list": return Array.isArray(args[0]) ? args[0] : [args[0]];
      case "scalar_vec3": {
        const x = args[0];
        const dflt = args[1];
        if (Array.isArray(x)) return x;
        if (typeof x === "number") return [x, x, x];
        if (dflt !== undefined) return Array.isArray(dflt) ? dflt : [dflt, dflt, dflt];
        return [0, 0, 0];
      }
      case "v_abs": {
        if (!Array.isArray(args[0])) return args[0];
        return (args[0] as number[]).map(v => Math.abs(v as number));
      }
      case "v_mul": {
        if (!Array.isArray(args[0]) || !Array.isArray(args[1])) return args[0];
        const a = args[0] as number[], b = args[1] as number[];
        return a.map((v, i) => (v as number) * ((b[i] as number) || 0));
      }
      case "v_add": {
        if (!Array.isArray(args[0]) || !Array.isArray(args[1])) return args[0];
        const a2 = args[0] as number[], b2 = args[1] as number[];
        return a2.map((v, i) => (v as number) + ((b2[i] as number) || 0));
      }
      case "quant": {
        // quant(x, y) → round x to nearest multiple of y
        const x = args[0] as number, y = args[1] as number;
        if (typeof x !== "number" || typeof y !== "number" || y === 0) return x;
        return Math.round(x / y) * y;
      }
      case "quantdn": {
        const x = args[0] as number, y = args[1] as number;
        if (typeof x !== "number" || typeof y !== "number" || y === 0) return x;
        return Math.floor(x / y) * y;
      }
      case "quantup": {
        const x = args[0] as number, y = args[1] as number;
        if (typeof x !== "number" || typeof y !== "number" || y === 0) return x;
        return Math.ceil(x / y) * y;
      }
      case "search": {
        const needle = args[0];
        const haystack = args[1];
        if (typeof needle === "string" && typeof haystack === "string") {
          const idx = (haystack as string).indexOf(needle as string);
          return idx >= 0 ? [idx] : [];
        }
        if (Array.isArray(haystack)) {
          return [(haystack as any[]).indexOf(needle)];
        }
        return [];
      }
      case "parent_module": return undefined;
      case "concat": {
        const result: ScadValue[] = [];
        for (const a of args) {
          if (Array.isArray(a)) result.push(...a);
          else result.push(a);
        }
        return result;
      }
      case "__range": {
        const start = args[0] as number;
        const step = args[1] as number;
        const end = args[2] as number;
        const result: number[] = [];
        if (step > 0) for (let i = start; i <= end + 1e-10; i += step) result.push(i);
        else if (step < 0) for (let i = start; i >= end - 1e-10; i += step) result.push(i);
        return result;
      }
    }

    // User-defined functions
    const fn = this.env.getFunction(name);
    if (fn) {
      const childEnv = new Environment(this.env);
      fn.params.forEach((p, i) => {
        const val = namedNodes[p.name] !== undefined
          ? this.evalExpr(namedNodes[p.name])
          : args[i] !== undefined ? args[i] : (p.default ? this.evalExpr(p.default) : undefined);
        childEnv.set(p.name, val);
      });
      const ev = new Evaluator(childEnv);
      return ev.evalExpr(fn.body);
    }

    return undefined;
  }

  // ─── Geometry evaluation ──────────────────────────────────────────────

  evalModuleCall(node: ASTNode & { type: "module_call" }): CSG | null {
    const { name, args: argNodes, namedArgs, children } = node;
    const args = argNodes.map(a => this.evalExpr(a));
    const named: Record<string, ScadValue> = {};
    for (const [k, v] of Object.entries(namedArgs)) named[k] = this.evalExpr(v);

    const fn = (this.env.get("$fn") as number) || 24;
    const segments = Math.max(6, Math.min(fn, 128)); // allow up to 128 for high-quality renders

    switch (name) {
      // ─── Primitives ─────────────────────────────────────────
      case "cube": {
        let size: number[] = [1, 1, 1];
        let center = false;
        if (args[0] !== undefined) {
          if (Array.isArray(args[0])) size = args[0] as number[];
          else size = [args[0] as number, args[0] as number, args[0] as number];
        }
        if (named.size !== undefined) {
          if (Array.isArray(named.size)) size = named.size as number[];
          else size = [named.size as number, named.size as number, named.size as number];
        }
        if (named.center !== undefined) center = !!named.center;
        else if (args[1] !== undefined) center = !!args[1];

        const r = new Vec3(size[0] / 2, size[1] / 2, size[2] / 2);
        const c = center ? new Vec3(0, 0, 0) : r;
        return CSG.cube({ center: c, radius: r });
      }

      case "sphere": {
        let radius = 1;
        if (args[0] !== undefined) radius = args[0] as number;
        if (named.r !== undefined) radius = named.r as number;
        if (named.d !== undefined) radius = (named.d as number) / 2;
        const stacks = Math.max(4, Math.floor(segments / 2));
        return CSG.sphere({ radius, slices: segments, stacks });
      }

      case "cylinder": {
        let h = 1, r1 = 1, r2 = 1, center = false;
        if (named.h !== undefined) h = named.h as number;
        else if (args[0] !== undefined) h = args[0] as number;

        if (named.r !== undefined) { r1 = r2 = named.r as number; }
        if (named.r1 !== undefined) r1 = named.r1 as number;
        if (named.r2 !== undefined) r2 = named.r2 as number;
        if (named.d !== undefined) { r1 = r2 = (named.d as number) / 2; }
        if (named.d1 !== undefined) r1 = (named.d1 as number) / 2;
        if (named.d2 !== undefined) r2 = (named.d2 as number) / 2;
        if (args[1] !== undefined && named.r === undefined) r1 = r2 = args[1] as number;
        if (named.center !== undefined) center = !!named.center;

        // Use r1 and r2 to create a potentially tapered cylinder
        const startZ = center ? -h / 2 : 0;
        const endZ = center ? h / 2 : h;

        if (Math.abs(r1 - r2) < 1e-10) {
          // Simple cylinder
          return CSG.cylinder({
            start: new Vec3(0, 0, startZ),
            end: new Vec3(0, 0, endZ),
            radius: r1,
            slices: segments,
          });
        }

        // Cone / tapered cylinder — direct polygon construction (no union approx)
        const csg = new CSG();

        // Generate rings of vertices at top and bottom
        const bottomRing: Vec3[] = [];
        const topRing: Vec3[] = [];
        for (let i = 0; i < segments; i++) {
          const a = (i / segments) * Math.PI * 2;
          const cosA = Math.cos(a), sinA = Math.sin(a);
          bottomRing.push(new Vec3(r1 * cosA, r1 * sinA, startZ));
          topRing.push(new Vec3(r2 * cosA, r2 * sinA, endZ));
        }

        // Side faces (quads split as needed)
        for (let i = 0; i < segments; i++) {
          const i2 = (i + 1) % segments;
          const b0 = bottomRing[i], b1 = bottomRing[i2];
          const t0_ = topRing[i], t1_ = topRing[i2];

          // Side normal (outward direction at midpoint of segment)
          const midAngle = ((i + 0.5) / segments) * Math.PI * 2;
          const sideN = new Vec3(Math.cos(midAngle), Math.sin(midAngle), (r1 - r2) / h).unit();

          const verts = [
            new Vertex(b0, sideN),
            new Vertex(b1, sideN),
            new Vertex(t1_, sideN),
            new Vertex(t0_, sideN),
          ];
          csg.polygons.push(new Polygon(verts));
        }

        // Bottom cap (if r1 > 0)
        if (r1 > 1e-10) {
          const bn = new Vec3(0, 0, -1);
          const bottomVerts = bottomRing.map(pos => new Vertex(pos, bn));
          bottomVerts.reverse();
          csg.polygons.push(new Polygon(bottomVerts));
        }

        // Top cap (if r2 > 0)
        if (r2 > 1e-10) {
          const tn = new Vec3(0, 0, 1);
          const topVerts = topRing.map(pos => new Vertex(pos, tn));
          csg.polygons.push(new Polygon(topVerts));
        }

        return csg;
      }

      case "polyhedron": {
        // polyhedron(points, faces)
        const pts = (named.points || args[0]) as number[][];
        const fcs = (named.faces || named.triangles || args[1]) as number[][];
        if (!pts || !fcs) return null;

        const vecs = pts.map(p => new Vec3(p[0], p[1], p[2]));
        const csg = new CSG();
        for (const face of fcs) {
          if (face.length < 3) continue;
          const vertices = face.map(idx => {
            const pos = vecs[idx as number];
            return new Vertex(pos, new Vec3(0, 0, 0));
          });
          // Calculate face normal
          const v0 = vertices[0].pos;
          const v1 = vertices[1].pos;
          const v2 = vertices[2].pos;
          const normal = v1.minus(v0).cross(v2.minus(v0)).unit();
          for (const v of vertices) v.normal = normal;
          csg.polygons.push(new Polygon(vertices));
        }
        return csg;
      }

      // ─── 2D to 3D Operations ──────────────────────────────────
      case "linear_extrude": {
        let height = 1, twist = 0, center = false, slices = 1;
        if (named.height !== undefined) height = named.height as number;
        else if (args[0] !== undefined) height = args[0] as number;
        if (named.twist !== undefined) twist = named.twist as number;
        if (named.center !== undefined) center = !!named.center;
        if (named.slices !== undefined) slices = named.slices as number;

        // Auto-calculate slices based on twist
        if (twist !== 0 && slices <= 1) {
          slices = Math.max(1, Math.ceil(Math.abs(twist) / 10));
        }

        // Evaluate children to get 2D points
        const pts2d = this.evalChildren2D(children);
        if (pts2d.length < 3) return null;

        return this.linearExtrudePolygon(pts2d, height, twist, center, slices);
      }

      case "rotate_extrude": {
        let angle = 360;
        if (named.angle !== undefined) angle = named.angle as number;
        if (named.$fn !== undefined) {
          // local override
        }

        const pts2d = this.evalChildren2D(children);
        if (pts2d.length < 2) return null;

        // Convert 2D points to profile for rotateExtrude: [x, z]
        const profile = pts2d.map(p => new Vec3(Math.abs(p[0]), 0, p[1]));
        return CSG.rotateExtrude(profile, angle * Math.PI / 180, segments);
      }

      // ─── 2D Primitives ────────────────────────────────────────
      case "polygon": {
        // Returns points for parent linear_extrude to use
        const pts = (named.points || args[0]) as number[][];
        if (!pts) return null;
        // Store as a special marker CSG with polygon data
        const csg = new CSG();
        (csg as any).__polygon2d = pts;
        return csg;
      }

      case "circle": {
        let radius = 1;
        if (args[0] !== undefined) radius = args[0] as number;
        if (named.r !== undefined) radius = named.r as number;
        if (named.d !== undefined) radius = (named.d as number) / 2;

        const pts: number[][] = [];
        for (let i = 0; i < segments; i++) {
          const a = (i / segments) * Math.PI * 2;
          pts.push([radius * Math.cos(a), radius * Math.sin(a)]);
        }
        const csg = new CSG();
        (csg as any).__polygon2d = pts;
        return csg;
      }

      case "square": {
        let size: number[] = [1, 1];
        let center = false;
        if (args[0] !== undefined) {
          if (Array.isArray(args[0])) size = args[0] as number[];
          else size = [args[0] as number, args[0] as number];
        }
        if (named.size !== undefined) {
          if (Array.isArray(named.size)) size = named.size as number[];
          else size = [named.size as number, named.size as number];
        }
        if (named.center !== undefined) center = !!named.center;

        const ox = center ? -size[0] / 2 : 0;
        const oy = center ? -size[1] / 2 : 0;
        const pts: number[][] = [
          [ox, oy], [ox + size[0], oy],
          [ox + size[0], oy + size[1]], [ox, oy + size[1]],
        ];
        const csg = new CSG();
        (csg as any).__polygon2d = pts;
        return csg;
      }

      case "text": {
        // Real text geometry using a segment-based bitmap font
        const textStr = (args[0] || named.text || "") as string;
        let fontSize = (named.size || args[1] || 10) as number;
        const halign = (named.halign || "left") as string;
        const valign = (named.valign || "baseline") as string;
        const spacing = (named.spacing || 1) as number;

        if (!textStr || typeof textStr !== "string") {
          return CSG.cube({ center: new Vec3(5, 2, 0.5), radius: new Vec3(5, 2, 0.5) });
        }

        // Generate 2D polygons for each character and extrude them slightly
        const charWidth = fontSize * 0.7;
        const charSpacing = charWidth * spacing;
        let result = new CSG();
        let xOff = 0;

        // Horizontal alignment offset
        const totalWidth = textStr.length * charSpacing;
        if (halign === "center") xOff = -totalWidth / 2;
        else if (halign === "right") xOff = -totalWidth;

        // Vertical alignment offset
        let yOff = 0;
        if (valign === "center") yOff = -fontSize / 2;
        else if (valign === "top") yOff = -fontSize;

        for (let ci = 0; ci < textStr.length; ci++) {
          const ch = textStr[ci];
          const charPolys = getCharPolygons(ch, fontSize);
          for (const poly of charPolys) {
            // Translate each character polygon and extrude (negate X to correct mirror)
            const translated = poly.map(p => [-p[0] - xOff - ci * charSpacing, p[1] + yOff]);
            if (translated.length >= 3) {
              const charCSG = this.linearExtrudePolygon(translated, fontSize * 0.3, 0, false, 1);
              // Concatenate polygons — don't use BSP union (destroys non-overlapping geometry)
              result = CSG.fromPolygons(result.polygons.concat(charCSG.polygons));
            }
          }
        }

        return result.polygons.length > 0 ? result : CSG.cube({ center: new Vec3(5, 2, 0.5), radius: new Vec3(5, 2, 0.5) });
      }

      case "offset": {
        const r = (named.r || named.delta || args[0] || 0) as number;
        // Evaluate child 2D shapes and offset them
        const child = this.evalChildrenGeometry(children);
        if (child && (child as any).__polygon2d) {
          const pts = (child as any).__polygon2d as number[][];
          const offsetPts = this.offsetPolygon(pts, r);
          const csg = new CSG();
          (csg as any).__polygon2d = offsetPts;
          return csg;
        }
        return child;
      }

      // ─── Transforms ──────────────────────────────────────────
      case "translate": {
        const v = (args[0] || [0, 0, 0]) as number[];
        const child = this.evalChildrenGeometry(children);
        if (!child) return null;
        // Propagate 2D polygon data through transforms
        if ((child as any).__polygon2d) {
          const pts = ((child as any).__polygon2d as number[][]).map(p => [p[0] + v[0], p[1] + v[1]]);
          const csg = new CSG();
          (csg as any).__polygon2d = pts;
          return csg;
        }
        return child.transform(mat4Translate(v[0] || 0, v[1] || 0, v[2] || 0));
      }

      case "rotate": {
        const child = this.evalChildrenGeometry(children);
        if (!child) return null;

        let m = mat4Identity();
        if (named.a !== undefined && named.v !== undefined) {
          // rotate(a, v) - axis-angle
          const angle = (named.a as number) * Math.PI / 180;
          const v = named.v as number[];
          // Rodrigues' rotation
          const len = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
          if (len > 1e-10) {
            const ax = v[0] / len, ay = v[1] / len, az = v[2] / len;
            const c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
            m = [
              t * ax * ax + c, t * ax * ay + s * az, t * ax * az - s * ay, 0,
              t * ax * ay - s * az, t * ay * ay + c, t * ay * az + s * ax, 0,
              t * ax * az + s * ay, t * ay * az - s * ax, t * az * az + c, 0,
              0, 0, 0, 1,
            ];
          }
        } else {
          const v = (args[0] || [0, 0, 0]) as number[];
          if (Array.isArray(v)) {
            if (v[2]) m = mat4Multiply(m, mat4RotateZ(v[2] * Math.PI / 180));
            if (v[1]) m = mat4Multiply(m, mat4RotateY(v[1] * Math.PI / 180));
            if (v[0]) m = mat4Multiply(m, mat4RotateX(v[0] * Math.PI / 180));
          } else {
            m = mat4RotateZ((v as any as number) * Math.PI / 180);
          }
        }
        return child.transform(m);
      }

      case "scale": {
        const v = (args[0] || [1, 1, 1]) as number[];
        const child = this.evalChildrenGeometry(children);
        if (!child) return null;
        if (Array.isArray(v)) {
          return child.transform(mat4Scale(v[0] || 1, v[1] || 1, v[2] || 1));
        }
        const s = v as any as number;
        return child.transform(mat4Scale(s, s, s));
      }

      case "mirror": {
        const v = (args[0] || [1, 0, 0]) as number[];
        const child = this.evalChildrenGeometry(children);
        if (!child) return null;
        // Mirror matrix for arbitrary plane normal
        const nx = v[0] || 0, ny = v[1] || 0, nz = v[2] || 0;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (len < 1e-10) return child;
        const ux = nx / len, uy = ny / len, uz = nz / len;
        const m = [
          1 - 2 * ux * ux, -2 * ux * uy, -2 * ux * uz, 0,
          -2 * ux * uy, 1 - 2 * uy * uy, -2 * uy * uz, 0,
          -2 * ux * uz, -2 * uy * uz, 1 - 2 * uz * uz, 0,
          0, 0, 0, 1,
        ];
        // Mirror flips winding, so we need to flip all polygon normals
        const mirrored = child.transform(m);
        // Invert by flipping each polygon
        const inverted = new CSG();
        for (const poly of mirrored.polygons) {
          const verts = [...poly.vertices].reverse().map(v => ({
            pos: v.pos,
            normal: v.normal.negated(),
          }));
          inverted.polygons.push({ vertices: verts, plane: { normal: poly.plane.normal.negated(), w: -poly.plane.w } } as any);
        }
        return inverted;
      }

      case "resize": {
        const newSize = (args[0] || [0, 0, 0]) as number[];
        const child = this.evalChildrenGeometry(children);
        if (!child) return null;
        // Calculate bounding box and scale factors
        let minX = Infinity, minY = Infinity, minZ = Infinity;
        let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
        for (const poly of child.polygons) {
          for (const v of poly.vertices) {
            minX = Math.min(minX, v.pos.x); maxX = Math.max(maxX, v.pos.x);
            minY = Math.min(minY, v.pos.y); maxY = Math.max(maxY, v.pos.y);
            minZ = Math.min(minZ, v.pos.z); maxZ = Math.max(maxZ, v.pos.z);
          }
        }
        const sx = newSize[0] > 0 ? newSize[0] / (maxX - minX || 1) : 1;
        const sy = newSize[1] > 0 ? newSize[1] / (maxY - minY || 1) : 1;
        const sz = newSize[2] > 0 ? newSize[2] / (maxZ - minZ || 1) : 1;
        return child.transform(mat4Scale(sx, sy, sz));
      }

      case "color": {
        // Color is visual-only; just pass through children
        return this.evalChildrenGeometry(children);
      }

      case "multmatrix": {
        const mat = (args[0] || named.m) as number[][];
        const child = this.evalChildrenGeometry(children);
        if (!child || !mat) return child || null;
        // Flatten 4x4 matrix
        const m: number[] = [];
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 4; col++) {
            m.push(mat[row]?.[col] ?? (row === col ? 1 : 0));
          }
        }
        return child.transform(m);
      }

      // ─── CSG Operations ──────────────────────────────────────
      case "union": {
        return this.evalChildrenGeometry(children);
      }

      case "difference": {
        const childGeoms = this.evalChildrenList(children);
        if (childGeoms.length === 0) return null;
        let result = childGeoms[0];
        for (let i = 1; i < childGeoms.length; i++) {
          result = result.subtract(childGeoms[i]);
        }
        return result;
      }

      case "intersection": {
        const childGeoms = this.evalChildrenList(children);
        if (childGeoms.length === 0) return null;
        let result = childGeoms[0];
        for (let i = 1; i < childGeoms.length; i++) {
          result = result.intersect(childGeoms[i]);
        }
        return result;
      }

      case "hull": {
        const childGeoms = this.evalChildrenList(children);
        if (childGeoms.length === 0) return null;
        return CSG.hull(childGeoms);
      }

      case "minkowski": {
        // Minkowski sum approximation:
        // For each vertex in shape B, translate a copy of shape A to that vertex position.
        // Then take the convex hull of all translated copies.
        // This is exact for convex shapes and a good approximation for most real cases.
        const childGeoms = this.evalChildrenList(children);
        if (childGeoms.length < 2) return childGeoms[0] || null;

        const shapeA = childGeoms[0];
        const shapeB = childGeoms[1];

        // Collect unique vertices from shape B
        const bPoints: Vec3[] = [];
        const seen = new Set<string>();
        for (const poly of shapeB.polygons) {
          for (const v of poly.vertices) {
            const key = `${v.pos.x.toFixed(4)},${v.pos.y.toFixed(4)},${v.pos.z.toFixed(4)}`;
            if (!seen.has(key)) {
              seen.add(key);
              bPoints.push(v.pos);
            }
          }
        }

        // Limit samples for performance (Minkowski with sphere $fn=24 = 288 vertices)
        const maxSamples = 64;
        let sampledB = bPoints;
        if (bPoints.length > maxSamples) {
          // Uniform sampling: take every Nth point
          const step = Math.ceil(bPoints.length / maxSamples);
          sampledB = bPoints.filter((_, i) => i % step === 0);
        }

        // For each B vertex, translate all A vertices by that offset
        const allPoints: Vec3[] = [];
        for (const bv of sampledB) {
          for (const poly of shapeA.polygons) {
            for (const v of poly.vertices) {
              allPoints.push(v.pos.plus(bv));
            }
          }
        }

        if (allPoints.length < 4) return CSG.hull(childGeoms);
        return CSG.hull([CSG.fromPolygons(allPoints.map(p =>
          new Polygon([
            new Vertex(p, new Vec3(0, 0, 1)),
            new Vertex(p.plus(new Vec3(0.001, 0, 0)), new Vec3(0, 0, 1)),
            new Vertex(p.plus(new Vec3(0, 0.001, 0)), new Vec3(0, 0, 1)),
          ])
        ))]);
      }

      case "intersection_for": {
        // intersection_for(i = [range]) body
        // Evaluates body for each iteration value, then intersects all results
        const varName = Object.keys(namedArgs)[0] || "i";
        const rangeNode = namedArgs[varName];
        const rangeVal = rangeNode ? this.evalExpr(rangeNode) : (args[0] as ScadValue[]);
        if (!Array.isArray(rangeVal) || rangeVal.length === 0) return null;

        const geoms: CSG[] = [];
        for (const item of rangeVal) {
          const childEnv = new Environment(this.env);
          for (const [k, v] of this.env.modules) childEnv.modules.set(k, v);
          for (const [k, v] of this.env.functions) childEnv.functions.set(k, v);
          for (const [k, v] of this.env.vars) {
            if (k.startsWith('$')) childEnv.set(k, v);
          }
          childEnv.set(varName, item);
          const ev = new Evaluator(childEnv);
          const geom = ev.evalChildrenGeometry(children);
          if (geom) geoms.push(geom);
        }
        if (geoms.length === 0) return null;
        let result = geoms[0];
        for (let i = 1; i < geoms.length; i++) {
          result = result.intersect(geoms[i]);
        }
        return result;
      }

      // ─── Special ─────────────────────────────────────────────
      case "echo": {
        // Debug output
        const values = args.map(a => JSON.stringify(a)).join(", ");
        console.log(`[SCAD echo] ${values}`);
        return this.evalChildrenGeometry(children);
      }

      case "render":
      case "group":
      case "clone": {
        // clone() duplicates children geometry (identity pass-through in CSG)
        return this.evalChildrenGeometry(children);
      }

      // ─── children() – evaluate the parent module's children ───
      case "children": {
        // $children is set when a user-defined module is called
        const parentChildren = this.env.get("$children") as ASTNode[] | undefined;
        if (parentChildren && parentChildren.length > 0) {
          return this.evalChildrenGeometry(parentChildren);
        }
        return this.evalChildrenGeometry(children);
      }

      // ─── projection() – 2D projection of 3D geometry (approximate) ──
      case "projection": {
        const cut = !!named.cut;
        const child = this.evalChildrenGeometry(children);
        if (!child) return null;
        const pts2d: number[][] = [];
        const seen = new Set<string>();
        for (const poly of child.polygons) {
          for (const v of poly.vertices) {
            if (cut && Math.abs(v.pos.z) > 0.1) continue;
            const key = `${v.pos.x.toFixed(3)},${v.pos.y.toFixed(3)}`;
            if (!seen.has(key)) {
              seen.add(key);
              pts2d.push([v.pos.x, v.pos.y]);
            }
          }
        }
        if (pts2d.length < 3) return null;
        const hull2d = convexHull2D(pts2d);
        const csg = new CSG();
        (csg as any).__polygon2d = hull2d;
        return csg;
      }

      // ─── import() – unsupported but don't crash ────────────────
      case "import": {
        console.log(`[SCAD] import() no soportado en Vorea Studio: ${args[0]}`);
        return null;
      }

      // ─── surface() – heightmap from image ─────────────────────────
      case "surface": {
        const filename = args[0] as string;
        if (!filename || typeof filename !== "string") {
          console.log(`[SCAD] surface() requires a filename argument`);
          return null;
        }

        const decoded = getImage(filename);
        if (!decoded) {
          console.log(`[SCAD] surface(): image "${filename}" not loaded. Upload it via the viewport image button.`);
          // Return a flat placeholder so the model doesn't break
          return CSG.cube({ center: new Vec3(25, 25, 0.5), radius: new Vec3(25, 25, 0.5) });
        }

        // Parameters
        const center = named.center === true || named.center === "true";
        const invert = named.invert === true || named.invert === "true";
        const solid = named.solid === true || named.solid === "true";
        const maxheight = (named.maxheight as number) || 10;
        const sizeArg = named.size as number[] | number | undefined;
        let sizeX = 100, sizeY = 100;
        if (Array.isArray(sizeArg)) {
          sizeX = sizeArg[0] || 100;
          sizeY = sizeArg[1] || sizeArg[0] || 100;
        } else if (typeof sizeArg === "number") {
          sizeX = sizeY = sizeArg;
        }
        // Up to 1000 samples for high quality reliefs (1000x1000 = 2M triangles)
        const maxSamples = Math.min((named.samples as number) || 100, 1000);

        // Determine grid resolution (downsample large images)
        const gridW = Math.min(decoded.width, maxSamples);
        const gridH = Math.min(decoded.height, maxSamples);

        // Generate height grid (flat Float64Array for memory efficiency at high res)
        const cols = gridW + 1;
        const rows = gridH + 1;
        const heights = new Float64Array(cols * rows);
        for (let iy = 0; iy < rows; iy++) {
          for (let ix = 0; ix < cols; ix++) {
            let b = sampleBrightness(decoded, ix / gridW, iy / gridH);
            if (invert) b = 1 - b;
            heights[iy * cols + ix] = b * maxheight;
          }
        }

        // Offset for centering
        const offX = center ? -sizeX / 2 : 0;
        const offY = center ? -sizeY / 2 : 0;

        // Build polygons
        const polygons: Polygon[] = [];

        // Helper to get 3D position
        const pos = (ix: number, iy: number, z?: number): Vec3 => new Vec3(
          offX + (ix / gridW) * sizeX,
          offY + (iy / gridH) * sizeY,
          z !== undefined ? z : heights[iy * cols + ix]
        );

        // Top surface — two triangles per grid cell
        for (let iy = 0; iy < gridH; iy++) {
          for (let ix = 0; ix < gridW; ix++) {
            const p00 = pos(ix, iy);
            const p10 = pos(ix + 1, iy);
            const p01 = pos(ix, iy + 1);
            const p11 = pos(ix + 1, iy + 1);

            // Triangle 1: p00, p10, p11
            const n1 = p10.minus(p00).cross(p11.minus(p00));
            const n1u = n1.length() > 1e-10 ? n1.unit() : new Vec3(0, 0, 1);
            polygons.push(new Polygon([
              new Vertex(p00, n1u),
              new Vertex(p10, n1u),
              new Vertex(p11, n1u),
            ]));

            // Triangle 2: p00, p11, p01
            const n2 = p11.minus(p00).cross(p01.minus(p00));
            const n2u = n2.length() > 1e-10 ? n2.unit() : new Vec3(0, 0, 1);
            polygons.push(new Polygon([
              new Vertex(p00, n2u),
              new Vertex(p11, n2u),
              new Vertex(p01, n2u),
            ]));
          }
        }

        // ─── Bottom cap + side walls (only when solid=true) ──────────
        if (solid) {
          const nDown = new Vec3(0, 0, -1);
          for (let iy = 0; iy < gridH; iy++) {
            for (let ix = 0; ix < gridW; ix++) {
              const p00 = pos(ix, iy, 0), p10 = pos(ix + 1, iy, 0);
              const p01 = pos(ix, iy + 1, 0), p11 = pos(ix + 1, iy + 1, 0);
              polygons.push(new Polygon([
                new Vertex(p00, nDown), new Vertex(p01, nDown), new Vertex(p11, nDown),
              ]));
              polygons.push(new Polygon([
                new Vertex(p00, nDown), new Vertex(p11, nDown), new Vertex(p10, nDown),
              ]));
            }
          }
          const nFront = new Vec3(0, -1, 0), nBack = new Vec3(0, 1, 0);
          const nLeft = new Vec3(-1, 0, 0), nRight = new Vec3(1, 0, 0);
          for (let ix = 0; ix < gridW; ix++) {
            polygons.push(new Polygon([
              new Vertex(pos(ix, 0, 0), nFront), new Vertex(pos(ix + 1, 0, 0), nFront),
              new Vertex(pos(ix + 1, 0), nFront), new Vertex(pos(ix, 0), nFront),
            ]));
            polygons.push(new Polygon([
              new Vertex(pos(ix, gridH, 0), nBack), new Vertex(pos(ix, gridH), nBack),
              new Vertex(pos(ix + 1, gridH), nBack), new Vertex(pos(ix + 1, gridH, 0), nBack),
            ]));
          }
          for (let iy = 0; iy < gridH; iy++) {
            polygons.push(new Polygon([
              new Vertex(pos(0, iy, 0), nLeft), new Vertex(pos(0, iy), nLeft),
              new Vertex(pos(0, iy + 1), nLeft), new Vertex(pos(0, iy + 1, 0), nLeft),
            ]));
            polygons.push(new Polygon([
              new Vertex(pos(gridW, iy, 0), nRight), new Vertex(pos(gridW, iy + 1, 0), nRight),
              new Vertex(pos(gridW, iy + 1), nRight), new Vertex(pos(gridW, iy), nRight),
            ]));
          }
        }

        console.log(`[SCAD] surface("${filename}"): ${gridW}x${gridH} grid, ${polygons.length} faces${solid ? ' (solid)' : ''}`);
        return CSG.fromPolygons(polygons);
      }

      // ─── assert() – check condition, pass through children ─────
      case "assert": {
        const condition = args[0];
        const message = args[1] || named.message || "Assertion failed";
        if (!condition) {
          console.log(`[SCAD assert] ${message}`);
        }
        return this.evalChildrenGeometry(children);
      }

      default: {
        // Try user-defined module
        const mod = this.env.getModule(name);
        if (mod) {
          const childEnv = new Environment(this.env);
          // Copy modules, functions, AND $ special vars (including $fn, $fa, $fs)
          for (const [k, v] of this.env.modules) childEnv.modules.set(k, v);
          for (const [k, v] of this.env.functions) childEnv.functions.set(k, v);
          for (const [k, v] of this.env.vars) {
            if (k.startsWith('$')) childEnv.set(k, v);
          }

          mod.params.forEach((p, i) => {
            const val = namedArgs[p.name] !== undefined
              ? this.evalExpr(namedArgs[p.name])
              : args[i] !== undefined ? args[i] : (p.default ? this.evalExpr(p.default) : undefined);
            childEnv.set(p.name, val);
          });

          // Store caller's children so children() can access them
          childEnv.set("$children", children as any);

          // Execute module body
          const ev = new Evaluator(childEnv);
          let result = new CSG();
          for (const stmt of mod.body) {
            if (stmt.type === "assign") {
              childEnv.set(stmt.name, ev.evalExpr(stmt.expr));
            } else if (stmt.type === "module_call") {
              const csg = ev.evalModuleCall(stmt);
              if (csg) result = result.union(csg);
            } else if (stmt.type === "if_stmt") {
              const csg = ev.evalIfGeometry(stmt);
              if (csg) result = result.union(csg);
            } else if (stmt.type === "for_loop") {
              const csg = ev.evalForGeometry(stmt);
              if (csg) result = result.union(csg);
            } else if (stmt.type === "module_def") {
              childEnv.modules.set(stmt.name, { params: stmt.params, body: stmt.body });
            } else if (stmt.type === "function_def") {
              childEnv.functions.set(stmt.name, { params: stmt.params, body: stmt.body });
            }
          }
          return result;
        }
        return null;
      }
    }
  }

  evalIfGeometry(node: ASTNode & { type: "if_stmt" }): CSG | null {
    const cond = this.evalExpr(node.cond);
    const branch = cond ? node.then : (node.else || []);
    let result = new CSG();
    for (const stmt of branch) {
      if (stmt.type === "module_call") {
        const csg = this.evalModuleCall(stmt);
        if (csg) result = result.union(csg);
      } else if (stmt.type === "if_stmt") {
        const csg = this.evalIfGeometry(stmt);
        if (csg) result = result.union(csg);
      } else if (stmt.type === "for_loop") {
        const csg = this.evalForGeometry(stmt);
        if (csg) result = result.union(csg);
      } else if (stmt.type === "assign") {
        this.env.set(stmt.name, this.evalExpr(stmt.expr));
      }
    }
    return result.polygons.length > 0 ? result : null;
  }

  evalForGeometry(node: ASTNode & { type: "for_loop" }): CSG | null {
    const rangeVal = this.evalExpr(node.range);
    if (!Array.isArray(rangeVal)) return null;

    // Multi-variable for: for (x = range, y = range, ...)
    if (node.variables && node.variables.length > 1) {
      let result = new CSG();
      const iterateVars = (idx: number, parentEnv: Environment) => {
        if (idx >= node.variables!.length) {
          // All variables bound — execute body
          const ev = new Evaluator(parentEnv);
          for (const stmt of node.body) {
            if (stmt.type === "module_call") {
              const csg = ev.evalModuleCall(stmt);
              if (csg) result = CSG.fromPolygons(result.polygons.concat(csg.polygons));
            } else if (stmt.type === "if_stmt") {
              const csg = ev.evalIfGeometry(stmt);
              if (csg) result = CSG.fromPolygons(result.polygons.concat(csg.polygons));
            } else if (stmt.type === "for_loop") {
              const csg = ev.evalForGeometry(stmt);
              if (csg) result = CSG.fromPolygons(result.polygons.concat(csg.polygons));
            } else if (stmt.type === "assign") {
              parentEnv.set(stmt.name, ev.evalExpr(stmt.expr));
            }
          }
          return;
        }
        const varDef = node.variables![idx];
        const varRange = new Evaluator(parentEnv).evalExpr(varDef.range);
        if (!Array.isArray(varRange)) return;
        for (const val of varRange) {
          const childEnv = new Environment(parentEnv);
          for (const [k, v] of parentEnv.modules) childEnv.modules.set(k, v);
          for (const [k, v] of parentEnv.functions) childEnv.functions.set(k, v);
          for (const [k, v] of parentEnv.vars) {
            if (k.startsWith('$')) childEnv.set(k, v);
          }
          childEnv.set(varDef.name, val);
          iterateVars(idx + 1, childEnv);
        }
      };
      iterateVars(0, this.env);
      return result.polygons.length > 0 ? result : null;
    }

    // Single variable for — use polygon concatenation instead of BSP union
    let result = new CSG();
    for (const item of rangeVal) {
      const childEnv = new Environment(this.env);
      for (const [k, v] of this.env.modules) childEnv.modules.set(k, v);
      for (const [k, v] of this.env.functions) childEnv.functions.set(k, v);
      for (const [k, v] of this.env.vars) {
        if (k.startsWith('$')) childEnv.set(k, v);
      }
      childEnv.set(node.variable, item);
      const ev = new Evaluator(childEnv);

      for (const stmt of node.body) {
        if (stmt.type === "module_call") {
          const csg = ev.evalModuleCall(stmt);
          if (csg) result = CSG.fromPolygons(result.polygons.concat(csg.polygons));
        } else if (stmt.type === "if_stmt") {
          const csg = ev.evalIfGeometry(stmt);
          if (csg) result = CSG.fromPolygons(result.polygons.concat(csg.polygons));
        } else if (stmt.type === "for_loop") {
          const csg = ev.evalForGeometry(stmt);
          if (csg) result = CSG.fromPolygons(result.polygons.concat(csg.polygons));
        } else if (stmt.type === "assign") {
          childEnv.set(stmt.name, ev.evalExpr(stmt.expr));
        }
      }
    }
    return result.polygons.length > 0 ? result : null;
  }

  // ─── Helper methods ─────────────────────────────────────────────────

  private evalChildrenGeometry(children: ASTNode[]): CSG | null {
    let result = new CSG();
    for (const child of children) {
      if (child.type === "module_call") {
        const csg = this.evalModuleCall(child);
        if (csg) {
          // Propagate 2D polygon data
          if ((csg as any).__polygon2d && result.polygons.length === 0 && !(result as any).__polygon2d) {
            (result as any).__polygon2d = (csg as any).__polygon2d;
          } else if (csg.polygons.length > 0) {
            result = result.union(csg);
          }
        }
      } else if (child.type === "if_stmt") {
        const csg = this.evalIfGeometry(child);
        if (csg) result = result.union(csg);
      } else if (child.type === "for_loop") {
        const csg = this.evalForGeometry(child);
        if (csg) result = result.union(csg);
      } else if (child.type === "assign") {
        this.env.set(child.name, this.evalExpr(child.expr));
      }
    }
    return result.polygons.length > 0 || (result as any).__polygon2d ? result : null;
  }

  private evalChildrenList(children: ASTNode[]): CSG[] {
    const list: CSG[] = [];
    for (const child of children) {
      if (child.type === "module_call") {
        const csg = this.evalModuleCall(child);
        if (csg) list.push(csg);
      } else if (child.type === "if_stmt") {
        const csg = this.evalIfGeometry(child);
        if (csg) list.push(csg);
      } else if (child.type === "for_loop") {
        const csg = this.evalForGeometry(child);
        if (csg) list.push(csg);
      }
    }
    return list;
  }

  private evalChildren2D(children: ASTNode[]): number[][] {
    const child = this.evalChildrenGeometry(children);
    if (child && (child as any).__polygon2d) {
      return (child as any).__polygon2d as number[][];
    }
    return [];
  }

  private linearExtrudePolygon(pts: number[][], height: number, twist: number, center: boolean, slices: number): CSG {
    const zOffset = center ? -height / 2 : 0;
    const csg = new CSG();
    const twistRad = twist * Math.PI / 180;
    const nSlices = Math.max(1, slices);

    for (let s = 0; s < nSlices; s++) {
      const t0 = s / nSlices;
      const t1 = (s + 1) / nSlices;
      const z0 = zOffset + height * t0;
      const z1 = zOffset + height * t1;
      const a0 = twistRad * t0;
      const a1 = twistRad * t1;

      const transformPoint = (p: number[], z: number, angle: number): Vec3 => {
        const x = p[0] * Math.cos(angle) - p[1] * Math.sin(angle);
        const y = p[0] * Math.sin(angle) + p[1] * Math.cos(angle);
        return new Vec3(x, y, z);
      };

      for (let i = 0; i < pts.length; i++) {
        const i2 = (i + 1) % pts.length;
        const p0 = pts[i];
        const p1 = pts[i2];

        const v00 = transformPoint(p0, z0, a0);
        const v10 = transformPoint(p1, z0, a0);
        const v01 = transformPoint(p0, z1, a1);
        const v11 = transformPoint(p1, z1, a1);

        // Side quad as two triangles
        const n1 = v10.minus(v00).cross(v01.minus(v00)).unit();
        if (n1.length() > 0.001) {
          csg.polygons.push(new Polygon([
            new Vertex(v00, n1),
            new Vertex(v10, n1),
            new Vertex(v11, n1),
            new Vertex(v01, n1),
          ]));
        }
      }

      // Bottom cap (first slice only)
      if (s === 0) {
        const bottomVerts = pts.map(p => transformPoint(p, z0, a0));
        const bn = new Vec3(0, 0, -1);
        if (bottomVerts.length >= 3) {
          csg.polygons.push(new Polygon(
            bottomVerts.reverse().map(pos => new Vertex(pos, bn))
          ));
        }
      }

      // Top cap (last slice only)
      if (s === nSlices - 1) {
        const topVerts = pts.map(p => transformPoint(p, z1, a1));
        const tn = new Vec3(0, 0, 1);
        if (topVerts.length >= 3) {
          csg.polygons.push(new Polygon(
            topVerts.map(pos => new Vertex(pos, tn))
          ));
        }
      }
    }

    return csg;
  }

  private offsetPolygon(pts: number[][], r: number): number[][] {
    if (Math.abs(r) < 1e-10 || pts.length < 3) return pts;

    // Simple offset: move each edge inward/outward by r
    const result: number[][] = [];
    const n = pts.length;

    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const curr = pts[i];
      const next = pts[(i + 1) % n];

      // Edge normals
      const dx1 = curr[0] - prev[0], dy1 = curr[1] - prev[1];
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1;
      const nx1 = -dy1 / len1, ny1 = dx1 / len1;

      const dx2 = next[0] - curr[0], dy2 = next[1] - curr[1];
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1;
      const nx2 = -dy2 / len2, ny2 = dx2 / len2;

      // Average normal
      const ax = (nx1 + nx2) / 2, ay = (ny1 + ny2) / 2;
      const alen = Math.sqrt(ax * ax + ay * ay) || 1;

      result.push([
        curr[0] + r * ax / alen,
        curr[1] + r * ay / alen,
      ]);
    }
    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2D CONVEX HULL — for projection() and other 2D operations
// ═══════════════════════════════════════════════════════════════════════════════

function convexHull2D(points: number[][]): number[][] {
  if (points.length < 3) return points;
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const n = sorted.length;
  function cross2d(o: number[], a: number[], b: number[]): number {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  }
  const lower: number[][] = [];
  for (let i = 0; i < n; i++) {
    while (lower.length >= 2 && cross2d(lower[lower.length - 2], lower[lower.length - 1], sorted[i]) <= 0) lower.pop();
    lower.push(sorted[i]);
  }
  const upper: number[][] = [];
  for (let i = n - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross2d(upper[upper.length - 2], upper[upper.length - 1], sorted[i]) <= 0) upper.pop();
    upper.push(sorted[i]);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEGMENT FONT FOR text() — Generates 2D polygon outlines for characters
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bitmap-segment font: each character is defined as a list of polygons
 * (closed paths of 2D points). Coordinates are normalized to a 0-1 unit cell
 * and scaled by fontSize at render time.
 */
const GLYPH_DATA: Record<string, number[][][]> = {
  // Each glyph: array of polygons, each polygon: array of [x, y] points (0-1 range)
  "A": [[[0,0],[0.5,1],[0.6,1],[1,0],[0.8,0],[0.65,0.38],[0.35,0.38],[0.2,0],[0,0]], [[0.4,0.5],[0.6,0.5],[0.55,0.62],[0.45,0.62]]],
  "B": [[[0,0],[0,1],[0.6,1],[0.75,0.9],[0.75,0.6],[0.6,0.55],[0.7,0.45],[0.7,0.1],[0.55,0],[0,0]], [[0.2,0.15],[0.5,0.15],[0.5,0.4],[0.2,0.4]], [[0.2,0.6],[0.55,0.6],[0.55,0.85],[0.2,0.85]]],
  "C": [[[0.8,0.15],[0.6,0],[0.3,0],[0.1,0.15],[0,0.35],[0,0.65],[0.1,0.85],[0.3,1],[0.6,1],[0.8,0.85],[0.8,0.7],[0.6,0.7],[0.6,0.8],[0.4,0.85],[0.25,0.75],[0.2,0.6],[0.2,0.4],[0.25,0.25],[0.4,0.15],[0.6,0.2],[0.6,0.3],[0.8,0.3]]],
  "D": [[[0,0],[0,1],[0.55,1],[0.75,0.85],[0.85,0.65],[0.85,0.35],[0.75,0.15],[0.55,0]], [[0.2,0.2],[0.5,0.2],[0.6,0.3],[0.65,0.45],[0.65,0.55],[0.6,0.7],[0.5,0.8],[0.2,0.8]]],
  "E": [[[0,0],[0,1],[0.75,1],[0.75,0.8],[0.2,0.8],[0.2,0.6],[0.6,0.6],[0.6,0.4],[0.2,0.4],[0.2,0.2],[0.75,0.2],[0.75,0]]],
  "F": [[[0,0],[0,1],[0.75,1],[0.75,0.8],[0.2,0.8],[0.2,0.55],[0.6,0.55],[0.6,0.35],[0.2,0.35],[0.2,0]]],
  "G": [[[0.8,0.15],[0.6,0],[0.3,0],[0.1,0.15],[0,0.35],[0,0.65],[0.1,0.85],[0.3,1],[0.6,1],[0.8,0.85],[0.8,0.45],[0.5,0.45],[0.5,0.6],[0.6,0.6],[0.6,0.75],[0.45,0.85],[0.25,0.75],[0.2,0.6],[0.2,0.4],[0.25,0.25],[0.4,0.15],[0.6,0.2],[0.6,0.3],[0.8,0.3]]],
  "H": [[[0,0],[0,1],[0.2,1],[0.2,0.6],[0.6,0.6],[0.6,1],[0.8,1],[0.8,0],[0.6,0],[0.6,0.4],[0.2,0.4],[0.2,0]]],
  "I": [[[0.2,0],[0.2,1],[0.6,1],[0.6,0]]],
  "J": [[[0.6,1],[0.6,0.2],[0.5,0.05],[0.3,0],[0.1,0.05],[0,0.2],[0,0.35],[0.2,0.35],[0.2,0.25],[0.3,0.2],[0.4,0.25],[0.4,1]]],
  "K": [[[0,0],[0,1],[0.2,1],[0.2,0.55],[0.55,1],[0.8,1],[0.4,0.5],[0.8,0],[0.55,0],[0.2,0.4],[0.2,0]]],
  "L": [[[0,0],[0,1],[0.2,1],[0.2,0.2],[0.7,0.2],[0.7,0]]],
  "M": [[[0,0],[0,1],[0.2,1],[0.4,0.6],[0.6,1],[0.8,1],[0.8,0],[0.6,0],[0.6,0.65],[0.4,0.3],[0.2,0.65],[0.2,0]]],
  "N": [[[0,0],[0,1],[0.2,1],[0.6,0.35],[0.6,1],[0.8,1],[0.8,0],[0.6,0],[0.2,0.65],[0.2,0]]],
  "O": [[[0.3,0],[0.1,0.15],[0,0.35],[0,0.65],[0.1,0.85],[0.3,1],[0.5,1],[0.7,0.85],[0.8,0.65],[0.8,0.35],[0.7,0.15],[0.5,0]], [[0.35,0.2],[0.5,0.2],[0.6,0.35],[0.6,0.65],[0.5,0.8],[0.35,0.8],[0.2,0.65],[0.2,0.35]]],
  "P": [[[0,0],[0,1],[0.6,1],[0.8,0.85],[0.8,0.55],[0.6,0.4],[0.2,0.4],[0.2,0]], [[0.2,0.6],[0.55,0.6],[0.6,0.7],[0.6,0.8],[0.55,0.85],[0.2,0.85]]],
  "Q": [[[0.3,0],[0.1,0.15],[0,0.35],[0,0.65],[0.1,0.85],[0.3,1],[0.5,1],[0.7,0.85],[0.8,0.65],[0.8,0.35],[0.7,0.15],[0.5,0]], [[0.35,0.2],[0.5,0.2],[0.6,0.35],[0.6,0.65],[0.5,0.8],[0.35,0.8],[0.2,0.65],[0.2,0.35]], [[0.55,0.15],[0.75,0],[0.85,0],[0.65,0.25]]],
  "R": [[[0,0],[0,1],[0.6,1],[0.8,0.85],[0.8,0.55],[0.65,0.45],[0.8,0],[0.6,0],[0.45,0.4],[0.2,0.4],[0.2,0]], [[0.2,0.6],[0.55,0.6],[0.6,0.7],[0.6,0.8],[0.55,0.85],[0.2,0.85]]],
  "S": [[[0.1,0.1],[0.3,0],[0.6,0],[0.8,0.1],[0.8,0.35],[0.65,0.5],[0.2,0.5],[0.1,0.6],[0.1,0.85],[0.3,1],[0.6,1],[0.8,0.9],[0.8,0.7],[0.6,0.7],[0.55,0.85],[0.35,0.85],[0.3,0.75],[0.3,0.65],[0.6,0.65],[0.6,0.5],[0.7,0.4],[0.6,0.3],[0.6,0.2],[0.45,0.15],[0.3,0.15],[0.3,0.3],[0.1,0.3]]],
  "T": [[[0,0.8],[0,1],[0.8,1],[0.8,0.8],[0.5,0.8],[0.5,0],[0.3,0],[0.3,0.8]]],
  "U": [[[0,0.3],[0,1],[0.2,1],[0.2,0.3],[0.25,0.15],[0.4,0.1],[0.55,0.15],[0.6,0.3],[0.6,1],[0.8,1],[0.8,0.3],[0.7,0.1],[0.5,0],[0.3,0],[0.1,0.1]]],
  "V": [[[0,1],[0.2,1],[0.4,0.25],[0.6,1],[0.8,1],[0.5,0],[0.3,0]]],
  "W": [[[0,1],[0.15,1],[0.25,0.35],[0.4,0.8],[0.5,0.8],[0.6,0.35],[0.7,1],[0.85,1],[0.85,0],[0.7,0],[0.5,0.55],[0.35,0],[0.15,0]]],
  "X": [[[0,0],[0.3,0.45],[0,1],[0.2,1],[0.4,0.6],[0.6,1],[0.8,1],[0.5,0.45],[0.8,0],[0.6,0],[0.4,0.35],[0.2,0]]],
  "Y": [[[0,1],[0.2,1],[0.4,0.55],[0.6,1],[0.8,1],[0.5,0.35],[0.5,0],[0.3,0],[0.3,0.35]]],
  "Z": [[[0,0],[0,0.2],[0.55,0.8],[0,0.8],[0,1],[0.8,1],[0.8,0.8],[0.25,0.2],[0.8,0.2],[0.8,0]]],
  // Lowercase (simplified — use uppercase scaled down)
  // Digits
  "0": [[[0.2,0],[0.05,0.2],[0,0.5],[0.05,0.8],[0.2,1],[0.6,1],[0.75,0.8],[0.8,0.5],[0.75,0.2],[0.6,0]], [[0.3,0.2],[0.5,0.2],[0.6,0.4],[0.6,0.6],[0.5,0.8],[0.3,0.8],[0.2,0.6],[0.2,0.4]]],
  "1": [[[0.2,0],[0.2,0.2],[0.3,0.2],[0.3,0.85],[0.15,0.75],[0.15,0.95],[0.3,1],[0.5,1],[0.5,0.2],[0.6,0.2],[0.6,0]]],
  "2": [[[0,0],[0,0.2],[0.5,0.55],[0.6,0.65],[0.6,0.75],[0.5,0.85],[0.3,0.85],[0.2,0.75],[0.2,0.65],[0,0.65],[0,0.8],[0.15,0.95],[0.35,1],[0.6,1],[0.8,0.85],[0.8,0.6],[0.7,0.45],[0.2,0.2],[0.8,0.2],[0.8,0]]],
  "3": [[[0,0.15],[0.15,0],[0.55,0],[0.75,0.1],[0.8,0.3],[0.7,0.48],[0.55,0.5],[0.7,0.55],[0.8,0.7],[0.75,0.9],[0.55,1],[0.15,1],[0,0.85],[0,0.7],[0.2,0.7],[0.3,0.8],[0.5,0.8],[0.6,0.7],[0.55,0.6],[0.4,0.55],[0.4,0.45],[0.55,0.42],[0.6,0.3],[0.5,0.2],[0.3,0.2],[0.2,0.3],[0,0.3]]],
  "4": [[[0.5,0],[0.5,0.35],[0,0.35],[0,0.55],[0.5,0.55],[0.5,1],[0.7,1],[0.7,0.55],[0.85,0.55],[0.85,0.35],[0.7,0.35],[0.7,0]], [[0.2,0.55],[0.5,0.55],[0.5,0.8],[0.2,0.55]]],
  "5": [[[0.05,0],[0.05,0.2],[0.4,0.2],[0.55,0.3],[0.6,0.4],[0.55,0.5],[0.4,0.55],[0.2,0.55],[0.2,0.6],[0,0.6],[0,1],[0.7,1],[0.7,0.8],[0.2,0.8],[0.2,0.65],[0.45,0.65],[0.7,0.55],[0.8,0.4],[0.8,0.2],[0.65,0.05],[0.4,0]]],
  "6": [[[0.65,0.85],[0.55,1],[0.25,1],[0.1,0.85],[0,0.65],[0,0.2],[0.1,0.05],[0.3,0],[0.55,0],[0.7,0.1],[0.8,0.3],[0.7,0.5],[0.55,0.55],[0.2,0.55],[0.2,0.6],[0.25,0.8],[0.45,0.85]], [[0.2,0.2],[0.2,0.4],[0.45,0.4],[0.6,0.3],[0.55,0.2],[0.4,0.15],[0.25,0.2]]],
  "7": [[[0,0.8],[0,1],[0.8,1],[0.8,0.8],[0.45,0],[0.25,0],[0.6,0.8]]],
  "8": [[[0.2,0],[0.05,0.12],[0,0.3],[0.05,0.45],[0.15,0.5],[0.05,0.55],[0,0.7],[0.05,0.88],[0.2,1],[0.6,1],[0.75,0.88],[0.8,0.7],[0.75,0.55],[0.65,0.5],[0.75,0.45],[0.8,0.3],[0.75,0.12],[0.6,0]], [[0.3,0.2],[0.5,0.2],[0.55,0.3],[0.5,0.42],[0.3,0.42],[0.25,0.3]], [[0.3,0.58],[0.5,0.58],[0.58,0.7],[0.5,0.82],[0.3,0.82],[0.22,0.7]]],
  "9": [[[0.15,0.15],[0.25,0],[0.55,0],[0.7,0.15],[0.8,0.35],[0.8,0.8],[0.7,0.95],[0.5,1],[0.25,1],[0.1,0.9],[0,0.7],[0.1,0.5],[0.25,0.45],[0.6,0.45],[0.6,0.4],[0.55,0.2],[0.35,0.15]], [[0.6,0.6],[0.6,0.8],[0.35,0.8],[0.2,0.7],[0.25,0.6],[0.4,0.58]]],
  // Punctuation
  ".": [[[0.3,0],[0.3,0.15],[0.5,0.15],[0.5,0]]],
  ",": [[[0.3,0],[0.3,0.15],[0.5,0.15],[0.5,0.05],[0.4,-0.1],[0.3,-0.05]]],
  "!": [[[0.3,0],[0.3,0.15],[0.5,0.15],[0.5,0]], [[0.3,0.3],[0.3,1],[0.5,1],[0.5,0.3]]],
  "?": [[[0.3,0],[0.3,0.15],[0.5,0.15],[0.5,0]], [[0.3,0.3],[0.3,0.45],[0.45,0.55],[0.55,0.65],[0.55,0.75],[0.45,0.85],[0.25,0.85],[0.15,0.75],[0.15,0.65],[0,0.65],[0,0.85],[0.15,0.95],[0.3,1],[0.55,1],[0.75,0.85],[0.75,0.6],[0.6,0.45],[0.5,0.35],[0.5,0.3]]],
  "-": [[[0.15,0.4],[0.15,0.55],[0.65,0.55],[0.65,0.4]]],
  "+": [[[0.3,0.3],[0.3,0.45],[0.15,0.45],[0.15,0.55],[0.3,0.55],[0.3,0.7],[0.5,0.7],[0.5,0.55],[0.65,0.55],[0.65,0.45],[0.5,0.45],[0.5,0.3]]],
  "=": [[[0.15,0.3],[0.15,0.42],[0.65,0.42],[0.65,0.3]], [[0.15,0.55],[0.15,0.67],[0.65,0.67],[0.65,0.55]]],
  "(": [[[0.5,0],[0.3,0.15],[0.2,0.35],[0.2,0.65],[0.3,0.85],[0.5,1],[0.6,1],[0.4,0.85],[0.35,0.65],[0.35,0.35],[0.4,0.15],[0.6,0]]],
  ")": [[[0.3,0],[0.5,0.15],[0.55,0.35],[0.55,0.65],[0.5,0.85],[0.3,1],[0.2,1],[0.4,0.85],[0.45,0.65],[0.45,0.35],[0.4,0.15],[0.2,0]]],
  "[": [[[0.2,0],[0.2,1],[0.6,1],[0.6,0.85],[0.35,0.85],[0.35,0.15],[0.6,0.15],[0.6,0]]],
  "]": [[[0.2,0],[0.2,0.15],[0.45,0.15],[0.45,0.85],[0.2,0.85],[0.2,1],[0.6,1],[0.6,0]]],
  "/": [[[0.1,0],[0.55,1],[0.7,1],[0.25,0]]],
  ":": [[[0.3,0],[0.3,0.15],[0.5,0.15],[0.5,0]], [[0.3,0.45],[0.3,0.6],[0.5,0.6],[0.5,0.45]]],
  " ": [],
  "_": [[[0,0],[0,0.12],[0.8,0.12],[0.8,0]]],
  // Extended – symbols
  "#": [[[0.15,0.2],[0.15,0.35],[0.05,0.35],[0.05,0.45],[0.15,0.45],[0.15,0.6],[0.05,0.6],[0.05,0.7],[0.15,0.7],[0.15,0.85],[0.25,0.85],[0.25,0.7],[0.45,0.7],[0.45,0.85],[0.55,0.85],[0.55,0.7],[0.65,0.7],[0.65,0.6],[0.55,0.6],[0.55,0.45],[0.65,0.45],[0.65,0.35],[0.55,0.35],[0.55,0.2],[0.45,0.2],[0.45,0.35],[0.25,0.35],[0.25,0.2]]],
  "%": [[[0.1,0],[0.6,1],[0.7,1],[0.2,0]], [[0.1,0.7],[0.1,0.9],[0.25,0.9],[0.25,0.7]], [[0.55,0.1],[0.55,0.3],[0.7,0.3],[0.7,0.1]]],
  "*": [[[0.3,0.4],[0.35,0.55],[0.2,0.65],[0.25,0.7],[0.4,0.6],[0.4,0.75],[0.5,0.75],[0.5,0.6],[0.65,0.7],[0.7,0.65],[0.55,0.55],[0.6,0.4],[0.5,0.4],[0.45,0.5],[0.4,0.4]]],
  "^": [[[0.2,0.6],[0.4,0.9],[0.6,0.6],[0.5,0.6],[0.4,0.75],[0.3,0.6]]],
  "~": [[[0.1,0.45],[0.2,0.55],[0.35,0.55],[0.45,0.45],[0.55,0.45],[0.65,0.55],[0.65,0.45],[0.55,0.35],[0.4,0.35],[0.3,0.45],[0.2,0.45],[0.1,0.35]]],
  "{": [[[0.5,0],[0.4,0.05],[0.35,0.15],[0.35,0.4],[0.25,0.5],[0.35,0.6],[0.35,0.85],[0.4,0.95],[0.5,1],[0.55,1],[0.45,0.9],[0.45,0.6],[0.35,0.5],[0.45,0.4],[0.45,0.1],[0.55,0]]],
  "}": [[[0.25,0],[0.35,0.1],[0.35,0.4],[0.45,0.5],[0.35,0.6],[0.35,0.9],[0.25,1],[0.2,1],[0.3,0.95],[0.3,0.6],[0.45,0.5],[0.3,0.4],[0.3,0.05],[0.2,0]]],
  "<": [[[0.6,0.2],[0.2,0.5],[0.6,0.8],[0.65,0.7],[0.35,0.5],[0.65,0.3]]],
  ">": [[[0.2,0.2],[0.6,0.5],[0.2,0.8],[0.15,0.7],[0.45,0.5],[0.15,0.3]]],
  "\\": [[[0.1,1],[0.25,1],[0.7,0],[0.55,0]]],
  "|": [[[0.35,0],[0.35,1],[0.45,1],[0.45,0]]],
  "'": [[[0.35,0.7],[0.35,1],[0.45,1],[0.45,0.7]]],
  ";": [[[0.3,0.45],[0.3,0.6],[0.5,0.6],[0.5,0.45]], [[0.3,0],[0.3,0.15],[0.5,0.15],[0.5,0.05],[0.4,-0.1],[0.3,-0.05]]],
  "@": [[[0.7,0.3],[0.55,0.2],[0.35,0.2],[0.15,0.35],[0.1,0.55],[0.15,0.75],[0.3,0.9],[0.55,0.9],[0.7,0.8],[0.75,0.6],[0.7,0.4],[0.6,0.35],[0.5,0.45],[0.5,0.6],[0.55,0.7],[0.45,0.75],[0.3,0.7],[0.25,0.55],[0.3,0.4],[0.45,0.35],[0.6,0.4]]],
  "$": [[[0.35,0],[0.35,0.1],[0.2,0.15],[0.1,0.3],[0.2,0.45],[0.35,0.5],[0.55,0.55],[0.6,0.65],[0.6,0.75],[0.5,0.85],[0.45,0.9],[0.45,1],[0.35,1],[0.35,0.9],[0.55,0.8],[0.65,0.65],[0.55,0.5],[0.35,0.45],[0.2,0.4],[0.15,0.3],[0.2,0.2],[0.35,0.15],[0.45,0.15],[0.45,0]]],
  "&": [[[0.7,0],[0.45,0.25],[0.25,0.1],[0.1,0.2],[0.1,0.35],[0.2,0.45],[0.1,0.6],[0.1,0.8],[0.2,0.95],[0.4,1],[0.55,0.95],[0.6,0.8],[0.5,0.6],[0.35,0.5],[0.55,0.3],[0.8,0]]],
};

/**
 * Get character polygons scaled to fontSize. Returns array of polygons
 * (each polygon is an array of [x, y] points).
 */
function getCharPolygons(ch: string, fontSize: number): number[][][] {
  const upper = ch.toUpperCase();
  const glyphPolys = GLYPH_DATA[upper] || GLYPH_DATA[ch];
  if (!glyphPolys || glyphPolys.length === 0) return [];

  return glyphPolys.map(poly =>
    poly.map(p => [p[0] * fontSize * 0.7, p[1] * fontSize])
  );
}

/**
 * Convert a text string to a combined 2D polygon (for parent linear_extrude).
 * Returns the outline points of the first character for simple cases.
 */
function textToPolygon2D(
  text: string,
  fontSize: number,
  halign: string,
  valign: string,
  spacing: number,
): number[][] {
  // For simple use as child of linear_extrude, return the first char outline
  const charWidth = fontSize * 0.7 * spacing;
  let xOff = 0;
  const totalWidth = text.length * charWidth;
  if (halign === "center") xOff = -totalWidth / 2;
  else if (halign === "right") xOff = -totalWidth;

  let yOff = 0;
  if (valign === "center") yOff = -fontSize / 2;
  else if (valign === "top") yOff = -fontSize;

  // Combine all characters into a single bounding box polygon
  // (simplified: returns the bounding rectangle)
  const allPts: number[][] = [];
  for (let ci = 0; ci < text.length; ci++) {
    const ch = text[ci];
    const polys = getCharPolygons(ch, fontSize);
    for (const poly of polys) {
      for (const pt of poly) {
        allPts.push([pt[0] + xOff + ci * charWidth, pt[1] + yOff]);
      }
    }
  }

  if (allPts.length < 3) return [];

  // Return the first character's first polygon (most common use case)
  const firstPolys = getCharPolygons(text[0]?.toUpperCase() || "A", fontSize);
  if (firstPolys.length > 0) {
    return firstPolys[0].map(p => [p[0] + xOff, p[1] + yOff]);
  }

  return allPts;
}
