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
  function innerFunction(b: number): number {
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

const assignmentObjectPattern = `
function objectPatternAssignment() {
  let p = 0, q = 0;
  ({ p, q } = { p: 3, q: 4 });
  return { p, q };
}
`;

const codeComplex = `
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

const switchCaseCode = `
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

const ifStatementCode = `
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

const loopCode = `
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

const tryCatchThrowCode = `
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
  codeComplex,
  switchCaseCode,
  ifStatementCode,
  loopCode,
  tryCatchThrowCode,
};
