import React from 'react';
import AgentChatPage from '../agents/AgentChatPage.jsx';

export default function AgentsRoute({ agents, content, currentClient }) {
  return <AgentChatPage agents={agents} content={content} currentClient={currentClient} />;
}
