RM Tea Club V8

Replace:
- main.jsx
- components/PosterStudio.jsx
- poster.css

Then append the contents of style_v8_additions.css to the END of your existing style.css.

New features:
- monthly-only outstanding calculation (legacy oldDebt excluded)
- weekly dashboard rows filtered out
- hide-left preference saved
- consistent green paid-member cards
- transaction edit and delete
- monthly reports and CSV export
- working local stock register
- editable poster/contact settings
- poster settings and stock stored in browser localStorage

Note: Stock and poster settings are stored per browser/device. Members and transactions remain in Firestore.
