"""
PRISM Trace CLI.

Usage:
    python -m apps.trace_cli <source_file> [--json] [--sandbox local|docker]

Diagnostic/progress output  -> stderr
Human-readable output       -> stdout
JSON output (--json)        -> stdout
"""

from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

import click

from contracts.language import LanguageAdapterRegistry
from contracts.language.models import ExecutionRequest
from contracts.learning_ir.models import EventType, LearningTrace
from core.execution.service import ExecutionService


# ---------------------------------------------------------------------------
# Pipeline factory
# ---------------------------------------------------------------------------


def _build_registry() -> LanguageAdapterRegistry:
    from adapters.languages.cpp.adapter import CppLanguageAdapter
    registry = LanguageAdapterRegistry()
    registry.register(CppLanguageAdapter())
    return registry


def _build_sandbox(sandbox_type: str):
    if sandbox_type == "docker":
        from adapters.sandboxes.docker.provider import DockerSandboxProvider
        provider = DockerSandboxProvider()
        if not provider.is_available():
            click.echo(
                "WARNING: Docker does not appear to be running. "
                "Falling back to local sandbox.",
                err=True,
            )
            from adapters.sandboxes.local.provider import LocalSandboxProvider
            return LocalSandboxProvider()
        return provider
    else:
        from adapters.sandboxes.local.provider import LocalSandboxProvider
        return LocalSandboxProvider()


# ---------------------------------------------------------------------------
# Human-readable formatter
# ---------------------------------------------------------------------------


def _format_trace(trace: LearningTrace) -> str:
    lines: list[str] = []

    for event in trace.events:
        seq = event.sequence
        etype = event.type
        payload = event.payload

        if etype == EventType.EXECUTION_STARTED:
            lines.append(f"[{seq}] execution.started")

        elif etype == EventType.SCOPE_ENTERED:
            lines.append(f"\n[{seq}] scope.entered")
            lines.append(f"    {payload.get('displayName', '')}")

        elif etype == EventType.ENTITY_CREATED:
            lines.append(f"\n[{seq}] entity.created")
            name  = payload.get("displayName", "?")
            dtype = payload.get("dataType", "?")
            value = payload.get("value", "?")
            lines.append(f"    {name} : {dtype} = {value}")

        elif etype == EventType.ENTITY_VALUE_CHANGED:
            lines.append(f"\n[{seq}] entity.value_changed")
            prev = payload.get("previousValue", "?")
            new  = payload.get("value", "?")
            lines.append(f"    {prev} \u2192 {new}")

        elif etype == EventType.SCOPE_EXITED:
            lines.append(f"\n[{seq}] scope.exited")
            lines.append(f"    {payload.get('displayName', '')}")

        elif etype == EventType.EXECUTION_COMPLETED:
            lines.append(f"\n[{seq}] execution.completed")

        elif etype == EventType.EXECUTION_FAILED:
            lines.append(f"\n[{seq}] execution.failed")
            lines.append(f"    category : {payload.get('category', 'unknown')}")
            lines.append(f"    message  : {payload.get('message', '')}")
            for diag in payload.get("diagnostics", []):
                lines.append(f"    > {diag}")
            for v in payload.get("violations", []):
                code = v.get("code", "")
                line = v.get("line")
                msg  = v.get("message", "")
                loc  = f"line {line}: " if line else ""
                lines.append(f"    [{code}] {loc}{msg}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# CLI command
# ---------------------------------------------------------------------------


@click.command()
@click.argument(
    "source_file",
    type=click.Path(exists=True, readable=True, path_type=Path),
)
@click.option(
    "--json", "output_json",
    is_flag=True,
    default=False,
    help="Output machine-readable Learning IR JSON to stdout.",
)
@click.option(
    "--sandbox",
    type=click.Choice(["local", "docker"]),
    default="docker",
    show_default=True,
    help="Sandbox execution provider.",
)
@click.option(
    "--language",
    default="cpp",
    show_default=True,
    help="Source language identifier.",
)
def main(
    source_file: Path,
    output_json: bool,
    sandbox: str,
    language: str,
) -> None:
    """PRISM Trace CLI — transform C++ source into Learning IR."""

    # Header (human mode only)
    if not output_json:
        click.echo("PRISM Trace CLI")
        click.echo(f"Language : {language}")
        click.echo(f"Profile  : cpp-trace-v0.1")
        click.echo(f"Sandbox  : {sandbox}")
        click.echo("")

    # Read source
    try:
        source_code = source_file.read_text(encoding="utf-8")
    except OSError as exc:
        click.echo(f"ERROR: Cannot read source file: {exc}", err=True)
        sys.exit(1)

    # Build pipeline
    registry = _build_registry()
    sandbox_provider = _build_sandbox(sandbox)
    service = ExecutionService(
        language_registry=registry,
        sandbox_provider=sandbox_provider,
    )

    # Validate and report before execution (human mode)
    if not output_json:
        click.echo("Validating source...", err=True)
        adapter = registry.resolve(language)
        validation = adapter.validate(
            ExecutionRequest(
                language_id=language,
                source_code=source_code,
                execution_id="validation-check",
            )
        )
        if validation.supported:
            click.echo("  SUPPORTED", err=True)
        else:
            click.echo("  UNSUPPORTED", err=True)
            for v in validation.violations:
                loc = f"line {v.line}: " if v.line else ""
                click.echo(f"  [{v.code}] {loc}{v.message}", err=True)
        click.echo("", err=True)
        click.echo("Executing...", err=True)

    # Execute
    execution_id = str(uuid.uuid4())
    request = ExecutionRequest(
        language_id=language,
        source_code=source_code,
        execution_id=execution_id,
    )
    trace = service.execute(request)

    if not output_json:
        click.echo("Transforming trace...", err=True)
        click.echo("", err=True)

    # Output
    has_failure = any(e.type == EventType.EXECUTION_FAILED for e in trace.events)

    if output_json:
        click.echo(json.dumps(trace.model_dump(by_alias=True), indent=2))
    else:
        if has_failure:
            click.echo("Result: FAILED")
        else:
            click.echo(f"Result: OK — {len(trace.events)} events produced.")
        click.echo("")
        click.echo(_format_trace(trace))

    sys.exit(1 if has_failure else 0)


if __name__ == "__main__":
    main()