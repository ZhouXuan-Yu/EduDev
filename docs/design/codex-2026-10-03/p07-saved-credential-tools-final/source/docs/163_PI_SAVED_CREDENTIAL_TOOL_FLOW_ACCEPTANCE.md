# 小智已保存配置、真实工具与冷恢复验收

日期：2026-10-04；M01/M10；合同162，按照根《测试样例说明书》CFG-01/02执行。完整Codex体验目标继续active，三元题组暂停。

## 本轮结果

**现有配置实现通过本轮范围，未修改生产代码、数据库结构、IPC或组件。** 新增针对保存配置的正式Electron测试及独立只读回读，不重新实现模型设置、safeStorage、Pi循环或文件工具。

最终 `pi-saved-credential-tools-0PMZJy`：15项、success=true、Node exit0，其中“不存在模型ID”是明确标出的typed边界检查，其余沿现有正式界面及状态回读。两次此前测试脚本错误永久保留；不能称连续三次稳定。正式截图已实际查看保存表单1366与文本模型拒绝图片页面。

| 需求 | 实际证据 |
| --- | --- |
| CFG-01 导入与验证 | fresh owned profile；主进程DEEPSEEK_API_KEY/DEEPSEEK_MODEL实际均空，旧deepseek配置行不存在，E2E flag禁止自动载入.env.local。密钥只从ignored调试配置输入密码字段，不打印。 |
| 验证与保存分开 | 有效候选独立验证成功，但配置version0/configured=false不变。候选清空后刷新显示鉴权失败与“上次官方目录”；未保存发送实际failed、0模型请求、0native binding，失败卡明确提示。 |
| CFG-01 保存 | 可见选择deepseek-flash/点击保存，密码立即清空；配置version1、Windows safeStorage同profile实际解密匹配导入密钥，SQLite只保存sealedKey。公开设置不含完整密钥。 |
| CFG-01 正式工具 | 教师先授权owned合成目录，自然发送“列出…读取03-资料实读.txt正文…”。实际office_list_files/office_read_text读取随机码与37，composer清空。SDK原fetch只观察匹配布尔值，真实请求与响应不替换。 |
| CFG-01 冷恢复 | 关闭该测试窗口，修改合成文件随机码和时长41；同profile再次启动，环境密钥仍空，保存配置原字节/同native文件及原前缀保持。恢复时零模型请求和零工具重放；主动续问实际新office_read_text获得新码/41，不复述旧答案。 |
| CFG-02 无效候选 | 独立验证失败不保存；已有有效配置后，无效候选保存实际鉴权失败、输入清空，原密文/version1/default原字节不变，随后正常任务仍可用。 |
| CFG-02 模型边界 | typed请求不存在模型ID经过真实官方校验后model_unavailable，旧配置不变；不是界面展示了不存在模型。 |
| CFG-02 能力边界 | fresh官方目录确认deepseek-v4-pro仅text；教师在真实模型菜单切换，保持同native历史，新对话默认仍flash。原IMG-04提示实际调用office_view_public_image一次，正确isError；没有image payload、native image或received，不自动切换。模型明确无法识别。 |
| 错误后恢复 | 在原pro对话发独立自然文件请求，实际读取新随机码/41并完成，仍使用原有效密钥和明确选择的模型。 |
| VIEW-01 | 1366×768与1920×1080实际内容视口，save/verify按钮在可视范围；截图前密码清空。PNG物理像素分别2049×1152/2880×1620，不能据此称参考同DPI或全页像素一致。 |

全部9次正式chat/completions响应HTTP200，Authorization与本次UI保存密钥匹配只记录true；没有存储header、请求正文或原响应。候选/保存鉴权失败是实际官方错误，不用官方目录缓存升级为凭证有效。配置前无密钥的失败属于本例预期，不关闭用户日常原失败。

## 缓存及最新方案核对

独立native回读9条assistant usage与9个实际传输记录一致。Pi1.0.2原openai-completions适配明确 `input = promptTokens - cacheRead - cacheWrite`，因此分母为input+cacheRead+cacheWrite，不用cacheRead/input制造超过100%的比例。

| 请求组 | 本次命中百分比 |
| --- | --- |
| Flash首次 | 25.29% |
| Flash后续3次，包含冷恢复续问 | 96.82%、96.81%、97.93% |
| 实际切换Pro后首次 | 0% |
| Pro后续4次 | 96.97%、97.83%、98.23%、97.58% |
| 本例全9次加权 | 50,560 / 63,468 = 79.66% |

这是这一合成任务、这次请求的真实命中；首次/切换和连续请求分别记录，不承诺所有任务达到同百分比。原SDK usage cost零值不作为实际免费或费用零证据，价格未知仍保持现有成本口径。

本轮读取官方latest仍为[Pi1.0.2](https://github.com/earendil-works/pi/releases/tag/v1.0.2)、[Hana0.450.0](https://github.com/liliMozi/openhanako/releases/tag/v0.450.0)。原browser/最新Pi自动压缩、无累计运行配额及Hana前缀复用实施仍按141/159；本轮未重新声称执行其所有旧测试。设置原源verify实际5项、version0.449.0（既有设置复用来源），不是声称新复制450设置组件。DeepSeek缓存搜索命中[官方说明](https://api-docs.deepseek.com/guides/kv_cache/)，正文抓取超时；本轮结论以实际SDK usage回读为证，不虚构新网页全文。

## 命令、固定版本与产物

工作目录 `D:/WorkProject/EduProject/apps/desktop`：

```powershell
$env:OMNI_EDU_TEST_BUILD_ROOT='D:/WorkProject/EduProject/apps/desktop/test-results/xiaozhi-agent/pi-natural-file-build2'
node scripts/xiaozhi-agent/pi-saved-credential-tools-ui-smoke.mjs
node scripts/xiaozhi-agent/pi-saved-credential-readback.mjs test-results/xiaozhi-agent/pi-saved-credential-tools-0PMZJy
node scripts/xiaozhi-agent/reuse-hana-settings-workspace.mjs --verify
```

- C脚本SHA `3a587fb2c86bbaea4218d8ac2e05cec1d8cac63ce9b8b6c524c9297cf496a089`；只读回读脚本SHA `cf4c8e9d9df693d9bf8d5a11312f13feb3b20b23d5ae4047dbb791abafcbcde6`。
- report.json、readback.json、双尺寸保存图、invalid-save.png、unsupported-image.png均在本轮owned目录；各图SHA/物理尺寸由独立PNG读取记录。
- 固定build2共323文件SHA `0dd7d497084c683cb11f1ea2ba79d509f8f7cc377b266261d69a338343389981`，前后保持。沿161已有同构建build/renderer79/main2 207历史门禁，本轮仅新增测试脚本与文档，**未重新运行build/79/207**，不把旧门禁写成新执行。
- 日常PID62244/handle28246872/RespondingTrue与out SHA `3b81b5e6a608ae849d7daf11c4d7aecff2f52d508bb2407493386f5b8b9952d6`复核保持，没有替换加载中的out或修改日常profile。
- 新两脚本node --check exit0、原设置来源5项verify exit0；仓库git diff --check及source-only清单核验见收尾执行记录。没有子agent、commit、push或远端凭证修改。

## 保留的失败

1. `eliXWp` 3项后：测试等待页顶pi-history-note，而真实缺密钥失败以run失败卡显示。原页面/报告证明正常拒绝、零请求；改为真实run status/error与本轮失败卡断言，未改产品。
2. `6El8Qt` 3项后：未限定范围的错误文字同时匹配侧栏预览和正文，Playwright strict失败。限定office-conversation真实正文，不force点击或修改状态。
3. 最终实例的独立readonly初试：native custom_message.content可为string，错误假定每条均array，TypeError。保留readback-first-failure.json/最初工具输出；按原schema用Array.isArray核图块，复读exit0，无新API请求。该首次未记录旧脚本SHA，明确null，不倒填。
4. 本轮查文件时数次猜旧路径/包名及本地记录命令括号/workdir错误，均纠正实际inventory；没有据此宣称产品或provider故障。
5. source-only归档首试guard误匹配脚本自身的静态data URI前缀，exit1；原部分源码目录p07-saved-credential-tools保留。改为实际长base64 payload检查、所有文件预检后才写入，以独立p07-saved-credential-tools-final清单为最终归档，不覆原首次结果。

原首失败目录不删，成功报告列出前两失败版本和SHA；只读日志/源归档严格拒绝凭证、密文、profile、DB、native历史、素材/图/binary。用户NET-USER-001/IMG-USER-001仍开放。

## 下一步：Skills与当前工具一致性

本轮发现实际 `education-skills.ts` 内建说明仍含“当前未注册联网工具”“当前没有正式DOCX/XLSX/PPTX/PDF生成工具”，与已注册的当前browser/Office工具静态事实不一致。**影响尚未做正式技能任务复现，不据此说它是原联网故障根因。**

下一唯一：四根→67§1/2/5/8/9→35→163，先查当前Pi/Hana Skills生成/版本/撤销/cache前缀源码，冻结仅内建Skills与实际工具能力对齐合同；保留宿主权限、本地脱敏和教师确认，更新能力说明而不加第二agent循环，实测显式教育查证与教学办公技能的自然联网/Word任务、旧会话/新会话、停止及冷恢复。缺失Codex Skills/模型/权限参考截图继续独立等待，不能把功能验证当专有组件同源或像素完成。

随后全D1–D7与P08实际无VPN/安装/备份恢复及最终八组，D人工签认独立。当前C成功不关闭日常配置、用户原输入失败、无VPN、安装或完整Codex目标。
