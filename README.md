# SkillCorner Body Pose Viewer

Interactive 3D viewer for SkillCorner Open Data, combining Body Pose and Game
Intelligence data to replay shots with player poses, ball tracking, and head
orientation.

## Structure

- `index.html`: static website ready for GitHub Pages.
- `notebooks/`: data collection and replay generation.
- `data/source/`: downloaded source files (ignored by Git).
- `data/clips/`: compact replay files consumed by the viewer.
- `data/manifest.json`: match, player, and clip metadata consumed by the viewer.

## Pipeline

Run the notebook:

1. `00-data_collection.ipynb`

The notebook downloads the official Body Pose and Game Intelligence files,
selects player possessions ending in shots, and updates `data/clips/` and
`data/manifest.json`. Serve the repository over HTTP to open `index.html` with
the generated data.
