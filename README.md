# Shots Gained Tracker

This project is a lightweight, client-side web app for logging golf shots and calculating strokes gained insights for each round you play.

## Running locally

Open `index.html` in your browser or serve the project from a simple static server:

```bash
python -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000).

## Features

- Create, select, and delete rounds.
- Capture shot-level data including lie, distance, expected strokes, and strokes to finish.
- Automatic strokes gained calculation with per-round, per-hole, per-shot, and per-category summaries.
- Edit or remove individual shots and clear entire rounds.
- Export your data to JSON for safekeeping and import it on another device.

All data stays in your browser via `localStorage` until you export it.
