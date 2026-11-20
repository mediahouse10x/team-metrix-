# Team Metrix

A single-page tool with three sections, all backed by a **Google Sheet as the database**:

- **Team Metrics** — monthly goal vs actual per person, per job.
- **Deliverables** — what each brand gets this month, per deliverable type.
- **Allocation** — that brand plan split across the team, with Key/Critical weights and responsibilities.

Metrics and Deliverables share nothing. Allocation *reads* the team list and the plan quantities so nothing is typed twice, and writes only its own data — neither of the other two reads anything from it.

| File | What it is |
|---|---|
| `index.html` | The whole app — open it in any browser, no build step, no server |
| `model.js` | Pure structure rules (pods, owners, validation) — no DOM, so it can be tested on its own |
| `Code.gs` | Google Apps Script to paste into the sheet (this is the backend) |
| `tests.html`, `tests/` | The model tests; run them with `node tests/run.js` or open `tests.html` |
| `Google Sheet setup.md` | Step-by-step setup, in Tamil |

## Team Metrics

- **Dashboard** — team average, EPI / MPI / LPI / Below-LPI counts, leaderboard, per-person breakdown, 6-month trend chart.
- **Monthly Entry** — goal vs actual for every job a person does; achievement and status update as you type.
- **Team & Roles** — add people, set Junior/Senior, tick the jobs each person does.
- **Jobs & Settings** — the job library, the rating thresholds and weights, and the Google Sheet connection.
- **Export** — CSV (Details / Summary / 6-month trend) or a 3-sheet Excel file, for the selected month.

## Deliverables

- **Plan** — create brands, add each brand's deliverables (Ads, Story, Carousel, Reels, anything), and set how many of each go out this month plus **Hrs each**, how long one piece takes. The quantity is per month; the hours carry over. Each row shows its own hours and the brand header shows `30 pieces · 55 hrs`. "Copy from last month" fills a repeating retainer in one click.
- **Overview** — total deliverables for the month, a ranked table by brand with each brand's share, totals by deliverable type across all brands, a per-brand breakdown and a bar chart. Exports to CSV.

Quantities are per month, so each month stands on its own and past months stay readable.

## Allocation

- **Split** — the team list comes first. Pick a person and you see everything they deliver this month, grouped by brand: each of that brand's deliverables with one box for this person, their running total per brand, and `pieces · responsibilities · critical` for the whole month. Every line shows `planned 60 · split 40 · 20 left` across the whole team as you type, and **Take 20** drops whatever is still unassigned into this person's box. Each line is either a **Deliverable** (a count) or a **Responsibility** (ticked for whoever owns it, no numbers), and carries a **Key** or **Critical** weight.
- **Team load** — pieces split vs planned for the month and what is still unsplit, a per-person table with share, critical count and responsibilities, a bar chart, a per-person breakdown, and a "still to split" table naming every line where the split does not match the plan. Exports to CSV.

The team list comes from Team & Roles and the quantities from the Deliverables plan, so the "still to split" figure is always honest.

## Structure

How the team is organised, one structure per month — the month picker is the structure selector, so November's pods stay November's however you rearrange December.

Two screens, nothing else.

**The pod list** — every pod as a read-only card: its channels with their owner, its people with their roles. Reorder with ← →, add one with **New pod**, and anything not yet placed sits in a "Not in any pod" card (drag from there onto a pod if you prefer). Checks run above the list.

**Press Edit on a pod** and that pod opens on its own screen, in five steps:

1. **This pod** — name, type (organic / ads / floater), colour, description.
2. **Which channels are in this pod?** — tick them from the brands in Deliverables → Plan. Ticking one that sits in another pod moves it.
3. **Who is in this pod?** — tick them from the people in Team & Roles. Same rule.
4. **What does each person do here?** — seniority, monthly capacity, and their roles in this pod (pod lead, channel owner, editor, QC, floater).
5. **Who runs each channel?** — per channel, the owner, the backup, the owner's time percent, and tick everyone else who works on it. The owner is always on the channel and cannot be unticked. Floaters from any pod are offered everywhere.

Everything saves as you change it. Nothing is pre-filled and nothing is hard-coded: the channels are whatever is in Deliverables, the people are whatever is in Team & Roles, and every pairing is yours to pick.

**Checks** — *errors*: a channel with no owner, an owner or crew member outside the channel's pod (floaters excepted), duplicate display names. *Warnings*: a pod with no lead or no senior, someone in no pod, a channel with nobody or with only one person, a senior owning more than three channels, and a pod planned past its editing capacity (capacity × (1 − owner time), measured against the pieces Allocation has given its members).

Moving a channel or a person between pods drops anyone who no longer belongs, so the structure cannot drift into a state the checks would reject. Channels parked outside every pod keep their setup until they are placed again.

### Workload

The Deliverables plan reaches the pods by itself. Open **Structure → Workload** and every channel that has a planned quantity, sits in a pod and has people on it is shared between those people — evenly, whole pieces, remainder to the first. Channels you have already set by hand are left exactly as they are.

Each pod shows what it has to put out this month, channel by channel and deliverable by deliverable, with what each person is carrying. Every number is an input: change one and it sticks, **Re-split** shares that line out evenly again, and a line that no longer adds up says so (`6 not placed`).

**Hours** run all the way through: `Reels · 20 to deliver · 2 hrs each · 40 hrs` per line, the hours for each channel and each pod, and what every person is carrying against their own capacity (`Kamesh 15 pc · 27.5/24 hrs`, red when over). The tiles at the top compare the month's hours with the team's capacity — capacity being each person's **hrs/month** from the Builder, less their owner time — and say whether you are short or have hours spare.

These are the same numbers as Allocation → Split and Team load, not a second copy — change one and the others follow. Channels with a plan but no pod, or no people, are called out at the top.

### Running the tests

```
node tests/run.js
```

The same cases run in a browser at `tests.html`. They cover the lookup helpers (`getActiveStructure`, `getPodForBrand`, `getOwnerForBrand`, `getMembersOfPod`), the capacity maths and every validation rule.

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
