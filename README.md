# SkillCorner Body Pose Viewer

Interactive 3D viewer for SkillCorner Open Data. It combines Body Pose and Game
Intelligence data to replay shots with player poses, ball tracking, head
orientation, and a continuous two-tier arena environment with integrated roof lighting.

## Quick start

The project uses Python 3.12.x for the data notebook and a static HTTP server.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m http.server 8000
```

Open <http://127.0.0.1:8000>.

To work on the data pipeline, start JupyterLab from the same environment:

```bash
jupyter lab
```

## Repository layout

```text
assets/css/    Interface styles
assets/js/     Reusable Three.js scene modules
data/clips/    Compact replay files consumed by the viewer
data/source/   Downloaded source files (ignored by Git)
docs/          Visual and technical notes
notebooks/     Data collection and replay generation
index.html     Static GitHub Pages entry point
```

## Data pipeline

Run `notebooks/00-data_collection.ipynb`. It downloads the official Body Pose
and Game Intelligence files, selects player possessions ending in shots, and
updates `data/clips/` and `data/manifest.json`.

The notebook currently uses only the Python standard library; JupyterLab and
IPykernel are development tools pinned in `requirements.txt` so the environment
is reproducible.
