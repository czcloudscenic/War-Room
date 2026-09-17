# The Ship as a game: rules

Written 2026-09-17 by Counsel from Christian's direction: "think like Fallout Shelter." One page. Every rule here is driven by something real in Vantus, or it says so. Nothing decorative gets a number.

## The loop Fallout Shelter runs, and what it becomes here

| Fallout Shelter | The Ship | Real source |
|---|---|---|
| The vault, side-on cross-section, rooms as cells | The hull, side-on cutaway, twelve stations on two decks | `world.js` ROOMS, `shipStations.js` |
| Dwellers | Crew agents: Sean, Muse, Scrappy, Slate; six future crew ghosted | `ROSTER` |
| Every room has a stat that drives its output | Every station has an agent that runs it; output = receipts per hour | `agent_events` rows mapped through `ACTION_STATION` |
| Power, food, water bars at the top | Three bars: Pipeline (items moving), Approvals (waiting on a human), Health (link, backup, credits) | `content` statuses, `backup_runs`, Anthropic balance |
| Incidents start in a room, damage it, spread to neighbors | A blocked item is an incident in its station; unhandled for 24 h it spreads to the next station in the pipeline | `content.block_reason`, `qc_status === 'blocked'`, age |
| External raids at the vault door | The sentinel on the hull: it lands when the ship is in a tunnel; it cuts harder the longer the oldest blocker has been open | tunnel clock + oldest blocked item age |
| Rush a room: instant payout or an incident | Rush a station: run its agent action now; a real result pays, a failed action logs an incident | `agent-action` function result_status |
| Happiness on every face | Morale per agent: recent success ratio over 48 h; a face-lit number, never faked | success / total receipts per agent |
| Tap a room to see who is in it and what it makes | Fly in to a station: agent, last receipt, output rate, open blockers | existing fly-in + receipts panel |
| Drag a dweller to reassign | Drag an agent to a station: sets that agent's next action target; the sim moves them only when a receipt confirms | new: assignment intent stored, movement still receipt-driven |
| Caps to build and upgrade | No currency. Upgrades are real: a station with a configured integration is "built"; one without is dark | integration config presence |

## The three bars

- **Pipeline**: share of content items that moved stage in the last 24 h. Green above 30 percent, amber 10 to 30, red below 10.
- **Approvals**: count waiting on Need Copy Approval or Need Content Approval. Green 0 to 2, amber 3 to 6, red above 6.
- **Health**: link up, backup ok in the last 26 h, credits above zero. All three green, or the bar is red and says which.

## Incidents

1. An item becomes blocked: its station flickers, sparks fall in that bay, the agent stops producing there.
2. After 24 h unhandled, the incident spreads to the next station in the pipeline order (foundry → qc → pipeline → comm).
3. Clearing the blocker (unblocking the item in Vantus) ends the incident; the station relights over 3 s.
4. The sentinel's cut intensity = 0.4 + 0.6 × clamp(oldestBlockerAgeHours / 72). No blockers: it still lands in tunnels (ambience) but cuts at 0.4.

## Rush

- Button on a station in fly-in: "Rush." Calls that station's agent action with the newest relevant item.
- Success: receipt lands, the station pulses, +10 morale for the agent.
- Failure: a receipt with result_status failed, an incident starts in that station, −10 morale.
- Cooldown 10 minutes per station. Never automatic.

## Morale

- Per agent: successes / (successes + failures) over 48 h, shown as a percentage above the head in fly-in, and as the face brightness at ship distance.
- Below 40 percent the agent's idle changes to the slumped idle clip; above 80 the confident one. Only two clips, both from the rig library.

## Camera levels

- Ship: the whole hull in the tunnel. Bars, radar, comms.
- Station: fly-in. Agent, receipts, rush, blockers.
- Nothing in between. Wheel zoom stays as a convenience, not a level.

## What stays out

- No caps, no lunchboxes, no random dwellers. The crew are four named agents; new ones appear only when an agent is commissioned in code.
- No incidents that are not backed by a blocked item, a failed action, or a real health signal.
- No morale from a timer. If nobody ran an agent for two days, morale is simply unknown and the face is neutral.

## Build order

1. Bars and incident state from real data (`shipStations.js` gets `computeBars(content, events, health)` and `computeIncidents(content)`; pure, testable).
2. Station incident visuals (flicker, sparks, relight) and the sentinel cut intensity from oldest blocker age.
3. Rush button wired to the existing `agent-action` function; morale from receipts.
4. Drag-to-assign as intent only.
