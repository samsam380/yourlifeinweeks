# Life in Weeks

A minimalist, dark-teal life calendar inspired by the classic **Your Life in Weeks** map.

Every week is clickable. Use it as a private, local-first memory ledger:

- add a title, note, and tags to any week
- highlight meaningful weeks
- cross out weeks that passed
- auto-cross past weeks from your birth date
- search notes
- export/import a JSON backup
- switch between box and circle cells
- change expected lifespan and cell size

The app is static HTML/CSS/JS. It has no backend and no tracking. Your notes live in the browser's `localStorage` unless you export them.

## Run locally

Open `index.html` directly, or serve it:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Deploy

This repository includes a GitHub Pages workflow. After pushing to GitHub, enable Pages for the repository and select **GitHub Actions** as the source.

## Design notes

The visual direction follows the sam256.com vibe: black background, mono type, subtle teal glow, minimal controls, no unnecessary decoration.
