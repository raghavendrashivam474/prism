"""
Tests for sandbox providers.

Local sandbox tests run without Docker.
Docker provider tests verify command construction and availability check.
"""

import pytest

from contracts.sandbox.models import SandboxFile, SandboxResult, SandboxWorkload


# ---------------------------------------------------------------------------
# Local sandbox
# ---------------------------------------------------------------------------


class TestLocalSandboxProvider:
    @pytest.fixture
    def sandbox(self):
        from adapters.sandboxes.local.provider import LocalSandboxProvider
        return LocalSandboxProvider()

    def test_executes_simple_echo(self, sandbox):
        workload = SandboxWorkload(
            files=[],
            command=["python", "-c", "print('hello prism')"],
        )
        result = sandbox.execute(workload)
        assert result.exit_code == 0
        assert "hello prism" in result.stdout

    def test_writes_files_to_workspace(self, sandbox):
        workload = SandboxWorkload(
            files=[
                SandboxFile(path="msg.txt", content="prism test content\n"),
            ],
            command=["python", "-c",
                     "f=open('msg.txt');print(f.read());f.close()"],
        )
        result = sandbox.execute(workload)
        assert result.exit_code == 0
        assert "prism test content" in result.stdout

    def test_timeout_produces_timed_out_result(self, sandbox):
        workload = SandboxWorkload(
            files=[],
            command=["python", "-c", "import time; time.sleep(60)"],
            timeout_ms=300,
        )
        result = sandbox.execute(workload)
        assert result.timed_out is True

    def test_failed_command_returns_nonzero_exit(self, sandbox):
        workload = SandboxWorkload(
            files=[],
            command=["python", "-c", "raise SystemExit(1)"],
        )
        result = sandbox.execute(workload)
        assert result.exit_code != 0

    def test_result_is_sandbox_result_type(self, sandbox):
        workload = SandboxWorkload(
            files=[],
            command=["python", "-c", "print('ok')"],
        )
        result = sandbox.execute(workload)
        assert isinstance(result, SandboxResult)

    def test_stderr_captured(self, sandbox):
        workload = SandboxWorkload(
            files=[],
            command=["python", "-c",
                     "import sys; sys.stderr.write('err line\\n')"],
        )
        result = sandbox.execute(workload)
        assert "err line" in result.stderr

    def test_duration_ms_is_non_negative(self, sandbox):
        workload = SandboxWorkload(
            files=[],
            command=["python", "-c", "pass"],
        )
        result = sandbox.execute(workload)
        assert result.duration_ms >= 0


# ---------------------------------------------------------------------------
# Docker provider — command construction and availability (no execution)
# ---------------------------------------------------------------------------


class TestDockerSandboxProviderContract:
    @pytest.fixture
    def provider(self):
        from adapters.sandboxes.docker.provider import DockerSandboxProvider
        return DockerSandboxProvider()

    def test_is_available_returns_bool(self, provider):
        result = provider.is_available()
        assert isinstance(result, bool)

    def test_command_includes_network_none_when_disabled(self, provider):
        workload = SandboxWorkload(
            files=[],
            command=["echo", "test"],
            network_enabled=False,
        )
        cmd = provider._build_command(
            container_name="test_prism",
            workspace="/tmp/test",
            workload=workload,
        )
        assert "--network" in cmd
        assert "none" in cmd

    def test_command_omits_network_none_when_enabled(self, provider):
        workload = SandboxWorkload(
            files=[],
            command=["echo", "test"],
            network_enabled=True,
        )
        cmd = provider._build_command(
            container_name="test_prism",
            workspace="/tmp/test",
            workload=workload,
        )
        # When network is enabled, --network none must not appear
        pairs = list(zip(cmd, cmd[1:]))
        assert ("--network", "none") not in pairs

    def test_command_includes_memory_limit(self, provider):
        workload = SandboxWorkload(
            files=[],
            command=["echo"],
            memory_limit_mb=128,
        )
        cmd = provider._build_command(
            container_name="test_prism",
            workspace="/tmp/test",
            workload=workload,
        )
        assert "--memory" in cmd
        assert "128m" in cmd

    def test_command_includes_volume_mount(self, provider):
        workload = SandboxWorkload(files=[], command=["echo"])
        cmd = provider._build_command(
            container_name="test_prism",
            workspace="/tmp/myworkspace",
            workload=workload,
        )
        assert "--volume" in cmd
        volume_index = cmd.index("--volume")
        assert "/workspace" in cmd[volume_index + 1]

    def test_command_includes_image(self, provider):
        workload = SandboxWorkload(files=[], command=["echo", "hi"])
        cmd = provider._build_command(
            container_name="test_prism",
            workspace="/tmp/test",
            workload=workload,
        )
        assert "gcc:13" in cmd

    def test_workload_command_appended_last(self, provider):
        workload = SandboxWorkload(files=[], command=["bash", "run.sh"])
        cmd = provider._build_command(
            container_name="test_prism",
            workspace="/tmp/test",
            workload=workload,
        )
        assert cmd[-2] == "bash"
        assert cmd[-1] == "run.sh"

    def test_container_name_in_command(self, provider):
        workload = SandboxWorkload(files=[], command=["echo"])
        cmd = provider._build_command(
            container_name="prism_abc123",
            workspace="/tmp/test",
            workload=workload,
        )
        assert "prism_abc123" in cmd