const code = `

var u: number = 10;

function add(a: number = 7, b: number): number {
  return a + b;
}

function multiply(a: number, b: number): number {
  return a * b;
}

function main() {
  let x = 5, w: number = 10;
  const y = 10;
  const {a, d} = { a: 1, d: 2 };
  x = 20;
  const z = w + u;
  const sum = add(x, y);
  const product = multiply(x, y);
  
  return add(sum, product);
}

main();
`;

const codeFunctionParam = `

function add(a: number = 7, b: number): number {
  return a + b;
}

function multiply(a: number, b: number): number {
  return a * b;
}

function addAndMultiply(multiply: (a: number, b: number) => number, add: (a: number, b: number) => number): number {
  const x = 5;
  const y = 10;
  const sum = add(x, y);
  const product = multiply(x, y);
  return add(sum, product);
}

function main() {
  return addAndMultiply(multiply, add);
}

main();
`;

const nestedCode = `
function outerFunction(a: number) {
  function innerFunction(b: number) {
    return a + b;
  }

  return innerFunction(5);
}
outerFunction(10);

`;

const assignmentSimple = `
function returnValue() {
  return 42;
}

function simpleAssignment() {
  let x = 0;
  x = 42 + returnValue() + returnValue();
  return x;
}
`;

const assignmentCompoundArithmetic = `
function compoundArithmetic() {
  let x = 100;
  x += 10;
  x -= 5;
  x *= 2;
  x /= 3;
  x %= 7;
  x **= 2;
  return x;
}
`;

const assignmentCompoundBitwise = `
function compoundBitwise() {
  let x = 255;
  x &= 0xFF;
  x |= 0x01;
  x ^= 0x10;
  x <<= 1;
  x >>= 1;
  x >>>= 1;
  return x;
}
`;

const assignmentCompoundLogical = `
function compoundLogical() {
  let a: number | null = null;
  a ??= 99;
  let flag = false;
  flag ||= true;
  flag &&= false;
  return { a, flag };
}
`;

const assignmentMemberExpression = `
function memberExpressionAssignment() {
  const obj = { prop: 0, nested: { value: 0 } };
  obj.prop = 5;
  obj.nested.value = 10;
  return obj;
}
`;

const assignmentComputedMember = `
function computedMemberAssignment() {
  const map: Record<string, number> = {};
  map["key"] = 1;
  return map;
}
`;

const assignmentArrayPattern = `
function arrayPatternAssignment() {
  let b = 0, c = 0;
  [b, c] = [1, 2];
  return { b, c };
}
`;

const assignmentObjectPattern = `
function objectPatternAssignment() {
  let p = 0, q = 0;
  ({ p, q } = { p: 3, q: 4 });
  return { p, q };
}
`;

export {
  code,
  nestedCode,
  assignmentSimple,
  assignmentCompoundArithmetic,
  assignmentCompoundBitwise,
  assignmentCompoundLogical,
  assignmentMemberExpression,
  assignmentComputedMember,
  assignmentArrayPattern,
  assignmentObjectPattern,
};
