# Supported C++ Profile — v0.1

## Overview

The C++ Trace Profile v0.1 defines the narrow subset of C++ that
PRISM can reliably trace during Sprint 0.

## Supported Constructs

| Construct            | Example                     |
|----------------------|-----------------------------|
| main() function      | `int main() { return 0; }`  |
| int variable create  | `int x = 10;`               |
| Direct assignment    | `x = 20;`                   |
| Arithmetic assign    | `x = x + 5;`                |
| Integer arithmetic   | `+`  `-`  `*`  `/`          |
| Multiple int vars    | `int a = 1; int b = 2;`     |
| Sequential execution | Statements in order         |
| Normal return        | `return 0;`                 |

## Explicitly Unsupported

- Pointers (`int* p`)
- References (`int& r`)
- Arrays (`int arr[10]`)
- Strings (`std::string`)
- Classes and structs
- Templates
- Loops (`for`, `while`, `do`)
- Conditionals (`if`, `else`, `switch`)
- User-defined functions (beyond `main`)
- Exceptions (`try`, `throw`, `catch`)
- Heap allocation (`new`, `delete`, `malloc`)
- Lambdas
- `#include` directives
- Namespaces
- Non-int types (`float`, `double`, `char`, `bool`, `auto`)

## Rejection Behaviour

Unsupported constructs are detected statically before compilation.
A structured `ValidationResult` is returned with per-line violations.
Execution does not proceed for unsupported source.
No misleading partial Learning IR is produced.