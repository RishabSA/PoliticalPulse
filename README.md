# PoliticalPulse

![PoliticalPulse Demo](resources/PoliticalPulseQuickDemo.gif)

[Try PoliticalPulse](https://politicalpulse.app/)

PoliticalPulse is an AI-powered sentiment analysis tool that gives members of Congress, their staff, and constituents a real-time read of public opinion. Select any representative on an interactive map, and PoliticalPulse scrapes recent news articles, anonymizes the subject to prevent bias, then uses GPT to produce a structured report: a summary, strengths, constituent concerns, actionable improvements, and a 0–100 **Pulse Score**. Article embeddings are clustered with K-Means and projected via t-SNE and PCA into an interactive scatter plot showing topic distribution.

---

## Features

- **Interactive congressional map** — click any U.S. House district or Senate seat to pull up a representative
- **Live news scraping** — fetches up to 25 articles via Google News RSS and scrapes full text with BeautifulSoup
- **Bias-filtered AI analysis** — the representative's name is anonymized before being sent to the model
- **Structured report** — summary, positives, negatives, and improvement suggestions, all in markdown
- **Pulse Score (0–100)** — a single sentiment integer derived by GPT from article tone
- **Topic scatter plot** — K-Means–clustered articles projected with t-SNE and PCA, labeled by TF-IDF topic terms
- **PDF export** — download the full report as a PDF via html2canvas + jsPDF

---

## Tech Stack

| Layer        | Technologies                                                               |
| ------------ | -------------------------------------------------------------------------- |
| Frontend     | React 19, Vite, Tailwind CSS v4, MapLibre GL, Recharts, react-markdown     |
| Backend      | FastAPI, Python 3.13, Uvicorn                                              |
| AI / ML      | OpenAI API (gpt-5-mini), scikit-learn (K-Means, t-SNE, PCA), NumPy, pandas |
| Scraping     | feedparser (Google News RSS), BeautifulSoup4, lxml, Requests               |
| Data         | Congress.gov API (119th Congress), U.S. Census cartographic GeoJSON        |
| Package mgmt | uv (server), npm (client)                                                  |

---

## Project Structure

```
PoliticalPulse/
├── client/                         # React frontend
│   ├── src/
│   │   ├── App.jsx                 # Root component — layout, state, report fetching
│   │   ├── Map.jsx                 # MapLibre GL congressional district map
│   │   ├── TopicScatter.jsx        # t-SNE / PCA article cluster scatter plot
│   │   ├── TextCarousel.jsx        # Animated text carousel for landing page
│   │   └── api/
│   │       ├── axios.js            # Axios instance pointed at the FastAPI server
│   │       └── server.js           # API call functions
│   ├── public/
│   │   ├── data/
│   │   │   ├── us_cd_119.geojson   # 119th Congress district boundaries
│   │   │   └── us_state.geojson    # State boundaries
│   │   └── assets/                 # App icons
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── server/                         # FastAPI backend
│   ├── main.py                     # App entrypoint — routes, lifespan, CORS
│   ├── congress_members.py         # Fetches House + Senate members from Congress.gov API
│   ├── scraper.py                  # Google News RSS fetch + article text scraping
│   ├── rep_feedback.py             # OpenAI structured output — summary, scores, sentiment
│   ├── embeddings.py               # TF-IDF, K-Means, t-SNE, PCA pipeline
│   ├── political_pulse_sentiment_analysis.ipynb  # Exploratory notebook
│   ├── pyproject.toml              # uv project manifest
│   └── .env                        # API keys (not committed)
│
└── resources/
    ├── PoliticalPulseQuickDemo.gif
    └── PoliticalPulseQuickDemo.mp4
```

---

## Setup

### Prerequisites

- Python 3.13+
- Node.js 18+

### API Keys

Create `server/.env`:

```env
CONGRESS_GOV_API_KEY=your_congress_gov_key
OPENAI_API_KEY=your_openai_key
```

Get a free Congress.gov API key at [api.congress.gov](https://api.congress.gov/sign-up/).

### Server

```bash
cd server
uv sync
uvicorn main:app --reload
```

The API will be available at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Client

```bash
cd client
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

---

## API Endpoints

| Method | Endpoint             | Description                                          |
| ------ | -------------------- | ---------------------------------------------------- |
| `GET`  | `/`                  | Health check                                         |
| `GET`  | `/house_rep_members` | List all House members (`?limit=438`)                |
| `GET`  | `/senate_members`    | List all Senate members (`?limit=100`)               |
| `GET`  | `/member_feedback`   | Full sentiment report (`?name=<full name>&limit=25`) |

### Example

```bash
curl "http://localhost:8000/member_feedback?name=Alexandria+Ocasio-Cortez&limit=20"
```

**Response shape:**

```json
{
  "summary": "...",
  "positives": "...",
  "negatives": "...",
  "improvements": "...",
  "pulseSentiment": 72,
  "article_links": ["https://..."],
  "article_titles": ["..."],
  "article_clusters": [0, 1, 2, ...],
  "article_topics": ["healthcare", "economy", ...],
  "article_tsne_xs": [...],
  "article_tsne_ys": [...],
  "article_pca_xs": [...],
  "article_pca_ys": [...]
}
```

---

## How It Works

1. **Member lookup** — on startup, the server fetches all current House and Senate members from the Congress.gov API and caches them in memory.
2. **News fetch** — when a representative is selected, up to 25 articles are fetched from Google News RSS and their redirect URLs resolved.
3. **Scraping** — BeautifulSoup extracts the title and body text from each article.
4. **Name anonymization** — the representative's name is replaced with `[NAME HIDDEN]` before any text is sent to the model, preventing political bias in the output.
5. **AI report** — GPT returns a structured JSON response with a summary, bullet-point positives and negatives, improvement suggestions, and a Pulse Score from 0–100.
6. **Topic clustering** — article texts are TF-IDF vectorized, clustered with K-Means (k=3), then projected to 2D with both t-SNE and PCA for visualization in the scatter plot.
