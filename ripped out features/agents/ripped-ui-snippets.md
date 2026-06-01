# Ripped UI snippets — Lacey, Ali, Sam, Overseer

## `src/ui/agents/AgentChatPage.jsx`

### AGENT_PROMPTS (Sean's references to ripped agents)
The Sean prompt mentioned: `Team: Lacey (Runner), Ali (Developer), Sam (Monitor), Artgrid (Footage Scout), Muse (Content Ideation), Overseer (SOP Guardian)`. Updated to remove the ripped names.

### Full agent prompts (kept verbatim in ripped-registry.js)
Lacey, Ali, Sam, Overseer all had their own AGENT_PROMPTS entries.

### Quick capabilities
```js
Lacey:    ["Build a Workflow", "Draft an SOP", "Execution Plan", "EOD Checklist"],
Ali:      ["Debug an Issue", "Integration Plan", "Schema Review", "Code Review"],
Sam:      ["System Health Check", "Cost Report", "Security Audit", "Pipeline Metrics"],
Overseer: ["Full SOP Audit", "Compliance Check", "Brand Voice Review", "Approval Gate"],
```

### Descriptions
```js
Lacey: "Automation workflows, deliverable execution, SOPs",
Ali: "Technical infrastructure, API integrations, builds",
Sam: "System monitoring, security, metrics, cost tracking",
Overseer: "SOP enforcement, brand voice compliance, audit",
```

### Action buttons (under agent-specific quick actions)
```jsx
{sel.name === "Overseer" && (
  <button onClick={() => runAgentAction("overseer_scan")} disabled={actionBusy}
    style={...}>SOP Scan</button>
)}
{sel.name === "Lacey" && (<>
  <button onClick={() => runAgentAction("lacey_advance")} disabled={actionBusy}>Advance Pipeline</button>
  <button onClick={() => runAgentAction("lacey_trigger_n8n", { workflow: "vitallyfe-pipeline", message: "Triggered from Vantus", triggeredBy: "Lacey" })} disabled={actionBusy}>Trigger n8n</button>
</>)}
{sel.name === "Sam" && (
  <button onClick={() => runAgentAction("sam_health")} disabled={actionBusy}>Health Check</button>
)}
```

### lacey_advance result block (~line 126)
```js
if (d.items && d.items.length > 0 && action === "lacey_advance") {
  // updates content items in local state to "Scheduled"
}
```

## `src/ui/agents/TeamBroadcast.jsx`
```js
Lacey: "You are Lacey, Runner Agent. Fast, pragmatic, loves checklists. When you receive a brief, identify what workflows, automations, or SOPs need to be updated or triggered. Under 80 words.",
Ali: "You are Ali, Developer Agent. Precise, technical. When you receive a brief, flag any technical changes needed to the system. Under 80 words.",
Sam: "You are Sam, Monitor Agent. Methodical, data-driven. When you receive a brief, note what metrics or signals you'll be watching. Under 80 words.",
Overseer: "You are Overseer, SOP Guardian. Rigorous, precise. When you receive a brief, flag any SOP compliance considerations. Under 80 words.",
```

## `src/ui/dashboard/ActivityFeed.jsx` — action label map
```js
overseer_scan:     "ran SOP scan",
lacey_advance:     "advanced pipeline",
lacey_trigger_n8n: "triggered n8n",
sam_health:        "ran health check",
```

## `src/ui/dashboard/QuickActionsDashboard.jsx` — quick actions
```js
{ label: "SOP Scan", action: "overseer_scan", agent: "Overseer", color: "#2AABFF" },
{ label: "Advance Pipeline", action: "lacey_advance", agent: "Lacey", color: "#2AABFF" },
{ label: "Health Check", action: "sam_health", agent: "Sam", color: "#2AABFF" },
{ label: "Trigger n8n", action: "lacey_trigger_n8n", agent: "Lacey", color: "#2AABFF", payload: { workflow: "vitallyfe-pipeline", message: "Triggered from Vantus Quick Actions", triggeredBy: "Vantus" } },
```
