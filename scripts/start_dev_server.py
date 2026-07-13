from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "dev-server.out.log"
ERR = ROOT / "dev-server.err.log"


def main() -> None:
    OUT.write_text("", encoding="utf-8")
    ERR.write_text("", encoding="utf-8")

    creationflags = 0
    if hasattr(subprocess, "CREATE_NEW_PROCESS_GROUP"):
        creationflags |= subprocess.CREATE_NEW_PROCESS_GROUP
    if hasattr(subprocess, "DETACHED_PROCESS"):
        creationflags |= subprocess.DETACHED_PROCESS
    if hasattr(subprocess, "CREATE_NO_WINDOW"):
        creationflags |= subprocess.CREATE_NO_WINDOW

    with OUT.open("ab") as out, ERR.open("ab") as err:
        process = subprocess.Popen(
            [
                str(ROOT / "node_modules" / ".bin" / "vinext.cmd"),
                "dev",
                "--hostname",
                "127.0.0.1",
                "--port",
                "3000",
            ],
            cwd=ROOT,
            stdout=out,
            stderr=err,
            stdin=subprocess.DEVNULL,
            close_fds=True,
            creationflags=creationflags,
        )

    print(process.pid)


if __name__ == "__main__":
    main()
