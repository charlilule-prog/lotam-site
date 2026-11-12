# אתר התדמית של לוטם

אתר סטטי. התוכן נמצא בקובצי JSON, והעיצוב בתבניות HTML.

- `content/settings.json` – הגדרות כלליות ו-SEO (כולל המתג "להופיע בגוגל")
- `content/home.json` – כל הטקסטים של עמוד הבית
- `content/guide.json` – עמוד המדריך
- `src/` – תבניות העמודים (עיצוב וקוד)
- `static/` – תמונות, גופנים, דף 404, `llms.txt` ומסך העריכה (`/admin/`)
- `build.mjs` – בונה את האתר לתיקייה `dist/` (בלי תלויות)

## בנייה
```
node build.mjs
```

## Cloudflare Pages
- Build command: `node build.mjs`
- Build output directory: `dist`

## עריכה
נכנסים ל-`/admin/` באתר, מתחברים עם GitHub, עורכים ושומרים. כל שמירה נכנסת למאגר, ו-Cloudflare בונה ומפרסם מחדש.

## רישיונות
- גופנים Heebo ו-Rubik: SIL Open Font License 1.1 (`static/fonts/LICENSE-*.txt`)
- Sveltia CMS: MIT (`static/admin/LICENSE-sveltia-cms.txt`)
