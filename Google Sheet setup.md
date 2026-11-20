# Google Sheet-ஐ backend ஆ இணைக்கிறது

HTML page-ஓட database இப்போ ஒரு Google Sheet. Page browser-ல ஓடும், data ஷீட்ல இருக்கும்.

## ஒரு தடவை செய்ய வேண்டியது

1. புது Google Sheet ஒன்னு உருவாக்குங்க. பேர் எதுவா இருந்தாலும் சரி (உதா. `Team Metrics DB`).
2. அந்த ஷீட்ல **Extensions → Apps Script** திறங்க.
3. உள்ள இருக்கற `Code.gs` code-ஐ முழுசா delete பண்ணிட்டு, இந்த folder-ல இருக்கற **`Code.gs`** file-ஓட content-ஐ paste பண்ணி **Save** (💾).
4. மேல வலது பக்கம் **Deploy → New deployment** → ⚙️ icon-ல **Web app** தேர்வு பண்ணுங்க.
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`  ← இது முக்கியம். `Anyone with Google account` வேலை செய்யாது.
   - **Deploy** → Google permission கேட்கும் → `Advanced` → `Go to … (unsafe)` → **Allow**.
     (இது உங்க சொந்த script, உங்க ஷீட்ல மட்டும் வேலை செய்யும்.)
5. கடைசியா கிடைக்கற **Web app URL** (`https://script.google.com/macros/s/..../exec`) copy பண்ணுங்க.
6. `Team Individual Metrics.html` page-ஐ browser-ல திறந்து **Jobs & Settings → Google Sheet database** பகுதியில அந்த URL-ஐ paste பண்ணி **Save & connect** அழுத்துங்க.

மேல வலது மூலையில `Sheet connected` ன்னு பச்சை badge வந்தா இணைப்பு சரி.

## ஷீட்ல என்ன இருக்கும்

Script-ஏ tab-களை உருவாக்கிக்கும்.

**Team Metrics பகுதி:**

| Tab | Columns |
|---|---|
| `Jobs` | id, level, category, job, ck |
| `Team` | id, name, level, jobs (job id-கள் comma-ல) |
| `Settings` | key, value (EPI/MPI/LPI, weights, cap) |
| `Entries` | month, personId, jobId, goal, actual |

**Deliverables பகுதி** (மேல இருக்கற tab-களோட எந்த சம்மந்தமும் இல்ல):

| Tab | Columns |
|---|---|
| `Brands` | id, name |
| `BrandItems` | brandId, itemId, name, hoursPerPiece |
| `Plan` | month, brandId, itemId, quantity |

**Allocation பகுதி** (Plan-ஐ team-க்கு பிரிச்சு கொடுக்கறது):

| Tab | Columns |
|---|---|
| `AllocTags` | brandId, itemId, ck (Key/Critical), kind (count/resp) |
| `Alloc` | month, brandId, itemId, personId, value |

**Structure பகுதி** (மாசம் வாரியா pod அமைப்பு):

| Tab | Columns |
|---|---|
| `Pods` | month, id, name, type, color, sortOrder, description |
| `PodBrands` | month, brandId, podId |
| `BrandTeam` | month, brandId, personId (அந்த channel-ல வேலை செய்யறவங்க) |
| `PodMembers` | month, personId, podId, roles |
| `BrandOwners` | month, brandId, primaryId, backupId, ownerPct |
| `StructMeta` | month, key, value |

`Team`, `Brands` tab-களுக்கு புது column-கள் சேர்ந்திருக்கு (displayName, skills, capacity, active / kind, platforms, formats, notes, active). புது Code.gs-ஐ deploy பண்ணினா header வரி தானா update ஆகும், பழைய data போகாது.

ஷீட்ல data-வ படிக்கலாம், pivot/chart போடலாம். ஆனா **கையால edit பண்ணாதீங்க** — page-ல இருந்து save ஆகும்போது அந்த tab மறுபடியும் எழுதப்படும். கையால மாத்தினா, page-ல **Reload from sheet** அழுத்தினா அது page-க்கு வரும்.

## முக்கியமான குறிப்புகள்

- **ஏற்கனவே browser-ல இருக்கற data:** முதல்முறை connect பண்ணும்போது ஷீட் காலியா இருந்தா, page-ல இருக்கற data தானா ஷீட்க்கு போயிடும். வேணும்னா **Push this browser's data** button-ஐ அழுத்தி எல்லா மாசமும் ஷீட்க்கு அனுப்பலாம்.
- **பல பேர் use பண்ணனும்னா:** அதே HTML file-ஐ அவங்களுக்கு கொடுத்து, அதே web app URL-ஐ அவங்க page-லயும் paste பண்ணுங்க. எல்லாரும் ஒரே ஷீட்ல எழுதுவாங்க. ஒரே job-ஐ ஒரே நேரத்துல ரெண்டு பேர் save பண்ணா கடைசியா save ஆனது நிக்கும்.
- **Internet இல்லனா:** page வேலை செய்யும், data browser-ல தங்கும், ஆனா ஷீட்க்கு போகாது. மேல ஒரு எச்சரிக்கை தெரியும். Internet வந்ததும் **Push this browser's data** அழுத்துங்க.
- **Code.gs-ஐ மாத்தினா:** Deploy → Manage deployments → ✏️ → Version `New version` → Deploy. இல்லாட்டி பழைய code-ஏ ஓடிட்டு இருக்கும்.

## Export

Dashboard மேல வலது பக்கம்:

- **Export CSV** — பக்கத்துல இருக்கற dropdown-ல `Details` / `Summary` / `6-month trend` தேர்வு பண்ணி அழுத்துங்க. ஒரு `.csv` file download ஆகும் (Excel, Google Sheets ரெண்டுலயும் நேரா திறக்கும்).
- **Export to Excel** — மூணு sheet-உம் சேர்ந்த ஒரே `.xlsx` file.

ரெண்டுமே **இப்போ தேர்வு பண்ணி இருக்கற மாசத்தோட** data.
