"""
Tests for C++ Trace Profile v0.1 validator.
"""

import pytest

from adapters.languages.cpp.instrumentation.profile_validator import (
    CppProfileValidator,
    ViolationCode,
)


@pytest.fixture
def validator():
    return CppProfileValidator()


# ---------------------------------------------------------------------------
# Supported sources — must produce supported=True, no violations
# ---------------------------------------------------------------------------


class TestSupportedProfile:
    def test_minimal_main(self, validator):
        source = "int main() {\n    return 0;\n}\n"
        result = validator.validate(source)
        assert result.supported is True
        assert result.violations == []

    def test_variable_create(self, validator):
        source = "int main() {\n    int x = 10;\n    return 0;\n}\n"
        result = validator.validate(source)
        assert result.supported is True
        assert result.violations == []

    def test_variable_assign(self, validator):
        source = (
            "int main() {\n"
            "    int x = 10;\n"
            "    x = 20;\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is True

    def test_arithmetic_all_operators(self, validator):
        source = (
            "int main() {\n"
            "    int a = 10;\n"
            "    int b = a + 5;\n"
            "    int c = a - 3;\n"
            "    int d = a * 2;\n"
            "    int e = a / 2;\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is True

    def test_multiple_int_variables(self, validator):
        source = (
            "int main() {\n"
            "    int a = 1;\n"
            "    int b = 2;\n"
            "    int c = a + b;\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is True

    def test_reassignment_chain(self, validator):
        source = (
            "int main() {\n"
            "    int x = 10;\n"
            "    x = 20;\n"
            "    x = x + 5;\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is True


# ---------------------------------------------------------------------------
# Unsupported constructs — must produce supported=False with correct codes
# ---------------------------------------------------------------------------


class TestUnsupportedConstructs:
    def test_for_loop_rejected(self, validator):
        source = (
            "int main() {\n"
            "    for (int i = 0; i < 10; i++) {}\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.LOOP_UNSUPPORTED in codes

    def test_while_loop_rejected(self, validator):
        source = (
            "int main() {\n"
            "    while (true) {}\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.LOOP_UNSUPPORTED in codes

    def test_pointer_rejected(self, validator):
        source = (
            "int main() {\n"
            "    int x = 10;\n"
            "    int* p = &x;\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.POINTER_UNSUPPORTED in codes

    def test_if_conditional_rejected(self, validator):
        source = (
            "int main() {\n"
            "    int x = 10;\n"
            "    if (x > 5) { x = 1; }\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.CONDITIONAL_UNSUPPORTED in codes

    def test_include_rejected(self, validator):
        source = "#include <iostream>\nint main() { return 0; }\n"
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.INCLUDE_UNSUPPORTED in codes

    def test_user_function_rejected(self, validator):
        source = (
            "int helper() { return 42; }\n"
            "int main() { return 0; }\n"
        )
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.USER_FUNCTION_UNSUPPORTED in codes

    def test_no_main_rejected(self, validator):
        source = "void foo() {}\n"
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.NO_MAIN in codes

    def test_float_type_rejected(self, validator):
        source = "int main() {\n    float x = 1.0f;\n    return 0;\n}\n"
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.UNSUPPORTED_TYPE in codes

    def test_heap_alloc_rejected(self, validator):
        source = (
            "int main() {\n"
            "    int* p = new int(5);\n"
            "    delete p;\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.HEAP_ALLOC_UNSUPPORTED in codes

    def test_exception_rejected(self, validator):
        source = (
            "int main() {\n"
            "    try { int x = 1; }\n"
            "    catch (...) {}\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.EXCEPTION_UNSUPPORTED in codes

    def test_namespace_rejected(self, validator):
        source = "namespace my_ns {\nint main() { return 0; }\n}\n"
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.NAMESPACE_UNSUPPORTED in codes


# ---------------------------------------------------------------------------
# Violation metadata
# ---------------------------------------------------------------------------


class TestViolationMetadata:
    def test_violations_contain_line_numbers(self, validator):
        source = (
            "int main() {\n"
            "    int x = 10;\n"
            "    for (int i = 0; i < 10; i++) {}\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        loop_violations = [
            v for v in result.violations
            if v.code == ViolationCode.LOOP_UNSUPPORTED
        ]
        assert len(loop_violations) > 0
        assert loop_violations[0].line == 3

    def test_multiple_violations_all_reported(self, validator):
        source = (
            "int main() {\n"
            "    int* p = nullptr;\n"
            "    for (int i = 0; i < 10; i++) {}\n"
            "    return 0;\n"
            "}\n"
        )
        result = validator.validate(source)
        assert result.supported is False
        codes = [v.code for v in result.violations]
        assert ViolationCode.POINTER_UNSUPPORTED in codes
        assert ViolationCode.LOOP_UNSUPPORTED in codes

    def test_violation_message_is_non_empty(self, validator):
        source = "int main() {\n    for (;;) {}\n    return 0;\n}\n"
        result = validator.validate(source)
        for v in result.violations:
            assert len(v.message) > 0

    def test_violation_code_is_non_empty(self, validator):
        source = "int main() {\n    for (;;) {}\n    return 0;\n}\n"
        result = validator.validate(source)
        for v in result.violations:
            assert len(v.code) > 0