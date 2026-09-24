"""Execute the workflow's two bash blocks with a local curl stub; no network."""
import os
import pathlib
import subprocess
import sys
import tempfile

source = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8")
blocks = []
current = None
for line in source.splitlines():
    if line.strip() == "run: |":
        current = []
        blocks.append(current)
    elif current is not None and (line.startswith("          ") or not line.strip()):
        current.append(line[10:])
    elif current is not None:
        current = None
assert len(blocks) == 2
plan, call = ["\n".join(block) for block in blocks]
assert "uses:" not in source and not any(word in plan + call for word in ["git checkout", "npm ", "pnpm ", "prisma ", "vercel "])
bash = r"C:\Program Files\Git\bin\bash.exe" if os.name == "nt" else "bash"
all_routes = "urgent-nudge match-backfill feature-expiry overdue-complaints request-expiry category-provisioning"
cases = [("*/5 * * * *", "", "urgent-nudge"), ("*/15 * * * *", "", "match-backfill feature-expiry"), ("0 * * * *", "", "overdue-complaints request-expiry"), ("0 3 * * *", "", "category-provisioning"), ("", "", all_routes), ("", "match-backfill", "match-backfill"), ("", "request-expiry", "request-expiry")]
with tempfile.TemporaryDirectory(prefix="talepo-cron-check-") as directory:
    env = {**os.environ, "GITHUB_OUTPUT": pathlib.Path(directory, "output").as_posix()}
    for schedule, manual, expected in cases:
        pathlib.Path(env["GITHUB_OUTPUT"]).write_text("", encoding="utf-8")
        result = subprocess.run([bash, "--noprofile", "--norc", "-s"], input=plan, text=True, encoding="utf-8", capture_output=True, env={**env, "SCHEDULE": schedule, "MANUAL_ROUTE": manual}, timeout=15)
        assert result.returncode == 0, result.stderr
        assert pathlib.Path(env["GITHUB_OUTPUT"]).read_text().strip() == "routes=" + expected
        print("PASS plan:", schedule or "manual", expected)
    log = pathlib.Path(directory, "calls")
    stub = 'curl() { printf "%s\\n" "${@: -1}" >> "$STUB_LOG"; printf "%s" "$STUB_CODE"; }\n'
    for secret, code, exit_code, count in [("test-only", "200", 0, 6), ("test-only", "401", 1, 6), ("test-only", "503", 1, 6), ("", "200", 0, 0)]:
        log.write_text("")
        result = subprocess.run([bash, "--noprofile", "--norc", "-s"], input=stub + call, text=True, encoding="utf-8", capture_output=True, env={**env, "BASE_URL": "https://example.invalid", "CRON_SECRET": secret, "ROUTES": all_routes, "STUB_LOG": log.as_posix(), "STUB_CODE": code}, timeout=15)
        assert result.returncode == exit_code, result.stderr + result.stdout
        urls = log.read_text().splitlines()
        assert len(urls) == count
        assert all(url == "https://example.invalid/api/cron/" + route for url, route in zip(urls, all_routes.split()))
        assert "test-only" not in result.stdout + result.stderr
        print("PASS call:", "missing secret" if not secret else code, "exit", exit_code, "calls", count)
print("11 passed; no network, deploy, checkout or migration.")
