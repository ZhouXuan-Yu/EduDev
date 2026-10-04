# P06d-D 整体差距审计与窗口恢复验收

开始2026-10-03，收尾2026-10-04；合同103，M10/M01。**本切片通过，完整D1–D7/P06/P07/P08和总目标仍active。** 三元题组暂停；单一嵌入Pi/Hana、默认国内DeepSeek及教育隐私/确认规则保持。

## 1. 实际交付

- 103把R1/R2、公开准备→真实工具→后续公开说明→最终答复、组件映射、所有状态和完整未完成清单集中绑定，压缩后有固定五步恢复入口。现成Pro/Hana/ZCode来源不称Codex官方同源；不显示隐藏推理/私有摘要。
- ZCode原`clampDimension`、`resolveDesktopWindowSize`、`attachDesktopWindowSizePersistence`和target type由AST提取，函数体原样，沿Apache-2.0许可证；constants/类型适配当前宿主，source/output SHA可复验，无新依赖或打包体积新增包。
- main本地UI几何schema1：正常尺寸/位置、最大化分别保存；resize原防抖，move/close微量同步原子写。4KiB读取上限、严格字段/有限整值、当前display workArea裁剪、坏配置/写失败回退。保存的是userData的`desktop-window.v1.json`，不含聊天/权限/Key，不增加业务表/IPC或云上传。
- 原生框安装后重应用保存bounds，防止150%下constructor累计高度漂移；实际贴屏越界最多两次测量校准，仅改越界字段。真实三次normal保持`x25/y20/1280×781`；最大化重启再还原同normal。旧配置不存在时默认布局，`OMNI_EDU_WINDOW_GEOMETRY=0`保留旧固定options和几何文件原字节。
- 修复AI/settings保留实例后的pending新聊天漏消费：visible/返回刷新时flush；hidden晚到fresh结果不覆盖用户后开的设置。原typed main/create会话及业务authority保持。

## 2. 固定源码门禁与真实实例

cwd均为`D:\WorkProject\EduProject\apps\desktop`。最终build5；renderer入口`index-DC37aI59.js`。最后主smoke同源码重建同入口；实例期间没有修改运行源码或out。

| 精确命令 | 实际结果/报告 | 边界 |
| --- | --- | --- |
| `npm run build` | exit0，p06dd-build-final5.log | main/preload/renderer/typecheck，不代替用户闭环 |
| `npm run test:renderer-components` | 79/79，exit0，p06dd-renderer-final5.log | 原组件状态门禁 |
| `node scripts/xiaozhi-agent/window-geometry-state-smoke.mjs` | 8/8，exit0，p06dd-state-final5.log | schema/有限值/负坐标/缺屏/小workArea算法，不是实际硬件切换 |
| `node scripts/xiaozhi-agent/reuse-window-size.mjs --verify` | 2，exit0，p06dd-source-size.log | 原尺寸源+LICENSE，静态来源 |
| `node scripts/xiaozhi-agent/reuse-window-chrome.mjs --verify` | 2，exit0，p06dd-source-chrome.log | 原overlay源+LICENSE，静态来源 |
| `node scripts/xiaozhi-agent/reuse-workspace-components.mjs --verify` | 32/182153bytes，exit0，p06dd-source-pro.log | Pro闭包原字节，不改原组件 |
| `node scripts/xiaozhi-agent/pi-native-chrome-ui-smoke.mjs` | **31/31，OUBtNz，exit0**，p06dd-native-final5.log | 实际Windows菜单/快捷键/导航/主frame边界，两native content窗口、caption捕获/125%zoom；resize/move→立即关闭→重启、三次exact normal、最大化、坏/未知/非法/超限文件、越界纠正/写失败/回退原字节，无provider任务 |
| `node scripts/xiaozhi-agent/pi-workspace-files-ui-smoke.mjs` | **25/25，XuZm2g，exit0**，p06dd-files-final5.log | 实际typed/Hana文件、本地text/Markdown/PNG/版本/取消/权限/归档、双native窗口、min360与重启；无Office/PDF正文/provider |
| `node scripts/xiaozhi-agent/pi-control-menus-ui-smoke.mjs` | **10/10，dpbdKr，exit0**，p06dd-menus-final5.log | 原模型/权限菜单、sidebar搜索、两设置返回相同未发草稿；chooser取消受控，无新grant |
| `node scripts/xiaozhi-agent/pi-public-process-ui-smoke.mjs` | **17/17，E13656，exit0**，p06dd-process-final5.log | 真DeepSeek自然合成教研请求分段/真实工具/来源/时长、失败展开、原生compact/待答停止/重排草稿/重启；该套件现有CSS viewport不是native caption证明 |
| `npm run test:smoke` | **207/207、ok=true、exit0**，p06dd-smoke-final5.log | 最后同源码构建与主冒烟 |
| `git diff --check` | 收尾exit0 | 保留现有脏改动，无commit/push |

最终专项无失败/skipped，83项UI不是整体Codex一致证明。native旧测试名“after Pi unmount”保留历史，但当前AI/settings是隐藏保留实例，断言实际证明hidden晚到结果不覆盖设置。正常保存尺寸exact恢复没有放宽；新默认bounds最多1DIP、旧constructor回退最多4DIP舍入独立标注，回退实际1360×902。贴屏实际1706×1019，workArea1707×1019，完全在范围内。

## 3. 失败和修复记录

1. ZzW3Sf前16通过，设置新聊天超时：id未变导致pending未flush。增加visible/返回刷新触发，并用visibleRef拒绝hidden晚到fresh导航；原新聊天和竞态断言通过，未删或延时。
2. f8WdBw前20通过，保存normal781重启783。owned-profile probe逐值核getBounds/getNormalBounds/getContentBounds，证明constructor/frame舍入；框安装后重应用原bounds，三次exact恢复及最大化通过。
3. 5L3pHS/5RyhWM前27通过，贴屏workArea1707被报告1708。后者第一校准1706仍报告1708，content却1706，不能拿content冒充outer。edge probe1705请求→1706outer，改最多两次仅越界字段读回；最终实际完整在workArea，原normal exact检查保持。
4. 文件修复前z9ixmY25已通过，但没有冒充最终版本；最终XuZm2g重新运行。PowerShell像素读首次把PathInfo误传Bitmap，已改`.Path`并fail-fast，未改图像或运行源码。

保留四次native失败图/report/log与独立probe，未扫描教师真实资料或改系统网络。

## 4. 全页差距没有关闭

原R2为2559×1529，实际当前native图2558×1529。row500平色像素：R2 sidebar RGB246/253/252，主白区从x459连续开始；当前sidebar245/251/251，主白区从x549开始。归一化后左锚点差约90物理px，当前rail62/sidebar304 CSS px与scale1.5吻合。原参考DPI未知不妨碍记录这个明显结构差，但不能将条件换算尺寸当参考CSS元数据。

因此D4壳精度/完整D1–D7仍未勾；下一必须先校准轨/侧栏总宽与底色。本文完整审计清单见103§1；现有source scroll逻辑只是在上读时取消auto-frame/按isAtBottom跟随，**尚未用真实长历史实例证明全场景**，不能以读源码勾选。Skills/settings未见官方各状态图、图片数量/产物、持续goal、真实变更/撤销/Office/PDF/联网和VPN-off/安装均留在完整任务中。

原字节证据在`design/codex-2026-10-03/p06-full-gap/artifacts.json`，含图/实际bounds/DPR/zoom/报告/成功失败log/源与合同、pixel anchors，SHA与bytes逐项readback。没有复制Key/DB/native私有摘要；实际窗口截图仅所属测试窗口。

## 5. 下一第一动作（完整目标保持）

四根→67§1/2/5/8/9→35最新→103§1/4和本文§4，冻结**105 P06d-E壳锚点与长阅读合同**。先以原图归一化宽度校准rail/sidebar/main左锚点与sidebar底色，沿现成Pro壳adapter，不改业务数据/原源。双native窗口→同语义长中英文历史/实际stream时向上阅读与回到底部→文件/设置往返焦点和未发多行IME→待答/审批/停止/错误实例，再必要门禁；不得继续拿局部通过称完整页一致。

随后P07持续goal与正式办公工具共同契约：文件版本/实际变更/审阅与撤销、Office/PDF正文与导出、国内联网、附件/图像/产物来源；main/typed/工具/UI/失败/真实实例逐项贯通。P08实际VPN关闭/国内API/Windows安装/新旧数据/最终八组。三元题组暂停，不重新选择引擎，不缩掉未完成项。
