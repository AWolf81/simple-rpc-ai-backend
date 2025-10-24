import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { AgentSkill } from '../../types';
import { parseSkillContent } from '../../skills/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const agentMdPath = path.join(__dirname, 'AGENT.md');

let cachedMainAgent: AgentSkill | null = null;

export function loadMainAgentSkill(): AgentSkill {
  if (cachedMainAgent) {
    return cachedMainAgent;
  }

  const content = fs.readFileSync(agentMdPath, 'utf-8');
  const parsed = parseSkillContent(content);

  cachedMainAgent = {
    id: parsed.metadata.id || 'main-agent',
    name: parsed.metadata.name || 'Main Agent',
    description: parsed.metadata.description || 'Core agent coordinator',
    level: 2,
    instructions: parsed.instructions,
    metadata: parsed.metadata
  };

  return cachedMainAgent;
}

export default loadMainAgentSkill;
