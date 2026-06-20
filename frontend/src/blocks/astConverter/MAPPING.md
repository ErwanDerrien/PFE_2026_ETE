# Object → Babel AST Node Mapping

For each interface in our structured object, the corresponding Babel AST node type.

---

## Statements

| Interface | `kind` | Babel AST Node |
|---|---|---|
| `VariableDeclaration` | `"variable-declaration"` | `VariableDeclaration` + `VariableDeclarator[]` |
| `AssignmentExpression` | `"assignment"` | `ExpressionStatement` > `AssignmentExpression` |
| `ReturnStatement` | `"return"` | `ReturnStatement` |
| `FunctionDeclaration` | `"function-declaration"` | `FunctionDeclaration` |
| `ExpressionStatement` | `"expression-statement"` | `ExpressionStatement` |
| `IfStatement` | `"if"` | `IfStatement` |
| `WhileStatement` | `"while"` | `WhileStatement` |
| `DoWhileStatement` | `"do-while"` | `DoWhileStatement` |
| `ForStatement` | `"for"` | `ForStatement` |
| `ForInStatement` | `"for-in"` | `ForInStatement` |
| `ForOfStatement` | `"for-of"` | `ForOfStatement` |
| `SwitchStatement` | `"switch"` | `SwitchStatement` |
| `ValueCase` | `"case"` | `SwitchCase` (with non-null `test`) |
| `DefaultCase` | `"default"` | `SwitchCase` (with `test: null`) |
| `TryStatement` | `"try"` | `TryStatement` |
| `CatchClause` | `"catch"` | `CatchClause` |
| `ThrowStatement` | `"throw"` | `ThrowStatement` |
| `BreakStatement` | `"break"` | `BreakStatement` |
| `ContinueStatement` | `"continue"` | `ContinueStatement` |
| `InterfaceDeclaration` | `"interface-declaration"` | `TSInterfaceDeclaration` |

---

## Values (expressions)

| Interface | `kind` | Babel AST Node |
|---|---|---|
| `Literal` | `"literal"` | `StringLiteral` / `NumericLiteral` / `BooleanLiteral` / `NullLiteral` |
| `VariableRef` | `"variable"` | `Identifier` |
| `PropertyAccess` | `"property"` | `MemberExpression` (computed: false) |
| `IndexAccess` | `"index"` | `MemberExpression` (computed: true) |
| `Call` | `"call"` | `CallExpression` |
| `NewCall` | `"new"` | `NewExpression` |
| `TaggedTemplate` | `"tagged-template"` | `TaggedTemplateExpression` |
| `BinaryOp` | `"binary"` | `BinaryExpression` or `LogicalExpression` |
| `UnaryOp` | `"unary"` | `UnaryExpression` or `UpdateExpression` |
| `Ternary` | `"ternary"` | `ConditionalExpression` |
| `FunctionValue` | `"function"` | `ArrowFunctionExpression` or `FunctionExpression` |
| `ArrayValue` | `"array"` | `ArrayExpression` |
| `ObjectValue` | `"object"` | `ObjectExpression` |
| `TemplateString` | `"template"` | `TemplateLiteral` |
| `Await` | `"await"` | `AwaitExpression` |
| `Yield` | `"yield"` | `YieldExpression` |
| `SpreadArg` | `"spread-arg"` | `SpreadElement` |

---

## Binding & Assignment Targets

| Interface | `kind` | Babel AST Node |
|---|---|---|
| `VariableTarget` | `"variable"` | `Identifier` |
| `PropertyTarget` | `"property"` | `MemberExpression` (computed: false) |
| `IndexTarget` | `"index"` | `MemberExpression` (computed: true) |
| `ArrayDestructure` | `"array-destructure"` | `ArrayPattern` |
| `ObjectDestructure` | `"object-destructure"` | `ObjectPattern` |
| `DestructuredProp` | `"prop"` | `ObjectProperty` (inside `ObjectPattern`) |
| `DefaultedTarget` | `"defaulted"` | `AssignmentPattern` (inside `ArrayPattern`) |
| `Rest` | `"rest"` | `RestElement` |

---

## Parameters

| Interface | `kind` | Babel AST Node |
|---|---|---|
| `SimpleParam` | `"param"` | `Identifier` |
| `DefaultParam` | `"default-param"` | `AssignmentPattern` |
| `DestructuredParam` | `"destructured-param"` | `ArrayPattern` or `ObjectPattern` |
| `RestParam` | `"rest-param"` | `RestElement` |

---

## Type Annotations

| Interface | `kind` | Babel AST Node |
|---|---|---|
| `PrimitiveType` | `"primitive"` | `TSStringKeyword` / `TSNumberKeyword` / `TSBooleanKeyword` / `TSBigIntKeyword` / `TSSymbolKeyword` / `TSNullKeyword` / `TSUndefinedKeyword` / `TSVoidKeyword` / `TSNeverKeyword` / `TSAnyKeyword` / `TSUnknownKeyword` |
| `LiteralType` | `"literal-type"` | `TSLiteralType` |
| `UnionType` | `"union"` | `TSUnionType` |
| `IntersectionType` | `"intersection"` | `TSIntersectionType` |
| `ArrayType` | `"array"` | `TSArrayType` |
| `TupleType` | `"tuple"` | `TSTupleType` |
| `ObjectType` | `"object"` | `TSTypeLiteral` |
| `FunctionType` | `"function"` | `TSFunctionType` |
| `GenericType` | `"generic"` | `TSTypeReference` + `TSTypeParameterInstantiation` |
| `TypeReference` | `"type-reference"` | `TSTypeReference` |
| `TypeParam` | _(no kind)_ | `TSTypeParameter` (inside `TSTypeParameterDeclaration`) |

---

## Interface Members

| Interface | `kind` | Babel AST Node |
|---|---|---|
| `PropertySignature` | `"property-signature"` | `TSPropertySignature` |
| `MethodSignature` | `"method-signature"` | `TSMethodSignature` |
| `IndexSignature` | `"index-signature"` | `TSIndexSignature` |
| `CallSignature` | `"call-signature"` | `TSCallSignatureDeclaration` |
| `ConstructSignature` | `"construct-signature"` | `TSConstructSignatureDeclaration` |

---

## Structural wrappers

| Interface | Babel AST Node |
|---|---|
| `Block` | `BlockStatement` |
| `FunctionDeclaration` (global `<global>`) | `Program` |
| `VariableDeclarator` | `VariableDeclarator` |
