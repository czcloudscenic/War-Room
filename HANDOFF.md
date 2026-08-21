# Vantus Handoff Brief

## 2026-08-20 — sidebar collapsed into grouped accordion (Christian's screenshot); Higgsfield still image-blocked

- **Nav accordion LIVE (`261d4c5`, deployed + Playwright-verified):** the 20 flat pages now sit under 6 icon groups — Command (Dashboard/Approvals/Decisions/Operations), Clients (Clients/Setup/Reports), Content (Idea Engine/Pipeline/Runway), Intelligence (Content Intel/Client Analytics), Workforce (Agents/Agent Ship/Software OPS), Admin (Billing/Ledger/Vault/Apps/Settings). Click a group to open it (single-open accordion); the active page's group auto-opens and follows navigation; group holding the active page keeps a highlight pill when closed; collapsed 68px rail shows group icons (click = expand + open that group); mobile drawer got the same accordion. `NAV` restructured in `src/utils/constants.js` (+ `navGroupOf()` helper); icons/chevron + both render sites in `App.jsx`. Follow-up same session (`e3ab393`): Christian confirmed all 8 tab names — final layout: Command (Dashboard/Approvals/Decisions), Clients (Clients/Setup), Work (Operations/Ledger/Reports), Content (Ideas/Pipeline/Runway), Growth (Client Analytics), Intelligence (Content Intel), Workforce (Agents/Ship/Software OPS), Admin (Billing/Vault/Apps/Settings). Growth + Intelligence are 1-page homes that future pages grow into.
- **Orange hue stripped tool-wide (`3aa7a88`, deployed + verified):** Christian asked to remove the orange all over the tool. All ambers (#ff9f0a/#f97316/#f59e0b + rgba variants, 77 uses / 31 files) -> neutral near-white #E5E5EA; warnings still read as bright emphasis, zero warm cast; red/green/blue/purple semantics untouched. Hand-tuned: Needs Revisions status -> #ff375f pink (was colliding with Copy Creation), future crew Route/Quill/Echo -> teal/slate/sky, away dot + secure action -> cool tones, login screen orange haze -> cool graphite. Google logo yellow untouched. NOTE: #E5E5EA is now the app's "attention" token — reuse it, don't reintroduce amber. Round 2 (`7a2e529`, deployed + verified on Approvals): Christian still saw the warm haze — it was the BACKGROUND, not components: two fixed amber radial glow divs behind every page (App.jsx ~line 958) now deleted, body #0d0907 -> #000, and every warm-cast near-black (#0f0d0e/#1a1818/#161314/#161414/#0e0c0d/#111010/#0a0809/#1a1410) -> neutral equivalent. Backgrounds are pure neutral black now — don't add warm-tinted darks or glow layers back.
- **Phase 3 characters still blocked, new root cause:** Higgsfield errors "daily generation limit for your grace period" on ALL image generation even after the daily reset (3D endpoints work; account has ~2,800 credits on Ultra) — that wording is a billing/grace state, check the Higgsfield billing page. Also learned: `3d_rigging` fails on Sean's meshes every time — his sheet crops have two figures + arms pinned under the coat; auto-riggers need a single A-pose figure. The mesh tool silently ignores enable_rigging/enable_animation (bare mesh out). Plan when images unblock: regenerate all 4 crew sheets as single-figure A-pose turnarounds (prompt drafted in session) → mesh → rig → GLTFLoader swap. A fresh unrigged Sean mesh sits uncommitted at `public/crew/sean.glb` — don't ship it static.

## 2026-08-20 (night) — PHASE 3 PIPELINE PROVEN: Sean is rigged + animated. Root cause of every rig failure found and beaten.

**The discovery that unblocked everything:** Meshy's auto-rigger needs a SINGLE figure in an A-POSE (arms clearly off the torso, legs apart). Sean's old sheets had 2 figures per crop + arms pinned under the coat — that's why every 3d_rigging call failed instantly. Also confirmed: multi_image_to_3d silently ignores enable_rigging/enable_animation (always outputs a bare mesh); rigging must be its own 3d_rigging pass on the mesh URL.

**The proven per-character recipe (ran end-to-end for Sean):**
1. nano_banana_pro turnaround from the character's 8/17 sheet as image_reference: 4 views in a row, EXPLICIT A-pose language ("arms angled 35 degrees away, clear visible gap between arm and body"), white bg, 16:9 2k. Sean's exact prompt is in this session — reuse it, swapping the identity/wardrobe block.
2. Split into 4 single-figure crops (PIL column-darkness scan — sips cropOffset is broken), media_upload → curl PUT → media_confirm.
3. multi_image_to_3d with the 4 crops, should_texture:true (~38cr, mesh takes ~15-25 min).
4. 3d_rigging on the mesh URL, height_meters 1.8, enable_animation + animation_action_id 30 (Casual_Walk) → walk GLB; run again with id 0 (Idle) → idle GLB. ~8cr each, minutes.

**DONE — Sean:** `public/crew/sean.glb` (Casual_Walk) + `public/crew/sean_idle.glb` (Idle), both 24-joint skins, textured, 9MB each, committed. Verified by parsing the GLB JSON chunk (skins/animations present).
**STAGED — Muse:** A-pose turnaround generated + 4 crops uploaded/confirmed as media_ids 6677bd8c-d71a-4ae1-af3f-d567e1fe2502 (front), d8d6fb1a-4e75-43d5-a7b1-cab63eb011fc (sideL), 6fe5ec64-cb35-4890-a681-459a33663068 (back), 63702e9c-d4ec-4fa8-9045-b34399546adc (sideR). Next call = step 3 with exactly those ids.
**BLOCKED — Scrappy + Slate turnarounds:** need 1 image job each; their 8/17 sheet job_ids for image_reference: Scrappy e98dcaa6-d4df-4650-85f4-1e162715631a, Slate ac910d9b-ee83-43f9-ab58-54deec52be88 (Muse's was 0b68d776-6f9a-4640-9d57-c9e9f1fbfc26).

**THE BLOCKER — Higgsfield "grace period":** the account (Ultra label, ~2,760 credits) is in a billing grace state. Error: "daily generation limit for your grace period... update your plan to continue." Today's allowance ≈ 2 images + ~5 3D jobs, then hard cut. All failed jobs auto-refund. CHRISTIAN: check higgsfield.ai billing — a failed renewal is throttling the account; fixing it removes the daily cap. Otherwise: run the remaining steps across daily resets (Muse mesh+rigs, then Scrappy/Slate full recipe).

**LAST MILE SHIPPED SAME NIGHT (79d502f + f62b7ef, deployed + Playwright-verified):** `src/ship/crewGLB.js` — `createCrewFigure()` drop-in used by ShipScene3D + ShipWorld3D. Crew listed in its `CREW_GLB` map render the real rigged character (walk/idle crossfade via AnimationMixer, same facing/lean language, normalized to the 34-unit figure height); everyone else — and any GLB load failure — keeps the procedural figure. SEAN IS LIVE IN THE COCKPIT as a real character on prod. CSP gotcha solved: GLTFLoader fetches GLB-embedded textures via blob: URLs — `blob:` added to connect-src in netlify.toml. To bring each remaining crew online: run the recipe above, drop `public/crew/<name>.glb` + `<name>_idle.glb`, uncomment their line in CREW_GLB. Also committed this session: the dynasty.js NETLIFY_DEV localhost-origin fix (abf3469, inert in prod).

## 2026-08-17 (late night) — The measured living ship is LIVE; Phase 3 pilot mesh in flight; the honest ceiling was named.

After Christian rejected the static look ("agents in the corner / just looks like an image"), the closing pass (final push 2da753b): two Fable agents measured the artwork pixel-precisely — sloped floor lines both decks (~150-unit nose-to-stern drop; the old flat lines were mid-wall, THAT was the floating crew), true room bays (holo-core = analytics at x≈684), and the human scale: **~130 logical units per adult mid-ship — our figures were 3× too small**. Now live: crew at perspective-aware human scale on the real painted floors, chips riding the deck slopes, shipArtFX (16 measured screen flickers, 12 lamp halos, breathing core glow + light, foreground rain, city twinkle, cloud drift, dust — 8 draw calls, 0.05ms), continuous camera sway/breathe. CINEMAGRAPH LESSON: a Seedance ambient-loop video of the art was tried and REVERTED — its "imperceptible" camera drift wandered and re-graded the scene, breaking calibration; the video code path remains (drop a locked-off loop at public/ship-interior.mp4, no deploy needed) but demand a literal tripod-static generation.
NOW EXPOSED at human scale: the procedural figures read blocky against photoreal art. Phase 3 pilot RESULT: Sean MESH DONE — valid textured 4MB GLB (saved ~/Downloads/vantus-sean-character.glb; CDN hf_20260817_201839_e5387b22…glb; also job e5387b22 in the gallery). Rigging step BLOCKED: Higgsfield daily generation limit hit — resume with 3d_rigging (model_url=e5387b22-1834-436d-ae3e-bc9fa35be125, enable_animation, animation_action_id 30 Casual_Walk; idle clip TBD) after the limit resets. If the mesh is good: same for Muse/Scrappy/Slate, then 3d_rigging animation clips (walk/idle via animation_actions) → GLTFLoader + AnimationMixer replacing procedural figures in ShipScene3D. That is the last mile to the reference.
The honest ceiling was also named to Christian mid-frustration: painting-fidelity + full interactivity is a game-studio-scale ask; the shipped compromise is art-as-world + live layers. His standing directive: keep going until it matches.

## 2026-08-17 (final) — THE SHIP MATCHES THE REFERENCE. Insight that ended the loop: polygons can't look like a painting — the painting is the world.

Christian's bar was always "looks like the reference image." Landed (push 22fb9f2, verified live): regenerated the ship artwork FROM his reference (same composition/density/lighting, people + film creatures removed, 2048px, candidate B of 2), recalibrated world.js (rooms/floor-lines/ladders/deck ceilings) to the new art's bays, and restored ShipScene3D (art stage + live 3D crew + projected chips) as the 3D View. The screen now reads as his mockup: photoreal ship centerpiece, receipt-driven crew, rail + mission bar chrome. ShipWorld3D (fully modeled world) stays in-repo one import away, pending its art-direction session — its DoubleSide/candela/albedo fixes from tonight all stand. Doctrine for the future: cinematic look = generated art as the stage + live layers on top; modeled 3D = for when the camera must move.

## 2026-08-17 (night) — Cinematic pass on the modeled ship: shipped + root-caused, one art-direction session left honestly open.

Christian's bar: the modeled 3D ship should look like his reference. Shipped tonight (pushes 310321f..249a473): grunge textures (public/textures/, generated + wired as map/bump), greebles.js detail layer (20 cable runs, swaying wires, pipes+valves, blinking junction boxes, vents, trusses, clutter — Fable subagent, 17 draw calls), UnrealBloomPass + ACES (three's bundled passes, no new deps), per-room warm lamp rig at candela scale, lightable base albedo, and the big one: **DoubleSide on merged shell materials — the cutaway shows back faces of outward-facing geometry, which single-sided Lambert lit BLACK under every lamp.** That bug ate 4 brightness iterations before a magenta diagnostic floodlight isolated it (props lit, shell didn't). Also root-caused the "slow prod first paint": Playwright browser console shows ERR_INTERNET_DISCONNECTED/NETWORK_CHANGED bursts — the Mac's network flaps; auth itself resolves instantly. Texture loads confirmed ok on prod.
**Honest state:** structure/density/glow ✔, but the painterly grim richness of the reference is NOT yet met. Remaining = art direction, not debugging: baked AO/shadow gradients into merged geometry (vertex colors), per-room emissive light pockets, texture presence tuning, possibly SSAO pass. DO THIS WITH A LOCAL VISUAL HARNESS (standalone vite page importing src/ship/* with a fake sim — no auth, screenshot in seconds) instead of prod deploy loops.
**Standing option:** ShipScene3D (the cinematic painted ship + live 3D crew) is in-repo unimported and is visually the closest thing to the reference today — a one-line route swap makes it the 3D View while the modeled world gets its art pass.

## 2026-08-17 (later) — Crew wardrobe identities LIVE + Phase 3 character sheets GENERATED. Likeness rule held and settled.

Christian asked for the actual Matrix cast (Neo/Morpheus/Trinity/Tank/red-dress woman) by name; declined plainly once (WB copyright + actor right-of-publicity + Danny's own spec ban) and he accepted the swap: "make faces that aren't their faces." Settled doctrine: archetype wardrobe yes, likenesses never.
- **Wardrobe pass LIVE (push 50a3386):** every crew figure in the 3D ship now has a distinct silhouette — Sean flared trench + visor, Muse THE red satin dress, Scrappy operator sweater + headset, Slate bald mentor greatcoat + spectacles, six future crew varied (vest+cap/blazer/hood/scarf/suspenders/armor). Fable subagent build, 11-figure harness green, verified on prod (Muse's red reads instantly in Quarters).
- **Phase 3 character sheets DONE (Higgsfield, in Christian's gallery):** 4 turnaround model sheets (front/3-4/profile/back) for Sean/Muse/Scrappy/Slate — original faces, reference-mood wardrobe, spot-checked for likeness safety (Slate ≠ Fishburne, Sean ≠ Reeves). Job ids in this session's transcript; raw URLs on the CDN.
- **Phase 3 pipeline upgrade discovered:** Higgsfield has `multi_image_to_3d` (feed the 4 cropped turnaround views) AND `3d_rigging` + `animation_actions` (rig + baked animation clips) — meaning NO Mixamo manual step is needed. Full remaining path, all automatable: crop each sheet into its 4 views → multi_image_to_3d per character → 3d_rigging with walk/idle clips → GLB integration in ShipWorld3D via AnimationMixer switched by sim state. One session of work when called.

## 2026-08-17 — PHASE 2 SHIPPED: the fully MODELED 3D ship. The ship arc is complete through Phase 2; only Phase 3 (bespoke characters) remains.

The painted backdrop is gone from the 3D View — the crew now walks a real procedural low-poly cutaway hull (final push c20be8f, verified live):
- `src/ship/shipModel.js` (Fable subagent, 586 lines): ribbed armored shell w/ cyan cross-section rims, all 12 station interiors (cockpit viewport + holo table, console rooms w/ flickering screens, 8-slot pipeline board, QC scanner arch w/ sweeping beam, security gate, pulsing core chamber, server racks + cycling piston, bunks, vault door + crates, reactor + 3 thrusters), lift shafts at ladder seams — 23 draw calls, deterministic builds, 0.005ms/frame, only 2 real lights.
- `src/ship/environment3d.js` (Fable subagent): storm-sky dome, 3-layer endless city (400 twinkling windows), rain that provably never enters the cutaway, haze, under-hull hover glow — 11 draw calls.
- `src/ship/scene3dContract.js` = the single 3D-space source of truth (deck heights, walk lane, camera, palette). `ShipWorld3D.jsx` = host: engine→3D navigation (climbs lerp real deck heights), crewModels figures reused, chips projected from true 3D anchors, contract camera + parallax, 4-light rig (incl. warm cutaway-side fill per the 8/17 lighting pass).
- Movement verified live again (intel receipt → figure at the core → aged honestly back to 0 working). Renderer lineage now: ShipWorld3D (live) ← ShipScene3D (art plane, unimported) ← ShipGame (2D canvas, ACTIVE as no-WebGL fallback) ← shipRenderer/shipRendererArt (unimported skins).
- Phase 3 queued: bespoke GLB crew (character sheets → mesh → Mixamo rig — original designs only; the likeness rule held through every request to use the film cast).
- Prod note: fresh sessions take 15-40s to first paint (black + blue dot) — pre-existing app hydration, NOT the 3D chunk (occurs before route code runs); worth a look someday.

## 2026-08-15 (night) — PHASE 1 3D SHIP LIVE: the cinematic ship in a real three.js scene, receipt-driven 3D crew.

Christian's directive: fully 3D, animated, "the actual ship I sent." Delivered as the planned Phase 1 (2.5D uplift) — LIVE on prod, verified with a walk test (fired intel_score_content, watched the 3D Scrappy figure work at the holo-core; header showed "1 working this minute").
- **First npm deps in this repo:** `three` + `@react-three/fiber` (R3F v9 for React 19). Entirely inside the lazy ShipRoute chunk (249KB gzip); main bundle unchanged. NoToneMapping so the painting renders as painted; hemisphere+key light rig shapes the crew only.
- **Files:** `ShipScene3D.jsx` (R3F host: parallax camera w/ ambient sway, art plane, sim bridge, HTML chip overlay, feet projected onto painted floor lines) · `src/ship/crewModels.js` (procedural articulated figures, 13 meshes: flared-coat silhouette, agent-color rim, visor strip, elbow-jointed typing arms, status light, canvas name tag — ORIGINAL designs; 22/22 checks) · `src/ship/holoFX.js` (core particle column + light, dust, window shafts, engine flicker; 0.01ms/frame). Both modules by parallel Fable subagents against contracts — second clean run of that pattern.
- **Fallback chain:** no WebGL → 2D canvas ship (ShipGame); ShipView3D (static art + cards) still in-repo unimported.
- **Likeness rule enforced again:** Christian asked for "the actual character models" from his reference = the Matrix cast. Flagged once (spec ban + legal exposure), built original crew in the same wardrobe/mood. Phase 3 (bespoke GLB characters via character-sheet → mesh → Mixamo rig) is where the designed crew lands if wanted.
- **Phases 2–3 queued (planned, not started):** true modeled low-poly interior w/ waypoint navigation; bespoke rigged character models. Plan in the 8/15 conversation; re-scope on request.
- Known cosmetics: THREE.Clock deprecation warning in console (benign); quarters figures could use a touch more separation at laptop widths.

## 2026-08-15 (evening) — THE LIVING SHIP IS LIVE: full §10 build-out in one day, ending in a Terraria-style crew simulation on prod.

Christian ordered the full ship ("stop with these small phases") — a conscious override of the cut-list's Phase E sequencing, defensible because the cut-list gated the office on receipts existing and Phase B shipped receipts. Progression across the day, ALL live on usevantus.com:
1. **Founder Rail** (List View) on the Dashboard + as the ship's right rail.
2. **Static 3D view**: original cinematic artwork generated via Higgsfield in the mood of Danny's reference (`agent-ship-*-reference/mockup.png` in ~/Downloads — his versions contain Matrix likenesses, OURS DOESN'T, per his own likeness rule) with mockup-style live station cards. Superseded same day but the art ships at `public/ship-interior.jpg` and `ShipView3D.jsx` remains in-repo unimported.
3. **The living ship (current 3D View)**: `src/ship/world.js` (geometry contract: 3 decks, 12 rooms, ladders) + `shipEngine.js` (receipt-driven crew movement — multi-deck pathfinding, walk/climb/work/idle/sleep, seeded deterministic wandering; built by a Fable subagent, verified with a cockpit→vault multi-hop trace) + `shipRenderer.js` (canvas pixel world: per-room interiors, holo-core, bunks with sleeping future crew, parallax city, rain, reactor; second Fable subagent) + `ShipGame.jsx` (RAF host). **Movement proven live on prod**: fired intel_score_content, watched Scrappy walk Quarters→ladder→Analytics Node and work beside the holo-core. Screenshots in ~/ship-game-*.png.
- Route chrome per Danny's mockup: AGENT SHIP // ONLINE strip (status = real backup health), 3D/Map/List toggle, mission bar (real numbers only), AgentRail as the AGENT ACTIVITY feed.
- Crew canon: Sean/Muse/Scrappy/Slate commissioned (Slate = the QC agent's §10 name; agent_events name "QC" maps to him); Route/Tally/Frame/Echo/Quill/Vault ghosted asleep in bunks until commissioned.
- Multi-agent note: the two sim modules were built by parallel Fable subagents against the world.js contract — clean handoffs, both self-verified. Pattern worked; reuse it.
- Nits open: none blocking. Possible polish: sprite labels tiny at laptop widths; station detail panel could pin receipts to the clicked room's sprites.

## 2026-08-15 — Founder Rail BUILT (spec §10 List View, the "matrix view" Danny mentioned). — ✅ superseded by the evening entry; everything shipped same day.

Danny's "matrix view for the agents" = the Agent Ship he locked in the spec 7/31 (Matrix-hovercraft reference, §9 art note + §10). Doctrine-compliant first slice built: **AgentRail.jsx** on the Dashboard — Danny's exact tiers (WORKING NOW honestly empty until long-running agents exist / QUEUED NEXT from ai_ops tasks with reason / BLOCKED with owner + SLA-paused marker / APPROVALS with Review Now deep link / DONE last 48h as expandable agent_events receipts with failure count shown) + the real-numbers bottom bar (agents active, done 48h, blocked, approvals, backup health). Supersedes the flat AllActivityFeed mount in CommandView — same receipts spine, per the one-spine rule. Map View (2D stations) = good future Codex brief; 3D ship stays Phase E per Danny's own cut list. Also in this unpushed pair: CSP hash for the React 19 style-hoisting console violation (8/14). Cron fleet: day 2 all green (backup 12.3KB ok, SLA pause held). Both intel AI actions proven live 8/14 (score: 4 verdicts, sharp summary; ideas: 4 grounded drafts, fit 0.85–0.92 — awaiting Approve/Kill in the UI to start the taste loop). Facts review now 4/6 (CloudScenic + ZZ remain).

## 2026-08-13 (later) — Content Intel (Studio Intel port) BUILT + committed. ⚠️ MIGRATION GATE: `20260813_content_analysis.sql` BEFORE push. Phase B browser stress test PASSED same day.

**Stress test first:** Phase B verified in a real browser against prod (Playwright, admin magic-link session): Decisions CRUD loop, TruthDrawer receipts, live approval minted immutable v1 + approved_version_id, stale-facts hard gate blocked scheduling, block-reason save → Ledger flag → founder digest with SLA-paused marker, 3 audit rows verified in DB, Settings cards render. Test artifacts cleaned (decision row deleted; ZZ fixture kept for the team's portal pass). Known pre-existing wart: one CSP inline-style console error on load. Not exercised: Mark-posted URL prompt, the two Phase B crons (fire on schedule).

**Then the port (per Studio's STUDIO-INTEL-TO-VANTUS guide):** per-client Content Intel — reads the IG posts the sync already lands in `account_posts`, computes send/save/follow/hook-hold rates vs per-client benchmarks, plus two AI actions (ideas from live performance, winners/losers scoring). Nothing auto-posts, ever.

- **⚠️ DEPLOY ORDER:** `supabase/migrations/20260813_content_analysis.sql` in the Supabase editor FIRST (staged in TextEdit). Tables: `content_analysis` (**account_post_id is BIGINT — the guide assumed uuid, but account_posts.id is bigserial; fixed**), `content_ideas`, `content_benchmarks`, + `clients.content_pillars` jsonb. RLS admin-domain; portal users see nothing.
- **Handler:** `agent-action/handlers/intel.js` (house CJS, `ai()`/`sbGet` from _shared) — `intel_score_content`, `intel_generate_ideas`, `intel_set_idea_status` (the taste-loop write). Wired into the dispatcher **admin-only** (service-key writes bypass RLS; portal sessions get 403). `intel` prefix → Scrappy in AGENT_PREFIX_MAP; agent_events logging is automatic. Brand context = `brand.voice` (getBrandContext), replacing Studio's personal KNOWLEDGE block; to run Christian's own account, paste his KNOWLEDGE text into that client's brand_voice_md.
- **Cron:** `intel-refresh` (15:30 UTC) — nightly deterministic rate recompute for every IG-connected client, zero AI spend; rewritten from the guide's Functions-2.0 style to the house CJS + next_run gate. AI reads stay on-demand.
- **Sync delta:** `sync-instagram.js` REELS/VIDEO metric list now requests `ig_reels_avg_watch_time` (stored raw ms in metrics jsonb; readMetrics divides) + Studio's degrade-retry (one unsupported metric no longer loses ALL insights for that media — previously it did).
- **UI:** `ContentIntelRoute.jsx` — new "Content Intel" nav under CONTENT: benchmark bars ("bars to beat", Studio defaults until a client has `content_benchmarks` rows), ranked table with ▲/▼ vs bars, Run analysis / Generate ideas, idea queue with Approve/Kill. Guide's foreign palette + fictional `useSupabaseRows(table, options)` signature replaced with house style + the real query-builder hook. Browser-safe math copy in `src/utils/contentMetrics.js` (handler keeps its own — change together).
- **Deliberately dropped from the guide:** comments ingestion (Vantus doesn't ingest comments; re-addable later), the transcript clip scorer (excluded by the guide itself), Studio's IG_ACCESS_TOKEN/IG_USER_ID env (per-client tokens in connected_accounts are the right shape), Netlify env changes (none needed), CSP changes (all new calls are server-side or same-origin).
- **Known-null by design:** `follow_rate` (IG doesn't expose per-media follows) and `hook_hold` (no duration source yet — was null in Studio too).
- **Verify after migration+push:** cron dry-run `/.netlify/functions/intel-refresh?test=1&key=<CRON_TEST_KEY>`; `intel_score_content` on a client with synced IG posts (CloudScenic); ideas land as drafts; portal user sees zero rows.
- Committed on main, NOT pushed (push on Christian's go).
- **v1.1 addendum (same day, ~2:15pm):** Codex's second pack (`codex/grunt-2026-08-13b`, 4 clean commits) merged + wired: `BenchmarksCard` (per-client bar editing + set-from-control-post) and `PillarsEditor` side-by-side in ContentIntelRoute, `IdeaPromoteButton` on approved ideas (inline-confirmed insert into content_items at Ready For Copy Creation, idea → status 'posted'; contract verified — text id, stage mirrors status). NO migration needed — tables already live. Console items closed this session: BACKUP_ENC_KEY set+verified (dry-run proved encrypt path, first real export tonight 11:00 UTC), rogue Resend var DELETED (it was a Resend key pasted as the NAME, value empty — which is why RESEND_API_KEY was never set; key = burned, mint fresh when deliberately going email-live). Codex checked out its branch in the shared worktree AGAIN mid-session (no damage; worktree isolation still the fix). cloudscenic's 3 connected_accounts were assigned to the CloudScenic client (they had client_id NULL — Setup §2 gap) and content_analysis seeded (4 IG posts; one reel at 2.64% send-rate vs the 1.3% bar).

## 2026-08-13 — Phase B (TRUTH) BUILT + Codex UI pack MERGED. ⚠️ MIGRATION GATE: `20260813_truth.sql` in the Supabase editor BEFORE push. — ✅ SHIPPED same day: migration applied+verified 12/12, pushed on Christian's go, deploy ready. Stress test passed (see entry above).

**Christian verified Phase A in the browser this morning ("looks good") and ordered Phase B.** All eight §3.B workstreams implemented; Codex built the presentational pack in parallel on `codex/grunt-2026-08-13` (5 clean commits, new-files-only) and it is merged + wired. Build clean. Committed on main, NOT pushed — main is now 4 commits ahead of origin.

- **⚠️ DEPLOY ORDER:** apply `supabase/migrations/20260813_truth.sql` FIRST (idempotent, additive), THEN push. New tables: `content_versions` (immutable — UPDATE-blocking trigger), `decisions`, `audit_log` (append-only), `truth_registry` (seeded: Sprout=schedule, Stripe=payments, Vantus=approvals), `backup_runs`, private `backups` storage bucket. New columns: content_items verification fields (verification_status/live_url/verified_at/verification_source + approved_version_id) + block fields (block_reason/blocked_since/block_owner/block_external/block_escalation_date — same on tasks); clients get facts_review_frequency_days + facts_last_reviewed_at (backfilled from facts_updated_at).
- **Version lineage (§3.B.2):** `src/core/versions.js` — creative edits in handleSave mint immutable versions; every APPROVED decision captures the approved version + sets `approved_version_id`, on BOTH paths (`recordApproval` browser-side, `executeDecision` in approval-decision.js service-side — **the two are mirrored, change together**). TruthDrawer shows drift ("edited since approval"). Missing lineage on legacy items is warn-only, deliberately.
- **Publish verification (§3.B.1):** `markPosted` now REQUIRES a live URL (Ledger prompts for it); stamps the verified/manual receipt + audit row. New cron `verify-publishes` (16:30 UTC): flags past-publish-date items with no receipt → 'awaiting' + `publish_unverified` bell; auto-verifies via `platform_post_id` ↔ `account_posts` (no writer for platform_post_id yet — the join is ready for Phase C Sprout wiring).
- **Exception engine (§3.B.4):** Blocked section in EditContentModal (reason/owner/external/escalation); blocked_since bookkeeping in handleSave; commandDigest blocked tier shows reason+owner (explicit blocks beat the age heuristic); **check-stuck-items now SKIPS external waits until their escalation date — SLA paused, client delay ≠ our failure (R10)**.
- **Audit trail (§3.B.5):** `src/core/audit.js` (logAudit/auditDiff — best-effort, never blocks the change). Hooked: content_items mandated fields (handleSave), Setup client fields (patchClient), Facts saves, vault saves (**field names only, never values**), markPosted, verify-publishes system rows.
- **Freshness gating (§3.B.7):** `truthGates()` in `src/core/truth.js` — **STALE FACTS HARD-BLOCK scheduling/client-facing statuses** (in the modal's SOP checklist). FactsAndReports grew review-cycle controls: per-client frequency + "Still correct — mark reviewed". Editing facts counts as reviewing. **Expect stale badges on first look — that's the feature; review facts to clear.**
- **Backups (§3.B.8):** `backup-export` cron (11:00 UTC) — gzip + AES-256-GCM export of 20 operational tables to the `backups` bucket + a backup_runs ledger row every run, ok OR failed. **Needs `BACKUP_ENC_KEY` (32-byte base64: `openssl rand -base64 32`) in Netlify env — until set, every run logs FAILED loudly in the Settings Backups card.** Christian console item.
- **Surfaces:** Ledger row → **Receipts** button → `TruthDrawer` (approved version/by whom, publish receipt, block state, versions, decisions, who touched it — the Phase B DoD on one panel). New **Decisions** nav (COMMAND) → Codex's DecisionLogRoute (decision debt ranked by blocks_count + decided history). Settings: TruthRegistryCard + Codex's BackupsCard. NOTIF_META: +publish_unverified; report_sent/report_missing now first-class (were fallback-rendered since 7/2).
- **Two-agent note for the record:** Codex ran in THIS working tree and checked out its branch mid-session; my working changes rode along and came back to main untouched (only HANDOFF.md content differed between bases — recovered). Codex's 5 commits were verified single-file before merging. If both lanes run concurrently again, prefer `git worktree` for the Codex lane.
- **Not exercised:** none of this has touched a real browser (STRESS-TEST.md pattern stands). Deliberately not built: checksums/diff viewers, hard-block on missing legacy lineage, per-fact freshness (per-client cycle only), Stripe/Sprout sync writers (Phase C/D).

## 2026-08-12 — Phase A LIVE on prod (go-live sequence completed 8/7); critical path is the Danny call + his data entry

**Go-live executed 8/7, in order and clean:** migration `20260805_activation.sql` applied by Christian in the Supabase SQL editor → `f6e198d` + `f5db0c3` pushed → Netlify deploy `6a7631ee…` went **ready** at 12:28pm. usevantus.com now serves the activation dashboard, approvals inbox, command view, and notification digest. The 8/5 entry's sequence is fully discharged; there is no migration exposure.

**Standing reminder for whoever logs in first:** the Dashboard opens in ACTIVATION STATE with everything red. That is the feature working. It stays red until Danny's data entry lands (17 skill briefs via Apps → Skills — now writing to the real `skill_briefs` table, not localStorage — plus Facts of Record, retainers, cadence, per-client owner, report recipients, approval modes). "View KPIs anyway" shows the old grid.

**Open board (non-code):**
- Danny call — hand off `VANTUS-PHASE-A-ESTIMATE.md`, get answers on: AI-written approval rationale (+2-3d), explicit approval-mode-confirmed flag (+0.5d), `RESEND_API_KEY` (all email still `[email dry-run]`).
- Browser stress-test pass — Phase A surfaces AND the client portal have never been exercised in a real browser (`STRESS-TEST.md`).
- Post-pass cleanup: delete client "ZZ Stress Test" (slug `zz-stress`) + archive QC Test Kitchen; both will correctly trip the stuck-item cron.
- Console loose ends: rogue Resend-named env var (7/8), `vantus-site` GitHub repo not yet created/pushed, Dynasty passcode rotation (`temppass`).

**Coding backlog = v3 spec Phases B–E** (spec lives OUTSIDE the repo at `~/Downloads/VANTUS-V3-BUILD-SPEC.md`). Doctrine order: B (TRUTH — publish verification receipts, version/approval lineage, decision log + decision debt, exception engine, generalized audit trail, source-of-truth registry, freshness/stale gating, backup discipline) → C (Danny's views: health bars, bottleneck panel, receipts-grade activity rail [ship List View first], Growth v1, content merge, client workspace shell that retires Setup and fixes the Open button, WORK destination) → D (Scope Sentinel agent, Stripe, vault hardening, Profitability Lite) → E (interpreter/steward/rights clock/office). **Phase B is veto-safe and can start now; Phase C waits on Danny's Section 8 vetoes.** Phase B adds several new tables — same migration-before-push discipline applies.

**Working tree:** `netlify/functions/dynasty.js` carries an uncommitted dev-only tweak (drops the localhost Origin header under `netlify dev` so the origin allowlist doesn't block local POSTs; prod untouched). It is the Dynasty terminal's change — leave it for that lane to commit. `deno.lock` untracked.

## 2026-08-05 — Phase A sits COMMITTED + UNPUSHED (`f6e198d`); go-live is a 3-step sequence — ✅ DISCHARGED 8/7, see entry above

**Current state:** local main is 1 commit ahead of origin (`f6e198d`, the full Phase A build below). Working tree otherwise clean except the pre-existing `netlify/functions/dynasty.js` modification (Dynasty terminal's, untouched) and untracked `deno.lock`. Nothing applied to prod yet — neither SQL nor code.

**Go-live sequence, in order (a push IS a prod deploy):**
1. Apply `supabase/migrations/20260805_activation.sql` in the Supabase SQL editor (project wjcs…). Idempotent; adds `clients.report_recipients`, `clients.owner_team_member_id`, `skill_briefs`.
2. `git push origin main` after review — Netlify auto-deploys.
3. First login will show the Dashboard in ACTIVATION STATE with everything red — that is the feature working, not a regression. It stays that way until the data entry lands (Danny's side: 17 skill briefs via Apps → Skills, Facts of Record, retainer numbers, cadence; plus per-client owner in Setup §1).

**Danny call (estimate handoff) still pending.** `VANTUS-PHASE-A-ESTIMATE.md` (repo root, in the commit) carries the three open questions: rule-based vs AI-written approvals rationale (+2-3d), explicit approval-mode confirmation flag (+0.5d), email digests gated on RESEND_API_KEY (his console item). Also tell him: the skill-brief deploy task DEPENDS on step 1 above — briefs deployed before the migration land in a browser's localStorage, not the system (the app auto-imports them after, but don't rely on it across machines).

**Out-of-repo context:** the Vantus marketing site is a separate repo at `~/vantus-site`, LIVE at https://vantus-site.netlify.app (future-facing positioning, waitlist Netlify form registered, no pricing per the spec's no-external-selling gate). Its GitHub repo (`czcloudscenic/vantus-site`) still needs to be created + pushed — no `gh` CLI on this machine.

## 2026-08-04 — Phase A (v3 spec) BUILT: activation dashboard, approvals inbox, command view, digest. ⚠️ MIGRATION GATE before push

**Danny's VANTUS-V3-BUILD-SPEC.md (frozen 7/31) reviewed → estimate in `VANTUS-PHASE-A-ESTIMATE.md` (repo root) → Christian green-lit → Phase A implemented this session. Committed locally in `f6e198d`, NOT pushed.**

- **⚠️ DEPLOY ORDER (the whole risk of this drop):** apply `supabase/migrations/20260805_activation.sql` in the Supabase SQL editor FIRST, then push. It adds `clients.report_recipients`, `clients.owner_team_member_id`, and the new `skill_briefs` table (admin-domain RLS). The app tolerates the missing table (warns, shows an error line on Skills) but the activation checklist and Skills page only go fully live after the migration. Idempotent, additive, safe to re-run.
- **Activation state (spec §3.A.1):** `src/core/activation.js` — 11 per-client checks computed only from real columns (contact, brand voice, Facts of Record via the existing `factsFilled()`, retainer [brief-lane exempt], cadence, approval-mode-with-approver, connected account, report recipients, account owner, content flowing, owner+due hygiene) + agents-without-briefs at book level. `ActivationBoard.jsx` replaces the Dashboard KPI grid while under-configured: score ring, next-5 actions (deep-link via setActiveNav), deficiency groups, per-client score strip, "View KPIs anyway" peek. `ClientsRoute.setupScore` now delegates to the same module — grid % and dashboard checklist can't disagree.
- **Approvals inbox v1 (§3.A.3):** new `Approvals` nav id (COMMAND section) + `src/ui/routes/ApprovalsRoute.jsx`. Cross-client queue of gate-status items with `approval_mode != client`; risk/effect/recommendation are RULE-BASED (qc_status, revision cap vs included_revisions, due-date proximity, runway severity, days-at-gate) — deliberately no AI text (Danny question #1 in the estimate; +2-3d if he wants it). Approve/Reject wire into the existing `recordApproval()` (same audit path as the portal; reject requires feedback). Edit reuses EditContentModal via setEditingItem. Client-mode items render as a read-only "waiting on clients" strip — chase, don't override.
- **Founder command view (§3.A.2):** `src/core/commandDigest.js` (pure) tiers the book into critical / requires-you / due-today / blocked / at-risk from content+tasks+invoices+pending client_users+runway; `CommandView.jsx` renders tier tiles → expandable lists → deep links, and sits on the Dashboard both during and after activation. Routine tier = `AllActivityFeed.jsx` (agent_events, no client filter, client chip per row — same rows as the per-client feed, second rendering).
- **Notification digest (§3.A.4):** `NotificationDigest.jsx` — one unscoped notifications query (admin RLS already allows; index exists), grouped client→type, role tabs Founder/Ops/Finance. `NOTIF_META` moved from App.jsx to `utils/constants.js` (+role field) so bell + digest render one map. In-app only — email digests stay gated on RESEND_API_KEY (Christian-console item, unchanged).
- **Landing spots for Danny's parallel data:** SkillsPage now reads/writes `skill_briefs` (one-time localStorage import, flagged via `vantus_skill_briefs_imported`; "All Agents" target covers the roster in the activation check). Setup §1 grew Account-owner select + Posts/week. Monthly-reports cards grew a Recipients input (comma-separated → `report_recipients`; empty still falls back to primary_email).
- **App.jsx delta ~25 lines** (nav block, DashboardRoute props, ApprovalsRoute mount, NOTIF_META import swap). All new logic in `src/core/` + new files. Build clean after every chunk (final: 428KB main, 13 lazy chunks).
- **Not exercised:** any of this against prod data in a real browser — same standing gap as the portal (STRESS-TEST.md pattern applies). First look will show everything red/missing until Danny's data entry lands; that's the feature working, not a bug.
- **Explicitly NOT built (per spec/estimate):** client workspace shell (Phase C — Open button still switches tenant + goes to dashboard), email delivery, Danny's content (17 briefs, facts, retainers), AI-written approval rationale, sidebar badge counts.

## 2026-07-29 night session — migrations APPLIED + verified on prod; feature pack proven live; stress-test kit shipped

**Closes the ⚠️ from the late-session entry below: there is no migration exposure anymore.**

- **Christian pasted the migration bundle the same evening.** Verified directly against prod Supabase, 13/13 green: all 4 new tables (approval_tokens / content_comments / stuck_alert_state / intake_requests), all 4 new columns (clients.included_revisions, clients.intake_token backfilled for every active client, team_members.monthly_cost, content_items.review_video_path), the review-media bucket, and the **revision-count trigger fires** (tested with a real approvals insert, then cleaned).
- **One-click approval flow proven END-TO-END against prod DB** (on the QC test item, fully cleaned + restored after): GET renders confirm page → POST records the decision → item advanced to Needs Revisions → trigger bumped revision_count → audit row `stage='client'` → notification carried the cycle-aware dedupe_key + client_id → BOTH tokens consumed (sibling invalidation) → replayed link says "Already recorded" → no premature cap alert at round 1 of 2. 8/8 assertions.
- **Intake proven live:** greet endpoint returns the client name, honeypot fake-succeeds and writes nothing, real POST stages a row + rings the bell. Both crons 403 unauthenticated on prod (chase-overdue-tasks was publicly invocable before this pack).
- **Stress-test kit shipped (`7d30c7b`):** `STRESS-TEST.md` (repo root) is the team's per-feature walkthrough — portal setup via a personal-Gmail invite, the internal-item scoping tripwire, two-browser realtime, caps to R2/2, intake promote, token rotation, margin entry. **Seeded prod fixture: client "ZZ Stress Test"** (slug `zz-stress`, approval_rule client, id `31749476-…`) with 3 items — copy-gate + content-gate (client-mode, appear in the portal) + one internal-mode negative control. **Delete ZZ + finally archive QC Test Kitchen after the team's pass** — both will (correctly) trip the stuck-item cron within days.
- **Still not exercised anywhere:** (1) the portal in a real browser with a client Google login — the whole backend is proven, the React surface isn't; first item on STRESS-TEST.md. (2) Real emails — `RESEND_API_KEY` still empty; every send logs `[email dry-run]`. (3) Stripe create-path. The 7/18 Christian-console board is otherwise unchanged.
- Two-agent repo etiquette now standing: **`git pull` before every commit**; pushes are keyless AND auto-deploy — a push IS a prod deploy.

## 2026-07-29 late session — Software OPS merged; ⚠️ the push AUTO-DEPLOYED the whole backlog — ⚠️ RESOLVED: migrations applied + verified same night (see entry above)

**Written by the Dynasty agent (cross-repo session, Christian directing).**

- **Software OPS is LIVE on usevantus.com** (commits `d186295`, `2326c28`, `260c4b1`).
  Admin-only nav section: client grid (Dynasty live + 2 standby slots) → the
  Dynasty pipeline's four ops pages inside Vantus, via a new `/api/dynasty`
  proxy (`netlify/functions/dynasty.js`: requireUser admin + rate limit +
  action allowlist → dynasty-lead-finder with `x-passcode` from env
  `DYNASTY_ADMIN_PASSCODE`/`DYNASTY_API_BASE`, set in Netlify UI). Pages in
  `src/ui/dynasty/*`, styles scoped `.dynops`, grid in `SoftwareOpsRoute.jsx`
  (registry-driven). Gate = `isOpsAdmin` (role admin OR ADMIN_EMAILS) — do NOT
  simplify to `role==="admin"`; profiles.role overrides cz@ to "agency".
  The standalone center (cloudscenic-ops-center.netlify.app) stays deployed in
  parallel; dynasty-leads repo untouched. Dynasty audit rows from Vantus show
  actor "Admin" (break-glass) — known tradeoff.
- **⚠️ THE PUSH SHIPPED EVERYTHING MAIN WAS HOLDING.** Christian ordered
  "merge it to vantus"; pushes are now KEYLESS (SSH key on czcloudscenic +
  global insteadOf — the one-shot-PAT era is over, update all assumptions),
  and Netlify auto-deploy is ON. So `260c4b1` took the 7/9–7/13 held commits,
  the Codex agent-action split, AND the M0–M7 feature pack live — **the ⛔
  migration gate above is now live-without-migrations.**
- **Exposure read (why this is survivable tonight):** every new email send
  site is Resend-key-guarded and the key is EMPTY → dry-run only, nothing can
  email clients. The portal branch is a security IMPROVEMENT (approved
  client_users no longer fall through to the admin shell). Approval/intake
  paths only 500 if someone exercises them before migrations. **Hard
  deadline: `check-stuck-items` cron fires 16:00 UTC (9am PT) daily** and
  will hit missing tables.
- **DO FIRST NEXT SESSION (or Christian tonight): apply the migration bundle**
  — `/tmp/vantus-m0-migrations-2026-07-29.sql` (19.8KB, additive+idempotent,
  already staged for TextEdit paste into Supabase). After that, the deployed
  state is fully supported and M8 regression can proceed as written below.
  Rollback alternative (loses Software OPS too): restore the prior production
  deploy in the Netlify UI.
- Coordination note: two agents committed to this repo today (this terminal's
  M-pack sweeps absorbed the dynasty.js dev-scrub mid-flight; reconciled).
  `git pull` before committing, and stop assuming pushes are blocked on PATs.

## 2026-07-29 session — Timeliner-inspired feature pack (7 milestones — SUPERSEDED: deployed by the late session, migrations applied + verified in the night session above; architecture facts below remain current)

**Built the full 6-feature pack on localhost per the approved plan** (`~/.claude/plans/lets-plan-to-make-rippling-petal.md`): client approval portal + one-click email approvals, timestamped video review comments, revision caps, stuck-item bottleneck cron, per-client margin view, public intake form. Commits `46c4d6b` (M0) → `0073f13` (M7), interleaved cleanly with the other terminal's Dynasty module (`2326c28`, `d186295`). **Nothing pushed, nothing deployed. Localhost only.**

**⛔ GATE — Christian must apply the migration bundle before ANY of this deploys or is browser-tested:** 7 additive+idempotent files `supabase/migrations/20260729_*.sql`, combined paste-ready at `/tmp/vantus-m0-migrations-2026-07-29.sql` (opened in TextEdit). Adds: approval_tokens (RLS, zero policies = service-key only), content_comments (+realtime publication), review-media storage bucket + `content_items.review_video_path`, `clients.included_revisions` + **revision-count trigger** (fixes the old race/bypass — approvals.js no longer bumps the counter itself) + `content_items.updated_at` touch trigger, stuck_alert_state, `team_members.monthly_cost`, `clients.intake_token` + intake_requests.

**Key architecture facts for pickup:**
- `/api/approval` (`approval-decision.js`): GET = confirm page ONLY (email-scanner-safe), POST = execute (single-use token, siblings invalidated) or portal-session mode. All writes via SERVICE_KEY because approvals INSERT is admin-only RLS. Emits the SAME notify type + cycle-aware dedupe_key as the App.jsx realtime detector — first writer wins, no double fan-out.
- Approval-request emails fire via notify type `approval_requested` (from handleSave + the realtime detector) when a `approval_mode='client'` item ENTERS Need Copy/Content Approval; `_lib/approvalRequest.js` issues the two tokens + emails `clients.primary_email`. **Every new send site is Resend-key-guarded (dry-run logs when keyless)** — tokens still get created, so the flow tests end-to-end without the key.
- Portal: App.jsx now has the missing `role==='client'` branch → `src/ui/client/ClientPortal.jsx` (approved clients used to fall through to the FULL ADMIN SHELL with only RLS scoping them — closed).
- Review video lives in the `review-media` bucket (public-read, unguessable paths) because Drive can't serve first-party video (webViewLink=HTML page, /preview iframe CSP-blocked + no currentTime). `ReviewPanel.jsx` is shared by EditContentModal + portal.
- `check-stuck-items` cron (16:00 UTC): per-status thresholds on `updated_at`, auto Unstick tasks, re-sends client approval links as the nudge. Dry-run verified live — correctly flagged the QC Test Kitchen leftover ("TEST-QC price check", 25d stuck).
- `chase-overdue-tasks` finally got an invocation gate (was publicly invocable!), a working dedupe_key, and client_id (its bell rows never rendered before).
- requireUser now allows localhost origins ONLY when `CONTEXT !== 'production'` (netlify dev testing).
- Intake: `/intake?t=<per-client token>` static page (CSP-safe external css/js) → staged `intake_requests` → Operations → Intake tab promote/dismiss. Setup Section 1 has copy/rotate link buttons.

**Remaining before deploy (M8):** (1) Christian applies migrations; (2) browser-test the portal end-to-end with a non-@cloudscenic Google identity approved in client_users against a disposable test client; (3) once the real Resend key is pasted, render-check the 5 new email templates (all in/via `_lib/emailTemplates.js`); (4) full regression (admin login, Ledger approve/revise, crons `?test=1`); (5) deploy via `netlify deploy --build --prod` (site still on the free team). The 7/18 board (empty Stripe/Resend keys, rogue env var, OAuth origin, team transfer) is UNCHANGED and still gates the integrations.

---

## 2026-07-18 session — env re-audit (keys now EMPTY not malformed), agent-action.js monolith split (Codex, reviewed+merged)

**Nothing pushed, nothing deployed.** `main` is now **18 commits ahead of `origin`** (9 held from 7/9–7/13 + this session's board doc + Codex's 9-commit refactor). All builds clean. Everything ships the moment a one-shot PAT arrives.

**🔑 Live env re-audited today — state CHANGED since 7/12.** Re-checked the linked Netlify env (names + length/prefix only; value reads are classifier-blocked, as intended). The three integrations the 7/12 sprint found *malformed* are now **empty** — someone cleared the bad values but never pasted good ones, so all three are still dead:
- `STRIPE_SECRET_KEY` → **empty** (was bad 20/64-char). Billing "Create & send" still errors.
- `STRIPE_WEBHOOK_SECRET` → **empty**. Paid-sync can't verify signatures.
- `RESEND_API_KEY` → **empty** (was bad 20-char). All email still dead.
- Rogue var **named** `re_jEHHfr94_CkaXNz6Vd23p9JoapccsqsnH` → **STILL PRESENT** (now empty-valued). Its NAME is a burned Resend key visible in every env listing = compromised. Delete the var + revoke that key in Resend.
- Healthy: `SUPABASE_SERVICE_KEY` is the new `sb_…` format (len 41); Anthropic/Slack/Tavily/Apify/Meta/TikTok/YT/Google keys all present + correctly shaped. Full re-verified checklist is at the top of `VANTUS_TODO.md` (updated 7/18).

**🧱 agent-action.js monolith split — SHIPPED to `main` (local), reviewed byte-for-byte.** The Fix #4 handler-split (speced May, branch never merged) never landed and the file had grown to **1,750 lines**. Briefed Codex (`/tmp/codex-brief-agent-action-split.md`); it ran in its own worktree on `codex/grunt-2026-07-18`, split into a **158-line router** + `agent-action/_shared.js` + six agent modules (`handlers/{qc,muse,scrappy,sean,cid,ops}.js`), 9 incremental commits.
- **Reviewed, not trusted:** line-level multiset diff of the original vs the split = **zero original logic lines lost** (only import/export boilerplate added); all **16 action cases route** with exact original signatures; `node --check` + router load-smoke + `npm run build` all green; scope confined to the 7 new files + CODEX_NOTES.
- **Gotcha worth keeping:** `npm run build` (Vite) only bundles `src/` — it does **NOT** touch `netlify/functions/`, so a green build proves nothing about a function refactor. Verify functions with `node --check` + a `require()` load smoke test instead. The brief carried this; future function-refactor briefs must too.
- Fast-forward merged (preserves the 9 granular commits for bisect); worktree removed.

**Next clean Codex target (not started):** App.jsx → hooks state extraction (1,444 lines, no `src/hooks/` yet). Riskier than the agent-action split — it *can* change behavior — so write a state-cluster map prep first before handing it off.

**Christian's ~15-min console session still clears the whole board** (full checklist in `VANTUS_TODO.md`): paste real Stripe (x2) + Resend keys; delete the rogue Resend var + revoke it; register `https://usevantus.com` as a Google OAuth JS origin; transfer usevantus.com → Cloud Scenic Pro team (unblocks auto-deploy); flip Gemini billing; rotate Supabase passwords; revoke the old exposed PAT; hand over one PAT → push the 18 held commits.

---

## 2026-07-09 session — runway work pushed + shipped, Netlify deploy failure root-caused (wrong team), repo cleanup

**Live state:** the 3 runway/handoff commits (`4e9260e` drought detection + Mon/Fri digests + Slack fix + Danny-on-emails, `ed263c1` Sprout last-post signals, `7787d05` 7/8 handoff) were **pushed to `origin/main` + deployed live** to usevantus.com this session. Runway drought work is now in production.

**🔴 Netlify auto-deploy is BLOCKED — root cause found (not a code bug, not a failed card):**
- A git-triggered deploy (commit `ed9c2f1`) failed with **"Skipped due to account credit usage exceeded."** Netlify skipped the build entirely — never compiled.
- Diagnosed via Netlify API: **usevantus.com lives on the free Personal team `cz-mwalysu`, NOT the Cloud Scenic Pro team.** `payment_failed: None` on both teams. Build minutes barely used (6 of the period) → the tripped cap is **bandwidth/usage**, and the Personal plan has `block_builds_when_usage_exceeded: true`, which hard-blocks git builds.
- **The real fix = transfer the site to the Cloud Scenic Pro team** (`cloudscenic`, billed dv@) — already paid, higher limits, won't hard-block. Netlify → site → Site config → General → Danger zone → **Transfer site**. Upgrading the free team is the fallback.
- **Workaround that WORKS meanwhile:** `netlify deploy --build --prod` — builds locally on the Mac (~6s) and uploads the artifact, bypassing Netlify's build infra entirely. That's how the runway work got live this session. Use it for every deploy until the team transfer is done.

**Repo cleanup (2 commits sitting LOCAL, NOT pushed — deliberately held):**
- `a9e273e` — **untracked `.netlify/functions/manifest.json`** (`git rm --cached`). It was committed before the `.gitignore:8 .netlify/` rule, so it showed dirty every session from a regenerated build timestamp. Now silenced.
- `9a8727c` — **`VANTUS_TODO.md` 7/9 three-lane action queue** (Claude Code / Codex / Christian) + the Netlify diagnosis, at the top of the file.
- **Holding the push on purpose:** these are pure housekeeping (zero runtime impact — the live site already has everything). Pushing now would just trigger another failed Netlify build + need a fresh PAT. Push them with the next real deploy AFTER the team transfer, so they build clean. (Local `origin/main` tracking ref reads "ahead 5" because the earlier push went to an explicit PAT URL, which doesn't update the ref — true state is 4 on remote, 2 pending.)

**🔒 Rogue Resend secret — now fully identified (still Christian's to rotate):** the rogue env var's **NAME is literally a live Resend key** — `re_jEHHfr94_CkaXNz6Vd23p9JoapccsqsnH` — pasted into the name field instead of the value. Env var names aren't masked, so the key is **exposed in plaintext = compromised.** Delete that var in Netlify **and rotate the key in Resend** (revoke `re_jEHHfr94…` at resend.com/api-keys, generate new, set as the *value* of `RESEND_API_KEY`), then redeploy. The correct `RESEND_API_KEY` var also exists — leave it, just update its value.

**Open items — the honest triage (everything real is Christian's, ~20–35 min solo):**
1. **Transfer usevantus.com → Cloud Scenic Pro team** (unblocks auto-deploy). 3–5 min.
2. **Delete rogue var + rotate Resend key** (security). 5–8 min.
3. **Flip Gemini billing** in AI Studio → revives all 7 VL generators (429 quota). 5–15 min.
4. **Revoke the GitHub PAT** exposed in this session's chat. 1 min.
5. Connect per-client social OAuth (@DynastyStaffing / @Parlor.Bar / @Vital.Lyfe) — gated on client logins, not on Christian's time.
6. Enter real retainer numbers (replace Dynasty $20k / Parlour $2k / VitalLyfe $8k placeholders).
7. Data check: any "no client email" warning → set that client's `primary_email` (code is correct; it's a data gap — Parlour Bar is the known one).
- **Codex has nothing real here.** The only candidate (email-warning hardening) is unnecessary — code already reads `primary_email` correctly and the mailer already falls back to owner + Slack notice.

---

## 2026-07-08 session — Creative OS handoff processed: email "bug" root-caused (non-bug), rogue secret found

**No code changes. NOT pushed: `4e9260e` + `ed263c1` (runway drought detection + Sprout last-post signals) still await Christian's push.**

**Context:** the Creative OS agent's 7/7 live cleanup (3 ghost clients archived → 5 active book, placeholder retainers Dynasty $20k / Parlour $2k / VitalLyfe $8k, 3/3 team roster, Facts of Record 4/5, Dynasty report recipient saved) handed over 3 items. Full handoff kit filed at `~/Desktop/Software builds/CS_CreativeOS_ChrisKit_v1/` (read its `CHRIS_HANDOFF.md`).

**Item 2 CLOSED — "Setup shows no-client-email for Dynasty" is a NON-BUG, do not "fix" it:**
- Verified end-to-end: warning (`FactsAndReports.jsx:246`), data source (`App.jsx` `select("*")` — confirmed present in the LIVE bundle downloaded from usevantus.com), and mailer (`send-monthly-reports.js:136` → `c.primary_email || OWNER_EMAIL`) all read the same correct column `clients.primary_email`.
- DB queried via service key: dynasty row HAS `hello@dynastystaffusa.com`. The warning the auditor saw belongs to **Parlour Bar** (`primary_email` NULL, recurring lane) — the row below Dynasty. It's truthful. **Open data gap: Parlour Bar needs a real primary_email from Christian** (don't scrape a generic info@).
- Auto-send confirmed double-gated: every client's `report_schedule` is NULL (cron skips) AND per 7/3 the Resend-domain + placeholder-retainer blockers stand. Keep off until retainers are real.

**SECURITY — rogue secret in Netlify env:** a variable whose NAME is a raw Resend API key (`re_jEHHfr94_...`) exists alongside the real `RESEND_API_KEY`. No repo references. Deletion was permission-blocked twice in this harness; **Christian: run `npx netlify env:unset "re_jEHHfr94_CkaXNz6Vd23p9JoapccsqsnH"` and rotate that key in Resend.**

**Still on Christian (from the handoff):** (1) Gemini billing toggle in AI Studio — VL portal's `gemini-proxy` returns 429, blocks all 7 generators; account action, Danny's card. (2) Social OAuth connects in Setup for @DynastyStaffing / @Parlor.Bar / @Vital.Lyfe; the 3 cloud.scenic agency accounts stay Unassigned on purpose. Chrome extension wasn't connected this session, so neither guided browser task ran.

**Schema note worth keeping:** two Supabase projects by design — `wjcstqqihtebkpyuacop` = Vantus (app), `wbryunphevoixgjalcvx` = VitalLyfe generator context (`brand-context.js`). Don't cross-wire.

---

## 2026-07-03 session — full test campaign (27/31), config fixes, data wipe, Client Vault

**All pushed + deployed; migration `20260703_client_vault.sql` applied by Christian.** Latest on `main`: `8e5c002` + this handoff commit.

**Test campaign (results annotated in `TESTING-2026-07-02.md`):** 27/31 pass. The whole QC section is green INCLUDING A9 vision — a flyer with a wrong on-asset price ($8.99 vs $13.99 of record, caption clean) came back blocked citing on-asset. Demo-ready for Danny. Remaining: C4 (cron send fires 13:00 UTC 7/4 — dummy June report queued for "QC Test Kitchen", goes to cz@), C5 covered by design, D5 mobile pass deferred (`/mobile-audit`).

**Two prod configs were silently broken and got fixed by Christian mid-session:**
- Google OAuth `origin_mismatch` — usevantus.com wasn't an Authorized JS Origin for the Drive client (lives in GCloud project "Vital Lyfe War Room", number 458336864067). **Drive upload had NEVER worked in prod** (zero items ever had files). Fixed → upload + QC vision proven.
- Resend domain — cloudscenic.com wasn't verified, so ALL email (reports/invoices/notifies/chase) was still dead despite the 7/2 API-key fix. Verified → C3 + D3 (invoice email) pass. `CRON_TEST_KEY` now set + enforced (keyless ?test=1 refuses).

**Bugs found by testing, fixed + deployed:** (1) manual "+ Add" item creation NEVER persisted — modal sent camelCase `seoKeywords`/`startWeek`, PostgREST rejected the whole insert (PGRST204); (2) realtime INSERT echo doubled client/item cards vs optimistic appends; (3) approval Slack notifications double-fired (recordApproval + the per-tab realtime detector) — notify.js now honors the (type,content_item_id) dedupe before Slack/email/n8n.

**Data wipe (Christian-approved):** 13 seed content items + 5 placeholder team members deleted from prod; dashboard OpsBoard demo tasks emptied and its fake task-motion timers + the agent-count jitter removed (the board was pure theater — not DB-backed).

**NEW: Client Vault** (FINANCE → Vault, `src/ui/routes/VaultRoute.jsx`): per-client billing profile (legal name, contact, email, phone, address/ZIP, tax id, notes) → `client_vault` table, admin-only RLS (portal + anon read zero). Card-on-file via Stripe Checkout **setup mode** (`vault_link`/`vault_sync` actions in `billing-stripe.js`): card is typed on Stripe's hosted page, Stripe vaults it, Vantus stores only brand/last4/expiry + ids and sets the customer default PM. **Never store raw card numbers — this design is deliberate (PCI).** Smoke-tested live: save works, checkout.stripe.com session returns.

**Cleanup owed (next session):** after the 7/4 cron send lands, archive "QC Test Kitchen" (id `4bf5e953…`), delete its test item `qc-test-kitchen-a1-price`, its client_vault row, the dummy `client_reports` row/PDF, and the test flyer in Drive. Note: a live-mode Stripe customer was created for the test client (harmless, no charges).

---

## 2026-07-02 session — QC Agent + Facts of Record + monthly report auto-email (Danny's spec)

**Built from Danny's spec package (`vantus-spec-for-chris.zip`, Counsel has it at scratchpad + the 4-item build order). All four items committed locally on `main` — NOT pushed yet.** Commits: `e59dea2` (schema), `e35a933` (QC agent), `cb90bc4` (Setup sections), `4864c8f` (report cron).

**Before this deploys, two manual steps (in order):**
1. **Apply `supabase/migrations/20260702_qc_facts_reports.sql` in the Supabase SQL editor** (adds qc_* to content_items, client_facts/report_schedule to clients, client_reports table + private `client-reports` bucket, and seeds Dynasty/Parlour/Vital Lyfe config per the spec). App code tolerates the columns missing, but QC runs will fail until applied.
2. Push `main` (founder PAT) → Netlify auto-deploys the new/changed functions.

**What shipped:**
- **QC Agent (spec priority 1):** `qc_review` action in `agent-action.js`. Hybrid gate: Claude sonnet **vision** (new `aiVision` helper) reviews facts/copy/brand + extracts on-asset text from the Google Drive assets; deterministic code exact-matches prices, phone numbers, and offer validity windows (expired offer = auto-blocker). Auto-runs when an item enters "Need Content Approval" (hook in `App.jsx handleSave`); manual "Run QC" button in the Ledger row panel. `qc_status` is a **parallel field** (not a new pipeline status): blocked items can't be Approved at the content gate, can't move to Ready For Schedule/Scheduled (hard SOP gate in EditContentModal), can't be Marked Posted. Videos are NOT frame-checked in v1 (no ffmpeg in functions) — caption+facts checked, warning emitted; fast-follow.
- **Facts of Record (priority 2):** Setup section 5 — per-client hours/locations/prices/offers/operational-facts editor → `clients.client_facts` JSONB, stamps `facts_updated_at`, amber staleness badge >30d, and QC injects a stale-facts warning into every result. No facts on file → QC runs typo/brand only + says so. Owner: Sebastian (data entry pending him).
- **Monthly report auto-email (priority 3):** semi-auto Sprout path (Christian's call — no Sprout API). Setup section 6: drop the month's PDF per client → private `client-reports` bucket + `client_reports` row; `send-monthly-reports` cron (daily 13:00 UTC) emails any unsent completed-month report to `clients.primary_email` with PDF attached, stamps sent_at, Slack+bell, and **nags from the 28th** if the PDF is missing. Test path: `?test=1&key=<CRON_TEST_KEY>` sends to OPS_OWNER without marking. Optional env: `CRON_TEST_KEY`.
- **Per-client config (priority 4):** seeded in the migration (Dynasty 2/day Mon-Fri + monthly_1st report; Parlour 2 videos + 2 flyers/wk pre-approved; Vital Lyfe brief-lane full approval). Rest is Setup-UI data entry.
- Side fix: clients query in App.jsx widened to `select *` — Setup previously read retainer/scope blanks on first load because the narrow column list omitted them.

**Verify after deploy:** create a test item with a Drive image + a wrong price vs facts → move to Need Content Approval → expect qc blocked + the issue naming the price; fix → Run QC → pass. Then `send-monthly-reports?test=1` with a dummy PDF uploaded.

---

## 2026-07-01 session — fulfillment OS complete, Stripe wired, big cleanup

**Current board lives in `VANTUS_TODO.md` (rewritten this session, read it first).** Everything below is pushed and live; last commit on `main` is `0a01e23`.

**What Vantus is now:** the agency fulfillment + billing OS (multi-tenant client book), not a single-client dashboard. The generator side is pre-production (Idea Engine, agents, Pipeline); the fulfillment side is delivery, approvals, and billing. Live nav: Dashboard, Clients, Setup, Ledger, Reports, Client Analytics, Operations, Agents, Idea Engine, Pipeline, Billing. Agent team is Sean / Muse / Scrappy.

**Shipped + pushed this session:**
- P1: overdue-task chase cron (`chase-overdue-tasks`), MRR trend chart, invoice-sent email.
- **Setup** data-entry page (retainers/scope, connected-account to client mapping, bulk owner + due-date, team roster edit).
- Owner-assign: migration `20260701_assigned_to_team_members.sql` (assigned_to FK repointed to team_members), applied by Christian.
- **Stripe wiring** (`billing-stripe.js`): create hosted invoice on send + webhook paid-sync. Secrets `STRIPE_SECRET_KEY` (live restricted key `rk_live_`) + `STRIPE_WEBHOOK_SECRET` set in Netlify, live webhook endpoint created (invoice.paid/voided/marked_uncollectible). Verified wired (webhook returns sig-fail not 501). Create-path NOT yet proven with a real invoice (test skipped). Each client needs `primary_email`.
- Codex perf merge: code-split + null-guard sweep + route-chunk prefetch (bundle 744KB to ~531KB, nav stays instant).
- Cleanup: removed 6 pages (Ad ROI Hub, References, ArtGrid, Cost Governance, Ideal Customer, Competitor Intel) + Analytics (extracted to `ripped out features/analytics-page/`). Removed the Artgrid agent everywhere. Deleted `tools/`. Deleted the parked ripped-out code (agents/apps/client-view/routes + working-ripped-out), keeping only analytics-page. Docs refreshed. `npm audit` clean.

**Open / parked (revisit later):**
- P0 data entry on the Setup page (retainers, account-to-client mappings, owners + due dates, real team roster). Pages read light until entered.
- **Danny update email** drafted (framing: generator = pre-production, fulfillment = delivery/billing, no more Monday.com; no em-dashes per Christian). Not sent.
- **Analytics live-data** (weekend job): plan at `ripped out features/analytics-page/LIVE-DATA-PLAN.md`. Key: the SMM-agent "reuse its IG pull" shortcut is a dead end (backbone only). Real reuse = Vantus's own `sync-instagram.js` + `oauth-instagram-*` + Meta app. Two routes (share Vantus Supabase, or port to a Supabase Edge Function). Seed a test row first.
- Other parked builds: ClientView self-approval portal (old code was deleted but recoverable from git), Unified Inbox, Template Engine, auto-posting, in-page customization design.

**Guardrails unchanged:** founder pushes `main` (one-shot PAT; shell can't reach keychain); migrations via Supabase SQL editor; `git fetch` before commit (shared repo); Codex runs in its OWN worktree (a shared-dir collision happened this session, never let it check out the live folder).

---

# Vantus Handoff Brief — 2026-06-04 (9-item package: speed shipped, #3 reunited, #10 planned)

## 2026-06-04 session — the "9-item package" push

**Canonical list lives in `VANTUS_TODO.md`** (repo root) — that's the running board, status-keyed. This handoff is the narrative; the TODO is the source of truth. Read it first on pickup.

### 📋 9-item package status (6 shipped, 4 left)
| # | Item | Status |
|---|------|--------|
| 1 | Refresh holds your page, doesn't sign you out | ✅ live |
| 7 | Analytics + Ad ROI Hub moved under "Content" nav | ✅ live |
| 8 | Team Broadcast page killed; button moved under Scrappy in Agents | ✅ live |
| 6 (part) | Login water-video removed | ✅ live |
| 4 | Generation speed 28–30s → 10–15s | ✅ **shipped this session** (`70dcd29`) |
| 3 | Analytics "why it won/lost" (Opus) | ✅ **committed & live this session** (`6cb248b`) |
| 9 | Admin page (user count + feedback) | 🗓️ queued for Codex next burst |
| 10 | Virality Checker (pre-publish gate) | 🟢 **ours, started — planning** |
| 6 | Multi-tenant data isolation (agency seats + self-serve) | 🟡 blocked — needs design pass |
| 2 | Per-client OAuth | 🟡 blocked behind #6 |
| 5 | Ad ROI Hub (Meta + static-ad gen) | 🟡 blocked — no Meta connection exists |

### 🚀 #4 — Generation speed (SHIPPED, live)
- Built by Codex on its worktree, reviewed by me line-by-line, pushed to `main` (`52bdea3..70dcd29`).
- Worst offenders fixed: `muse_ig_ideas` and `scrappy_muse_collab` (both 22–30s) → ~10–15s. Method: parallelized fetches (`Promise.all`), Tavily `advanced`→`basic`, `muse_ig_ideas` Opus→**Sonnet**, single-pass collab (raw Tavily data → ideas, *better* grounding), trimmed token caps. Shared `scrappySearchContext` + `_researchDigest` dedup.
- Bonus Codex added: real timing logs — `[agent-action] {action} completed in {ms}ms` in Netlify function logs (so "estimated" numbers become measurable).
- ⚠️ **Spot-check still owed:** the `muse_ig_ideas` Opus→Sonnet quality on a real Idea Engine run. Founder said they'd eyeball it.

### 🔧 #3 — "why it won/lost" (REUNITED + live) — the gotcha to remember
- The #3 work (Opus winner/loser contrast + `lossReasons` "why it lost" in `scrappy_analyze_performance` + `AnalyticsRoute.jsx` Bottom Performers section) had been **deployed-from-local-tree but never committed.**
- Pushing Codex's #4 branch (built off the older commit) auto-deployed and **briefly reverted #3 on prod.** Caught it, committed #3 (`fce3c0f`), **rebased it onto #4** (`6cb248b`) — clean, non-overlapping (#4 never touched `scrappy_analyze_performance`), built green, pushed. #3 now reunited with #4 and in history.
- **Lesson:** the Desktop repo and Codex's `/private/tmp/vantus-grunt-2026-06-04` are **linked git worktrees sharing one object store** — Codex commits are reachable from Desktop by SHA without a fetch. Don't push a branch that's behind local uncommitted work without reconciling first.
- 🔜 #3's win/lose is still slated to eventually **migrate into #10's gate** (where the model can actually see the content). It's safe and shipped for now.

### 🗓️ #9 — Admin page (queued for Codex)
- Was ~80% done before a burst-cancel (`admin-stats.js` + `netlify.toml` redirect written on the throwaway branch, **nothing merged**, that branch had its feedback migration reverted out so #4's net diff stayed clean).
- Re-hand on a **fresh burst** — brief at `/tmp/codex_brief_speed_admin.md` (the #9 half). Standalone #4 brief also saved at `/tmp/codex_brief_4_speed.md` (already shipped, keep for reference).
- Codex burst was nearly spent (`<20%` of 5h, resets ~08:21). Hand it ONE finite task per burst; don't let the speed-audit type work finish on the downgraded mini model.

### 🧭 #10 — Virality Checker (STARTED — planning, this is the next build)
**Concept:** a pre-publish gate — run content through it *before* posting; the model actually watches the whole video (you hold the file at that moment, so no gated-link/scraper wall). It's the final gate before content goes out.
**Architecture decision made:** build the brain on **Gemini alone, all platforms** — YouTube by URL (native), IG/TikTok by file-upload at the gate (Gemini Files API). Gemini gives the **semantic "why"** ("body sags at 0:15, hook works because of the close-up") which is what the founder wants. **Dropped Higgsfield as a dependency** (its MCP is session-only, not usable by the deployed app, and dev-API availability is uncertain) — keep Higgsfield's virality *score* as an optional later layer only.
**The loop (why it matters):** the gate IS the DNA harvester — every check is a real, legit, fully-analyzed piece of the user's content. Store that DNA → feed the **Idea Engine** so it generates grounded ideas. Pair each gate analysis with the metrics that roll in later → revives a *real* "why it won."
**Build slices:**
1. Scaffold (no key) — Virality Checker page + nav item + route, DNA-store table/migration, analysis-function skeleton.
2. Wire Gemini — URL for YouTube, upload for IG/TikTok → verdict. **Needs `GEMINI_API_KEY`.**
3. DNA harvest → Idea Engine feed.
4. Pair gate analysis + later metrics → real "why it won."
**⛔ UNBLOCK NEEDED:** founder grabs a free Gemini key at https://aistudio.google.com/apikey → set as `GEMINI_API_KEY` in Netlify. Slice 1 (scaffold) can start without it.

### 🚢 Git / deploy state
- `main` is at **`6cb248b`** (= #4 speed + #3 reunited), live on prod via auto-deploy.
- Pushes this session via one-shot GitHub PATs (shell can't reach keychain — [[project_vantus_push_auth]]). **Both tokens should be revoked** (reminded founder). Always `git fetch` + verify fast-forward before pushing — Counsel tab may push to `main` too ([[project_vantus_counsel_workflow]]).
- `VANTUS_TODO.md` is **untracked** (not committed) — it's the working list; commit it if you want it versioned.

### 📌 Pickup queue (in order)
1. **Spot-check Idea Engine** quality (`muse_ig_ideas`, Opus→Sonnet) on a live run.
2. **#10 slice 1** — scaffold the Virality Checker (page + nav + route + DNA-store migration + function skeleton). No key needed.
3. **Grab the Gemini key** → #10 slice 2 (wire the real gate).
4. **Re-hand #9** to Codex on a fresh burst (`/tmp/codex_brief_speed_admin.md`).
5. When ready for the next epic: **#6 multi-tenant design session** (unblocks #2).

---

# Vantus Handoff Brief — 2026-06-02 (YouTube OAuth live + Scrappy performance analysis)

## 2026-06-02 session — YouTube connected, analytics cards restyled, "why it won" analysis

**Why:** First real step of the self-serve analyzer pivot — get a second platform (YouTube) syncing real account data, then start turning that synced data into insight. Connected **Cloud Scenic's own YouTube channel** as the working test account.

### 🎥 YouTube OAuth — shipped & live
- Created a Google Cloud OAuth client (Web app) **separate from Supabase's Google sign-in client** so the consent screen is YouTube-access, not login. Enabled **YouTube Data API v3** + **YouTube Analytics API**; scopes `youtube.readonly` + `yt-analytics.readonly`; redirect `https://usevantus.com/api/oauth/youtube/callback`.
- Set the three Netlify env vars via CLI: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `YT_REDIRECT_URI`. (`SUPABASE_URL` / `SUPABASE_SERVICE_KEY` already present.)
- Confirmed `20260601_connected_accounts.sql` was **already applied to prod** (a "policy already exists" error on re-run proved the tables/RLS exist).
- **Connected Cloud Scenic's channel + synced** — videos flowing into `account_posts`.
- ⚠️ OAuth consent screen is in **Testing** mode: only test-user accounts can connect, and refresh tokens expire after 7 days. Publish (and likely Google verification for the readonly scopes) before opening it to other users.
- To connect a brand/business YouTube: sign in as the Google account that **manages** the channel, then pick it in the brand picker — `channels?mine=true` resolves to whatever the authorizing account selects.

### 🎨 Analytics card display — restyled
- Top Performer thumbnails now use **per-platform aspect ratios**: YouTube `16:9`, TikTok `9:16`, Instagram/other `1:1` (`AnalyticsRoute.jsx`, was hardcoded `1:1`).
- Enlarged cards: grid min-width 180px → **280px** + scaled-up card text/metrics.
- Generic connect-toast handler in `ConnectedAccountsCard.jsx` — `youtube_connected` / `tiktok_connected` (+ `*_oauth_error`) params now surface a toast and clean the URL, not just Instagram's.

### 📊 Scrappy performance analysis — built (NEEDS TUNING)
- New agent action **`scrappy_analyze_performance`** (`agent-action.js`): reads synced `account_posts`, groups by platform, computes each platform's **median engagement** as baseline, takes top 6, asks Claude (Haiku) for **per-post "why it won" reasons + 3–5 aggregate patterns**. Per-platform because drivers differ. Returns `{ insights, reasons }`.
- `AnalyticsRoute.jsx`: **"✨ Why these won"** button, **Performance Insights** panel (patterns per platform), and a **"Why it won"** line on each Top Performer card (keyed by `reasons[post.id]`).
- 🐛 **KNOWN BUG (tomorrow's first fix):** the analysis surfaces reasons across multiple posts and leans on raw view-count; it should be scoped to the true **top performer(s)** and rank by the right metric. Founder flagged it; output otherwise works.

### 🚢 Deploy / git state
- Founder authorized overriding the "agent never pushes" rule for this session. Deploys done via `netlify deploy --build --prod` (direct, not git-triggered). Pushes via one-shot GitHub PAT (this shell can't reach the keychain — see [[project_vantus_push_auth]]).
- Pushed to `main`: `33516c4` (aspect ratios + toasts), `62afc21` (bigger cards).
- ⚠️ **`44b55a5` (Scrappy analysis) is committed locally + live on prod, but NOT pushed to `main`.** Push it first thing tomorrow (fresh PAT) before any Counsel/Codex push rebuilds prod from git and drops it.

### 📌 Tomorrow's queue
1. **Push `44b55a5`** to sync git ← do before anything else
2. **Fix "Why these won" scoping** (top performer(s) only; correct ranking metric)
3. **Wire Muse to synced content** — `muse_ig_ideas` reads `account_posts` top performers + caption themes, generates grounded ideas + fills the `script` field (Instagram-first, on-demand button, daily n8n cron later). Deferred today.
4. **Performance pages** — recommendations layer built on top of the Scrappy analysis.

---

# Vantus Handoff Brief — 2026-06-01 (post-rip pass + IG-analyzer pivot prep)

## 2026-06-01 session — Major rip + de-hardcoding pass

**Why:** The original Vantus premise was "log in to your IG/TT/YT/LinkedIn accounts, have AI analyze your analytics and generate better content ideas." The actual built app drifted into a VitalLyfe-specific content-ops dashboard. This session ripped the agency-shaped weight and de-VitalLyfe'd everything so the codebase is ready for the self-serve IG OAuth pivot.

### Ripped (preserved under `ripped out features/`)
- **Apps:** Brief → Content (brief-gen), Shot Reference, Hero Generator
- **Agents:** Lacey (Runner), Ali (Developer), Sam (Monitor), Overseer (SOP Guardian) — kept Sean, Muse, Scrappy, Artgrid
- **Routes:** TrackerRoute (redundant), TaskboardRoute (empty ops theater), SopsRoute (VitalLyfe 7-step SOP)
- **External-client portal:** `ClientView.jsx` (1,298 lines) + preview-mode overlay + 2 "Client View" trigger buttons + `seed.content.js` (VITAL_LYFE_SOP). Approved external clients now route to the main app — RLS already scopes them per `client_id`.

Backups: `ripped out features/{apps,agents,routes,client-view}/` + `working ripped out features/` (full pre-rip production build snapshot for fallback).

### De-hardcoded
Anything VitalLyfe-specific now flows through `clients.brand_voice_md` at request time, parsed into a `brand.pillars` array via new `parsePillars()` helper in `agent-action.js`:
- `muse_ig_ideas` + `muse_generate_calendar` + `scrappy_research` — pillars/voice come from client context, not hardcoded
- `notify.js` email + Slack branding — pulls `clients.name` per call ("Cloud Scenic × {client}" / "{client} Vantus"), falls back to "Vantus"
- `ContentRoute` IG/TT/YT subtitles — pull `currentClient.ig_handle / slug / name`
- `LoginScreen` tagline — "VitalLyfe Content Operations" → "Content Operations Dashboard"
- `CIDPage` AI prompt + ~10 UI labels — "VitalLyfe Adaptation/Version/Ready" → "Brand Adaptation/Version/Ready"
- `ArtgridScout` AI prompt — brand-agnostic, takes voice from context
- `AdROIHub` AI persona — generic Ad Analyst (was "Sam"). Seed campaigns + placeholder also generic.
- `constants.js` — `PILLARS_LIST` is generic placeholders, `CAMPAIGNS = []`
- `App.jsx` — Muse memory seed neutered, new-item template uses client slug
- `ICPPage` — `DEFAULT_CLIENTS = []` (was hardcoded VitalLyfe profile)
- `ReferencesPage` — `INITIAL_REFS = []` (was 4 Drip Campaign seeds)
- `seed.ops.js` — dead-agent task entries (Lacey/Ali/Overseer) stripped
- Various placeholders (`teammate@example.com`, `e.g. your brand name`, generic campaign examples)

Only residue: a single historical comment in `src/core/memory.js` about the long-removed `seedMuseMemory()`. Not live.

### Auth-lock fix (stuckGuard tightening)
**Bug:** Opening Vantus in a second tab kicked the user out of both. Cause: `stuckGuard` setTimeout in `App.jsx` fired unconditionally at 4s — even if `getSession()` resolved at 3.9s, the guard still wiped tokens and reloaded.
**Fix:** Cancel the guard the moment auth resolves (both `getSession().then()` and `onAuthStateChange`). Bumped timeout 4s → 8s for slow networks. Recovery still runs if auth genuinely hangs.

### Build delta
- Modules: 103 → 93
- JS bundle: 798KB → 628KB (~21% lighter)
- pdf-worker chunk (1.2MB): GONE (was used by ripped brief-gen)

### What still uses VitalLyfe as data (not behavior)
- The `clients` row for VitalLyfe in Supabase — still has `brand_voice_md` seeded from migration `20260526_seed_vitallyfe_brand_voice.sql`. Useful as the working test client.
- HANDOFF.md (this doc) still references it as the historical client.

### What the new "user" model looks like (next sprint)
Replace agency-style `clients` rows + invite allowlist with:
- IG/TT/YT/LinkedIn OAuth-per-user
- New `ig_accounts` (and sibling `tt_accounts`, etc.) tables: `user_id`, `account_id`, `access_token`, `handle`, `meta`
- Worker that pulls recent posts + insights (top performers, engagement, hashtags, themes)
- Retarget `muse_ig_ideas` to read user's top posts + caption themes, generate 5 ideas grounded in their actual account
- Add Higgsfield account linking (already stashed)
- Self-serve sign-up — kill the "pending approval" gate

---

# Vantus Handoff Brief — 2026-05-26 PM (evening — post 3-agent collab session)

## Project
Cloud Scenic × VitalLyfe "Vantus" — content operations dashboard.
**Live:** https://usevantus.com (Let's Encrypt SSL, Cloudflare-registered, Netlify-hosted)
**Fallback URL:** https://majestic-cassata-aa16e9.netlify.app (kept active)
**GitHub:** https://github.com/czcloudscenic/War-Room.git (auto-deploys on push to `main`)
**Internal name:** "warroom" (per `package.json` — kept for repo + Netlify subdomain consistency)

## Stack
- **Frontend:** React 19 + Vite 8 (Node 22 pinned via `.nvmrc` and `netlify.toml`). `src/App.jsx` now 1,342 lines (was 1,676 — Codex split out 6 route components into `src/ui/routes/` as Fix #2).
- **Backend:** Supabase (`wjcstqqihtebkpyuacop`) — tables: `content_items` (versioned), `profiles`, `cid_library` + `cid_performance` (real CID tables), `agent_events`, `notifications`, `clients`, `client_users`. (`cid_posts` was a phantom — never existed; migration + caller deleted 2026-05-26 PM.)
- **Netlify Functions:** `/api/chat`, `/api/agent-action`, `/api/notify`, `/api/apify-scrape`, `/api/unsplash` — plus shared helpers `_lib/requireUser.js` (auth + cors) and `_lib/rateLimit.js` (in-memory sliding window). (`/api/cid-scrape` removed 2026-05-26 PM — zero callers + queried phantom table. Higgsfield function is stashed.)
- **Anthropic models:** `claude-haiku-4-5-20251001` (server-side functions) + `claude-sonnet-4-6` (frontend /api/chat callers — bumped from retired `claude-sonnet-4-20250514` on 2026-05-26)
- **Workflows:** n8n cloud at `https://cloudscenic.app.n8n.cloud`, workflow "VitalLyfe Vantus — Content Sync" (ID `3WXHHEiMz9rMnBEn`) — published + live. Per-client routing via `clients.n8n_webhook_url` (Fix #7).

## Env Vars (Netlify, all set)
`ANTHROPIC_API_KEY` · `SUPABASE_SERVICE_KEY` · `SUPABASE_URL` · `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` · `TAVILY_API_KEY` · `N8N_WEBHOOK_URL` · `SLACK_WEBHOOK_URL` (global fallback) · `SLACK_BOT_TOKEN` · `RESEND_API_KEY`

(`CID_BEARER_TOKEN` deleted 2026-05-26 PM — orphaned after cid-scrape removal.)

## Current Nav (UI sidebar)
- **COMMAND:** Dashboard, Task Board, Agents, Competitor Intel, Ideal Customer
- **CONTENT:** Pipeline (unified Instagram/TikTok/YouTube with platform tabs), Production (was Content Tracker)
- **CREATIVE:** Higgsfield Studio *(nav only; component still untracked — see Dirty WIP)*
- **APPS:** Apps, Settings
  - Apps page lists toggleable modules: Brief → Content, ArtGrid Scout, Shot Reference, Hero Generator, Ad ROI Hub, Team Broadcast, References, Skills, SOPs, plus dormant ones

## Agent Actions (`netlify/functions/agent-action.js`)
muse_write_content · muse_from_brief · muse_generate_calendar · muse_save_calendar · muse_ig_ideas · overseer_scan · sean_briefing · lacey_advance · lacey_trigger_n8n · sam_health · artgrid_scout · scrappy_research · scrappy_muse_collab · scrappy_hook_analysis · cid_build_brief · cid_ab_variations

Every invocation writes one row to `agent_events` via SERVICE_KEY (success/error/skipped). **All calls now require an authenticated session** (via `requireUser`).

## Brain Trilogy Status
| Move | What | Status |
| --- | --- | --- |
| **1** — Cortex wiring | Per-client agent brand voice from `clients.brand_voice_md` | ✅ **Live 2026-05-26** (commit `767cb93`). `agent-action.js:94 getBrandContext(client_id)` reads `clients.brand_voice_md` per request; 12 prompt sites interpolate `${brand.name}` + `${brand.voice}`; dynamic `#${brand.name}` hashtags; dead `seedMuseMemory` removed. VitalLyfe seeded via `20260526_seed_vitallyfe_brand_voice.sql`. **Per-request voice override** also wired in `agent-action.js` (payload.voiceOverride replaces brand.voice for that call) + `AgentChatPage.jsx` exposes a textarea — useful for "try a punchier tone" runs. |
| **2** — `agent_events` | Real history of agent invocations | ✅ Live |
| **3** — Notifications persistence | Durable, deduped, realtime | ✅ Live |

**Brain trilogy complete.** Forward layer: Cortex wiki entries (`wiki/clients/<slug>/brand-voice.md`) push into `clients.brand_voice_md` via `scripts/sync-cortex.mjs` (stub exists, schema not finalized — don't create the directory until founder signs off on the convention).

## ✅ Security Posture (REWRITTEN 2026-05-26 PM — hardening sweep complete)

**Auth: live.** Four-way branch in `App.jsx setupSession()` (L72) — admin / approved external client / pending invite (realtime unlock) / unknown blocked.

**Function-level auth: live.** All 5 protected functions reject anon callers via `_lib/requireUser.js`. (cid-scrape.js was deleted 2026-05-26 PM in the closed-by-removal cleanup — was the only function on the legacy bearer-token pattern.)

**Email/password auth: DISABLED 2026-05-26 PM.** Supabase Auth → Providers → Email toggle flipped off. The admin password leaked in git history (pre-`9fb1e10` setup.js — literal redacted from docs 2026-07-12) is now genuinely inert — only Google OAuth remains for cz/dv/ss admin sign-in. Magic-link fallback also disabled (acceptable since Google is the intended path). Remaining: rotate the cz/dv/ss account passwords in the Supabase dashboard to fully retire the value.

**Client-side auth injection: live.** `src/services/apiFetch.js` attaches the access token on every protected call (26 sites). `AgentChatPage` now also passes `currentClient.id` as `client_id` so the backend resolves brand voice correctly (fixed 2026-05-26 — Move 1 was silently using fallback before this prop wiring).

**RLS posture:**
- Temp anon policies fully cleared. Admin policies (@cloudscenic.com email check) on every table.
- `client_users` — admins full r/w; approved clients read their own row(s); realtime enabled.
- `content_items` — admins full r/w; approved clients scoped SELECT+UPDATE to their `client_id` (via `EXISTS` subquery against `client_users`); INSERT/DELETE admin-only; legacy "Allow all for now" anon policy DROPPED (Fix #10.1, `20260526_content_items_client_rls.sql`). Anon REST probe with anon key now returns 0 rows.

**Security hardening sweep (Fix-batch shipped 2026-05-26 PM, commit `8e59968`):**
- **CORS** locked from `*` to allowlist regex via `_lib/requireUser.js cors(event)` — matches `usevantus.com` + `(deploy-preview-*--)?majestic-cassata-aa16e9.netlify.app`. All 6 functions rewritten. `Vary: Origin`.
- **Rate limits** via new `_lib/rateLimit.js` — in-memory sliding window keyed on `user.id:endpoint`. `/api/chat` 30/min, `/api/agent-action` 60/min. Cold starts reset (acceptable since auth+RLS are primary defense).
- **Headers** in `netlify.toml`: HSTS preload (1y, includeSubDomains, preload), Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo denied), tight CSP whitelisting only Anthropic + Supabase REST+WSS + Resend + Slack hooks + n8n cloud + Tavily + Apify + Unsplash images. `style-src 'unsafe-inline'` retained for inline-style React patterns (tighten when factored out — separate task).
- **Auth-lock contention** auto-recovers now (Fix #15). On stuckGuard fire: clears `sb-*-auth-token` localStorage keys, sets one-shot `sessionStorage` flag to prevent reload loops, then `location.reload()`. Manual `localStorage.clear() + reload` workaround retired.

**Remaining open security debt (low urgency):**
- `style-src 'unsafe-inline'` in CSP — required by current inline-style patterns. Tighten when inline styles get factored out.

(Password rotation debt closed 2026-05-26 PM — better fix than rotation: email/password auth provider disabled entirely. Password leak in git history is now inert.)

## Per-client Routing (all live as of 2026-05-26)
- **Slack:** `clients.slack_webhook_url` column. `notify.js` prefers it; falls back to global `SLACK_WEBHOOK_URL`. (Fix #6, commit `702f867`)
- **n8n:** `clients.n8n_webhook_url` column. `notify.js` reads it in the same Supabase fetch as Slack (one roundtrip pulls both); falls back to global env. (Fix #7, commit `2bb8958`)
- **Brand voice:** `clients.brand_voice_md` column. `agent-action.js getBrandContext(client_id)` reads it per request, passes to every handler. Per-request override via `payload.voiceOverride`. (Move 1 / Fix #3, commit `767cb93`)

## Dirty / Stashed WIP — CORRECTED 2026-07-12 (stash cleared)

**The stash is gone; this section previously misdescribed it.** `stash@{0}` ("pre-codex-fix2 wip") was inspected on 2026-07-12: it contained ONLY tracked changes — `public/portal.html` (1,920-line WIP diff), one-line edits to `src/apps/apps.config.js` + `src/utils/constants.js`, and `.netlify/` build noise. The untracked files earlier versions of this section listed (`HiggsfieldStudio.jsx`, `higgsfield.js`, `scripts/sync-cortex.mjs`, `.claude/` config) were **never in the stash** — plain `git stash` doesn't capture untracked files — and they no longer exist on disk or in any commit. That WIP is lost; treat any future Higgsfield Studio or sync-cortex work as a fresh build.

What survived is archived on branch **`archive/portal-html-wip-2026-05-26`** (the stash commit, unpopped). The stash itself was dropped. Re-evaluate portal.html from that branch only if the old client-portal page is ever wanted; it predates the React-side hardening.

`src/ui/layout/PasswordGate.jsx` from earlier HANDOFFs was never created (no git history, not in stash). Drop the mention if it comes up again.

## Session log

### 2026-05-26 PM — Move 1 sprint (9 fixes shipped + security sweep + Codex App.jsx split)

Massive session. Closed half the open punch-list in one afternoon.

| Commit | What |
| --- | --- |
| `767cb93` | `feat(brand)`: per-client brand voice from clients.brand_voice_md (Move 1 / Fix #3). New `getBrandContext` helper + 12 prompt sites refactored + dynamic hashtags + `seedMuseMemory` removed + VitalLyfe SQL seed |
| `22cc58f` | `feat(brand)`: per-request voice override + bump 9 deprecated frontend models (`claude-sonnet-4-20250514` → `claude-sonnet-4-6`; `claude-3-haiku-20240307` → `claude-haiku-4-5-20251001`) |
| `0c163dd` | `fix(brand)`: pass currentClient into AgentChatPage (post-Move-1 regression — `client_id: null` was reaching backend) |
| `2b43364` | `fix(auth)`: auto-recover from supabase-js auth-lock deadlock (Fix #15). stuckGuard clears `sb-*-auth-token` keys + reloads; one-shot sessionStorage flag prevents reload loops |
| `ed46c31` | `chore(schema)`: content_items baseline migration (Fix #10) — 25 cols + FK + indexes + RLS captured in `20260526_content_items_baseline.sql`. Surfaced wide-open "Allow all for now" policy as security debt |
| `5a51b00` | `fix(rls)`: scoped client policies on content_items + drop wide-open anon (Fix #10.1) — `20260526_content_items_client_rls.sql`. Anon REST returns 0 rows now |
| `2bb8958` | `feat(notify)`: per-client n8n routing + consolidated slack+n8n into one Supabase fetch (Fix #7) |
| `4b54630` | `chore(cleanup)`: delete dead `src/agents/` folder (Fix #8) — 8 files, 96 lines |
| `183d53f` | `chore(cleanup)`: cid_library column rename `vitallyfe_adaptation` → `client_adaptation` (Fix #3.1) + close Fix #11 (pdfjs already dynamic) + arch map sync |
| Codex on `codex/grunt-2026-05-26` | `refactor(App)`: extract 6 route components to `src/ui/routes/` (Fix #2). App.jsx 1,676 → 1,342 lines. 7 commits (`4ee755b` Dashboard, `6589b78` Agents, `bee8946` Content, `f2d384c` Tracker, `94eae54` Taskboard, `c4f2cc5` Sops, `e57e951` notes) |
| `8e59968` | `security`: CORS allowlist + per-user rate limits + CSP/HSTS/Permissions/Referrer (security hardening sweep) |
| `90beaa6` | `chore(cleanup)`: drop unused INITIAL_CONTENT seed array (Fix #14 partial) + drop matching App.jsx import + regenerate arch map docs |

**What unlocked:** brain trilogy complete. Multi-tenancy is real end-to-end — adding a new client via AddClient modal + filling `brand_voice_md` gets them their own agent voice automatically. Security posture moved from "auth gate only" to "auth + RLS + CORS + rate limits + CSP". App.jsx finally splittable. Three migrations applied to live Supabase by founder (brand voice seed, content_items baseline, content_items client_rls, cid_library rename) — all verified before code push.

**Codex workflow established:** I work main, Codex grinds on `codex/grunt-<date>` feature branches. Brief Codex with exact line numbers + dirty-WIP out-of-scope list + CODEX_NOTES.md as the report. Use `git push origin HEAD:main` to dodge stale local main refs.

### 2026-05-26 PM (evening) — 3 closed-by-removal cleanups + Codex Fix #4 grind + 3-agent collab pattern proven

| Commit | What |
| --- | --- |
| `a22df04` | `chore(cleanup)`: close cid_posts dead chain + document email/password auth disable. Live SQL probe confirmed `cid_posts` table never existed; `cid-scrape.js` + `003_cid_posts.sql` deleted; arch map + 5 markdown bundle files synced; +88/-171 lines |
| (out-of-band) | **Supabase Auth → Providers → Email** toggle flipped off in dashboard. Leaked admin password (literal redacted 2026-07-12) in git history now inert. Only Google OAuth path remains. |
| (out-of-band) | **Netlify env var `CID_BEARER_TOKEN`** deleted — orphaned after cid-scrape removal. |
| Codex on `codex/grunt-2026-05-27` | `refactor(agent-action)`: Fix #4 — split 1,317-line monolith into 16 handler files under `netlify/functions/agent-action/handlers/`. agent-action.js now 309-line router. 19 commits, build green after each. CODEX_NOTES.md has full report. **Awaiting founder review + merge.** |

**3-agent collab pattern proven at scale:** Main Claude (this tab) drove diagnostics + briefs + arch-map updates. Counsel Claude (parallel tab) shipped `90beaa6` (INITIAL_CONTENT cleanup, caught dead import before I did) + `9955cd3` (HANDOFF rewrite to fix stale "Dirty WIP" claim). Codex GPT-5.5 ground through Fix #4 on its own branch. Zero conflicts across all three. See [[project_vantus_counsel_workflow]] for the workflow notes.

**Codex burst budget behavior:** 5h burst limit (gpt-5.5 quality) caps Codex on big refactors. When exhausted, auto-downgrades to gpt-5.4-mini. Weekly limit is separate (much more generous). Resets are timed per-window (today's was 01:51). Plan big Codex jobs around burst windows.

**Codex standing contract:** "use `codex/grunt-YYYY-MM-DD` today's date, NEVER push to remote, founder reviews + merges manually." My initial Fix #4 brief overrode both (asked for a specific branch name + push) — Codex correctly refused both via CODEX_NOTES.md and asked for confirmation. Briefs should respect the contract; only override when explicitly needed.

**Next session queue (briefs already drafted at `/tmp/`):**
- `/tmp/codex-brief-deadcode.md` — dead code sweep across `src/`. Ready to fire when Codex burst returns.
- `/tmp/codex-brief-app-state.md` — App.jsx state extraction into custom hooks (skeleton; needs parallel Claude tab to produce state map at `/tmp/app-state-map.md` first, paste into brief).
- `/tmp/other-claude-prompt.md` — prompt for a parallel Claude tab to do the state mapping prep.

### 2026-05-25 — Auth restore + invite flow + per-client Slack
Eight commits, four high-severity bugs closed, full external-client invite flow shipped.

| Commit | What |
| --- | --- |
| `307b64f` | `fix(auth)`: dedupe setupSession + render UI immediately on session resolve |
| `8e5095e` | `feat(auth)`: re-enable auth gate + add admin RLS policies (Fix #1) |
| `852d915` | `chore(rls)`: drop temp anon policies now OAuth is live (Fix #1 tail) |
| `2a9c9c1` | `feat(auth)`: caller auth on 5 functions + client_users invite/allowlist flow (Fix #2) |
| `d0acec3` | `fix(auth)`: flip checking=false in onAuthStateChange + 4s stuckGuard (hotfix) |
| `19b6235` | `feat(invite)`: admin team panel inside Edit Client modal (Fix #2.5) |
| `702f867` | `feat(slack)`: per-client webhook routing in notify.js (Fix #4) |
| `d7f0b27` | `docs(map)`: regenerate architecture map after fixes |

**What unlocked:** real multi-tenancy. We can now invite external client teammates (e.g. Natalia at VitalLyfe) via the UI; they get a "pending" screen until we approve in the team panel; on approval their dashboard unlocks via realtime. Per-client Slack routing means future clients won't pollute #vitallyfe-war-room.

### 2026-05-22 → 2026-05-23 (preserved for context)
Repo tidy, component extraction, security audit, Move 2 + Move 3 deployed, custom domain set up, Anthropic model upgrade, mobile nav fixes, multi-tenant `clients` table seeded with VitalLyfe.

## What's NOT Built / Open Items

**Sprint-scale:**
- **Fix #4** — ✅ **DONE on `codex/grunt-2026-05-27`, awaiting founder merge.** 1,317-line agent-action.js → 309-line router + 16 handler files under `netlify/functions/agent-action/handlers/`. 19 commits, build green after each. Reviewed safe by main Claude. Merge with `git checkout main && git merge codex/grunt-2026-05-27 && git push origin main`.
- **App.jsx state extraction** — next big Codex job (~12 hooks under `src/hooks/`). Brief skeleton drafted at `/tmp/codex-brief-app-state.md`; needs the state-cluster mapping section filled in by a parallel Claude tab first (prompt at `/tmp/other-claude-prompt.md`).
- **Fix #12** — Back OpsBoard with a DB-backed `tasks` table (new migration + UI rewrite). ~1 hr. Not Codex-shaped (needs UI browser testing).
- **Fix #13** — Per-user client assignments. Counsel + main both flagged as ambiguous: could mean access (already done via `client_users.status='approved'`), role-per-client (add `assignment_role` column), or primary-contact-per-client (different concept). **Defer until the actual pain forces the question** — small team + one flagship client doesn't surface this yet.

**Decision-bound:**
- **Fix #9 — RESOLVED 2026-07-12 (moot).** The Higgsfield WIP never existed in the stash: `HiggsfieldStudio.jsx` / `higgsfield.js` / `sync-cortex.mjs` were **untracked**, and the plain `git stash` (no `-u`) only captured tracked changes. The untracked files are gone from disk and were never committed anywhere — the WIP is lost. What the stash actually held (a 1,920-line `public/portal.html` rewrite + 2 one-line nav registrations + `.netlify/` build noise) is archived on branch `archive/portal-html-wip-2026-05-26`; stash dropped. `main` has zero Higgsfield references, so nothing dangles. If Higgsfield Studio is ever wanted, it's a fresh build, not a resume.

**Polish:**
- **Vantus-bot Slack app** for agent-attributed messages (currently posts as signed-in user via MCP).
- **Fix #14** — INITIAL_CONTENT seed array removed 2026-05-26 (commit `90beaa6`). `seed.content.js` now only exports `VITAL_LYFE_SOP`, still rendered by `SopsRoute` + `ClientView`. Per-client SOP schema decision is the remaining work before this constant can move into the DB.
- **Dead code sweep across `src/`** — brief drafted at `/tmp/codex-brief-deadcode.md`. Fire when Codex burst returns.
- **External tracker → n8n trigger** (SharePoint/Airtable side).
- Tighten `style-src 'unsafe-inline'` in CSP when inline-style React patterns get factored out.

**Cortex bridge (forward design — not built):**
- `wiki/clients/<slug>/brand-voice.md` → `clients.brand_voice_md` push pipeline via `scripts/sync-cortex.mjs` (stub lives in `stash@{0}`, not in working tree). DO NOT create `wiki/clients/` until founder signs off on the schema. See `~/.claude/projects/-Users-chrisz/memory/project_cortex_vantus_bridge.md`.

## Strategic Context
- **Client:** VitalLyfe (Natalia = approver, Jon = JC, Danny = Cloud Scenic ops)
- **Active campaigns:** Tierra Bomba at $100/day, influencer seeding ~27–30 confirmed
- **External tracker:** influencer list in SharePoint, NOT in Vantus
- **Slack:** posts go to `#vitallyfe-war-room` as "VitalLyfe War Room" bot via `SLACK_WEBHOOK_URL`

## Sister Project
Cloud Scenic OS lives at `~/Desktop/Software builds/Cloud Scenic OS/` — separate codebase, Portal Build Companion agent owns it. Don't mix the two.

## Key Files (Vantus)
- `src/App.jsx` — root component (1,342 lines, post Codex Fix #2 split). Owns all state; routes are dumb presentation.
- `src/ui/routes/` — 6 extracted route components (DashboardRoute · AgentsRoute · ContentRoute · TrackerRoute · TaskboardRoute · SopsRoute). Codex 2026-05-26 Fix #2.
- `src/services/apiFetch.js` — auth-aware fetch wrapper. Attaches `Bearer <access_token>` to every protected call.
- `src/services/supabaseClient.js` — Supabase singleton.
- `src/ui/clients/AddClientModal.jsx` — client CRUD + team management. Embeds ClientTeamPanel.
- `src/ui/clients/ClientTeamPanel.jsx` — invite/approve/reject UI.
- `src/ui/layout/LoginScreen.jsx` — Google OAuth button.
- `src/ui/agents/AgentChatPage.jsx` — chat panel. Passes `currentClient.id` as `client_id` for brand voice resolution. Voice-override textarea above quick actions.
- `netlify/functions/_lib/requireUser.js` — shared auth gate + per-request `cors(event)` (allowlist regex).
- `netlify/functions/_lib/rateLimit.js` — NEW 2026-05-26. In-memory sliding-window per-user rate limit.
- `netlify/functions/agent-action.js` — **On `main`:** 1,317-line monolith. **On `codex/grunt-2026-05-27` (awaiting merge):** 309-line router that imports 16 handlers from `netlify/functions/agent-action/handlers/`. Once merged, this becomes the post-Fix #4 shape.
- `netlify/functions/agent-action/handlers/` — **Codex branch only, awaiting merge.** 16 per-handler files (one per agent action). See CODEX_NOTES.md on the branch for the full list + extraction commits.
- `netlify/functions/chat.js` — Anthropic proxy. Rate-limit 30/min/user.
- `netlify/functions/notify.js` — client notifications + per-client Slack + per-client n8n (single consolidated Supabase fetch).
- `supabase/migrations/20260526_seed_vitallyfe_brand_voice.sql` — VitalLyfe brand voice seed (Move 1).
- `supabase/migrations/20260526_content_items_baseline.sql` — full content_items DDL (Fix #10).
- `supabase/migrations/20260526_content_items_client_rls.sql` — scoped client RLS + drop anon policy (Fix #10.1).
- `supabase/migrations/20260526_cid_library_rename_adaptation.sql` — column rename (Fix #3.1, idempotent DO block).
- `supabase/migrations/20260525_*.sql` — auth restore batch (client_users, slack_webhook, admin RLS, drop temp anon).
- `netlify.toml` — security headers (HSTS, CSP, Referrer-Policy, Permissions-Policy) added 2026-05-26.
- `architecture-map.html` — interactive system map (regenerated 2026-05-26 with all today's changes).
- `docs/architecture-map/` — portable markdown export (README · critical-path · nodes · known-bugs · roadmap · open-items).
- `docs/architecture-map/open-items.md` — checkbox punch-list. Current open count: 3 MED bugs + 2 LOW track-only + 4 numbered fixes. (#4 closed on codex branch awaiting merge; cid_posts LOW closed-by-removal; rotate-passwords closed-by-auth-disable.)
- `sprint-recap.html` — **NEW 2026-05-26 PM evening (untracked).** Single-page animated dashboard summarizing the day's work — 4 ticker counters, before/after agent-action.js shrinking bar, 3-agent collab cards, commit timeline, live ticker. Built as a video prop; keep or delete. Open at `http://localhost:4747/sprint-recap.html` if `python3 -m http.server 4747` is running from repo root.
- `docs/REFACTOR_PLAN.md` — pre-existing refactor roadmap.
- `START HERE.md` — quick-orient nav for cold opens.
- `CODEX_NOTES.md` — Codex's report from the Fix #2 split run (2026-05-26).

---
## 2026-07-04 — harness restart snapshot (recorded by Counsel)
> The Nerve Center multiplexer was shut down and came back **blank** on 2026-07-04; the live agent sessions in its tabs were lost (in-flight, uncommitted-to-chat context is gone — only on-disk state survives). This block records the exact repo state at restart so a cold-started agent can resume without stepping on uncommitted work. **Run `git status` yourself before acting — treat the list below as a starting point, not gospel.**
- Branch `main` · HEAD `a8ff98b` (2026-07-04, "docs(map): update punch-list — 10 map bugs fixed in the 2026-07-04 sweep").
- The narrative above (dated 2026-07-03) predates that 07-04 map-bug commit — treat this repo as **one commit ahead of the prose**.
- Untracked at restart (NOT committed): `COUNSEL_HANDOFF_2026-07-01.md`, `ripped out features/`.
- No tracked-file modifications pending. Owned by the Vantus terminal — Counsel only recorded state, did not edit the narrative.

---
## 2026-07-06 — post-crash recovery + map sync (Vantus terminal, closing)
Cold-started after a terminal crash. On-disk state was intact; no work lost. Verified the build (`npm run build` clean, 98 modules), then closed out the loose threads from the 2026-07-04 sweep:

**Shipped to prod (usevantus.com, HTTP 200):**
- Pushed the 5 sweep commits that were sitting local-only → HEAD `a8ff98b` deployed on Netlify.
- Ran migration `20260704_notify_dedupe_and_cleanup.sql` against prod (via Supabase SQL editor): `notifications.dedupe_key` cycle-aware index is live (re-approvals notify again), deprecated `clients.slack_channel_id` column dropped.
- Confirmed `TOKEN_ENC_KEY` already exists in Netlify — the crypto hard-fail change (encrypt() throws when key unset) is a no-op in prod; existing OAuth tokens were already encrypted with it. **Do NOT rotate that key** or already-stored tokens become undecryptable.

**Architecture map refreshed** → committed + pushed as `dc55cbf` (docs-only):
- HTML `FIXES`/`KNOWN_BUGS` badges were pre-sweep (showed all 10 fixed bugs as open) — rewritten to show only genuinely-open work. Removed the `dead-ui` node (its 3 components were deleted in the sweep). Findings panel + `slack_channel_id` note updated.
- `known-bugs.md`: 10 fixed bugs moved to a "Fixed in the 7/4 sweep" section. `open-items.md`: marked DEPLOYED, migration marked run. `roadmap.md`: added a shipped/partial/open status table.

**Still open (nothing blocking — tracked partials):**
- **#5 Stripe** — the one real unproven thing: `billing-stripe.js:64` live invoice create-path has never run against a real invoice. Send one small controlled invoice to validate webhook paid-sync before billing a client through it. (Email-overlap half already fixed.)
- **#7 admin scoping** — client boundary is doubly-safe now (RLS + client-half scope); give Ledger/Reports/Client-Analytics their own scoped fetches before the next heavy client.
- **#8 security** — crypto done; still open: rotate the Supabase admin password out of git history once fully off password login, tighten CSP style-src.
- **Spot-check owed:** the two 7/3 config outages (Google OAuth Drive origin, Resend domain) were reportedly fixed in-console — verify they held; neither surfaces an error where a human looks.

**Repo state at close:** `main` == `origin/main` (level, `dc55cbf`). Uncommitted/untracked and deliberately left: `HANDOFF.md` (this note + Counsel's restart note), `COUNSEL_HANDOFF_2026-07-01.md`, `ripped out features/`. Both push PATs used this session were one-shot — revoke at https://github.com/settings/tokens if not already done.

---
## 2026-07-12 — Hardening sprint (Fix #7 admin half + CSP + stash truth + integration probes)

**Shipped (4 local commits on `main`, awaiting founder push+deploy — repo is now 7 ahead of origin incl. the 3 held 7/9 commits):**
- `4fe5c97` **Fix #7 (admin half) DONE.** `useSupabaseRows` hook in `src/utils/hooks.js`; ReportsRoute + ClientAnalyticsRoute fetch their own slim windowed rows (90d; approvals limit 20 w/ `content_items(title)` embed; `account_posts` projected via `metrics->>` — jsonb blob no longer ships); global content blob bounded to `posted_at.is.null OR >= 90d` (`ACTIVE_CONTENT_DAYS`, App.jsx). Ledger deliberately keeps riding the bounded blob (realtime + optimistic-overrides interplay). Realtime channel unchanged — patch-only handlers self-maintain the bound. Query syntax validated against live PostgREST (anon 200s). Remaining client half: portal-user `client_id=eq.` re-subscribe.
- `3758a98` **CSP: `'unsafe-inline'` dropped from style-src (Fix #8).** The old "styled-jsx" comment was wrong — no styled-jsx exists, and React `style={{}}` goes through CSSOM (not governed by style-src). Real consumers: LoginScreen's runtime `<style>` injection (moved into `globals.css`) and the GIS button stylesheet (sha256-allowlisted; unused by our UI anyway). Verified on a draft deploy: login pixel-identical, console zero violations.
- `d8f7b0c` **Stash truth + credential redaction.** `stash@{0}` was never the Higgsfield WIP — those files were untracked and plain `git stash` skipped them; they're gone (Fix #9 = moot, fresh build if ever wanted). Actual stash contents (portal.html rewrite + 2 nav one-liners) archived on `archive/portal-html-wip-2026-05-26`, stash dropped. Leaked password literal redacted from all current-tree docs.

**Integration probes — all three "reportedly fixed" integrations are BROKEN in prod (see VANTUS_TODO 🚨 block for fixes):**
1. **Stripe:** `STRIPE_SECRET_KEY` is not a Stripe-shaped value in ANY Netlify context (prod 20 chars, dev 64) — Stripe returns 401. The known-bugs "key is live" claim was wrong. Fix #5 proof invoice is blocked until the real key is set.
2. **Resend:** `RESEND_API_KEY` equally invalid (not `re_`-shaped, API rejects) → all outbound email dead. The rogue env var NAMED `re_jEHHfr94_…` still exists — treat that value as burned, rotate in Resend, set the new key, delete the rogue var.
3. **Google OAuth:** live probe of the GIS popup URL → Google still serves `origin_mismatch` for `https://usevantus.com` (client `844741925554-i2j0…`). The 7/3 console fix never took. Drive upload has never worked in prod.

**Deploy note:** these 4 commits are safe to deploy independently of the key fixes (nothing depends on Stripe/Resend/OAuth). `netlify deploy --build --prod` after founder review; git auto-deploy still credit-blocked.

---
## 2026-07-13 — status ping (no Vantus code work)

Session pivoted to a Danny catch-up email (Dynasty demo, lives at `/tmp/danny-dynasty-demo-email.txt`, owned by the Dynasty session — not Vantus work). Framing correction from Christian for whoever revises it: Dynasty is **already sold**; the email is a catch-up for Danny, not a pitch. He rates the current draft "some good, some eh" — revision pending in the owning session.

**Vantus state unchanged since the 7/12 block above:**
- `main` ahead 7 of origin (3 held 7/9 commits + 4 hardening commits). Push still gated on a one-shot PAT from Christian; deploy via `netlify deploy --build --prod` (git auto-deploy still credit-blocked).
- The three broken integrations (Stripe key invalid, Resend key invalid + rogue `re_…`-named env var, Google OAuth origin unregistered) are still awaiting Christian's ~10-min console session — see the 🚨 block in VANTUS_TODO.md.
- Incidental: `.netlify/netlify.toml` shows modified (regenerated by the 7/12 CLI draft deploys, same class of noise as the untracked manifest — harmless, don't commit it).

---

## 2026-08-17 (night, cont.) — crew at home posts + patrol drones

- **Movement rule amended (Christian):** idle crew now hold their HOME STATION, not Quarters. `shipStations.js` ROSTER gained `home:` (Sean→cockpit, Muse→foundry, Scrappy→intel, Slate→qc); both idle paths (no receipts / stale receipts) resolve to `member.home || 'quarters'`. Future crew still ghost in Quarters. Receipts still drive working/active state and station moves.
- **NEW `src/ship/drones.js`:** 4 original patrol drones (dark capsules, cyan eye, blinking red nav light, faint additive searchlight cone, 3 swaying feeler antennas). Deterministic sin paths — two upper sky, one low over the city, one slow foreground hull crossing. NO film-machine likenesses (Christian said "sentinel robots"; built our own design per the likeness doctrine). First deploy had them 3-4x too small at camera distance — rescaled (s 2.0–3.8).
- Pushes `9099056` + `1bd9c5e`, both deployed + verified via Playwright (magic-link login, Agent Ship → 3D View): Sean/Scrappy/Muse/Slate each at their bay, drones visible in sky and over city.
- Note: one `git push` failed on a network flap mid-run ("repository exists" SSH tail) — retry succeeded; the deploy-watch that reported ready was watching the PREVIOUS deploy. Watch for commit_ref, not just state.
- **Sentinels rescaled to actual scale (Christian: "i need actual scale sentinals"):** drones.js rebuilt as sentinel-class machines — armored head larger than a crew member, 6-eye cyan cluster + pulsing red hunter eye, 8 chained-segment tentacles (7 segs each, travelling sway wave), sweeping searchlight. Push `b72d465`, verified on prod: machines visible over the nose, stern, city band, and the slow foreground crosser.
- **Crew pop + sentinels to deep background (Christian: figures "too big & blending into the ship", sentinel over cockpit rejected):** humanScaleAt cut ~30% (66-105 units); commissioned crew get signature-color tint on near-black garments + 0.4 emissive self-glow (Sean blue / Scrappy indigo / Muse red / Slate cyan now pop); future crew forced to true ghosts (desaturated slate, 0.35 opacity — their wardrobe colors were reading as pixel noise in Quarters). Sentinels halved again + moved to the storm line / city band with haze-lifted hull colors — never over the hull. Pushes 41525c4 + 54af643, Playwright-verified.
- **Hull-breach attacker (Christian: "sentinal on the ship shooting lasers trying to get in nothing crazy"):** 5th sentinel holds an agitated hover over the stern hull (ATTACK config in drones.js, hover 838/95 → impact 895/168), pitched down, tentacles writhing fast, no searchlight. Laser = burst cycle (1.4s on / 2.4s off) with cutting flicker: red core cylinder + wide additive haze sheath + pulsing impact flare. First beam was ~2px and invisible — widened core to r2.4-3.2 + haze r6.5-8.5. Also: future-crew ghost meshes REMOVED from the 3D scene entirely (Christian's "glitch in the left corner" = their accent strips + translucent boxes in Quarters; they remain in Map/List views). Pushes e0c4220 + 8e3d310, laser verified mid-burst on prod.

---
## 2026-08-18 — session close: ship arc settled, board for next session

**Repo state at close:** `main` == `origin/main` (`9b5c0c9`), deployed + ready on Netlify (verified by commit_ref). Only local noise: two regenerated `.netlify/functions/*.zip` artifacts — don't commit. All of tonight's ship work is live on usevantus.com and Playwright-verified.

**Ship view final state (3D View on Agent Ship):** art-as-world painting + shipArtFX life layer; crew at HOME stations when idle (Sean cockpit / Scrappy intel / Muse foundry / Slate qc), receipts still move them; crew scaled 66-105 units with signature-color tint + emissive pop; future crew NOT rendered in 3D (Map/List only); 4 background sentinels patrol storm sky + city band only; 5th attacker sentinel over the stern firing burst lasers at the hull. All sentinel/crew designs original per the settled likeness doctrine.

**What's left on the Vantus build (verbatim board given to Christian tonight):**
- *Blocked on Danny:* Phase C (client workspace shell + rest of spec) gated on his Section 8 vetoes — the Danny call. Open questions live in `VANTUS-PHASE-A-ESTIMATE.md` (AI vs rule-based approval recs, approval_rule default, Resend key). All email still dry-run until a real Resend key lands.
- *Blocked on Higgsfield daily limit (resumes when it resets):* rig Sean — `3d_rigging` with `model_url: e5387b22-1834-436d-ae3e-bc9fa35be125`, `enable_animation: true`, `animation_action_id: 30` (Casual_Walk); then sheet→4-crop→mesh→rig for Muse/Scrappy/Slate (sheets already in Higgsfield gallery); then GLTFLoader + AnimationMixer replaces the procedural figures in ShipScene3D. This is the last visible gap vs the reference.
- *Christian's quick list:* the Danny call; create empty private GitHub repo for vantus-site then `git push -u origin main`; delete ZZ Stress Test + archive QC Test Kitchen from prod; review CloudScenic brand facts for intel features.
- *No buildable code work remains* that isn't gated on one of the above.

**Ops notes for next session:** git pushes intermittently fail on this Mac's network flaps ("repository exists" SSH tail) — retry loop wins; Netlify deploy-watch must match `commit_ref`, not just `state=ready`; prod boot can black-screen 15-45s on the same flaps (wait, don't debug); Playwright browser_click is broken in this MCP build — use browser_evaluate with a querySelector click instead.
