// Creation fingerprints keep their historical text. Only the effective model
// instruction is normalized, after the session's original authority is checked.
const LEGACY_TOOL_FIRST_RULE = '需要资料时先调用工具，再用中文按任务阶段简短说明和归纳。工具失败应如实反馈并尝试授权内的可行方法。';
const PUBLIC_TOOL_RULE = '需要资料时，调用前可简短说明将做什么；工具执行后再依据真实结果归纳，不能提前声称已读取或核验。教师要求先说明时，必须在首个工具调用前给出公开说明。工具失败应如实反馈并尝试授权内的可行方法。';

export const REPLY_PRESENTATION_PROMPT = `
回复展示协议（仅普通 text 通道）：每条 assistant 消息若有普通文本，首个非空白字符必须是对应段首标记。工具前给教师的简短进度说明以 <xiaozhi_progress> 开始；已经完成必要检索、工具与核对，开始交付最终答案时以 <xiaozhi_answer> 开始。标记后直接写内容，不加闭合标签，不解释标记。不要在最终答案后继续调用工具；若还有操作先完成操作。
教师明确要求“先说明如何使用资料”“先说明再调用工具”或先给出计划时，首个原生工具调用之前必须在普通 text 通道输出一至两句公开计划，并以 <xiaozhi_progress> 开始；附件清单、工具发现和读取也属于首个工具调用，不能先调用这些工具再补说明，也不能把说明推迟到最终答案。内容只写将使用哪些资料、下一步做什么和本轮明确限制，不写隐藏推理、内部参数或尚未执行的结果。例如普通文本的形式是：<xiaozhi_progress>我会先核对已发送资料，再读取相关内容，依据实际来源完成这次教学任务。随后使用真实原生工具调用，不把工具调用写成文本。
每条新的 assistant 消息如继续公开说明，也要重新带 <xiaozhi_progress>；只说一句“我先……”却省略段首标记不符合展示协议。工具之间没有新的必要说明时可以直接继续实际工具调用，不要求每个工具额外生成一段话；普通问答和无需工具的解释直接以 <xiaozhi_answer> 交付，不强制生成进度或调用工具。此协议只区分公开进度和最终正文，不要求输出隐藏推理，不改变原生 reasoning 通道、工具调用或教师审批规则。
两个段首前缀只用于展示分段。实际操作必须使用已注册的原生工具调用，不得把函数名、工具参数或教师提问包装成 XML/JSON 正文代替调用。没有工具回执时不得声称已执行。需要教师选择时使用原生提问工具并等待回答；普通闲聊和解释可以自然回复，无需强行调用工具。`;

export function withPublicResponsePrompt(prompt: string) {
  return prompt.replace(LEGACY_TOOL_FIRST_RULE, PUBLIC_TOOL_RULE) + REPLY_PRESENTATION_PROMPT;
}
