from __future__ import annotations

import argparse
import json
import os
import shutil
import sqlite3
import stat
import subprocess
import sys
from datetime import datetime
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
RELEASES = ROOT / "releases"


STARTER = r'''from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
import venv
import webbrowser
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND_DIST = ROOT / "frontend" / "dist"
VENV_DIR = ROOT / ".runtime-venv"
BACKEND_PORT = int(os.environ.get("ARQUEOGRAPH_API_PORT", "8000"))
FRONTEND_PORT = int(os.environ.get("ARQUEOGRAPH_WEB_PORT", "5174"))


def is_port_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def python_bin() -> Path:
    if os.name == "nt":
        return VENV_DIR / "Scripts" / "python.exe"
    return VENV_DIR / "bin" / "python"


def ensure_runtime() -> Path:
    py = python_bin()
    marker = VENV_DIR / ".installed"
    if not py.exists():
        print("Creando entorno Python local...")
        venv.EnvBuilder(with_pip=True).create(VENV_DIR)
    if not marker.exists():
        print("Instalando dependencias del backend...")
        subprocess.check_call([str(py), "-m", "pip", "install", "--upgrade", "pip"])
        subprocess.check_call([str(py), "-m", "pip", "install", "-r", str(BACKEND / "requirements.txt")])
        marker.write_text("ok\n", encoding="utf-8")
    return py


def start_processes(py: Path) -> list[subprocess.Popen]:
    if is_port_open(BACKEND_PORT):
        raise SystemExit(f"El puerto API {BACKEND_PORT} ya esta ocupado. Cierra esa app o usa ARQUEOGRAPH_API_PORT.")
    if is_port_open(FRONTEND_PORT):
        raise SystemExit(f"El puerto web {FRONTEND_PORT} ya esta ocupado. Cierra esa app o usa ARQUEOGRAPH_WEB_PORT.")

    env = os.environ.copy()
    env["PYTHONPATH"] = str(BACKEND)

    backend = subprocess.Popen(
        [
            str(py),
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(BACKEND_PORT),
        ],
        cwd=BACKEND,
        env=env,
    )

    frontend = subprocess.Popen(
        [str(py), "-m", "http.server", str(FRONTEND_PORT), "--bind", "127.0.0.1"],
        cwd=FRONTEND_DIST,
        env=env,
    )

    return [backend, frontend]


def main() -> int:
    if not BACKEND.exists() or not FRONTEND_DIST.exists():
        print("No encuentro backend o frontend/dist dentro del paquete.")
        return 1

    (BACKEND / "data" / "uploads").mkdir(parents=True, exist_ok=True)
    (BACKEND / "data" / "imagenes").mkdir(parents=True, exist_ok=True)

    py = ensure_runtime()
    processes = start_processes(py)
    url = f"http://127.0.0.1:{FRONTEND_PORT}/"
    print("")
    print("ArqueoGraph iniciado.")
    print(f"Frontend: {url}")
    print(f"API:      http://127.0.0.1:{BACKEND_PORT}/docs")
    print("Presiona Ctrl+C para cerrar.")
    time.sleep(1.5)
    webbrowser.open(url)

    try:
        while all(proc.poll() is None for proc in processes):
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\nCerrando ArqueoGraph...")
    finally:
        for proc in processes:
            if proc.poll() is None:
                proc.terminate()
        for proc in processes:
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
'''


README_PACKAGE = r'''# ArqueoGraph - paquete compartible

Este paquete contiene una copia ejecutable local de ArqueoGraph:

- backend FastAPI;
- frontend ya compilado;
- base SQLite actual;
- plantillas y tutorial para nuevos sitios;
- scripts de arranque.

## Requisitos

- Python 3.10 o superior.
- Internet solo la primera vez, para instalar dependencias Python en `.runtime-venv`.
- No se necesita Node para ejecutar este paquete.

## Abrir la app

En macOS/Linux:

```bash
./start.sh
```

En macOS tambien puedes hacer doble clic en:

```text
start.command
```

En Windows:

```bat
start.bat
```

La app abre:

```text
http://127.0.0.1:5174/
```

La API queda en:

```text
http://127.0.0.1:8000/docs
```

## Datos incluidos

Este paquete incluye `backend/data/arqueograph.sqlite`, que contiene los datos
normalizados actuales.

Si el paquete fue creado en modo `lite`, no incluye las carpetas pesadas de
imagenes. La app funciona igual, pero algunas imagenes referenciadas pueden no
estar disponibles en detalle. Para compartir tambien las imagenes, crear un
paquete `full`.

## Crear nuevos sitios

Ver:

```text
NUEVOS_SITIOS.md
```

Comandos principales:

```bash
PYTHONPATH=backend python3 backend/scripts/site_package.py create --id caleta_vitor --nombre "Caleta Vitor"
PYTHONPATH=backend python3 backend/scripts/site_package.py validate --id caleta_vitor
PYTHONPATH=backend python3 backend/scripts/site_package.py import --id caleta_vitor
```

## Cerrar

Volver a la terminal donde se ejecuto `start.sh` y presionar `Ctrl+C`.
'''


START_SH = """#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
python3 start_arqueograph.py
"""


START_BAT = """@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %ERRORLEVEL% EQU 0 (
  py -3 start_arqueograph.py
) else (
  python start_arqueograph.py
)
pause
"""


def run(cmd: list[str], cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    print("$ " + " ".join(cmd))
    subprocess.check_call(cmd, cwd=cwd, env=env)


def copy_file(src: Path, dst: Path) -> None:
    if not src.exists():
        return
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)


def copy_tree(src: Path, dst: Path, ignore: shutil.IgnorePattern | None = None) -> None:
    if not src.exists():
        return
    shutil.copytree(src, dst, ignore=ignore)


def write_text(path: Path, text: str, executable: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    if executable:
        current = path.stat().st_mode
        path.chmod(current | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def build_frontend() -> None:
    env = os.environ.copy()
    env["VITE_API_BASE"] = "http://127.0.0.1:8000"
    run(["npm", "run", "build"], cwd=FRONTEND, env=env)


def sqlite_counts(db_path: Path) -> dict[str, int]:
    if not db_path.exists():
        return {}
    tables = ["sitios", "individuos", "mediciones_quimicas", "paleopatologias", "dataciones", "imagenes"]
    with sqlite3.connect(db_path) as conn:
        return {
            table: conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in tables
        }


def package_size(path: Path) -> str:
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            total += item.stat().st_size
    units = ["B", "KB", "MB", "GB"]
    size = float(total)
    for unit in units:
        if size < 1024 or unit == units[-1]:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{total} B"


def copy_backend_data(target_backend: Path, include_images: bool) -> None:
    data_src = BACKEND / "data"
    data_dst = target_backend / "data"
    data_dst.mkdir(parents=True, exist_ok=True)

    for item in data_src.iterdir():
        if item.name.startswith("."):
            continue
        if item.name.startswith("respaldo_") and item.suffix == ".sqlite":
            continue
        if item.name == "imagenes":
            continue
        if item.is_file():
            copy_file(item, data_dst / item.name)
        elif item.is_dir() and item.name != "__pycache__":
            copy_tree(item, data_dst / item.name, ignore=shutil.ignore_patterns(".DS_Store", "__pycache__"))

    images_src = data_src / "imagenes"
    images_dst = data_dst / "imagenes"
    images_dst.mkdir(parents=True, exist_ok=True)
    if include_images:
        for item in images_src.iterdir():
            if item.name.startswith("."):
                continue
            if item.is_file():
                copy_file(item, images_dst / item.name)
            elif item.is_dir():
                copy_tree(item, images_dst / item.name, ignore=shutil.ignore_patterns(".DS_Store", "__pycache__"))
    else:
        copy_file(images_src / "mapa_playa_chinchorro.svg", images_dst / "mapa_playa_chinchorro.svg")
        write_text(images_dst / "README_IMAGENES_LITE.txt", "Paquete lite: las carpetas pesadas de imagenes no fueron incluidas.\n")


def create_package(args: argparse.Namespace) -> dict[str, str]:
    if not args.skip_build:
        build_frontend()

    RELEASES.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    mode = "full" if args.full else "lite"
    package_name = f"ArqueoGraph_{mode}_{timestamp}"
    package_dir = RELEASES / package_name
    if package_dir.exists():
        shutil.rmtree(package_dir)

    package_dir.mkdir(parents=True)

    for name in [
        "README.md",
        "README_FASE7_TUTORIAL.md",
        "TUTORIAL_ACCESO_LOCAL.md",
        "MIGRACION_SQLITE.md",
        "NUEVOS_SITIOS.md",
        "PAQUETE_APP.md",
    ]:
        copy_file(ROOT / name, package_dir / name)

    copy_tree(BACKEND / "app", package_dir / "backend" / "app", ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store"))
    copy_tree(BACKEND / "scripts", package_dir / "backend" / "scripts", ignore=shutil.ignore_patterns("__pycache__", "*.pyc", ".DS_Store"))
    copy_tree(BACKEND / "templates", package_dir / "backend" / "templates", ignore=shutil.ignore_patterns(".DS_Store"))
    copy_tree(BACKEND / "sample_data", package_dir / "backend" / "sample_data", ignore=shutil.ignore_patterns(".DS_Store"))
    copy_file(BACKEND / "requirements.txt", package_dir / "backend" / "requirements.txt")
    copy_backend_data(package_dir / "backend", include_images=args.full)

    copy_tree(FRONTEND / "dist", package_dir / "frontend" / "dist", ignore=shutil.ignore_patterns(".DS_Store"))

    write_text(package_dir / "start_arqueograph.py", STARTER)
    write_text(package_dir / "start.sh", START_SH, executable=True)
    write_text(package_dir / "start.command", START_SH, executable=True)
    write_text(package_dir / "start.bat", START_BAT)
    write_text(package_dir / "README_PAQUETE.md", README_PACKAGE)

    manifest = {
        "name": package_name,
        "mode": mode,
        "created_at": timestamp,
        "frontend_api_base": "http://127.0.0.1:8000",
        "includes_images": args.full,
        "db_counts": sqlite_counts(package_dir / "backend" / "data" / "arqueograph.sqlite"),
        "runtime": {
            "frontend": "http://127.0.0.1:5174/",
            "api": "http://127.0.0.1:8000/docs",
        },
    }
    write_text(package_dir / "PACKAGE_MANIFEST.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")

    archive = ""
    if not args.no_zip:
        archive = shutil.make_archive(str(package_dir), "zip", root_dir=RELEASES, base_dir=package_name)

    return {
        "package_dir": str(package_dir),
        "archive": archive,
        "size": package_size(package_dir),
        "mode": mode,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Construye un paquete compartible de ArqueoGraph.")
    parser.add_argument("--full", action="store_true", help="Incluye backend/data/imagenes completo.")
    parser.add_argument("--skip-build", action="store_true", help="No recompila frontend/dist.")
    parser.add_argument("--no-zip", action="store_true", help="Crea carpeta pero no archivo zip.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        result = create_package(args)
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False, indent=2))
        return 1
    print(json.dumps({"ok": True, **result}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
