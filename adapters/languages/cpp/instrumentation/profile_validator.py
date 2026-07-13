"""
C++ Trace Profile v0.1 Validator.

Determines whether C++ source code falls within the supported
Sprint 0 execution profile before any compilation or execution occurs.

Supported:
    - main() function only
    - local int variables
    - integer literal initialisation
    - direct assignment
    - simple arithmetic: + - * /
    - sequential execution
    - normal completion (return 0)

All other constructs are explicitly rejected with structured violations.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from contracts.language.models import ValidationResult, ValidationViolation


# ---------------------------------------------------------------------------
# Violation codes
# ---------------------------------------------------------------------------


class ViolationCode:
    LOOP_UNSUPPORTED = "CPP_PROFILE_LOOP_UNSUPPORTED"
    POINTER_UNSUPPORTED = "CPP_PROFILE_POINTER_UNSUPPORTED"
    REFERENCE_UNSUPPORTED = "CPP_PROFILE_REFERENCE_UNSUPPORTED"
    ARRAY_UNSUPPORTED = "CPP_PROFILE_ARRAY_UNSUPPORTED"
    CLASS_UNSUPPORTED = "CPP_PROFILE_CLASS_UNSUPPORTED"
    STRUCT_UNSUPPORTED = "CPP_PROFILE_STRUCT_UNSUPPORTED"
    TEMPLATE_UNSUPPORTED = "CPP_PROFILE_TEMPLATE_UNSUPPORTED"
    CONDITIONAL_UNSUPPORTED = "CPP_PROFILE_CONDITIONAL_UNSUPPORTED"
    USER_FUNCTION_UNSUPPORTED = "CPP_PROFILE_USER_FUNCTION_UNSUPPORTED"
    INCLUDE_UNSUPPORTED = "CPP_PROFILE_INCLUDE_UNSUPPORTED"
    NAMESPACE_UNSUPPORTED = "CPP_PROFILE_NAMESPACE_UNSUPPORTED"
    EXCEPTION_UNSUPPORTED = "CPP_PROFILE_EXCEPTION_UNSUPPORTED"
    HEAP_ALLOC_UNSUPPORTED = "CPP_PROFILE_HEAP_ALLOC_UNSUPPORTED"
    LAMBDA_UNSUPPORTED = "CPP_PROFILE_LAMBDA_UNSUPPORTED"
    STRING_UNSUPPORTED = "CPP_PROFILE_STRING_UNSUPPORTED"
    UNSUPPORTED_TYPE = "CPP_PROFILE_UNSUPPORTED_TYPE"
    NO_MAIN = "CPP_PROFILE_NO_MAIN"
    USER_FUNCTION_UNSUPPORTED = "CPP_PROFILE_USER_FUNCTION_UNSUPPORTED"


@dataclass(frozen=True)
class _RawViolation:
    code: str
    line: int | None
    message: str


# ---------------------------------------------------------------------------
# Compiled patterns
# ---------------------------------------------------------------------------

# Loops
_LOOP_PATTERN = re.compile(r"^\s*(for|while|do)\s*[\(\{]")

# Pointer declarations: int* p  or  int *p
_POINTER_PATTERN = re.compile(r"^\s*\w[\w\s]*\*\s*\w+")

# Reference declarations: int& r  or  int &r
_REFERENCE_PATTERN = re.compile(r"^\s*\w[\w\s]*&\s*\w+")

# Array usage: name[
_ARRAY_PATTERN = re.compile(r"\w+\s*\[")

# class or struct keyword starting a definition
_CLASS_PATTERN = re.compile(r"^\s*(class|struct)\s+\w+")

# template<
_TEMPLATE_PATTERN = re.compile(r"^\s*template\s*<")

# if / else / switch
_CONDITIONAL_PATTERN = re.compile(r"^\s*(if|else\s*if|switch)\s*\(")
_ELSE_PATTERN = re.compile(r"^\s*else\s*[\{\n]")

# #include
_INCLUDE_PATTERN = re.compile(r"^\s*#\s*include")

# namespace
_NAMESPACE_PATTERN = re.compile(r"^\s*namespace\s+\w+")

# try / throw / catch
_EXCEPTION_PATTERN = re.compile(r"^\s*(try|throw|catch)\s*[\(\{]")

# heap allocation keywords
_HEAP_ALLOC_PATTERN = re.compile(r"\b(new|delete|malloc|free|calloc|realloc)\b")

# lambda: [...](
_LAMBDA_PATTERN = re.compile(r"\[.*?\]\s*\(")

# string type
_STRING_PATTERN = re.compile(r"\bstring\b|\bstd::string\b")

# unsupported types on variable declaration lines
_UNSUPPORTED_TYPE_PATTERN = re.compile(
    r"^\s*(float|double|long|short|unsigned|char|bool|auto|"
    r"size_t|uint|int8_t|int16_t|int32_t|int64_t|"
    r"uint8_t|uint16_t|uint32_t|uint64_t)\s+\w+"
)

# main() detection
_MAIN_PATTERN = re.compile(r"\bint\s+main\s*\(")

# Any function definition: returntype name(...) {
# We use this to find user-defined functions other than main
_FUNC_DEF_PATTERN = re.compile(
    r"^\s*\w[\w\s\*&<>,]*\s+(\w+)\s*\([^)]*\)\s*(const\s*)?\{"
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _scan_lines(
    lines: list[str],
    pattern: re.Pattern,
    code: str,
    message: str,
) -> list[_RawViolation]:
    """Scan each line and return a violation for every match."""
    violations: list[_RawViolation] = []
    for line_num, line in enumerate(lines, start=1):
        if pattern.search(line):
            violations.append(_RawViolation(code=code, line=line_num, message=message))
    return violations


def _check_main_present(lines: list[str]) -> list[_RawViolation]:
    source = "\n".join(lines)
    if not _MAIN_PATTERN.search(source):
        return [
            _RawViolation(
                code=ViolationCode.NO_MAIN,
                line=None,
                message="No main() function found. C++ Trace Profile v0.1 requires main().",
            )
        ]
    return []


def _check_user_functions(lines: list[str]) -> list[_RawViolation]:
    """Find function definitions other than main()."""
    violations: list[_RawViolation] = []
    for line_num, line in enumerate(lines, start=1):
        match = _FUNC_DEF_PATTERN.search(line)
        if match:
            func_name = match.group(1)
            if func_name == "main":
                continue
            violations.append(
                _RawViolation(
                    code=ViolationCode.USER_FUNCTION_UNSUPPORTED,
                    line=line_num,
                    message=(
                        f"User-defined function '{func_name}' is not supported "
                        "by C++ Trace Profile v0.1."
                    ),
                )
            )
    return violations


# ---------------------------------------------------------------------------
# Public validator
# ---------------------------------------------------------------------------


class CppProfileValidator:
    """
    Validates C++ source code against the Sprint 0 trace profile.

    Each rule produces zero or more typed violations with line numbers.
    The validator never executes or compiles any code.
    """

    # (pattern, violation_code, message)
    _LINE_RULES: list[tuple[re.Pattern, str, str]] = [
        (
            _LOOP_PATTERN,
            ViolationCode.LOOP_UNSUPPORTED,
            "Loops (for/while/do) are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _POINTER_PATTERN,
            ViolationCode.POINTER_UNSUPPORTED,
            "Pointers are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _REFERENCE_PATTERN,
            ViolationCode.REFERENCE_UNSUPPORTED,
            "References are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _ARRAY_PATTERN,
            ViolationCode.ARRAY_UNSUPPORTED,
            "Arrays are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _CLASS_PATTERN,
            ViolationCode.CLASS_UNSUPPORTED,
            "Classes and structs are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _TEMPLATE_PATTERN,
            ViolationCode.TEMPLATE_UNSUPPORTED,
            "Templates are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _CONDITIONAL_PATTERN,
            ViolationCode.CONDITIONAL_UNSUPPORTED,
            "Conditionals (if/else/switch) are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _ELSE_PATTERN,
            ViolationCode.CONDITIONAL_UNSUPPORTED,
            "Conditionals (if/else/switch) are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _INCLUDE_PATTERN,
            ViolationCode.INCLUDE_UNSUPPORTED,
            "#include directives are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _NAMESPACE_PATTERN,
            ViolationCode.NAMESPACE_UNSUPPORTED,
            "Namespaces are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _EXCEPTION_PATTERN,
            ViolationCode.EXCEPTION_UNSUPPORTED,
            "Exceptions (try/throw/catch) are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _HEAP_ALLOC_PATTERN,
            ViolationCode.HEAP_ALLOC_UNSUPPORTED,
            "Heap allocation (new/delete/malloc) is not supported by C++ Trace Profile v0.1.",
        ),
        (
            _LAMBDA_PATTERN,
            ViolationCode.LAMBDA_UNSUPPORTED,
            "Lambdas are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _STRING_PATTERN,
            ViolationCode.STRING_UNSUPPORTED,
            "String types are not supported by C++ Trace Profile v0.1.",
        ),
        (
            _UNSUPPORTED_TYPE_PATTERN,
            ViolationCode.UNSUPPORTED_TYPE,
            "Only 'int' variables are supported by C++ Trace Profile v0.1.",
        ),
    ]

    def validate(self, source: str) -> ValidationResult:
        """
        Validate C++ source against the Sprint 0 trace profile.

        Returns ValidationResult with supported=True if the source
        falls entirely within the supported profile.
        Returns supported=False with structured violations otherwise.
        """
        lines = source.splitlines()
        raw: list[_RawViolation] = []

        # Structural checks (whole-source)
        raw.extend(_check_main_present(lines))
        raw.extend(_check_user_functions(lines))

        # Per-line pattern checks
        for pattern, code, message in self._LINE_RULES:
            raw.extend(_scan_lines(lines, pattern, code, message))

        violations = [
            ValidationViolation(code=v.code, line=v.line, message=v.message)
            for v in raw
        ]

        return ValidationResult(
            supported=len(violations) == 0,
            violations=violations,
        )