// Fixed FX14 synthetic qualification fixture, not an authorized curriculum or natural model output.
export const standardA='# FX14 合成课标 A版\n能依据原文找事实并解释理由\n阅读材料：两棵树接受的阳光不同。学生连续四周记录树高和浇水量。记录没有控制土壤、初始树高等其他因素，不能断定阳光是树高变化的唯一原因。';
export const standardB=standardA.replace('A版','B版')+'\n比较两种观点并给依据';
export const quote='能依据原文找事实并解释理由';
export const lessonDocument={schemaVersion:'xiaozhi.classroom-plan.v1',title:'从观察到有依据的解释',totalMinutes:40,
 objectives:['依据原文列出光照、树高和浇水记录三类事实。','比较观察条件，引用原文证据解释观察结果。','指出不能认定光照是唯一原因，并提出一项补充观察。'],
 scenes:[
  {sceneId:'intro',type:'slide',title:'用观察提出问题',activity:'出示两棵树的观察文字，学生先区分看到的事实和自己的推测。',durationMinutes:5},
  {sceneId:'explore',type:'slide',title:'寻找原文事实',activity:'两人一组圈出光照、树高和浇水记录，在三列表中分别摘录事实；对照原文纠正臆测。',durationMinutes:10},
  {sceneId:'practice',type:'slide',title:'比较解释与证据',activity:'分别写出一条有依据的解释和一条证据不足的断言，指出未控制的因素并提出补充记录。',durationMinutes:10},
  {sceneId:'assess',type:'quiz',title:'独立出口检查',activity:'独立回答三题，提交原文证据和理由；教师逐目标按标准反馈，未达到者回到相应段落。',durationMinutes:10},
  {sceneId:'close',type:'slide',title:'总结证据边界',activity:'学生补完“我的解释是…，依据是…，还不能断定…”；教师收集下一课待追问问题。',durationMinutes:5}
 ],lesson:{schemaVersion:'xiaozhi.teaching-lesson.v1',subject:'语文',grade:'五年级',preparation:['教师提供合成阅读材料及三列表记录纸','投影或打印原文，准备出口条'],goalCriteria:['准确列出三类原文事实，不补造数据。','至少引用一条原文事实支持解释，并区分解释和断言。','指出至少一项未控制因素，提出可记录的补充观察。'],
 phases:[
  {sceneId:'intro',kind:'introduction',objectiveIndices:[0,1],teacherPrompt:'哪一句是原文事实？哪一句只是你的推测？',checks:[]},
  {sceneId:'explore',kind:'activity',objectiveIndices:[0,1],teacherPrompt:'用原文的哪几个词支持你的记录？不要补写不存在的高度数字。',checks:[]},
  {sceneId:'practice',kind:'practice',objectiveIndices:[1,2],teacherPrompt:'阳光不同是否已经排除了其他原因？还需要比较什么？',checks:[]},
  {sceneId:'assess',kind:'assessment',objectiveIndices:[0,1,2],teacherPrompt:'先独立作答，再依据证据标准核对。',checks:[
   {objectiveIndices:[0],prompt:'原文记录了哪三类与比较有关的信息？',expectedEvidence:'光照条件、四周树高记录、浇水量；不编造具体高度。',criterion:'三类信息均与原文一致。'},
   {objectiveIndices:[1],prompt:'用一条原文事实说明为什么需要继续观察，不能直接下唯一原因结论。',expectedEvidence:'原文没有控制土壤或初始树高等其他因素，因此现有观察不能排除其他解释。',criterion:'引用实际事实且理由与证据有联系。'},
   {objectiveIndices:[2],prompt:'提出一项补充观察，并说明它能帮助判断什么。',expectedEvidence:'例如记录并比较土壤条件，帮助检查土壤差异是否也可能影响树高。',criterion:'指出一个未控制因素，补充观察可执行且不声称已证明因果。'}]},
  {sceneId:'close',kind:'closure',objectiveIndices:[0,1,2],teacherPrompt:'把事实、解释和仍待核对的问题分开说。',checks:[]}
 ],mappings:[0,1,2].map(objectiveIndex=>({objectiveIndex,curriculumIndex:0,quote,explanation:`目标${objectiveIndex+1}用原文事实及其证据边界落实解释理由的阅读要求，合成依据仅作测试对照。`})),missingSources:['这是FX14合成资格样本，真实课标发布版本与自然语义映射仍待教师对照。']}};
