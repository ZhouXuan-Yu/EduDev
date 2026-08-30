import type { KnowledgeEdge, KnowledgeNode } from '../../shared/contracts';

export type MermaidVisualizationResult = {
  schemaVersion: 'omni.visualization.mermaid.v1';
  renderType: 'mermaid';
  title: string;
  mermaid: string;
  nodeCount: number;
  edgeCount: number;
  safe: true;
  requiresTeacherReview: true;
  writesFile: false;
  evidenceBoundary: 'local_knowledge_graph_summary';
};

function label(value: string, max = 70) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/https?:\/\/|javascript:|data:/gi, '')
    .replace(/[\[\]{}();`<>|#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || '未命名';
}

function nodeId(index: number) {
  return `n${index + 1}`;
}

export function buildMermaidVisualization(title: string, nodes: KnowledgeNode[], edges: KnowledgeEdge[], limit = 12): MermaidVisualizationResult {
  const boundedNodes = nodes.slice(0, Math.max(1, Math.min(20, Math.trunc(limit))));
  const nodeIds = new Set(boundedNodes.map((node) => node.id));
  const boundedEdges = edges.filter((edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)).slice(0, Math.max(0, boundedNodes.length * 2));
  const indexById = new Map(boundedNodes.map((node, index) => [node.id, nodeId(index)]));
  const lines = ['graph TD'];
  boundedNodes.forEach((node, index) => {
    lines.push(`  ${nodeId(index)}["${label(node.name || node.summary)}"]`);
  });
  boundedEdges.forEach((edge) => {
    const source = indexById.get(edge.sourceNodeId);
    const target = indexById.get(edge.targetNodeId);
    if (source && target) lines.push(`  ${source} -->|${label(edge.relationType, 40)}| ${target}`);
  });
  const safeTitle = label(title, 120);
  return {
    schemaVersion: 'omni.visualization.mermaid.v1',
    renderType: 'mermaid',
    title: safeTitle,
    mermaid: lines.join('\n').slice(0, 4_000),
    nodeCount: boundedNodes.length,
    edgeCount: boundedEdges.length,
    safe: true,
    requiresTeacherReview: true,
    writesFile: false,
    evidenceBoundary: 'local_knowledge_graph_summary',
  };
}
