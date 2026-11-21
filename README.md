# Stori — content repurposing studio

Stori is a local, full-stack prototype for turning a long-form video or podcast into clips, platform copy, a calendar, and a growing brand-memory profile.

## Run it

1. Open a terminal in this folder.
2. Run `npm start`.
3. Visit `http://localhost:4173`.

No dependency installation is required; the server uses Node's built-in modules. Node 18 or later is required.

## What the server handles

- Project creation and ingestion queue records
- Clip-plan generation and save/unsave actions
- Persistent brand statement and voice cues
- Content-calendar records
- Performance-event capture and recommendation feedback
- A JSON data store (`.stori-data.json`) created after the first change

The current analysis engine is a transparent local demo engine so the project runs without credentials. Its `analyzeProject` function is the intentional hand-off point for a production transcription + LLM provider.
