"""
Docker sandbox provider.

Executes workloads inside an isolated Docker container.
Provides real isolation for untrusted C++ code execution.

Requires Docker Desktop to be installed and running.
"""

from __future__ import annotations

import subprocess
import tempfile
import time
import uuid
from pathlib import Path

from contracts.sandbox.models import SandboxResult, SandboxWorkload


class DockerSandboxProvider:
    """
    Executes sandbox workloads inside an isolated Docker container.

    Enforces:
      - network isolation (--network none)
      - memory limits
      - CPU limits
      - execution timeout
    """

    DEFAULT_IMAGE = "gcc:13"

    def __init__(self, image: str = DEFAULT_IMAGE) -> None:
        self._image = image

    def execute(self, workload: SandboxWorkload) -> SandboxResult:
        """Execute the workload inside a Docker container."""
        container_name = f"prism_{uuid.uuid4().hex[:12]}"

        with tempfile.TemporaryDirectory(prefix="prism_docker_") as workspace:
            workspace_path = Path(workspace)

            # Write workload files with LF line endings.
            # Files originate on Windows but execute inside a Linux container.
            for file in workload.files:
                dest = workspace_path / file.path
                dest.parent.mkdir(parents=True, exist_ok=True)
                # Normalise to LF regardless of host OS
                content_lf = file.content.replace("\r\n", "\n").replace("\r", "\n")
                dest.write_bytes(content_lf.encode("utf-8"))

            timeout_sec = workload.timeout_ms / 1000.0
            start = time.monotonic()

            cmd = self._build_command(
                container_name=container_name,
                workspace=str(workspace_path),
                workload=workload,
            )

            try:
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=timeout_sec + 10,
                )
                duration_ms = int((time.monotonic() - start) * 1000)

                timed_out = (
                    proc.returncode == 137
                    or duration_ms > workload.timeout_ms + 5_000
                )

                return SandboxResult(
                    exit_code=proc.returncode,
                    stdout=proc.stdout,
                    stderr=proc.stderr,
                    timed_out=timed_out,
                    duration_ms=duration_ms,
                )

            except subprocess.TimeoutExpired:
                self._kill_container(container_name)
                duration_ms = int((time.monotonic() - start) * 1000)
                return SandboxResult(
                    exit_code=1,
                    stdout="",
                    stderr="Docker execution timed out.",
                    timed_out=True,
                    duration_ms=duration_ms,
                )

    def _build_command(
        self,
        container_name: str,
        workspace: str,
        workload: SandboxWorkload,
    ) -> list[str]:
        """Build the docker run command list."""
        cmd = [
            "docker", "run",
            "--rm",
            "--name", container_name,
            "--volume", f"{workspace}:/workspace",
            "--workdir", "/workspace",
            "--memory", f"{workload.memory_limit_mb}m",
            "--memory-swap", f"{workload.memory_limit_mb}m",
            "--cpus", "0.5",
            "--stop-timeout", str(max(workload.timeout_ms // 1000, 5)),
        ]

        if not workload.network_enabled:
            cmd += ["--network", "none"]

        for key, value in workload.environment.items():
            cmd += ["-e", f"{key}={value}"]

        cmd.append(self._image)
        cmd.extend(workload.command)
        return cmd

    def is_available(self) -> bool:
        """Return True if Docker is installed and the daemon is running."""
        try:
            result = subprocess.run(
                ["docker", "info"],
                capture_output=True,
                timeout=5,
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    @staticmethod
    def _kill_container(container_name: str) -> None:
        """Attempt to kill a running container. Best-effort."""
        try:
            subprocess.run(
                ["docker", "kill", container_name],
                capture_output=True,
                timeout=10,
            )
        except Exception:
            pass