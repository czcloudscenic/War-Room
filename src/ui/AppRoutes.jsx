import React from 'react';
import { lazyRoute, RouteErrorBoundary } from './lazyRoute.jsx';

// ── AppRoutes (extracted from App.jsx, 2026-08-26 decomposition slice B) ─────
// The route-mount table for the 20 primary destinations. Pure JSX move: every
// identifier the mounts reference arrives as a prop from Vantus (App.jsx). The
// trailing mounts (agents / content pipeline / ideas / apps / settings) joined
// on 2026-09-18 (slice C); their content-editing handlers arrive as props too.
import AppPlaceholder from './shared/AppPlaceholder.jsx';
import AppsPage from './apps/AppsPage.jsx';
import SettingsPage from './settings/SettingsPage.jsx';
import AgentsRoute from './routes/AgentsRoute.jsx';
import ContentRoute from './routes/ContentRoute.jsx';
const SkillsPage = lazyRoute(() => import('../apps/skills/SkillsPage.jsx'));
const TeamBroadcast = lazyRoute(() => import('./agents/TeamBroadcast.jsx'));
const IdeaEngineRoute = lazyRoute(() => import('./routes/IdeaEngineRoute.jsx'));
const ApprovalsRoute = lazyRoute(() => import('./routes/ApprovalsRoute.jsx'));
const BillingRoute = lazyRoute(() => import('./routes/BillingRoute.jsx'));
const CalendarRoute = lazyRoute(() => import('./routes/CalendarRoute.jsx'));
const ClientAnalyticsRoute = lazyRoute(() => import('./routes/ClientAnalyticsRoute.jsx'));
const ClientWorkspaceRoute = lazyRoute(() => import('./routes/ClientWorkspaceRoute.jsx'));
import ClientsRoute from './routes/ClientsRoute.jsx';
const ContentIntelRoute = lazyRoute(() => import('./routes/ContentIntelRoute.jsx'));
import DashboardRoute from './routes/DashboardRoute.jsx';
const DecisionLogRoute = lazyRoute(() => import('./truth/DecisionLogRoute.jsx'));
const GrowthRoute = lazyRoute(() => import('./routes/GrowthRoute.jsx'));
const LedgerRoute = lazyRoute(() => import('./routes/LedgerRoute.jsx'));
const OperationsRoute = lazyRoute(() => import('./routes/OperationsRoute.jsx'));
const ProfitabilityRoute = lazyRoute(() => import('./routes/ProfitabilityRoute.jsx'));
const ReportsRoute = lazyRoute(() => import('./routes/ReportsRoute.jsx'));
const RunwayRoute = lazyRoute(() => import('./routes/RunwayRoute.jsx'));
const ScopeRoute = lazyRoute(() => import('./routes/ScopeRoute.jsx'));
const SetupRoute = lazyRoute(() => import('./routes/SetupRoute.jsx'));
const ShipRoute = lazyRoute(() => import('./routes/ShipRoute.jsx'));
const SoftwareOpsRoute = lazyRoute(() => import('./routes/SoftwareOpsRoute.jsx'));
const VaultRoute = lazyRoute(() => import('./routes/VaultRoute.jsx'));

export default function AppRoutes({ activeNav, agents, aiEnabled, clientContent, clients, content, currentClient, isMobile, isOpsAdmin, liveCount, role, selectedAgent, switchClient, teamMembers, userEmail, userId, workspaceClientId, setActiveNav, setAddClientOpen, setEditingClient, setEditingItem, setIsNewItem, setSelectedAgent, setWorkspaceClientId, activePlatform, apps, handleAddNew, handleIgIdeas, handleMuseWrite, igIdeasLoading, igItems, setActivePlatform, toggleApp, ttItems, ytItems }) {
  return (
    <RouteErrorBoundary key={activeNav}>
      {activeNav === "dashboard" && (
        <DashboardRoute
          isMobile={isMobile}
          currentClient={currentClient}
          clientContent={clientContent}
          liveCount={liveCount}
          aiEnabled={aiEnabled}
          agents={agents}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          clients={clients}
          content={content}
          team={teamMembers}
          setActiveNav={setActiveNav}
        />
      )}

      {/* APPROVALS — internal inbox (Phase A). Edit reuses EditContentModal via setEditingItem. */}
      {activeNav === "approvals" && (
        <ApprovalsRoute
          isMobile={isMobile}
          clients={clients}
          content={content}
          currentUser={{ id: userId, email: userEmail }}
          onEdit={(item) => { setEditingItem(item); setIsNewItem(false); }}
        />
      )}

      {/* DECISIONS — client decision log + decision debt (Phase B, Codex UI pack) */}
      {activeNav === "decisions" && (
        <DecisionLogRoute clients={clients} activeClientId={currentClient?.id || null} />
      )}

      {/* CONTENT INTEL — Studio Intel port: rates vs benchmarks + idea queue */}
      {activeNav === "contentintel" && (
        <ContentIntelRoute isMobile={isMobile} clients={clients} currentClient={currentClient} />
      )}

      {/* AGENT SHIP — spec §10: 3D / Map / List renderings of the receipts spine */}
      {activeNav === "ship" && (
        <ShipRoute isMobile={isMobile} clients={clients} content={content} setActiveNav={setActiveNav} />
      )}

      {/* CLIENTS — CRM home */}
      {activeNav === "clients" && (
        <ClientsRoute
          isMobile={isMobile}
          clients={clients}
          content={content}
          currentClient={currentClient}
          onOpen={(c) => { switchClient(c); setWorkspaceClientId(c.id); setActiveNav("clientworkspace"); }}
          onEdit={(c) => setEditingClient(c)}
          onAdd={() => setAddClientOpen(true)}
        />
      )}

      {/* CLIENT WORKSPACE (Phase C §3.C.6) — Open now lands here, not the dashboard */}
      {activeNav === "clientworkspace" && workspaceClientId && (() => {
        const wc = clients.find(x => x.id === workspaceClientId);
        return wc ? (
          <ClientWorkspaceRoute
            client={wc}
            content={content}
            isMobile={isMobile}
            userId={userId}
            onBack={() => setActiveNav("clients")}
            setActiveNav={setActiveNav}
          />
        ) : null;
      })()}

      {activeNav === "setup" && (
        <SetupRoute isMobile={isMobile} clients={clients} content={content} />
      )}

      {activeNav === "ledger" && (
        <LedgerRoute isMobile={isMobile} clients={clients} content={content} team={teamMembers} currentUser={{ id: userId, email: userEmail }} />
      )}

      {activeNav === "reports" && (
        <ReportsRoute isMobile={isMobile} clients={clients} />
      )}

      {/* GROWTH / LEADS (Phase C §3.C.4) — scan → audit → brief → convert */}
      {activeNav === "leads" && (
        <GrowthRoute isMobile={isMobile} setActiveNav={setActiveNav} clients={clients}
          openClient={(id) => { const c = clients.find(x => x.id === id); if (c) { switchClient(c); setWorkspaceClientId(c.id); setActiveNav("clientworkspace"); } }} />
      )}

      {/* CONTENT CALENDAR (Phase C §3.C.5) — all clients, one month grid */}
      {activeNav === "calendar" && (
        <CalendarRoute isMobile={isMobile} clients={clients} content={content} setActiveNav={setActiveNav} />
      )}

      {activeNav === "runway" && (
        <RunwayRoute isMobile={isMobile} clients={clients} content={content} />
      )}

      {activeNav === "operations" && (
        <OperationsRoute isMobile={isMobile} clients={clients} />
      )}

      {activeNav === "clientanalytics" && (
        <ClientAnalyticsRoute isMobile={isMobile} clients={clients} content={content} />
      )}

      {/* SCOPE SENTINEL — Phase D: classify every ask, absorb nothing silently */}
      {activeNav === "scope" && (
        <ScopeRoute isMobile={isMobile} clients={clients} />
      )}

      {/* PROFITABILITY LITE — Phase D: retainer + paid projects minus hard costs */}
      {activeNav === "profitability" && (
        <ProfitabilityRoute isMobile={isMobile} clients={clients} />
      )}

      {activeNav === "billing" && (
        <BillingRoute isMobile={isMobile} clients={clients} />
      )}

      {activeNav === "vault" && (
        <VaultRoute isMobile={isMobile} clients={clients} />
      )}

      {/* DYNASTY — Cloud Scenic control surface for the Dynasty pipeline.
          Admin-only: first role-gated route in the app; /api/dynasty enforces
          the same server-side. */}
      {activeNav === "dynasty" && isOpsAdmin && (
        <SoftwareOpsRoute />
      )}

      {/* AGENTS */}
      {activeNav === "agents" && (
        <AgentsRoute agents={agents} content={content} currentClient={currentClient} />
      )}

      {/* CONTENT (unified: Instagram / TikTok / YouTube with tab switcher) */}
      {activeNav === "content" && (
        <ContentRoute
          igItems={igItems}
          ttItems={ttItems}
          ytItems={ytItems}
          activePlatform={activePlatform}
          setActivePlatform={setActivePlatform}
          isMobile={isMobile}
          handleIgIdeas={handleIgIdeas}
          igIdeasLoading={igIdeasLoading}
          handleAddNew={handleAddNew}
          setEditingItem={setEditingItem}
          handleMuseWrite={handleMuseWrite}
          currentClient={currentClient}
        />
      )}

      {activeNav === "ideas" && <IdeaEngineRoute currentClient={currentClient} />}
      {(activeNav === "chat" || activeNav === "broadcast") && <TeamBroadcast agents={agents} />}

      {/* SKILLS */}
      {activeNav === "skills" && <SkillsPage agents={agents} />}

      {/* APPS */}
      {activeNav === "apps" && <AppsPage apps={apps} toggleApp={toggleApp} />}
      {activeNav === "settings" && <SettingsPage />}
      {activeNav === "scrappy" && <AppPlaceholder label="Scraping Ops" desc="Live trend scraping from TikTok, IG, Reddit — powered by Scrappy." icon="◉" />}
      {activeNav === "automation" && <AppPlaceholder label="Automation Center" desc="Scheduled agent workflows, n8n triggers, and pipeline automation." icon="⚡" />}
    </RouteErrorBoundary>
  );
}
