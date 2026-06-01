# Working snapshot — pre-rip Vantus build

This folder is a frozen production build of Vantus **before** the 2026-06-01 rip pass. Everything ripped out of the live app (Brief→Content, Shot Reference, Hero Generator, Lacey/Ali/Sam/Overseer agents, Tracker/Taskboard/Sops routes) still works here.

## Open it

From this folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000

It still hits the live Supabase + Netlify Functions, so auth + agents + Apify scrape + pipeline still work end-to-end. Just an older UI shape.

## What's preserved here

- All 8 agents (Sean, Muse, Scrappy, Lacey, Ali, Sam, Artgrid, Overseer)
- All apps including the ripped ones (Brief→Content, Shot Ref, Hero Gen, ArtGrid, Ad ROI, CID, References, Skills)
- Tracker / Task Board / SOPs routes
- VitalLyfe hardcoded pillars + 7-step SOP

Use this as a fallback if you ever want to revive one of these features — see `../ripped out features/` for the source files.
