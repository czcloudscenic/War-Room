# Apps Rules

## What is an App?

An app is an optional module that adds functionality to Vantus. Apps can be toggled on/off from the Apps page. When disabled, the app's sidebar nav item disappears.

## Base Pages (always visible, cannot be toggled)

- Dashboard
- Agents
- Instagram / TikTok / YouTube pipelines
- Content Tracker
- Task Board
- Ad ROI Hub
- Team Broadcast
- References
- Skills
- SOPs
- Apps (the toggle page itself)

## Toggleable Apps

| ID | Label | Default |
|----|-------|---------|
| artgrid | ArtGrid Scout | enabled |
| cid | Competitor Intel | enabled |
| scrappy | Scraping Ops | disabled |
| analytics | Analytics | disabled |
| costs | Cost Governance | disabled |
| automation | Automation Center | disabled |

## Storage

- Key: `vantus_apps`
- Format: JSON array of `{ id, label, desc, enabled }`
- Loaded on mount, saved on every toggle

## Sidebar Integration

The sidebar filters OPERATIONS nav items by `isAppEnabled(item.id)`. If an item's ID matches a disabled app, it's hidden. Items without a matching app entry are always shown.

## Adding a New App

1. Add entry to `DEFAULT_APPS` in `src/apps/apps.config.js`
2. Create app directory in `src/apps/{appName}/`
3. Add nav item to OPERATIONS section in NAV constant
4. Add `activeNav === "{id}"` render block in main content area
5. The Apps page auto-renders all apps from the array
