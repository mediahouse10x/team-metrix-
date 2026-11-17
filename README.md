# Team Metrix

A single-page tool with two independent sections, both backed by a **Google Sheet as the database**:

- **Team Metrics** — monthly goal vs actual per person, per job.
- **Deliverables** — what each brand gets this month, per deliverable type.

The two share nothing but the sheet they live in.

| File | What it is |
|---|---|
| `index.html` | The whole app — open it in any browser, no build step, no server |
| `Code.gs` | Google Apps Script to paste into the sheet (this is the backend) |
| `Google Sheet setup.md` | Step-by-step setup, in Tamil |

## Team Metrics

- **Dashboard** — team average, EPI / MPI / LPI / Below-LPI counts, leaderboard, per-person breakdown, 6-month trend chart.
- **Monthly Entry** — goal vs actual for every job a person does; achievement and status update as you type.
- **Team & Roles** — add people, set Junior/Senior, tick the jobs each person does.
- **Jobs & Settings** — the job library, the rating thresholds and weights, and the Google Sheet connection.
- **Export** — CSV (Details / Summary / 6-month trend) or a 3-sheet Excel file, for the selected month.

## Deliverables

- **Plan** — create brands, add each brand's deliverables (Ads, Story, Carousel, Reels, anything), and set how many of each go out this month. "Copy from last month" fills a repeating retainer in one click.
- **Overview** — total deliverables for the month, a ranked table by brand with each brand's share, totals by deliverable type across all brands, a per-brand breakdown and a bar chart. Exports to CSV.

Quantities are per month, so each month stands on its own and past months stay readable.

## Scoring

Overall % is a weighted average of each job's `actual / goal`, with **Critical jobs weighted ×2** and Key jobs ×1, capped at 120%. A Critical job below the LPI threshold caps the person's status at MPI. All thresholds, weights and the cap are editable in Jobs & Settings and apply to every month, past ones included.

## Setup

1. Make a Google Sheet.
2. **Extensions → Apps Script**, paste `Code.gs`, save.
3. **Deploy → New deployment → Web app**, execute as **Me**, access **Anyone**. Copy the `/exec` URL.
4. Open the page → **Jobs & Settings → Google Sheet database** → paste the URL → **Save & connect**.

Live: **https://mediahouse10x.github.io/team-metrix-/**

Full instructions, including what each sheet tab holds: [`Google Sheet setup.md`](Google%20Sheet%20setup.md).

The web app URL is stored in the browser only — it is never committed to this repo.

## Offline

If the sheet can't be reached, the page keeps working and holds changes in the browser, shows a warning, and pushes them to the sheet when you press **Push this browser's data**.
