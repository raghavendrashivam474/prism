"""
Local sandbox provider.

Executes workloads in a temporary directory on the host machine.
Useful for development when Docker is not available.

WARNING: This sandbox provides no real isolation.
         Never use with untrusted code in production.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
import time
from pathlib import Path

from contracts.sandbox.models import SandboxResult, SandboxWorkload


class LocalSandboxProvider:
    """
    Executes sandbox workloads directly on the host machine.

    No container isolation. For development and testing only.
    """

    def execute(self, workload: SandboxWorkload) -> SandboxResult:
        """Execute the workload in a temporary directory on the host."""
        with tempfile.TemporaryDirectory(prefix="prism_local_") as workspace:
            workspace_path = Path(workspace)

            for file in workload.files:
                dest = workspace_path / file.path
                dest.parent.mkdir(parents=True, exist_ok=True)
                dest.write_text(file.content, encoding="utf-8")

            timeout_sec = workload.timeout_ms / 1000.0
            start = time.monotonic()

            try:
                proc = subprocess.run(
                    workload.command,
                    cwd=workspace,
                    capture_output=True,
                    text=True,
                    timeout=timeout_sec,
                    env={**self._base_env(), **workload.environment},
                )
                duration_ms = int((time.monotonic() - start) * 1000)
                return SandboxResult(
                    exit_code=proc.returncode,
                    stdout=proc.stdout,
                    stderr=proc.stderr,
                    timed_out=False,
                    duration_ms=duration_ms,
                )

            except subprocess.TimeoutExpired:
                duration_ms = int((time.monotonic() - start) * 1000)
                return SandboxResult(
                    exit_code=1,
                    stdout="",
                    stderr="Execution timed out.",
                    timed_out=True,
                    duration_ms=duration_ms,
                )

    @staticmethod
    def _base_env() -> dict[str, str]:
        """Minimal environment for subprocess execution."""
        return {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin:/usr/local/bin"),
            "HOME": os.environ.get("HOME", str(Path.home())),
            "TEMP": os.environ.get("TEMP", tempfile.gettempdir()),
            "TMP": os.environ.get("TMP", tempfile.gettempdir()),
        }