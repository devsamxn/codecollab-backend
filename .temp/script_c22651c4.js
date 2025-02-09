function factorial(n) {
    if (n === 0 || n === 1) return 1;
    return n * factorial(n - 1);
}

console.log("Starting factorial calculations...");
let result = factorial(50000);
console.log("Factorial computation completed!");
