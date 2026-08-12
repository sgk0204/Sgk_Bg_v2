# Monthly Budget & Investment Dashboard

A fully dynamic, client-side budget & investment tracker. Every number on
every screen — dashboard cards, category tables, monthly history, yearly
rollups, charts — is computed live from data **you** enter. Nothing in
this app is hardcoded or pre-filled with sample figures.

No build step, still plain HTML/CSS/JS in the browser — but data now lives
in **Firebase** (Auth + Firestore), scoped to your signed-in account, so it
follows you across devices instead of being stuck in one browser.

## Project structure

```
budget-dashboard/
├── index.html                  # App shell — layout, tabs, modal, CDN includes
├── css/
│   └── styles.css              # Custom CSS (scrollbars, tab states, grid borders)
├── js/
│   ├── config.js                # DEFAULT_CONFIG (category schema only) + empty
│   │                             #   INITIAL_TRANSACTIONS — no sample data
│   └── app.js                   # BudgetApp class: all state, rendering, and
│                                 #   SUMIFS/QUERY-style aggregation logic
├── .github/
│   └── workflows/
│       └── deploy.yml           # GitHub Actions workflow — auto-deploys to
│                                 #   GitHub Pages on every push to `main`
├── .gitignore
└── README.md
```

### How data flows (mirrors the original Google Sheets spec)

| Original spec sheet         | This app's equivalent                                   |
|------------------------------|-----------------------------------------------------------|
| Config                       | "1. Config & Salary" tab — salary history + category/threshold schema |
| Transactions (daily entry)   | "2. Transactions Log" tab — the only place you manually type data |
| Dashboard (auto-calculated)  | "3. Monthly Dashboard" tab — SUMIFS-equivalent totals, % of salary, conditional formatting, daily burn rate |
| Monthly Summary (auto history) | "4. Monthly Summary" tab — one row per month, recalculated from Transactions |
| Yearly Dashboard              | "5. Yearly Dashboard" tab — year totals, Jan–Dec grid, YoY comparison |
| Charts                        | "6. Visual Charts" tab — 6 Chart.js charts driven by the same data |

Add a transaction in tab 2, and tabs 3–6 update instantly — no manual
totaling anywhere.

## Running it locally

Just open `index.html` in a browser. That's it — there's no install step
because all dependencies (Tailwind, Chart.js, Font Awesome, Google Fonts)
load from CDNs.

If you prefer a local server (recommended, some browsers restrict local
file access for certain features):

```bash
# Python
python3 -m http.server 8000

# Node (if you have it)
npx serve .
```

Then visit `http://localhost:8000`.

## Deploying to GitHub Pages

### Option A — included GitHub Actions workflow (recommended)

1. Create a new repository on GitHub (public or private with Pages enabled on your plan).
2. Push this project to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Budget & Investment Dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```
3. In your repo on GitHub, go to **Settings → Pages**, and under
   **Build and deployment → Source**, select **GitHub Actions**.
4. The included workflow at `.github/workflows/deploy.yml` will run
   automatically on every push to `main` and deploy the site.
5. Your dashboard will be live at:
   `https://<your-username>.github.io/<your-repo>/`

### Option B — manual Pages setup (no Actions)

1. Push the project to GitHub as above.
2. Go to **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**, pick `main` and
   `/ (root)`, then save.
4. GitHub will publish the site at the same URL pattern as above within
   a minute or two.

## Setting up your own Firebase backend

This app is still a static site (GitHub Pages hosting doesn't change),
but it now talks to Firebase for login and cloud storage. You need your
own free Firebase project — takes about 5 minutes:

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   and create a project (the free "Spark" plan is enough).
2. **Project settings → General → Your apps →** click the `</>` web icon
   → register an app → copy the `firebaseConfig` values it shows you.
3. Paste those values into `js/firebase-config.js` (replace the
   `"YOUR_..."` placeholders).
4. **Build → Authentication → Get started → Sign-in method** → enable
   **Email/Password** (and **Google**, if you want that button to work —
   it just needs enabling and a support email).
5. **Build → Firestore Database → Create database** → start in
   **production mode** → pick a nearby region.
6. Firestore → **Rules** tab → replace the default rules with the ones
   below → **Publish**. This is what keeps every user's data private —
   without it, anyone could read/write anyone else's budget:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /budgets/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

7. Commit and push `js/firebase-config.js` with your real values, then
   deploy as usual (see below). Firebase config values are safe to have
   in a public repo — they're not secret keys; the Firestore rules above
   are what actually enforce privacy.

## Data & privacy notes

- Data now lives in **Firestore**, under a document keyed to your
  Firebase user ID — so it's private to your account and syncs across
  any device you log into.
- The security rules above mean only you (the signed-in owner) can ever
  read or write your document — Google/Firebase, not this static site,
  enforces that.
- The trash-can icon in the top bar (**Clear All Data**) permanently
  wipes your salary history and transactions after a confirmation
  prompt — there is no undo.
- **Export CSV** still works as a manual backup at any time.

## Customizing categories

Edit `js/config.js` to change the `Responsible` / `Bonus` / `Investment`
category names in `DEFAULT_CONFIG.categories`. This only affects the
dropdown options and schema — it does not add any fake transactions.

## License

MIT — see `LICENSE`.
