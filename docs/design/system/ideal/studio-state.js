/* Prototype-only repository. Synthetic questions; no production data or network. */
(function (D) {
  const bank = [
    {id:'PHY-001',type:'选择题',point:'浮力方向',level:'基础',text:'关于浸在水中的物体所受浮力，下列说法正确的是（　　）',options:['只有漂浮的物体才受到浮力','浮力的方向总是竖直向上','浮力的大小总是等于重力','物体下沉时不受浮力'],answer:'B',analysis:'液体对物体的浮力方向竖直向上。受到浮力并不意味着物体一定上浮。',source:'浮力基础练习 · 第1题'},
    {id:'PHY-002',type:'计算题',point:'称重法',level:'基础',text:'用弹簧测力计测得物体在空气中的重力为 3 N，将物体完全浸没在水中（不接触容器底），测力计示数为 2 N。求物体受到的浮力。',answer:'1 N',analysis:'物体静止时，F浮 = G − F示 = 3 N − 2 N = 1 N。',source:'浮力基础练习 · 第2题'},
    {id:'PHY-003',type:'实验题',point:'阿基米德原理',level:'中等',text:'小明用溢水杯探究浮力与排开液体重力的关系。测得物体重力为 2.4 N，浸没后测力计示数为 1.4 N，空小桶重 0.5 N，小桶与排出水总重 1.5 N。\n（1）分别求浮力与排开水的重力。\n（2）这组数据支持什么结论？为何还需要多次实验？',answer:'（1）均为 1.0 N。（2）支持浮力等于排开液体的重力；多次改变条件，避免结论的偶然性。',analysis:'分别使用称重法与差值法。单次相等不足以支持普遍结论。',source:'浮力实验专题 · 第3题',figure:true},
    {id:'PHY-004',type:'选择题',point:'物体浮沉',level:'中等',text:'一个物体浸没在水中后释放，开始加速上浮。释放瞬间，它所受浮力 F浮 与重力 G 的关系为（　　）',options:['F浮 < G','F浮 = G','F浮 > G','无法判断'],answer:'C',analysis:'忽略阻力时，向上加速说明向上的合力大于零。',source:'浮沉条件练习 · 第1题'},
    {id:'PHY-005',type:'填空题',point:'阿基米德原理',level:'基础',text:'物体排开水的体积为 200 cm³，水的密度为 1.0×10³ kg/m³，取 g = 10 N/kg，则物体受到的浮力为 ______ N。',answer:'2',analysis:'200 cm³ = 2×10⁻⁴ m³，F浮 = ρ水gV排 = 2 N。',source:'浮力基础练习 · 第5题'},
    {id:'PHY-006',type:'计算题',point:'称重法',level:'中等',text:'某金属块在空气中重 5.4 N，完全浸没在水中时测力计示数为 3.4 N。取 g = 10 N/kg，水的密度为 1.0×10³ kg/m³。求：\n（1）金属块受到的浮力；（2）金属块的体积。',answer:'（1）2 N；（2）2×10⁻⁴ m³。',analysis:'先由称重法求浮力，再用 V = F浮 / (ρ水g) 求体积。',source:'浮力应用专题 · 第2题'},
    {id:'PHY-007',type:'实验题',point:'称重法',level:'中等',text:'探究浮力与浸入深度的关系。物体从部分浸入到完全浸没，再继续下移且不触底。请描述测力计示数的变化，并说明完全浸没后应控制哪些条件不变。',answer:'示数先减小，完全浸没后保持不变。保持液体密度、物体体积等条件不变。',analysis:'部分浸入时排液体积增加；完全浸没后排液体积不再改变。',source:'浮力实验专题 · 第7题'},
    {id:'PHY-008',type:'计算题',point:'物体浮沉',level:'提升',text:'重 6 N 的实心物体静止漂浮在水面上，露出水面的体积占总体积的 1/4。取 g = 10 N/kg。求物体排开水的体积及物体的密度。',answer:'排水体积 6×10⁻⁴ m³；物体密度 750 kg/m³。',analysis:'漂浮时 F浮 = G。先求排液体积，再由总体积为排液体积的 4/3 求密度。',source:'浮沉应用专题 · 第4题'}
  ];
  const key = 'edudev.design.question-studio.v3';
  const uid = () => 'q-' + crypto.randomUUID();
  const fresh = () => ({id:uid(),title:'浮力 · 课堂练习',purpose:'practice',items:[],layout:'默认练习版式',blueprint:[],updated:Date.now()});
  const defaults = () => ({version:3,draft:fresh(),saved:[],templates:[],filter:{query:'',point:'全部',type:'全部',level:'全部',tree:'知识点'},bankScroll:0,preview:'student'});
  let state = defaults(), storageMessage = '';
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const value = JSON.parse(raw);
      if (value.version !== 3 || !Array.isArray(value.draft?.items) || !Array.isArray(value.saved) || !Array.isArray(value.templates)) throw new Error('schema');
      state = {...state,...value,filter:{...state.filter,...value.filter}};
    }
  } catch { storageMessage = '无法恢复原型草稿，原存储未删除；本次可继续编辑并下载备份。'; }
  function save() {
    state.draft.updated = Date.now();
    try { localStorage.setItem(key,JSON.stringify(state)); storageMessage = ''; }
    catch { storageMessage = '浏览器无法保存草稿；本次修改仍在页面中，请下载备份。'; }
  }
  function add(question, kind = '题库原题') {
    if (state.draft.items.some(q => q.sourceId === question.id)) return false;
    state.draft.items.push({...structuredClone(question),id:uid(),sourceId:question.id,kind,points:5,reviewed:kind === '题库原题',revision:1});
    save(); return true;
  }
  function archive() {
    if (!state.draft.items.length) return;
    state.saved = [structuredClone(state.draft),...state.saved.filter(d=>d.id !== state.draft.id)].slice(0,20);
    save();
  }
  function filtered() {
    const f = state.filter;
    return bank.filter(q => (f.point === '全部' || q.point === f.point) && (f.type === '全部' || q.type === f.type) && (f.level === '全部' || q.level === f.level) && [q.id,q.text,q.point,q.source].join(' ').toLowerCase().includes(f.query.trim().toLowerCase()));
  }
  D.studio = {bank,state,key,uid,save,add,archive,filtered,fresh,storageMessage:()=>storageMessage};
})(window.Design);
