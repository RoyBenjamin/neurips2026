# NeurIPS 2026, from home

A reading list for everyone following NeurIPS 2026 without being in Sydney, Atlanta or Paris.
Live at [roybenjamin.com/neurips2026](https://roybenjamin.com/neurips2026/).

Pick a research area and get the main-track papers worth your time: main talks first, then spotlights,
then the posters people are talking about on Hugging Face, alphaXiv and GitHub. Or search a topic and
get the closest papers by meaning. Save papers to a reading list and export it to Zotero.

## How it works

A static site with no build step and no server.

- `index.html`, `style.css`: the page.
- `app.js`: views, search, the reading list and the Zotero (RIS) export.
- `rank.js`: the order within an area, and the links for each paper.
- `data/papers.js`: every paper with its area, tier and buzz numbers.
- `data/details/`: abstracts and authors, one file per area, loaded when you open that area.
- `data/embeddings.bin`: one vector per paper. Search embeds your query in the browser
  with [Transformers.js](https://huggingface.co/docs/transformers.js) (`bge-small-en-v1.5`), so queries never leave your device.

The data is built offline from the official neurips.cc program. Areas are clusters of title and abstract embeddings,
named by hand. Buzz is Hugging Face upvotes, alphaXiv votes and GitHub stars, counted only when a title exactly
matches one arXiv paper. The data is refreshed once, on Dec 5, and then frozen for the conference.

The reading list and theme are kept in your browser's local storage. Page views are counted anonymously with
[Umami](https://umami.is) (no cookies).

## Run it locally

```bash
python3 -m http.server
```

Then open http://localhost:8000.

Made by [Roy Benjamin](https://www.linkedin.com/in/roy-b). Paper data from [neurips.cc](https://neurips.cc).

<sub>Inspired by Jueun Kim's NeurIPS 2026 Explorer.</sub>
