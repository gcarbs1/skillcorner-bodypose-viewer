# SkillCorner Body Pose Viewer

## Overview

Combines SkillCorner's open Body Pose and Game Intelligence data to reconstruct shots from two matches in 3D. The pipeline synchronizes poses at 25 FPS with events at 10 FPS and makes the results available in `index.html`:

- **Library.** Brings together 60 shots, filterable by match, with goals highlighted.
- **3D scene.** Displays player poses, the ball, and the shooter's head orientation on the pitch.
- **Player view.** Positions a second camera at the shooter's head.
- **Playback.** Provides a timeline, 0.5×, 1×, and 2× speeds, and frame-by-frame navigation.

## Structure

- `notebooks/00-data_collection.ipynb`: downloads the official files, selects possessions ending in a shot, compacts the pose frames, and exports the audited viewer data.
- `data/raw/`: original files downloaded by the notebook and excluded from version control.
- `data/processed/`: final tables containing the shots and collection metrics.
- `docs/`: visual architecture and stadium performance decisions.
- `index.html` and `html/`: Three.js viewer with styles, application logic, stadium, compact data, and local dependencies.

## Outputs

| path | contents |
|---|---|
| `data/processed/shots.csv` | one shot per row, with player, team, outcome, position, and pose coverage |
| `data/processed/collection_audit.csv` | collection counts and coverage indicators |
| `html/data/manifest.json` | matches, players, joints, bones, and clip metadata |
| `html/data/clips/` | one compact JSON file per shot, with pose frames and ball trajectory |
