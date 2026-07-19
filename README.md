# RM Tea Club Manager V9 Clean Monthly

Clean single-source project structure.

## Only source folder used

- `src/main.jsx`
- `src/style.css`
- `src/poster.css`
- `src/components/PosterStudio.jsx`
- `src/services/firestore.js`
- `src/firebase.js`

There are no duplicate root-level React source files.

## Deploy

Upload the complete contents of this package to the repository root, replacing the old repository contents.
Firebase App Hosting builds with `npm run build` and starts `server.js`.

## Monthly-only rules

Outstanding is calculated only from due and overdue month statuses from July 2026.
Legacy weekly dashboard rows and legacy outstanding fields are not used.


## V9.0.1 registry fix

The package lock now uses the public npm registry:
`https://registry.npmjs.org/`

Internal sandbox registry URLs replaced: 50.
