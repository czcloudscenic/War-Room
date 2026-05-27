// VitalLyfe SOP — actively rendered by SopsRoute + ClientView.
// Per-client SOP migration is tracked as Fix #14 follow-up (needs DB schema decision).
// INITIAL_CONTENT export removed 2026-05-26 PM (was a dead import in App.jsx; DB is authoritative for content_items).

export const VITAL_LYFE_SOP = {
  title: "Master Content Workflow",
  subtitle: "Cloud Scenic  VitalLyfe",
  version: "v1.0 · 2026",
  steps: [
    { num: "01", phase: "Discovery", title: "Ideation & Concept Alignment", desc: "Cloud Scenic meets with VitalLyfe's Marketing Director to align on creative direction, brand goals, campaign objectives, and overall content strategy. All ideas, angles, and priorities are discussed and confirmed before any content work begins.", tags: ["Ideation", "Strategy Session", "Marketing Director"] },
    { num: "02", phase: "Planning", title: "Content Tracker Build & Approval", desc: "A comprehensive content tracker is built in Google Sheets covering every planned asset across Reels, Stories, Graphics, and Carousels — including full content breakdowns, Content Pillars, and pre-approved Captions. Submitted to client for approval before production begins.", tags: ["Google Sheets", "Reels", "Stories", "Graphics", "Carousels", "Content Pillars"] },
    { num: "03", phase: "Pre-Production", title: "Footage Scouting via Art Grid", desc: "With the approved tracker as a reference, the team heads into Art Grid to scout and select footage that aligns with each piece of content. Every clip is chosen intentionally to match the visual tone, Content Pillars, and platform requirements outlined in the tracker.", tags: ["Art Grid", "Footage Research", "Visual Direction"] },
    { num: "04", phase: "Production", title: "Content Development & Post-Production", desc: "All content is developed and edited across every required format — Reels, Stories, Graphics, and Carousels. Full post-production is completed for each asset, ensuring platform-specific dimensions, pacing, and brand standards are met before moving to review.", tags: ["Post-Production", "Reels", "Stories", "Graphics", "Carousels"] },
    { num: "05", phase: "Review", title: "Content Review & Client Approval", desc: "All completed content is sent for client review via Google Drive or Wipster. The client provides feedback and approvals on each asset. No content moves to scheduling until explicit approval is received on every deliverable.", tags: ["Google Drive", "Wipster", "Feedback Loop", "Approval Gate"] },
    { num: "06", phase: "Distribution", title: "Content Scheduling Across All Platforms", desc: "Approved content is loaded into Sprout Social and scheduled across all active social platforms. Captions are pulled directly from the approved tracker to ensure accuracy and brand consistency across every post.", tags: ["Sprout Social", "Multi-Platform", "Approved Captions"] },
    { num: "07", phase: "Final Sign-Off", title: "Scheduler Review & Final Confirmation", desc: "The completed schedule from Sprout Social is sent back to the client for a final review. Once confirmed, this serves as the final authorization for delegation and publishing.", tags: ["Sprout Social", "Final Approval", "Delegation", "Go-Live"] },
  ],
  tools: ["Sprout Social", "Google Drive", "Wipster", "Google Sheets", "Slack"],
  platforms: ["Instagram", "TikTok", "YouTube"],
  contentPillars: ["Education", "Entertainment", "Inspiration", "Promotion", "Community"],
};
