/** Narrow subject routing, not a physics solver or a claim of answer correctness. */
function relevantPhysicsTask(text: string) {
  if (/浮力|阿基米德|浮沉条件|受力|重力|合力|拉力|张力|支持力|摩擦力|弹簧测力计/u.test(text)) return true;
  if (/密度|上浮|下沉|漂浮|悬浮|浸没|浸入|排开/u.test(text)
    && /物体|物块|木块|球|液体|水中|水面|水里|海水|盐水|油中|浮沉/u.test(text)) return true;
  if (/\b(?:buoyancy|buoyant|archimedes|hydrostatics)\b/iu.test(text)) return true;
  return /\b(?:density|float|floating|sink|sinking|tension|equilibrium|force)\b/iu.test(text)
    && /\b(?:water|liquid|fluid|gravity|spring balance)\b/iu.test(text);
}

const PHYSICS_ANSWER_INSTRUCTIONS = `[本次物理任务的答案核对约束]
先明确研究对象和已知受力条件，核对重力、浮力及题目中的绳/测力计张力、支持力、摩擦力或流体阻力等外力，不得无依据假定外力不存在。测力计读数是拉力，不是重力减少；已知静止或匀速直线运动时核对所有外力的合力为零，不能漏掉拉力便把静止状态说成上浮或下沉。
若讨论撤去拉力、支持等后的运动，须明确这是新增条件，并区分从静止释放与已有速度；合力方向决定加速度，不直接等于运动方向。没有给定“松手、断线、撤去外力、由静止”等条件时，不能暗补成已知。仅在其他外力可忽略的条件下比较浮力与重力来判断加速度或由静止释放的运动趋势。
浮力取决于液体密度、重力加速度和排开液体体积。在均匀液体、重力加速度近似不变、物体体积固定且始终完全浸没时，浮力不随深度改变。只有跨过液面使排液体积改变，或液体密度/物体体积等条件变化时，才另论浮力变化；不能笼统写“上浮过程中浮力逐渐减小”。密度判断浮沉须说明平均密度、是否有其他约束力及液体条件，不把受绳牵引的平衡当作自由漂浮/悬浮。
刚性正方体浮力且明确适用静水近似时，查找education_analyze_buoyancy，提交实际边长、密度、g、载荷与自由/全浸没触底场景，利用返回的双方法、临界/超载与缺条件结果；未给定量用null，不猜g或把未知载荷当0。超出这个模型仍使用适用的物理推导/数量核验，不能强塞进正方体模型。
仅在相关结论处简短写明适用条件，区分资料已知、自设条件和推导，不复述这份核对规则，不输出隐藏推理，不增加无关的受力分析段落。`;

export function physicsAnswerInstructions(text: string) {
  return relevantPhysicsTask(text) ? PHYSICS_ANSWER_INSTRUCTIONS : '';
}
