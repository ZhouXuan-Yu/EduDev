import assert from 'node:assert/strict';

export async function mcpConfigurationJourney(ctx){
 const {page,until,check,shot}=ctx.get(),catalog=()=>page.evaluate(()=>window.omniEdu.getXiaozhiMcpCatalog());await ctx.tab('tools');await page.getByTestId('pi-mcp-add').waitFor();await until(()=>catalog().then(v=>v.ok),'MCP_CATALOGUE');
 const initial=(await catalog()).value;assert.equal(initial.servers.length,0);
 await page.getByTestId('pi-mcp-name').fill('本地公开课程配置核验');await page.getByTestId('pi-mcp-address').fill(ctx.mcp.url);await page.getByTestId('pi-mcp-secret').fill(ctx.mcpSecret);
 assert.equal(await page.getByTestId('pi-mcp-add').isDisabled(),true);await page.getByTestId('pi-mcp-ack').locator('[data-slot="checkbox-control"]').click();await page.getByTestId('pi-mcp-add').click();await until(()=>catalog().then(v=>v.ok&&v.value.servers.length===1),'MCP_SAVE');
 await until(()=>page.getByTestId('pi-mcp-notice').innerText().then(t=>t==='已保存连接。请读取工具目录，再逐项授权。'),'MCP_SAVE_UI_ACK');
 let server=(await catalog()).value.servers[0];ctx.serverId=server.id;assert.equal(server.status,'unverified');assert.equal(ctx.mcp.state.requests,0);assert.equal(await page.getByTestId('pi-mcp-secret').inputValue(),'');check('Saving an acknowledged connection neither inspects nor authorizes tools');
 const status=part=>page.getByTestId('pi-mcp-status-'+server.id).innerText().then(t=>t.includes(part));
 const action=async(id,settled)=>{await page.getByTestId(id).click();await until(async()=>!await page.getByTestId('pi-mcp-refresh').isDisabled()&&await settled(),'MCP_UI_ACK');};
 const inspect=()=>action('pi-mcp-inspect-'+server.id,()=>status('目录已读取'));
 const trust=()=>action('pi-mcp-trust-'+server.id,()=>page.getByTestId('pi-mcp-notice').innerText().then(t=>t==='已授权当前目录中的选中只读工具。'));
 await inspect();server=(await catalog()).value.servers[0];assert.equal(server.status,'ready');assert(!server.trustedSchemaHash);assert(ctx.mcp.state.requests>0);
 assert(await page.getByTestId(`pi-mcp-tool-${server.id}-unknown_effect`).locator('input').isDisabled());await page.getByTestId(`pi-mcp-tool-${server.id}-lookup_lesson`).locator('[data-slot="checkbox-control"]').click();await trust();
 server=(await catalog()).value.servers[0];assert.equal(server.trustedSchemaHash,server.schemaHash);assert.deepEqual(server.tools.filter(t=>t.selected).map(t=>t.name),['lookup_lesson']);await shot('mcp-explicit-readonly-trust');check('Real loopback MCP catalogue grants only explicitly selected declared read-only tool');
 ctx.mcp.state.tools[0].inputSchema.properties.topic.maxLength=90;await action('pi-mcp-inspect-'+server.id,()=>status('工具目录已变更'));server=(await catalog()).value.servers[0];assert.equal(server.status,'schema_changed');assert(!server.trustedSchemaHash);assert(!server.tools.some(t=>t.selected));check('Actual MCP schema change invalidates prior tool trust');
 await inspect();await page.getByTestId(`pi-mcp-tool-${server.id}-lookup_lesson`).locator('[data-slot="checkbox-control"]').click();await trust();await action('pi-mcp-revoke-'+server.id,()=>status('授权已撤销'));assert.equal((await catalog()).value.servers[0].status,'revoked');assert.equal(ctx.mcp.state.calls,0);await shot('mcp-revoked');check('Explicit revoke persists without executing any service tool');
}
