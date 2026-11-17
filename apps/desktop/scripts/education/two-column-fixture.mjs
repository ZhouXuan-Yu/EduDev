const questions = [
  [
    "小车沿直线匀速运动，每秒前进两米。根据这些条件，求五秒内小车前进的路程。",
    ["两米", "四米", "六米", "十米"],
  ],
  [
    "一个物体静止在水平桌面上，同时受到重力和支持力作用。请判断这两个力之间的关系。",
    ["方向相同", "方向相反", "大小不同", "没有关系"],
  ],
  [
    "一盏灯接入电路后能够正常发光。断开开关之后灯熄灭，根据实验现象判断电路状态。",
    ["处于通路", "处于断路", "电流增大", "灯泡更亮"],
  ],
  [
    "实验小组用刻度尺测量物体长度，需要先观察刻度尺的零刻度以及最小分度值。请选择正确操作。",
    ["斜着观察", "估计读数", "不看单位", "随意测量"],
  ],
];
const question = (q, index) =>
  `<section><p>${index + 1}．${q[0]}</p><div class="options">${q[1].map((text, i) => `<div>${String.fromCharCode(65 + i)}．${text}</div>`).join("")}</div></section>`;
export const twoColumnHtml = `<!doctype html><meta charset="utf-8"><style>@page{size:A4;margin:18mm}body{font-family:'Microsoft YaHei',sans-serif;font-size:15px;line-height:1.7}h1{text-align:center;font-size:22px;margin:0 0 30px}.columns{display:grid;grid-template-columns:1fr 1fr;gap:38px}section{margin-bottom:45px}p{margin:0 0 10px}.options{display:grid;grid-template-columns:1fr 1fr;gap:5px 12px}</style><h1>物理双栏结构回归样本</h1><div class="columns"><div>${questions
  .slice(0, 2)
  .map((q, i) => question(q, i))
  .join("")}</div><div>${questions
  .slice(2)
  .map((q, i) => question(q, i + 2))
  .join("")}</div></div>`;
