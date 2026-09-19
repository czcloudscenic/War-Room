import React from 'react';

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
const SkillsPage = React.lazy(() => import('../apps/skills/SkillsPage.jsx'));
const TeamBroadcast = React.lazy(() => import('./agents/TeamBroadcast.jsx'));
const IdeaEngineRoute = React.lazy(() => import('./routes/IdeaEngineRoute.jsx'));
const ApprovalsRoute = React.lazy(() => import('./routes/ApprovalsRoute.jsx'));
const BillingRoute = React.lazy(() => import('./routes/BillingRoute.jsx'));
const CalendarRoute = React.lazy(() => import('./routes/CalendarRoute.jsx'));
const ClientAnalyticsRoute = React.lazy(() => import('./routes/ClientAnalyticsRoute.jsx'));
const ClientWorkspaceRoute = React.lazy(() => import('./routes/ClientWorkspaceRoute.jsx'));
import ClientsRoute from './routes/ClientsRoute.jsx';
const ContentIntelRoute = React.lazy(() => import('./routes/ContentIntelRoute.jsx'));
import DashboardRoute from './routes/DashboardRoute.jsx';
const DecisionLogRoute = React.lazy(() => import('./truth/DecisionLogRoute.jsx'));
const GrowthRoute = React.lazy(() => import('./routes/GrowthRoute.jsx'));
const LedgerRoute = React.lazy(() => import('./routes/LedgerRoute.jsx'));
const OperationsRoute = React.lazy(() => import('./routes/OperationsRoute.jsx'));
const ProfitabilityRoute = React.lazy(() => import('./routes/ProfitabilityRoute.jsx'));
const ReportsRoute = React.lazy(() => import('./routes/ReportsRoute.jsx'));
const RunwayRoute = React.lazy(() => import('./routes/RunwayRoute.jsx'));
const ScopeRoute = React.lazy(() => import('./routes/ScopeRoute.jsx'));
const SetupRoute = React.lazy(() => import('./routes/SetupRoute.jsx'));
const ShipRoute = React.lazy(() => import('./routes/ShipRoute.jsx'));
const SoftwareOpsRoute = React.lazy(() => import('./routes/SoftwareOpsRoute.jsx'));
const VaultRoute = React.lazy(() => import('./routes/VaultRoute.jsx'));

export default function AppRoutes({ activeNav, agents, aiEnabled, clientContent, clients, content, currentClient, isMobile, isOpsAdmin, liveCount, role, selectedAgent, switchClient, teamMembers, userEmail, userId, workspaceClientId, setActiveNav, setAddClientOpen, setEditingClient, setEditingItem, setIsNewItem, setSelectedAgent, setWorkspaceClientId, activePlatform, apps, handleAddNew, handleIgIdeas, handleMuseWrite, igIdeasLoading, igItems, setActivePlatform, toggleApp, ttItems, ytItems }) {
  return (
    <>
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
    </>
  );
}
