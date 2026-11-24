# JavaScript Essentials: From Execution Context to the Event Loop

A practical guide to how JavaScript runs code, manages function calls, and handles asynchronous work. Examples use modern JavaScript and can be tried in a browser console or a Node.js file.

## Contents

1. [A mental model for JavaScript](#a-mental-model-for-javascript)
2. [Values, variables, and functions](#values-variables-and-functions)
3. [Execution context](#execution-context)
4. [Creation and execution phases](#creation-and-execution-phases)
5. [Global context and the global object](#global-context-and-the-global-object)
6. [Hoisting and declaration behavior](#hoisting-and-declaration-behavior)
7. [Function calls and the call stack](#function-calls-and-the-call-stack)
8. [Lexical environments and the scope chain](#lexical-environments-and-the-scope-chain)
   - [Blocks and block scope](#blocks-and-block-scope)
   - [Shadowing and illegal shadowing](#shadowing-and-illegal-shadowing)
9. [Closures](#closures)
   - [How a closure works](#how-a-closure-works)
   - [Closures for private state](#closures-for-private-state)
   - [Closures in asynchronous callbacks](#closures-in-asynchronous-callbacks)
   - [Currying with closures](#currying-with-closures)
   - [Run a function only once](#run-a-function-only-once)
   - [Closures and memory](#closures-and-memory)
10. [Objects and prototypes](#objects-and-prototypes)
11. [Asynchronous JavaScript and the event loop](#asynchronous-javascript-and-the-event-loop)
12. [Promises and async/await](#promises-and-asyncawait)
13. [JavaScript iteration and array methods](#javascript-iteration-and-array-methods)
   - [Iteration fundamentals](#iteration-fundamentals)
   - [`forEach()` and callback control flow](#foreach-and-callback-control-flow)
   - [Synchronous and asynchronous iteration](#synchronous-and-asynchronous-iteration)
   - [Sequential execution with `for...of`](#sequential-execution-with-forof)
   - [Concurrent execution with `map()` and `Promise.all()`](#concurrent-execution-with-map-and-promiseall)
   - [Traditional `for` and `for...of`](#traditional-for-and-forof)
   - [`map()`, `filter()`, and `reduce()`](#map-filter-and-reduce)
   - [Combining array methods](#combining-array-methods)
   - [Comparing iteration approaches](#comparing-iteration-approaches)
   - [Async array-method pitfalls](#async-array-method-pitfalls)
   - [Promise utilities for batches](#promise-utilities-for-batches)
   - [Production guidance](#production-guidance-for-iteration)
   - [Interview questions and practice](#iteration-interview-questions-and-practice)
14. [Common misconceptions](#common-misconceptions)
15. [Practice exercises](#practice-exercises)
16. [Quick review](#quick-review)

## A mental model for JavaScript

JavaScript is a programming language with a **call stack**, **memory**, and a runtime environment. When code runs, the engine evaluates expressions and executes statements. The host environment—such as a browser or Node.js—provides additional capabilities like timers, network access, and user-interface events.

Two useful descriptions of JavaScript execution are:

- **Single-threaded execution of JavaScript code:** a given JavaScript agent normally runs one piece of JavaScript at a time on its thread.
- **Synchronous statement evaluation:** ordinary statements run in order; the current statement finishes before the next statement begins.

These descriptions do **not** mean that a browser or Node.js can do only one thing at a time. The host can perform work such as timers or network I/O while JavaScript is not running. Workers can also run JavaScript on separate threads. The event loop coordinates when queued JavaScript callbacks get a turn.

> **Learning model:** Execution-context diagrams are a useful way to reason about scope and function calls. They are teaching tools, not a literal drawing of every engine's internal memory layout.

## Values, variables, and functions

JavaScript values include primitives such as numbers, strings, booleans, `null`, `undefined`, `bigint`, and symbols, as well as objects and functions.

```js
const course = "JavaScript"; // string
let lessonCount = 3;         // number
const isPublished = true;    // boolean

function describeCourse(name) {
  return `Learning ${name}`;
}

console.log(describeCourse(course)); // Learning JavaScript
```

Use `const` by default when a binding will not be reassigned, and `let` when reassignment is needed. `const` prevents rebinding the variable; it does not make an object immutable.

```js
const learner = { name: "Sam" };
learner.name = "Alex"; // allowed: the object is still mutable
// learner = {};       // TypeError: cannot reassign a const binding
```

Functions are values. They can be assigned to variables, passed to other functions, and returned from functions.

```js
const add = function (left, right) {
  return left + right;
};

console.log(add(2, 3)); // 5
```

## Execution context

An **execution context** is the runtime environment used while JavaScript evaluates code. It tracks information needed for that code, including its bindings and the current execution state.

At a high level, an execution context can be pictured as:

```text
+--------------------------------------+
| Execution Context                    |
|                                      |
|  Environment: bindings and scope     |
|  State: current place in execution   |
+--------------------------------------+
```

This simplified view is often taught using two components:

1. **Memory / environment component:** names are associated with bindings and values.
2. **Execution / code component:** the engine evaluates statements and tracks where execution currently is.

When a script begins, the runtime establishes a **global execution context**. Calling a function creates a function execution context for that call. Modules and some other constructs have their own environment behavior as well.

```text
Program starts
      |
      v
Global execution context
      |
      +---- function call ----> Function execution context
```

The global context does not imply that every global variable becomes a property of the global object. That distinction depends on the environment and declaration form; for example, top-level `let` and `const` in a browser script do not behave exactly like top-level `var`.

## Creation and execution phases

A helpful teaching model separates evaluating a scope into two broad phases:

1. **Setup / declaration processing:** the environment establishes bindings for declarations.
2. **Statement execution:** expressions are evaluated, assignments happen, and function calls are made.

Consider:

```js
var score = 7;

function showScore() {
  console.log(score);
}

showScore();
```

Conceptually, before ordinary statements run, the current environment knows about the `var` binding `score` and the function declaration `showScore`. The function declaration can be called before its textual position because its binding is initialized during declaration processing.

For `var`, a simplified walkthrough is:

```text
Setup:
  score    -> undefined
  showScore -> function

Execution:
  score = 7
  call showScore()
  log score
```

The exact initialization rules differ by declaration type:

| Declaration | Scope | State before its declaration runs | Reassignment / redeclaration |
| --- | --- | --- | --- |
| `var` | Function-scoped, or global-script scoped | Initialized to `undefined` | Can be reassigned and redeclared in the same scope |
| `let` | Block-scoped | Uninitialized in the TDZ; access throws | Can be reassigned; cannot be redeclared in the same scope |
| `const` | Block-scoped | Uninitialized in the TDZ; access throws | Cannot be reassigned or redeclared in the same scope; initializer required |
| Function declaration | Enclosing scope (subject to block and module rules) | Usually initialized and callable before its declaration | Follow function declaration rules for that scope |
| Function expression / arrow function | Follows its variable declaration | Depends on `var`, `let`, or `const` binding state | Follows the variable declaration rules |

This model is often called **hoisting**, but code is not literally moved around. It is the result of how declarations and bindings are processed.

## Global context and the global object

The **global execution context** is established when a script or module starts. In a browser, the global object is commonly accessed as `globalThis` (and traditionally as `window` in a window context). In Node.js, the global object is `globalThis` (also available as `global`). These environments provide different host APIs and have different top-level declaration behavior.

```js
console.log(globalThis); // The current environment's global object
```

In a classic browser script, top-level `var` declarations generally create properties on `window`, while top-level `let` and `const` create global lexical bindings that are not `window` properties. ES modules are always strict-mode code and have module scope at the top level, rather than adding their top-level declarations to the global object.

```html
<script>
  var scriptVar = "var";
  let scriptLet = "let";

  console.log(window.scriptVar); // "var" in a classic browser script
  console.log(window.scriptLet); // undefined
</script>
```

Top-level `this` also depends on the kind of code and environment. For example, in a classic browser script, top-level `this` is `window`; in an ES module, top-level `this` is `undefined`. Prefer `globalThis` when you specifically need the global object, and avoid using global variables as application storage.

## Hoisting and declaration behavior

**Hoisting** is a useful name for the observable behavior caused by how JavaScript creates and initializes bindings before executing statements. It does not mean the engine physically moves declarations to the top of the file.

### `var` and the value `undefined`

```js
console.log(lesson); // undefined
var lesson = "execution context";
console.log(lesson); // "execution context"
```

This can be understood as if the `var` binding were established and initialized to `undefined` before statement execution, then assigned when execution reaches the initializer:

```js
// Conceptual model only:
var lesson;                 // binding initialized to undefined
console.log(lesson);
lesson = "execution context";
console.log(lesson);
```

### Function declarations

Function declarations are initialized so that the function can normally be called before the declaration appears in the same scope:

```js
greet(); // Hello!

function greet() {
  console.log("Hello!");
}
```

This rule applies to function declarations, not every function-shaped expression. Block-level function declaration behavior has additional strict-mode and environment rules, so keep declarations in the scope where they are intended to be used.

### Function expressions and arrow functions

A function expression or arrow function is a value assigned to a variable. Its availability before the assignment depends on the variable declaration:

```js
// With `var`, the binding exists as undefined, but it is not callable yet.
// sayHi(); // TypeError: sayHi is not a function
var sayHi = function () {
  console.log("Hi!");
};

// With `let` or `const`, an earlier access is in the TDZ and throws
// ReferenceError rather than producing a callable function.
const sayBye = () => console.log("Bye!");
```

After initialization, both are ordinary ways to hold a function:

```js
const sayWelcome = () => console.log("Welcome!");
sayWelcome();
```

### `undefined` versus an undeclared name

`undefined` is a primitive value. A declared binding can contain it—for example, an uninitialized `var` binding or a function that returns without a value. An **undeclared name** has no accessible binding in the current scope chain; reading it throws a `ReferenceError`.

```js
var declaredButUnset;

console.log(declaredButUnset); // undefined
// console.log(notDeclared);   // ReferenceError: notDeclared is not defined
```

Do not treat the wording “not defined” in an error message as a JavaScript value. It is not a special placeholder comparable to `undefined`. Also, `typeof` has a special case for an undeclared identifier:

```js
console.log(typeof notDeclared); // "undefined"
```

That special case does not make the name declared; directly reading it still throws. Assigning `undefined` manually is legal, but usually avoid doing so when `null` or an explicit state better communicates intent.

### The temporal dead zone (TDZ)

`let` and `const` declarations are registered for their lexical scope before the code executes, but their bindings remain **uninitialized** until execution reaches the declaration. The interval from entering that scope to initialization is the **temporal dead zone**. The binding exists during the TDZ; reading or assigning it before initialization throws a `ReferenceError`.

```js
{
  // The block scope has been entered, but `message` is not initialized yet.
  // console.log(message); // ReferenceError: Cannot access 'message' before initialization

  const message = "ready";
  console.log(message); // "ready"
}
```

The TDZ is tied to entering the scope, not merely to the lines above a declaration. A closure called before an outer `let` is initialized can also encounter the TDZ:

```js
{
  const readLater = () => status;

  // readLater(); // ReferenceError: status is still in its TDZ
  let status = "initialized";
  console.log(readLater()); // "initialized"
}
```

Conceptually, the timeline is:

```text
Enter lexical scope        Reach initializer          Scope continues
        |                         |                          |
        v                         v                          v
  binding exists,           binding initialized       reads use its value
  but is uninitialized
        <------ Temporal Dead Zone ------>
        reads/writes throw ReferenceError
```

The phrase “separate memory space” is sometimes used in teaching diagrams to distinguish lexical bindings from `var` bindings. Treat it as a conceptual aid: JavaScript specifies the observable binding and initialization behavior, not a required physical memory layout inside an engine.

### `var`, `let`, and `const` in practice

```js
var oldCount = 1;
var oldCount = 2; // allowed; same function/global-script scope
oldCount = 3;     // allowed

let count = 1;
count = 2;        // allowed
// let count = 3; // SyntaxError in the same scope

const limit = 3;
// limit = 4;     // TypeError: assignment to a constant binding
// const title;   // SyntaxError: const declaration needs an initializer
```

The examples that cause errors are commented out so the whole snippet remains runnable. Redeclaring a lexical binding with `let` or `const`, or omitting a `const` initializer, violates declaration rules and produces a `SyntaxError`. Reassigning an already initialized `const` binding is a runtime `TypeError`.

`const` prevents reassignment of the binding, not mutation of the object held by that binding:

```js
const preferences = { theme: "light" };
preferences.theme = "dark"; // allowed: mutates the object
// preferences = {};        // TypeError: reassigns the const binding
```

### Error types at a glance

| Error | Typical cause | Example |
| --- | --- | --- |
| `ReferenceError` | Read a `let`/`const` binding in its TDZ, or read an undeclared identifier | `console.log(item); let item = 1;` |
| `SyntaxError` | Invalid declaration or parse-time rule violation, such as a duplicate `let` in one scope or a `const` without an initializer | `let item; let item;` |
| `TypeError` | An operation is invalid for the value/binding, such as assigning to an initialized `const` | `const item = 1; item = 2;` |

Error wording can vary between engines. The error category and underlying cause are the useful parts to recognize.

### Declaration best practices

- Prefer `const` when the binding will not be reassigned.
- Use `let` when reassignment is part of the intended logic.
- Avoid `var` in modern code unless working with legacy code or a specific compatibility requirement.
- Declare and initialize bindings close to where they are first needed. This makes the TDZ short and scope easier to understand; there is no need to move every declaration to the top of a function.
- Keep lexical declarations in the smallest useful block and avoid relying on access before a declaration.

## Function calls and the call stack

The **call stack** keeps track of active function calls. It uses last-in, first-out (LIFO) behavior: the most recently called function completes first.

```js
function multiply(a, b) {
  return a * b;
}

function calculate() {
  const result = multiply(4, 5);
  return result + 1;
}

console.log(calculate()); // 21
```

The stack evolves roughly as follows:

```text
1. Start                 2. calculate() runs
   |                        | calculate
   |                        | global
   |                        +----------------
   | global
   +----------------

3. multiply() runs       4. multiply returns
   | multiply               | calculate
   | calculate              | global
   | global                 +----------------
   +----------------

5. calculate returns
   | global
   +----------------
```

When `multiply` returns, its call is finished and execution resumes in `calculate` at the point after the call. When `calculate` returns, execution resumes in the global context.

Each function invocation has its own local bindings for parameters and local declarations. Two calls to the same function therefore have separate local state:

```js
function showValue(value) {
  const label = `value=${value}`;
  console.log(label);
}

showValue(10); // value=10
showValue(20); // value=20
```

The calls use the same function code but have separate `value` and `label` bindings. The function's lexical parent is determined by where it was defined; it is not changed by the caller.

### Following execution in browser developer tools

To see real execution rather than only a diagram:

1. Open a page in the browser and open Developer Tools.
2. In **Sources** (Chrome/Edge) or **Debugger** (Firefox), open the JavaScript file.
3. Click a line number to set a breakpoint, then trigger the code.
4. Inspect the **Call Stack** panel to see active calls and the **Scope** panel to inspect local, closure, and global bindings.
5. Use step-over, step-into, and step-out to observe calls being added to and removed from the stack.

The exact panel names vary by browser. A breakpoint pauses execution, so it changes timing; use it to inspect synchronous control flow, not to infer the normal timing of asynchronous tasks.

### Return values and cleanup

A `return` statement ends the current function call and supplies a value to the caller. If a function reaches its end without returning a value, its result is `undefined`.

```js
function getLessonNumber() {
  return 4;
}

const currentLesson = getLessonNumber();
console.log(currentLesson); // 4
```

The function's active call is removed from the call stack after it completes. However, values created during that call can remain reachable—for example, when a returned closure still refers to its lexical environment. The engine can reclaim memory only when values are no longer reachable.

### Recursion and stack overflow

Each recursive call adds another active call:

```js
function countdown(number) {
  if (number <= 0) return;
  console.log(number);
  countdown(number - 1);
}

countdown(3); // 3, 2, 1
```

Recursion must have a base case. Recursing too deeply can exhaust the call stack and produce a stack overflow error.

## Lexical environments and the scope chain

**Scope** determines where a name can be accessed. JavaScript uses lexical scope: access is determined by where code is written, not by who called it.

A useful model for name lookup is a **lexical environment**: the current scope's bindings together with a reference to the enclosing lexical environment. The **scope chain** is the sequence of those outer-environment references followed during lookup.

### Blocks and block scope

A **block** (also called a compound statement) groups zero or more statements between braces. Blocks commonly appear in `if`, `else`, `for`, `while`, `switch`, and standalone scopes:

```js
if (true) {
  const first = "one";
  const second = "two";
  console.log(first, second);
}
```

Braces do not always mean a block: they can also define an object literal, a class body, or a destructuring pattern. In the example above, the braces after `if (true)` form a statement block.

`let` and `const` are **block-scoped**. Their bindings are available in the block where they are declared and in nested scopes, but not after the block ends:

```js
{
  let localCount = 1;
  const localLabel = "inside";
  console.log(localCount, localLabel); // 1 "inside"
}

// console.log(localCount); // ReferenceError
// console.log(localLabel); // ReferenceError
```

`var` is **not block-scoped**. It is scoped to the nearest function, or to the relevant global-script environment when declared outside a function. Therefore, a block by itself does not contain a `var` binding:

```js
{
  var visibleAfterBlock = "var escapes the block";
  let hiddenAfterBlock = "let stays in the block";
}

console.log(visibleAfterBlock); // "var escapes the block"
// console.log(hiddenAfterBlock); // ReferenceError
```

If that `var` is inside a function, it is available within that function but not outside the function. At the top level, whether a declaration becomes a property of the global object depends on the environment and script type; see [Global context and the global object](#global-context-and-the-global-object).

The scope structure can be pictured like this:

```text
Outer function or global environment
  var functionScoped
  |
  +-- if/loop block environment
        let blockScoped
        const alsoBlockScoped
        |
        +-- nested block environment
              can read bindings from both outer environments
```

### Shadowing and illegal shadowing

**Shadowing** happens when a nested scope declares a binding with the same name as a binding in an outer scope. Within the nested scope, the inner binding is found first. The outer binding still exists and becomes visible again when the nested scope ends.

```js
let lesson = "outer";

{
  let lesson = "inner";
  console.log(lesson); // "inner" — the inner binding shadows the outer one
  lesson = "updated inner";
  console.log(lesson); // "updated inner"
}

console.log(lesson); // "outer" — the outer binding was not changed
```

This is also legal when the outer binding is `var` and the inner binding is `let`, because the `let` is confined to its nested block:

```js
var topic = "outer var";

{
  let topic = "inner let";
  console.log(topic); // "inner let"
}

console.log(topic); // "outer var"
```

An inner `let` can also shadow an outer `let` when they belong to distinct nested blocks. But declaring the same lexical name twice in one block is an error:

```js
let title = "outer";
{
  let title = "inner"; // Legal: a different, nested block scope
  console.log(title);
}

// let duplicate = 1;
// let duplicate = 2; // SyntaxError: duplicate lexical declaration in one scope
```

**Illegal shadowing** is a teaching term for declaration combinations that conflict because `var` is function-scoped while `let` and `const` are lexical. A `var` declaration cannot cross into or redeclare a lexical binding with the same name in the same variable scope:

```js
let amount = 10;

{
  // var amount = 20; // SyntaxError: var conflicts with the outer lexical binding
}
```

This applies even at the top level of a classic browser script. There, top-level `let amount` is a global lexical binding, while a top-level `var amount` would be a global-object property. Those are different kinds of global bindings, but the language still forbids declaring both names this way in the same script. Putting `var` inside braces does not avoid the conflict: `var` does not belong to that block, so it still targets the surrounding script's variable scope.

```js
// Classic browser script; shown as an isolated example:
let amount = 20;
{
  // var amount = 10; // SyntaxError; this var is not block-scoped
}
```

Different binding mechanisms do not automatically make duplicate declarations legal. The conflict is about declaration rules and scope, not simply whether the engine stores the bindings in the same physical place. “Separate memory spaces” is a teaching picture, not an exception to those rules.

The same conflict occurs when the lexical declaration is inside a block and `var` is declared in that block: `var` would belong to the enclosing function/global variable scope, crossing the lexical binding.

```js
{
  let status = "local";
  // var status = "function-scoped"; // SyntaxError: conflicting declarations
}
```

These are parse-time `SyntaxError`s, so the script or function body is rejected before that code executes.

By contrast, a `var` inside a nested function does not conflict with a same-named binding outside that function—the function creates a separate `var` scope:

```js
let amount = 10;

function updateLocalAmount() {
  var amount = 20; // Legal: this var belongs to the function scope
  return amount;
}

console.log(updateLocalAmount()); // 20
console.log(amount); // 10
```

Shadowing is legal JavaScript, but reusing names can make code harder to follow. Prefer distinct names when the inner and outer values represent different concepts.

```text
Global environment
  topic = "scope"
       ^
       | outer reference
Function environment: explain()
  detail = "enclosing scopes"
       ^
       | outer reference
Nested block environment
  local = "block"
```

When JavaScript evaluates an identifier, it checks the current environment first. If there is no matching binding there, it follows the lexical parent reference and keeps looking outward. It does not search the caller's local variables merely because the caller invoked the function.

```js
const topic = "scope";

function explain() {
  const detail = "Names are found through enclosing scopes.";
  function show() {
    const punctuation = "!";
    console.log(topic, detail + punctuation);
  }

  show();
}

explain();
// console.log(detail); // ReferenceError: detail is local to explain
```

For `show`, lookup of `punctuation` succeeds in its own function environment; lookup of `detail` continues to `explain`; lookup of `topic` continues to the global lexical environment.

```text
show environment: punctuation
       |
       v
explain environment: detail
       |
       v
global environment: topic
       |
       v
no outer environment
```

If a name is absent from every environment in the chain, an identifier read throws `ReferenceError` (unless a special case such as `typeof undeclaredName` applies). A property lookup is different: reading a missing object property normally produces `undefined`.

```js
const settings = {};

console.log(settings.theme); // undefined: missing property
// console.log(theme);       // ReferenceError: no binding named theme
```

An inner scope can read from an enclosing scope. If it declares a name with the same spelling, that local binding shadows the outer one.

```js
const language = "JavaScript";

function example() {
  const language = "another language";
  console.log(language); // another language
}

example();
console.log(language); // JavaScript
```

`let` and `const` are block-scoped:

```js
if (true) {
  const message = "inside the block";
  console.log(message);
}

// console.log(message); // ReferenceError
```

The **temporal dead zone (TDZ)** is the period from entering a `let` or `const` scope until its declaration is initialized. Reading the binding during this period throws a `ReferenceError`.

```js
// console.log(count); // ReferenceError: count is in its TDZ
let count = 1;
```

The TDZ is another consequence of lexical environments and binding initialization; it is not the same thing as a name being undeclared. Prefer declarations near their first use. This reduces surprises from hoisting and makes scope easier to inspect.

## Closures

A **closure** is a function together with access to the lexical environment in which that function was created. A function can keep using those bindings after the outer function has returned.

```js
function makeCounter() {
  let count = 0;

  return function increment() {
    count += 1;
    return count;
  };
}

const counter = makeCounter();
console.log(counter()); // 1
console.log(counter()); // 2
console.log(counter()); // 3
```

After `makeCounter` returns, its call is no longer active on the call stack. The returned `increment` function still has access to `count`, so that binding remains reachable.

```text
makeCounter() call ends
        |
        v
increment function remains reachable
        |
        +---- closes over count
```

### How a closure works

The function's lexical environment is determined by where it is **created**, not by where or when it is later called. A closure retains access to the bindings it needs from that environment. It does not simply copy the current values into the function.

```js
function createReader() {
  let message = "first";

  const read = () => message;
  message = "updated";

  return read;
}

const readMessage = createReader();
console.log(readMessage()); // "updated"
```

`read` refers to the `message` binding. The binding is updated before `createReader` returns, so the later call reads the updated value.

```text
createReader environment
+----------------------+
| message: "updated"   |<----+
+----------------------+     |
                             | lexical reference
readMessage function --------+
                             |
                             +--> call later reads message
```

Closures keep a reference to the relevant lexical bindings alive as long as those bindings remain reachable through a live function. This is why a function can continue to use an outer function's local state after that outer call has finished.

Closures are useful for:

- Keeping state private behind a function interface.
- Creating functions configured with particular values.
- Callbacks that need information from the code that created them.
- Implementing function factories, currying, and module-like APIs.

### Closure in a callback

```js
function makeGreeter(name) {
  return function greet() {
    return `Hello, ${name}!`;
  };
}

const greetMina = makeGreeter("Mina");
console.log(greetMina()); // Hello, Mina!
```

The returned function remembers the `name` binding from the call that created it.

### Closures for private state

A closure can expose selected operations while keeping its state inaccessible to outside code:

```js
function createScoreboard(initialScore = 0) {
  let score = initialScore;

  return {
    add(points) {
      score += points;
      return score;
    },
    getScore() {
      return score;
    },
  };
}

const scoreboard = createScoreboard(10);
scoreboard.add(5);
console.log(scoreboard.getScore()); // 15
console.log(scoreboard.score); // undefined: score is not a public property
```

The returned methods close over the same `score` binding. Callers can use the provided operations but cannot directly assign to that local binding.

### Closures in asynchronous callbacks

Callbacks often run after the function that created them has returned. Their closures let them retain access to needed values:

```js
function notifyLater(name) {
  setTimeout(() => {
    console.log(`Hello, ${name}!`);
  }, 0);
}

notifyLater("Ari");
```

The call to `notifyLater` finishes before the timer callback runs, but the callback still has access to its `name` binding. This is the same lexical-scope rule used by event handlers, Promise callbacks, and other asynchronous code.

### A common loop pitfall

`var` is function-scoped, so callbacks created in a loop can all refer to the same binding:

```js
const callbacks = [];

for (var index = 0; index < 3; index += 1) {
  callbacks.push(function () {
    return index;
  });
}

console.log(callbacks.map((callback) => callback())); // [3, 3, 3]
```

Use `let` when each loop iteration needs its own binding:

```js
const callbacks = [];

for (let index = 0; index < 3; index += 1) {
  callbacks.push(function () {
    return index;
  });
}

console.log(callbacks.map((callback) => callback())); // [0, 1, 2]
```

Each `let` loop iteration provides a distinct `index` binding, which is why the callbacks return different values.

### Currying with closures

**Currying** transforms a function that takes several arguments into a sequence of functions that each take one argument. Closures retain the earlier arguments:

```js
function add(left) {
  return function addRight(right) {
    return left + right;
  };
}

const addTen = add(10);
console.log(addTen(4)); // 14
console.log(addTen(7)); // 17
```

The returned `addRight` function closes over the `left` binding created by `add(10)`.

### Run a function only once

A closure can remember whether an operation has already completed:

```js
function once(callback) {
  let called = false;
  let result;

  return function (...args) {
    if (!called) {
      called = true;
      result = callback.apply(this, args);
    }

    return result;
  };
}

const initialize = once(() => {
  console.log("Initialized");
  return { ready: true };
});

console.log(initialize()); // logs "Initialized", then { ready: true }
console.log(initialize()); // returns the same result without calling again
```

The returned function and the `called` and `result` bindings live together through the closure. This example caches the first result and ignores later arguments. If the callback throws on its first call, `called` remains `true`; change the order or reset the flag if retries are the desired behavior.

### Closures and memory

When a function call returns, its execution context is removed from the active call stack. That does **not** mean every value created during the call is immediately freed. If a returned function or callback can still reach a binding, the binding must remain available.

```text
Live reference to closure
          |
          v
   inner function
          |
          v
   captured environment
          |
          +--> captured values remain reachable

No live reference to closure
          |
          v
function and its otherwise-unreachable environment
can become eligible for garbage collection
```

Garbage collection is based on reachability, not simply on whether the outer function has returned. Engines may optimize storage, and collection timing is not deterministic. A closure does not necessarily keep every value from its outer scope alive; only values that remain reachable are relevant. Avoid retaining callbacks or closures longer than needed when they capture large data or long-lived objects.

## Objects and prototypes

Objects store properties. When a property is not found directly on an object, JavaScript can look for it on that object's **prototype**, then continue up the prototype chain.

```js
const animal = {
  speak() {
    return "A sound";
  },
};

const dog = Object.create(animal);
dog.name = "Pip";

console.log(dog.name);      // Pip (own property)
console.log(dog.speak());   // A sound (found through the prototype)
```

The lookup flow is:

```text
Read dog.speak
      |
      v
Does dog have its own "speak" property? -- yes --> use it
      |
      no
      v
Check dog’s prototype (animal)
      |
      v
Found animal.speak --> call it with dog as `this`
```

If a property is not found anywhere in the chain, its value is `undefined`. Assigning a property usually creates or updates an own property on the receiver; it does not automatically change the prototype.

### Classes use prototypes

JavaScript `class` syntax offers a convenient way to define constructor functions and shared prototype methods:

```js
class User {
  constructor(name) {
    this.name = name;
  }

  introduce() {
    return `I am ${this.name}.`;
  }
}

const user = new User("Ravi");
console.log(user.introduce()); // I am Ravi.
```

`introduce` is shared through `User.prototype`, rather than being recreated as a new method for every instance.

### `this` depends on how a function is called

For a method call such as `user.introduce()`, `this` refers to the receiver (`user`). If you extract the method, that receiver is no longer supplied by the call expression:

```js
const introduce = user.introduce;
// introduce(); // `this` is not user; behavior depends on strict mode
```

Arrow functions do not create their own `this`; they capture it from the surrounding lexical scope. Choose regular methods or arrow functions based on the desired `this` behavior.

## Asynchronous JavaScript and the event loop

Ordinary JavaScript execution on an agent is run-to-completion: a running task continues until its stack is empty. The host environment can schedule future work, then the **event loop** selects queued work when JavaScript can run it.

A simplified browser model:

```text
                  +----------------------+
                  | Host APIs            |
                  | timers, I/O, events  |
                  +----------+-----------+
                             |
                             | enqueue callbacks
                             v
+-------------+       +-------------+       +------------------+
| Call stack  | <---- | Task queue  |       | Microtask queue  |
| JS runs now |       | later tasks |       | promise reactions|
+------+------+       +-------------+       +--------+---------+
       ^                                             |
       +------------ event loop scheduling <---------+
```

This diagram is deliberately simplified; browser and Node.js scheduling details differ. A key practical rule in browsers is that promise reactions (microtasks) are generally processed after the current stack finishes and before the next task, such as a timer callback.

### Predicting output

```js
console.log("A");

setTimeout(() => {
  console.log("B");
}, 0);

Promise.resolve().then(() => {
  console.log("C");
});

console.log("D");
```

Typical browser output:

```text
A
D
C
B
```

Why:

1. `"A"` is logged synchronously.
2. The timer callback is scheduled as a future task.
3. The promise reaction is scheduled as a microtask.
4. `"D"` is logged before the current stack finishes.
5. The microtask runs before the next task.
6. The timer callback runs when its task is selected.

`setTimeout(callback, 0)` does not mean “run immediately”; it makes the callback eligible to run later, subject to the host scheduler and current work.

### Long synchronous work blocks the thread

```js
console.log("Before");

const start = Date.now();
while (Date.now() - start < 1000) {
  // Occupies the JavaScript thread for about one second.
}

console.log("After");
```

While this loop is running, the same thread cannot process other JavaScript callbacks or update the page. Break expensive work into smaller tasks or use an appropriate worker when computation must run off the main thread.

## Promises and async/await

A **Promise** represents the eventual result of an asynchronous operation. It can be pending, fulfilled with a value, or rejected with a reason.

```js
const resultPromise = fetch("/api/lessons");

resultPromise
  .then((response) => {
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    return response.json();
  })
  .then((lessons) => {
    console.log(lessons);
  })
  .catch((error) => {
    console.error("Could not load lessons:", error);
  });
```

`async` functions always return a Promise. Inside an `async` function, `await` pauses that function's continuation until the awaited Promise settles; it does not block the JavaScript thread.

```js
async function loadLessons() {
  try {
    const response = await fetch("/api/lessons");

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const lessons = await response.json();
    return lessons;
  } catch (error) {
    console.error("Could not load lessons:", error);
    throw error;
  }
}

loadLessons()
  .then((lessons) => console.log(lessons))
  .catch((error) => console.error("Loading failed:", error));
```

Important details:

- `await` is valid inside an `async` function (and at module top level in supported module environments).
- A rejected Promise awaited inside `try` behaves like a thrown error and can be caught.
- Errors should be handled or deliberately propagated; avoid swallowing failures.
- Independent operations can often run together with `Promise.all`.

```js
async function loadDashboard() {
  const [profile, lessons] = await Promise.all([
    fetch("/api/profile").then((response) => response.json()),
    fetch("/api/lessons").then((response) => response.json()),
  ]);

  return { profile, lessons };
}
```

`Promise.all` rejects if any input Promise rejects. If each outcome should be collected regardless of success or failure, consider `Promise.allSettled`.

## JavaScript iteration and array methods

JavaScript offers multiple ways to visit collection values. Although they can all process an array, they differ in control flow, return values, whether they create arrays, and how they work with asynchronous callbacks.

This chapter builds on the [event loop](#asynchronous-javascript-and-the-event-loop) and [Promises](#promises-and-asyncawait) sections. It covers traditional `for` loops, `for...of`, `forEach()`, `map()`, `filter()`, `reduce()`, and Promise utilities.

Example data used throughout:

```js
const employees = [
  { id: 1, name: "Rahul", salary: 50000, active: true },
  { id: 2, name: "Amit", salary: 60000, active: false },
  { id: 3, name: "Priya", salary: 70000, active: true },
  { id: 4, name: "Neha", salary: 80000, active: true },
];
```

### Iteration fundamentals

**Iteration** means repeatedly processing values in a collection. Pick an approach based on the desired result and control flow, not simply because one style is shorter.

```text
Need a side effect for each value?       -> forEach()
Need a transformed value for each?       -> map()
Need only values matching a condition?   -> filter()
Need one accumulated result?             -> reduce()
Need break/continue or sequential await? -> for...of or for
Need explicit index control?             -> traditional for
```

Array methods such as `forEach`, `map`, `filter`, and `reduce` invoke a callback for each assigned element. These methods do not mutate the array automatically, although a callback can mutate the array or objects referenced by it. On sparse arrays, these methods skip holes; `for...of` yields `undefined` for a hole. Prefer dense arrays unless sparse-array behavior is intentional.

### `forEach()` and callback control flow

`forEach()` calls its callback once for each assigned element. The callback receives the current element, its index, and the original array:

```js
const names = ["Rahul", "Amit", "Priya", "Neha"];

names.forEach((name, index, array) => {
  console.log(index, name, array.length);
});
```

Use it when the purpose is a side effect, such as logging or updating an external accumulator:

```js
let totalSalary = 0;
employees.forEach((employee) => {
  totalSalary += employee.salary;
});
console.log(totalSalary); // 260000
```

`forEach()` always returns `undefined`; it does not return callback results:

```js
const result = [1, 2, 3].forEach((number) => number * 2);
console.log(result); // undefined
```

Use `map()` when the callback results are what you need.

#### Why `break` and `continue` do not work inside the callback

`break` and `continue` control an enclosing loop or `switch`. A `forEach()` callback is a separate function, not a loop body lexically enclosing the method call. Therefore, a `break` or `continue` directly inside a callback is a syntax error:

```js
const values = [10, 20, 30, 40];

values.forEach((value) => {
  // if (value === 30) break;    // SyntaxError: no enclosing loop here
  // if (value === 20) continue; // SyntaxError: no enclosing loop here
});
```

To skip the rest of the callback for one element, use `return`. This exits only that callback invocation; `forEach()` continues with the next element:

```js
values.forEach((value) => {
  if (value === 20) return;
  console.log(value);
});
// 10
// 30
// 40
```

To stop iteration early, use `for...of`, a traditional `for` loop, or a method that expresses the goal, such as `find()` or `some()`.

#### `return` depends on which function contains it

`return` always exits the current function. It does not inherently stop a loop:

```js
function processWithForEach() {
  values.forEach((value) => {
    if (value === 20) return; // exits this callback only
    console.log(value);
  });

  console.log("Finished"); // still runs
}

function processWithLoop() {
  for (const value of values) {
    if (value === 20) return; // exits processWithLoop entirely
    console.log(value);
  }

  console.log("Not reached");
}
```

| Statement | Effect |
| --- | --- |
| `break` | Exits the nearest enclosing loop or `switch` |
| `continue` | Skips to the next iteration of the nearest enclosing loop |
| `return` | Exits the current function |
| `return value` | Exits the current function and supplies a value to its caller |

### Synchronous and asynchronous iteration

Synchronous statements run in order on the current call stack. Asynchronous operations, such as timers and network requests, can finish later; the runtime schedules their continuations for a later turn. See [the event loop](#asynchronous-javascript-and-the-event-loop) for the execution model.

```js
console.log("Start");
setTimeout(() => console.log("Timer"), 0);
console.log("End");
// Start
// End
// Timer
```

An `async` function always returns a Promise. `await` suspends that async function's continuation until its Promise settles, but does not make the caller automatically wait unless the caller awaits the Promise.

### Async array-method pitfalls

#### Why `forEach(async ...)` does not wait

An async callback returns a Promise, but `forEach()` ignores callback return values. It invokes all callbacks and returns `undefined` without waiting for their Promises:

```js
const userIds = [1, 2, 3];

async function loadUsersWithForEach() {
  userIds.forEach(async (id) => {
    console.log("Started:", id);
    const user = await getUser(id);
    console.log("Finished:", user.name);
  });

  console.log("forEach finished invoking callbacks");
}
```

The three requests may be started before the `"forEach finished..."` message appears, and each completion can occur in any order. The outer function does not wait for them. If `getUser` rejects, the callback's Promise rejects; `forEach()` does not collect it for the caller to handle.

#### Sequential execution with `for...of`

Use `for...of` with `await` when each operation should finish before the next starts, or when order and early exit matter:

```js
async function loadUsersSequentially(ids) {
  const users = [];

  for (const id of ids) {
    const user = await getUser(id);
    users.push(user);
    console.log("Finished:", user.name);
  }

  return users;
}
```

Flow:

```text
start request 1 -> await result 1
                         |
                         v
start request 2 -> await result 2
                         |
                         v
start request 3 -> await result 3
                         |
                         v
                    return results
```

Use `try`/`catch` around the loop or let the returned Promise reject for the caller to handle. A `break` or `continue` can be used inside this loop.

Sequential execution is appropriate when later work depends on earlier results, when requests must be ordered, or when limiting load is more important than latency. Independent operations run one after another can take longer overall.

#### Concurrent execution with `map()` and `Promise.all()`

For independent operations, `map()` can start one async operation per input, and `Promise.all()` can wait for all results:

```js
async function loadUsersConcurrently(ids) {
  const userPromises = ids.map((id) => getUser(id));
  return Promise.all(userPromises);
}
```

`map()` returns an array of Promises because each callback returns a Promise. `Promise.all()` fulfills with results in **input order**, even if operations complete in a different order:

```text
Input IDs:       [1, 2, 3]
Completion:       2, 3, 1
Promise.all result [user1, user2, user3]
```

If any input rejects, `Promise.all()` rejects. It does not automatically cancel the remaining operations. For very large inputs, avoid starting unlimited work at once; use batching or a concurrency limiter.

| Sequential `for...of` | Concurrent `map()` + `Promise.all()` |
| --- | --- |
| Starts the next operation after the current one finishes | Starts independent operations without waiting between starts |
| Easy to preserve order of side effects and stop early | Results preserve input order, but completion timing can vary |
| Good for dependencies or rate-limited workflows | Good for independent operations and lower total wait time |
| Use `break` / `continue` directly | Cancellation and partial-failure handling need separate design |

The examples use a placeholder `getUser(id)`. In an application it might wrap `fetch`; check `response.ok`, parse the response, and propagate errors rather than silently substituting fake data.

### Traditional `for` and `for...of`

#### Traditional `for`

A traditional `for` loop gives direct control over initialization, continuation condition, and update:

```js
for (let index = 0; index < 3; index += 1) {
  console.log(index);
}
// 0
// 1
// 2
```

Use it when you need an index, custom increments, reverse traversal, or early termination:

```js
const names = ["Rahul", "Amit", "Priya", "Neha"];

for (let index = names.length - 1; index >= 0; index -= 1) {
  console.log(index, names[index]);
}
```

#### `for...of`

`for...of` iterates values from an iterable. Arrays, strings, Maps, Sets, and generators are common iterables:

```js
for (const name of ["Rahul", "Amit", "Priya"]) {
  console.log(name);
}
```

It supports `break`, `continue`, and `await` inside an async function. To access both index and value, use `.entries()`:

```js
const names = ["Rahul", "Amit", "Priya"];

for (const [index, name] of names.entries()) {
  console.log(index, name);
}
```

The iteration protocol explains how `for...of` works: an iterable supplies a `[Symbol.iterator]()` method, and its iterator's `next()` method returns `{ value, done }` objects:

```js
const iterator = [10, 20][Symbol.iterator]();

console.log(iterator.next()); // { value: 10, done: false }
console.log(iterator.next()); // { value: 20, done: false }
console.log(iterator.next()); // { value: undefined, done: true }
```

Do not confuse `for...of` with `for...in`: `for...of` yields iterable values; `for...in` yields enumerable property keys. For arrays, use `for...of` or array methods when you want values.

### `map()`, `filter()`, and `reduce()`

These methods describe common data transformations and return new results. They do not automatically deep-clone objects.

#### `map()` transforms every assigned element

`map()` calls a callback for each assigned array element and returns a new array containing the callback results:

```js
const numbers = [1, 2, 3, 4];
const doubled = numbers.map((number) => number * 2);

console.log(doubled); // [2, 4, 6, 8]
console.log(numbers); // [1, 2, 3, 4]
```

With a block-bodied arrow callback, explicitly return the transformed value:

```js
const correct = numbers.map((number) => {
  return number * 2;
});

const incorrect = numbers.map((number) => {
  number * 2; // no return
});

console.log(correct); // [2, 4, 6, 8]
console.log(incorrect); // [undefined, undefined, undefined, undefined]
```

Transform records into UI-friendly values:

```js
const employeeCards = employees.map((employee) => ({
  id: employee.id,
  displayName: employee.name,
  monthlySalary: employee.salary,
}));
```

In React, `map()` is commonly used to create elements for a list. Use a stable key that identifies the item:

```jsx
function EmployeeList({ employees }) {
  return (
    <ul>
      {employees.map((employee) => (
        <li key={employee.id}>{employee.name}</li>
      ))}
    </ul>
  );
}
```

The returned array is new, but object elements remain references unless you create replacement objects. `map()` is not a deep clone.

#### `filter()` selects matching elements

`filter()` returns a new array containing elements whose callback result is truthy:

```js
const activeEmployees = employees.filter((employee) => employee.active);
console.log(activeEmployees.map((employee) => employee.name));
// ["Rahul", "Priya", "Neha"]
```

The callback should answer a yes/no question. `filter()` keeps the original element references; it does not transform or clone them.

#### `reduce()` accumulates a result

`reduce()` passes an accumulator from one callback call to the next. The accumulated result can be a number, object, array, Map, or another value:

```js
const numbers = [10, 20, 30, 40];

const total = numbers.reduce((sum, number) => sum + number, 0);
console.log(total); // 100
```

With initial value `0`, the accumulator evolves like this:

| Current value | Accumulator before | Accumulator after |
| ---: | ---: | ---: |
| 10 | 0 | 10 |
| 20 | 10 | 30 |
| 30 | 30 | 60 |
| 40 | 60 | 100 |

Calculate a shopping cart total:

```js
const cart = [
  { product: "Laptop", price: 60000, quantity: 1 },
  { product: "Mouse", price: 1000, quantity: 2 },
  { product: "Keyboard", price: 2000, quantity: 1 },
];

const totalAmount = cart.reduce(
  (total, item) => total + item.price * item.quantity,
  0,
);

console.log(totalAmount); // 64000
```

Group records by department:

```js
const staff = [
  { name: "Rahul", department: "IT" },
  { name: "Amit", department: "HR" },
  { name: "Priya", department: "IT" },
];

const byDepartment = staff.reduce((groups, person) => {
  const department = person.department;
  (groups[department] ??= []).push(person);
  return groups;
}, {});

console.log(byDepartment.IT.map((person) => person.name)); // ["Rahul", "Priya"]
```

Providing an initial value is usually best: it defines the accumulator type and makes empty-array behavior predictable. Without an initial value, the first element becomes the accumulator and iteration begins at the second element; calling `reduce()` on an empty array without an initial value throws a `TypeError`.

### Combining array methods

A readable pipeline often makes each transformation's purpose clear:

1. Select active employees.
2. Convert monthly salaries to annual salaries.
3. Sum the annual amounts.
4. Print the results.

```js
const annualSalaries = employees
  .filter((employee) => employee.active)
  .map((employee) => ({
    id: employee.id,
    name: employee.name,
    annualSalary: employee.salary * 12,
  }));

const totalAnnualSalary = annualSalaries.reduce(
  (total, employee) => total + employee.annualSalary,
  0,
);

annualSalaries.forEach((employee) => {
  console.log(employee.name, employee.annualSalary);
});

console.log("Total annual salary:", totalAnnualSalary);
// Rahul 600000
// Priya 840000
// Neha 960000
// Total annual salary: 2400000
```

This creates intermediate arrays. For ordinary application data, clarity is often worth the allocations. For very large data, a single loop may reduce allocations, but benchmark the actual workload before optimizing.

### Comparing iteration approaches

| Approach | Main purpose | Result | Early exit | Automatically awaits async callback? |
| --- | --- | --- | --- | --- |
| Traditional `for` | Index-based or custom iteration | No method result | Yes: `break`, `continue`, `return` | Only if the surrounding function uses `await` |
| `for...of` | Iterate iterable values | No method result | Yes: `break`, `continue`, `return` | Sequential `await` works in an async function |
| `forEach()` | Side effects per element | Always `undefined` | No `break`/`continue`; callback `return` skips only that call | No |
| `map()` | Transform each element | New array | No loop control | No; async callbacks produce Promises in an array |
| `filter()` | Select matching elements | New array | No loop control | No; async callback Promises are truthy |
| `reduce()` | Accumulate into a result | Final accumulator | No loop control | No; async reduction needs explicit Promise handling |

| Requirement | Good default |
| --- | --- |
| Log or perform a side effect for each value | `forEach()` |
| Stop when a condition is met | `for...of`, traditional `for`, `find()`, or `some()` |
| Transform each value | `map()` |
| Keep matching values | `filter()` |
| Calculate a total or grouped result | `reduce()` |
| Process async work sequentially | `for...of` with `await` |
| Start independent async work together | `map()` with `Promise.all()` |
| Custom index changes or reverse iteration | Traditional `for` |

Other useful array methods include `find()`, `findIndex()`, `some()`, `every()`, and `includes()`. Choose the method that expresses the question directly.

### Async `map()`, `filter()`, and `reduce()` pitfalls

#### Async `map()`

An async callback makes `map()` return an array of Promises:

```js
const doubledPromises = [1, 2, 3].map(async (number) => number * 2);
const doubledValues = await Promise.all(doubledPromises);

console.log(doubledValues); // [2, 4, 6]
```

The `await` above must be inside an async function or at top level in a supported module.

#### Async `filter()` is not an async predicate

This is incorrect:

```js
const numbers = [1, 2, 3];
const incorrect = numbers.filter(async (number) => number > 1);
console.log(incorrect); // [1, 2, 3]
```

An async function returns a Promise immediately. Promise objects are truthy, including Promises that will fulfill with `false`, so `filter()` keeps every visited value. Resolve the conditions first, then filter synchronously:

```js
async function keepNumbersGreaterThanOne(numbers) {
  const matches = await Promise.all(
    numbers.map(async (number) => number > 1),
  );

  return numbers.filter((number, index) => matches[index]);
}

console.log(await keepNumbersGreaterThanOne([1, 2, 3])); // [2, 3]
```

For real validation, replace the predicate with the async check. If checks may fail, decide whether to reject the whole operation or represent each check's failure explicitly.

#### Async `reduce()`

An async reducer needs to await the previous accumulator Promise. This pattern is sequential:

```js
async function sumAfterAsyncSteps(numbers) {
  return numbers.reduce(async (accumulatorPromise, number) => {
    const accumulator = await accumulatorPromise;
    return accumulator + number;
  }, Promise.resolve(0));
}

console.log(await sumAfterAsyncSteps([1, 2, 3])); // 6
```

For independent async work, prefer `map()` with `Promise.all()`. Use an async reducer when each step depends on the previous accumulated result.

### Promise utilities for batches

| Utility | Behavior |
| --- | --- |
| `Promise.all()` | Fulfills when all inputs fulfill; rejects when an input rejects |
| `Promise.allSettled()` | Waits for every input to settle and reports each outcome |
| `Promise.race()` | Settles with the first input to settle |
| `Promise.any()` | Fulfills with the first fulfilled input; rejects if all inputs reject |

Use `Promise.allSettled()` when every independent outcome matters, even when some operations fail:

```js
const results = await Promise.allSettled([
  Promise.resolve("User 1"),
  Promise.reject(new Error("User 2 failed")),
  Promise.resolve("User 3"),
]);

console.log(results);
// [
//   { status: "fulfilled", value: "User 1" },
//   { status: "rejected", reason: Error(...) },
//   { status: "fulfilled", value: "User 3" }
// ]
```

`Promise.all()` rejecting does not cancel other work. If cancellation is required, the operations must support a cancellation mechanism such as `AbortController` for `fetch`.

### Production guidance for iteration

- Use `map()` for returned transformed data, not just for side effects.
- Use `forEach()` only when each callback's result is intentionally ignored.
- Use `for...of` or `for` when you need direct loop control, early termination, or sequential `await`.
- Use `Promise.all()` only when operations are independent and starting them together is acceptable.
- For large workloads, batch requests or limit concurrency to respect rate limits and resource usage.
- Handle or propagate Promise rejections; do not silently discard async callback Promises.
- Supply an initial value to `reduce()` when it makes the expected result type explicit or supports empty arrays.
- Remember that `map()` and `filter()` are shallow: nested object references remain shared.
- Prefer clear code. A traditional `for` loop can sometimes be faster, but performance depends on the engine, data, and workload; benchmark before changing readable code.

### Iteration interview questions and practice

#### Common interview questions

1. **What is the difference between `map()` and `forEach()`?** `map()` returns an array of callback results; `forEach()` returns `undefined` and is intended for side effects.
2. **Why can't `break` be used in a `forEach()` callback?** The callback is a separate function and is not lexically inside the method's internal loop.
3. **Why doesn't `return` in a `forEach()` callback stop iteration?** It exits only that callback invocation; the method continues to the next element.
4. **What happens when an async callback is passed to `forEach()`?** The callback returns a Promise, but `forEach()` ignores it and does not wait.
5. **How do `for...of` and `for...in` differ?** `for...of` yields iterable values; `for...in` yields enumerable property keys.
6. **Does `Promise.all()` preserve input order?** Yes. Its fulfillment array uses input order, not completion order.
7. **Does `Promise.all()` cancel other operations after a rejection?** No. It rejects, but other already-started operations continue unless separately cancelled.
8. **What happens when `reduce()` is called on an empty array without an initial value?** It throws a `TypeError`.

#### Practice challenges

```js
const values = [1, 2, 3, 4, 5];

// 1. Use map() to produce [1, 4, 9, 16, 25].
// 2. Use filter() to keep only even values.
// 3. Use reduce() to calculate the sum.
```

More practice:

- Find the first employee whose `id` is `3`; return `null` if there is no match.
- Group employees by department.
- Process three async operations sequentially with `for...of`, then concurrently with `Promise.all()`. Compare start order, completion order, and error handling.
- Given an asynchronous validation function, collect its results first and filter the original values afterward.

Suggested solutions:

```js
const squares = values.map((value) => value * value);
const evens = values.filter((value) => value % 2 === 0);
const sum = values.reduce((total, value) => total + value, 0);

function findEmployeeById(employeeList, id) {
  return employeeList.find((employee) => employee.id === id) ?? null;
}
```

## Common misconceptions

| Misconception | More accurate view |
| --- | --- |
| “The whole program is literally moved before it runs.” | Declaration processing and binding initialization explain hoisting behavior; source text is not simply rearranged. |
| “Every variable starts as `undefined`.” | `var` is initialized to `undefined`; `let` and `const` are inaccessible in the TDZ until initialized. |
| “All declarations inside braces are block-scoped.” | `let` and `const` are block-scoped; `var` is scoped to a function or global-script environment. |
| “Shadowing changes the outer variable.” | A nested lexical binding is distinct; updates to it do not change the shadowed outer binding. |
| “Illegal shadowing is a runtime value error.” | A `var`/lexical declaration conflict is a `SyntaxError` detected before execution. |
| “A closure copies outer variable values when it is created.” | A closure retains access to lexical bindings, so later calls can observe changes to those bindings. |
| “An outer function's locals are always deleted at `return`.” | Captured bindings remain available while reachable through a live closure; unreachable values can later be collected. |
| “`forEach()` waits for async callbacks.” | It ignores callback Promises; use `for...of` with `await` or `Promise.all()` as appropriate. |
| “`return` in a `forEach()` callback stops the loop.” | It exits only that callback call; iteration continues. |
| “`filter(async ...)` waits for async conditions.” | Async predicates return truthy Promises; resolve the checks before filtering. |
| “A function's local memory always disappears at `return`.” | Its call leaves the stack, but captured bindings can remain reachable through closures. |
| “JavaScript cannot do anything concurrently.” | A JavaScript agent executes one piece of JS at a time, while the host may do asynchronous work; workers can run on separate threads. |
| “A zero-delay timer runs immediately.” | It schedules a callback for a later task; current synchronous work and microtasks run first. |
| “`async` / `await` makes code synchronous.” | It makes asynchronous control flow easier to read; awaiting suspends the async function's continuation, not the thread. |
| “Class methods are copied onto every instance.” | Methods defined in a class body are placed on the class prototype and shared through prototype lookup. |

## Practice exercises

Try to predict each result before running the code.

### 1. Scope and shadowing

```js
const value = "outer";

function inspect() {
  const value = "inner";
  return value;
}

console.log(inspect());
console.log(value);
```

### 2. Call stack

```js
function first() {
  console.log("first start");
  second();
  console.log("first end");
}

function second() {
  console.log("second");
}

first();
```

### 3. Closure state

Write `makeMultiplier(factor)` so that it returns a function multiplying its input by `factor`.

### 4. Event loop

```js
console.log("one");
setTimeout(() => console.log("two"), 0);
Promise.resolve().then(() => console.log("three"));
console.log("four");
```

For the browser model described above, write the output order and explain why.

### Suggested answers

1. `inner`, then `outer`. The function's local `value` shadows the outer binding only inside `inspect`.
2. `first start`, `second`, `first end`. `second` completes before execution resumes in `first`.
3. One solution:

   ```js
   function makeMultiplier(factor) {
     return function multiply(value) {
       return value * factor;
     };
   }

   const double = makeMultiplier(2);
   console.log(double(5)); // 10
   ```

4. `one`, `four`, `three`, `two`. Synchronous logs run first, then the promise microtask, then the timer task.

## Quick review

- JavaScript evaluates ordinary statements in order on its current execution thread.
- An execution context is the environment and state associated with evaluating code.
- Hoisting describes binding initialization behavior; `var`, function declarations, and lexical declarations initialize differently.
- `undefined` is a value; an undeclared identifier has no binding and normally throws `ReferenceError`.
- A function call creates an active call that is tracked on the call stack.
- The call stack is LIFO; a completed function returns control to its caller.
- Scope is lexical: identifier lookup follows outer-environment references, not the caller's stack frame.
- `let` and `const` are block-scoped and have a temporal dead zone; `var` is function-scoped or global-script scoped.
- A nested binding can shadow an outer binding; a `var` declaration conflicting with a lexical binding is a `SyntaxError`.
- A closure retains access to bindings from its creation environment, enabling private state, callbacks, currying, and function factories.
- Captured bindings remain reachable while a live closure can access them; garbage collection timing is not deterministic.
- Use `forEach()` for side effects, `map()` for transformation, `filter()` for selection, and `reduce()` for accumulation.
- Use `for...of` or `for` for early exit and sequential async work; use `map()` with `Promise.all()` for independent concurrent operations.
- Prototype lookup lets objects share behavior through a prototype chain.
- The host environment and event loop schedule callbacks; promise reactions are microtasks.
- `async` / `await` is Promise-based asynchronous control flow, not thread blocking.
