/** Explicit synthetic acceptance fixture, migrated from the former production seeds. */
export async function seedLegacyEducationFixture(api) {
    await api.createStudent({
      displayName: '小A',
      grade: '初二',
      subjects: ['数学', '英语'],
      goals: '期末数学稳定在 90 分以上',
      currentIssues: '函数图像理解不稳，移项和符号错误反复出现。',
      parentConcerns: '希望看到每月进步反馈。',
      tags: ['函数', '计算细节', '家长高关注'],
    });
    const studentId = (await api.listStudents('小A'))[0].id;
    await api.createRecord({
      studentId,
      recordType: 'mistake',
      subject: '数学',
      title: '一次函数图像与参数关系',
      content: '连续三次把 k 值正负与图像走向对应做错，需要从图像变化重新讲解。',
      tags: ['一次函数', '概念混淆'],
      occurredAt: new Date(Date.now() - 86400000).toISOString(),
    });
    await api.createRecord({
      studentId,
      recordType: 'homework',
      subject: '数学',
      title: '方程应用题订正',
      content: '能列式，但单位转换和未知数说明不稳定。',
      tags: ['审题', '表达规范'],
      occurredAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    });
      await api.createQuestionBankItem({
        subject: '数学',
        grade: '初二',
        knowledgePoint: '一次函数',
        questionType: '解答题',
        difficulty: 'medium',
        stem: '已知一次函数 y = kx + b 经过点 (0, 2) 和 (3, 8)，求 k、b，并判断图像随 x 增大如何变化。',
        answer: 'b = 2，3k + 2 = 8，所以 k = 2；图像随 x 增大而增大。',
        analysis: '先用 x=0 得到截距 b，再代入另一点求斜率 k；k>0 表示递增。',
        sourceTitle: '内置演示题库',
        tags: ['一次函数', 'k值', '图像性质'],
      });
      await api.createQuestionBankItem({
        subject: '数学',
        grade: '初二',
        knowledgePoint: '一次函数',
        questionType: '变式题',
        difficulty: 'medium',
        stem: '一次函数 y = -3x + 5 的图像经过哪些象限？函数值随 x 增大如何变化？',
        answer: '经过第一、二、四象限；函数值随 x 增大而减小。',
        analysis: 'b>0，k<0，所以图像过一二四象限；斜率为负表示递减。',
        sourceTitle: '内置演示题库',
        tags: ['一次函数', '象限', '增减性'],
      });
}
