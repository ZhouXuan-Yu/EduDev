/** FX01 synthetic teaching content. Not a model answer-quality fixture/result. */
export const presentationFixture={schemaVersion:'xiaozhi.presentation-draft.v1',title:'浮力：从漂浮到下沉',sections:[
 {pageId:'cover',heading:'浮力：从漂浮到下沉',paragraphs:['八年级 · 10分钟科普课','观察木块，解释漂浮条件，判断载荷变化。'],speakerNotes:[{kind:'script',text:'导入1分钟：请学生先预测增加载荷后水面和木块位置的变化，再说明本课使用理想化的静力模型。'}]},
 {pageId:'conditions',heading:'先确认研究条件',paragraphs:['正方体边长10cm；木块密度600kg/m³；水密度1000kg/m³。','取g=10N/kg，容器足够大且深；忽略空气浮力及载荷体积，载荷不脱落。'],speakerNotes:[{kind:'script',text:'用1分钟把厘米换为米：边长0.1m，体积0.001m³。不能把题目说成来自本地题库；它是本次合成自拟。'}]},
 {pageId:'formula',heading:'排开的液体决定浮力',paragraphs:['F浮=ρ液gV排；ρ液用kg/m³，V排用m³。','漂浮且静止时，浮力等于总向下力；不能把整个木块体积总当作排液体积。'],speakerNotes:[{kind:'script',text:'讲解2分钟：区分物体总体积和浸入部分排开的体积。让学生指出每个符号和对应单位。'}]},
 {pageId:'variables',heading:'改变变量，观察排液体积',paragraphs:['先保持木块和载荷不变，只改变液体密度。','比较浸入深度，再改变木块密度和向下载荷；每次只改一个变量。'],table:{columns:['变量','可调范围'],rows:[['木块密度','200–950kg/m³'],['液体密度','800 / 1000 / 1200kg/m³'],['附加载荷','0–6N']]},speakerNotes:[{kind:'script',text:'用HTML演示2分钟：学生先预测，再拖动变量。图示是教学示意，不把静力计算称为真实运动积分。'}]},
 {pageId:'default',heading:'默认状态：木块为何漂浮',paragraphs:['质量0.6kg，重力6N；漂浮时浮力为6N。','排液体积0.0006m³，即600cm³；浸入6cm、露出4cm。'],speakerNotes:[{kind:'script',text:'讲解1分钟：通过受力平衡求浮力，再用阿基米德原理求排液体积，最后由底面积0.01m²求浸入深度。'}]},
 {pageId:'load',heading:'载荷增加，平衡能否保持',paragraphs:['附加4N时，总向下力10N，达到全浸没最大浮力。','附加5N且未触底时，总向下力11N，浮力上限10N；向下合力1N。'],speakerNotes:[{kind:'script',text:'解释1分钟：4N是中性浮力边界，平衡条件不能唯一确定完全浸没后的深度。5N未触底时有向下合力；若触底静止，则支撑力为1N，不能混淆这两种状态。'}]},
 {pageId:'checks',heading:'两道理解检查',paragraphs:['① 木块密度600kg/m³、液体密度800kg/m³且无载荷，漂浮时浮力是多少？','② 水中附加5N载荷，木块尚未触底，向下合力是多少？请说明依据。'],speakerNotes:[{kind:'script',text:'检查1分钟：先独立作答，再说出为什么不能只看液体密度或直接套用平衡条件。'}, {kind:'answer',text:'检查①参考答案6N；检查②参考答案1N，方向向下。只在教师备注保留，不放入本页投影。'}]},
 {pageId:'summary',heading:'把观察变成有依据的判断',paragraphs:['先确认状态与研究对象，再用浮力公式和受力关系。','拓展：把水换成密度更大的液体，木块会浸得更深还是更浅？'],speakerNotes:[{kind:'script',text:'总结1分钟：让学生用“状态—受力—排液体积”的顺序复述推理。拓展题关注总向下力不变时排液体积减小，木块浸得更浅。'}]}
]};
