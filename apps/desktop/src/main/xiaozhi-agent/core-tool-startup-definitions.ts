import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import generated from './capabilities/generated/core-tool-static-definitions.json' with {type:'json'};
import {CORE_TOOL_NAMES} from './tools/manifest';
import {taskEnvelopeParameters} from './tasks/tool-envelope';

/** Build-derived metadata only: no factory, workspace, callback or tool activation. */
export function coreToolStartupDefinitions():Pick<ToolDefinition,'name'|'parameters'>[] {
  if(generated.schemaVersion!==1)throw Error('source_changed');
  // Persistent terminal schema and optional Goal tools remain per-run declarations.
  return generated.definitions.filter(definition=>CORE_TOOL_NAMES.includes(definition.name)&&definition.name!=='exec_command'&&definition.name!=='report_goal_progress')
    .map(definition=>({name:definition.name,parameters:taskEnvelopeParameters(definition.name,definition.parameters as ToolDefinition['parameters'])}));
}
