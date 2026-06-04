const code = `

var u: number = 10;

function add(a: number = 7, b: number): number {
  return a + b;
}

function multiply(a: number, b: number): number {
  return a * b;
}

function main() {
  const x = 5, w: number = 10;
  const y = 10;
  const {a, d} = { a: 1, d: 2 };
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

export { code, nestedCode };
