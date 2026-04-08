import subprocess
import platform
import json
import psutil
from datetime import datetime
import shutil

class CLIService:
    """Service for executing CLI commands and system checks"""

    @staticmethod
    def get_system_load() -> float:
        """Get system load average as percentage (0-100)"""
        try:
            load_avg = psutil.getloadavg()[0]
            cpu_count = psutil.cpu_count()
            return min((load_avg / cpu_count) * 100, 100)
        except Exception:
            return 0.0

    @staticmethod
    def get_memory_usage() -> float:
        """Get memory usage percentage"""
        try:
            return psutil.virtual_memory().percent
        except Exception:
            return 0.0

    @staticmethod
    def get_disk_usage() -> float:
        """Get disk usage percentage"""
        try:
            return psutil.disk_usage("/").percent
        except Exception:
            return 0.0

    @staticmethod
    def get_python_version() -> str:
        """Get Python version"""
        try:
            result = subprocess.run(
                ["python", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return result.stdout.strip() or result.stderr.strip()
        except Exception:
            return "Unknown"

    @staticmethod
    def get_nodejs_version() -> str:
        """Get Node.js version"""
        try:
            result = subprocess.run(
                ["node", "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            return result.stdout.strip() or "Not installed"
        except Exception:
            return "Not installed"

    @staticmethod
    def analyze_code_with_pylint(code: str, file_path: str) -> dict:
        """Analyze Python code using pylint (if available)"""
        try:
            # Check if pylint is installed
            if not shutil.which("pylint"):
                return {"available": False, "message": "pylint not installed"}

            # Write code to temporary file
            import tempfile
            with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False) as f:
                f.write(code)
                temp_file = f.name

            # Run pylint
            result = subprocess.run(
                ["pylint", temp_file, "--output-format=json"],
                capture_output=True,
                text=True,
                timeout=10,
            )

            # Clean up
            import os
            os.unlink(temp_file)

            # Parse output
            try:
                issues = json.loads(result.stdout)
                return {"available": True, "issues": issues}
            except json.JSONDecodeError:
                return {"available": True, "issues": [], "raw_output": result.stdout}
        except Exception as e:
            return {"available": False, "error": str(e)}

    @staticmethod
    def run_command(command: list, timeout: int = 30) -> dict:
        """Run arbitrary command and return output"""
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return {
                "success": result.returncode == 0,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "returncode": result.returncode,
            }
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "Command timeout"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    @staticmethod
    def check_system_health() -> dict:
        """Get overall system health status"""
        system_load = CLIService.get_system_load()
        memory_usage = CLIService.get_memory_usage()
        disk_usage = CLIService.get_disk_usage()

        # Determine health status
        status = "healthy"
        if system_load > 80 or memory_usage > 85 or disk_usage > 90:
            status = "critical"
        elif system_load > 60 or memory_usage > 70 or disk_usage > 75:
            status = "warning"

        return {
            "status": status,
            "systemLoad": system_load,
            "memoryUsage": memory_usage,
            "diskUsage": disk_usage,
            "pythonVersion": CLIService.get_python_version(),
            "nodeVersion": CLIService.get_nodejs_version(),
            "timestamp": datetime.utcnow().isoformat() + "Z",
        }
