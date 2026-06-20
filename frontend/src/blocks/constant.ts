export const code = `

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

export const codeFunctionParam = `

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

export const nestedCode = `
function outerFunction(a: number) {
  function innerFunction(b: number): number {
    return a + b;
  }

  return innerFunction(5);
}
outerFunction(10);

`;

export const assignmentSimple = `
function returnValue() {
  return 42;
}

function simpleAssignment() {
  let x = 0;
  x = 42 + returnValue() + returnValue();
  return x;
}
`;

export const assignmentCompoundArithmetic = `
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

export const assignmentCompoundBitwise = `
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

export const assignmentCompoundLogical = `
function compoundLogical() {
  let a: number | null = null;
  a ??= 99;
  let flag = false;
  flag ||= true;
  flag &&= false;
  return { a, flag };
}
`;

export const assignmentMemberExpression = `
function memberExpressionAssignment() {
  const obj = { prop: 0, nested: { value: 0 } };
  obj.prop = 5;
  obj.nested.value = 10;
  return obj;
}
`;

export const assignmentComputedMember = `
function computedMemberAssignment() {
  const map: Record<string, number> = {};
  const obj = { prop: 0, nested: { value: 0 } };
  obj["prop"] = 5;
  obj["nested"]["value"] = 10;
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

export const assignmentObjectPattern = `
function objectPatternAssignment() {
  let p = 0, q = 0;
  ({ p, q } = { p: 3, q: 4 });
  return { p, q };
}
`;

export const codeComplex = `
var globalMultiplier: number = 2;

function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

function makeCounter(start: number) {
  let count = start;
  function increment(step: number): number {
    count += step;
    return count;
  }
  function reset(): number {
    count = start;
    return count;
  }
  return { increment, reset };
}

function memoize(fn: (n: number) => number): (n: number) => number {
  const cache: Record<number, number> = {};
  function memoized(n: number): number {
    if (cache[n] !== undefined) return cache[n];
    cache[n] = fn(n);
    return cache[n];
  }
  return memoized;
}

function makeRectangle(width: number, height: number) {
  const area = width * height;
  const perimeter = 2 * (width + height);
  function scale(factor: number) {
    return makeRectangle(width * factor, height * factor);
  }
  return { area, perimeter, scale };
}

function sumFibSequence(memoFib: (n: number) => number): number {
  const f1 = memoFib(1);
  const f2 = memoFib(2);
  const f3 = memoFib(3);
  const f4 = memoFib(4);
  const f5 = memoFib(5);
  return f1 + f2 + f3 + f4 + f5;
}

function main(): number {
  const memoFib = memoize(fibonacci);

  const fib5 = memoFib(5);
  const fib10 = memoFib(10);

  const counter = makeCounter(0);
  const a = counter.increment(1);
  const b = counter.increment(2);
  const c = counter.reset();

  const rect = makeRectangle(10, 5);
  const scaled = rect.scale(globalMultiplier);
  const { area, perimeter } = scaled;

  const fibSum = sumFibSequence(memoFib);

  let result = fib5 + fib10;
  result += fibSum;
  result += area + perimeter;
  result += a + b + c;

  return result;
}

main();
`;

export const switchCaseCode = `
function classify(value: number): string {
  let category: string;
  let bonus: number = 0;

  switch (true) {
    case value < 0:
      category = "negative";
      bonus = value * 2;
      break;
    case value === 0:
      category = "zero";
      break;
    case value > 0 && value <= 10:
      category = "small";
      bonus = value + 1;
      break;
    case value > 10 && value <= 100:
      category = "medium";
      bonus = value * 3;
      break;
    default:
      category = "large";
      bonus = value - 50;
      break;
  }

  return category + ":" + bonus;
}

function describeStatus(code: number): string {
  switch (code) {
    case 200:
    case 201:
      return "success";
    case 400:
      return "bad request";
    case 401:
    case 403:
      return "unauthorized";
    case 404:
      return "not found";
    case 500:
      return "server error";
    default:
      return "unknown";
  }
}

classify(42);
describeStatus(404);
`;

export const ifStatementCode = `
function getDiscount(price: number, isMember: boolean, quantity: number): number {
  let discount = 0;

  if (price <= 0) {
    return 0;
  }

  if (isMember) {
    discount += 10;
  } else {
    discount += 0;
  }

  if (quantity >= 100) {
    discount += 20;
  } else if (quantity >= 50) {
    discount += 10;
  } else if (quantity >= 10) {
    discount += 5;
  } else {
    discount += 0;
  }

  if (isMember && quantity >= 50) {
    discount += 5;
  }

  return discount;
}

function classify(score: number): string {
  if (score >= 90) {
    return "A";
  } else if (score >= 80) {
    return "B";
  } else if (score >= 70) {
    return "C";
  } else if (score >= 60) {
    return "D";
  } else {
    return "F";
  }
}

getDiscount(200, true, 60);
classify(85);
`;

export const loopCode = `
function loops(items: number[], n: number): number {
  let total = 0;

  while (total < n) {
    total += 1;
    if (total === 3) continue;
    if (total > 100) break;
  }

  do {
    total -= 1;
  } while (total > 0);

  for (let i = 0; i < n; i++) {
    total += i;
  }

  for (let j = n; j > 0; j -= 1) {
    total += j;
  }

  for (const item of items) {
    total += item;
  }

  for (const key in items) {
    total += Number(key);
  }

  return total;
}

loops([1, 2, 3], 10);
`;

export const tryCatchThrowCode = `
function risky(value: number): number {
  if (value < 0) {
    throw new Error("negative");
  }
  return value * 2;
}

function safe(value: number): number {
  let result = 0;

  try {
    result = risky(value);
  } catch (e) {
    result = -1;
    throw e;
  } finally {
    result += 1;
  }

  return result;
}

safe(5);
`;

export const assignmentExpressionCode = `
function allAssignments() {
  let x = 0;

  x = 42;
  x += 10;
  x -= 5;
  x *= 2;
  x /= 4;
  x %= 7;
  x **= 2;

  x &= 0xFF;
  x |= 0x01;
  x ^= 0x10;
  x <<= 1;
  x >>= 1;
  x >>>= 1;

  let a: number | null = null;
  a ??= 99;
  let flag = false;
  flag ||= true;
  flag &&= false;

  const obj = { prop: 0, nested: { value: 0 } };
  obj.prop = 5;
  obj.nested.value = 10;
  obj.prop += 3;
  obj.nested.value -= 2;

  const map: Record<string, number> = {};
  const arr: number[] = [0, 0, 0];
  map["key"] = 1;
  map["key"] += 10;
  arr[0] = 7;
  arr[1] += 3;
  obj["prop"] = 5;
  obj["nested"]["value"] = 10;

  let b = 0, c = 0;
  [b, c] = [1, 2];

  let p = 0, q = 0;
  ({ p, q } = { p: 3, q: 4 });

  return { x, a, flag, obj, map, arr, b, c, p, q };
}
`;

export const variablesCode = `
const hello = 5;
let counter = 0;
var legacy = "old";

const name: string = "Alice";
let age: number = 30;
let isActive: boolean = true;

let maybeNull: string | null = null;
let maybeUndefined: number | undefined = undefined;

const pi = 3.14159;
const message = "hello world";
const flag = false;
const nothing = null;

let x = 1, y = 2, z = 3;
let a: number = 10, b: number = 20;

const coords: [number, number] = [42, 7];
const triple: [string, number, boolean] = ["ok", 1, true];

const scores: number[] = [10, 20, 30];
const tags: Array<string> = ["ts", "js"];

const user: { name: string; age: number } = { name: "Bob", age: 25 };

const [first, second] = [1, 2];
const [head, ...tail] = [10, 20, 30, 40];
const [p = 0, q = 0] = [5];

const { name: userName, age: userAge } = { name: "Carol", age: 28 };
const { x: ox = 0, y: oy = 0 } = { x: 3 };
const { a: fa, b: fb, ...rest } = { a: 1, b: 2, c: 3, d: 4 };

const nested: { id: number; meta: { label: string } } = {
  id: 1,
  meta: { label: "item" },
};
const { id, meta: { label } } = nested;

const square = (n: number): number => n * n;
const add = (a: number, b: number) => a + b;
const greet = (name: string) => \`Hello, \${name}!\`;

const greeting = \`Hi \${name}, you are \${age} years old\`;
const multiline = \`line one
line two
line three\`;

const MAX: number = 100;
const RATIO = 1 / 3;
const SUM = a + b;
const PRODUCT = x * y * z;
`;

