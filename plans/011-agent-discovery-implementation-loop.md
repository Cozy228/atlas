# Loop & Goal Prompt — implement the agent-discovery redesign, verify with a blind agent (Copilot CLI)

> 用法：把下面 “GOAL PROMPT” 整段喂给 `/loop`（自定步调）或一个新 agent。
> 该 prompt 自带成功判据与循环；通过后合并成单个 commit。

---

## GOAL PROMPT

你的目标：把 Atlas 的机器可读面改造到——一个**完全没有先验知识的 blind agent**，只拿到根 URL 和一句模糊问题，就能端到端答出测试问题；并把 `docs/atlas-agent-discovery-and-api-redesign-proposal.md` 描述的**所有覆盖面**落到源码里，最终作为**一个 commit** 提交。

### 追踪 issue
- **GitHub issue #14**（`Cozy228/atlas`）。整个 loop 期间用 `gh issue comment 14 --repo Cozy228/atlas -F <file>` **实时更新进度**：每遍 blind 测试都贴一条评论，记录该遍的 blind 输入、逐步走法、如何进入下一步、最后一步的 response、最终回复，以及 pass/fail。

### 唯一事实源（先读，不要凭记忆）
- `docs/atlas-agent-discovery-and-api-redesign-proposal.md` —— 要建什么（§0 架构前提 + §4 目标结构 + §5/6/7/8/11/13）。
- `docs/adr/0013-resource-projection-not-materialization.md` + ADR-0003/0006/0009 —— 怎么建（live projection，不 materialize）。
- `@atlas/schema` 的 `warningCodes`（`packages/atlas-schema/src/index.ts`）—— 状态词表，**复用，不自创**。

### 不可妥协的约束
- PNPM；改动外科手术式，每行都能追溯到提案；public-safe、仅 fake data。
- **只选 α（live projection）**：绝不持久化解析后的正文 / 镜像来源 / 预拼装文档 / stale 兜底；时间戳用 `resolvedAt` 不是 `generatedAt`；不引入模型。
- **两个正交轴**：`section.status` ∈ {available, partial, unresolved}；原因走 `warnings[].code` / `missingSections[].code`，取自 `warningCodes`。missing/failed ≠ negative。
- 动手前按 `CLAUDE.md` 做 skill check / load。
- 若某个面在 α 下无法实现而必须 materialize，**停下来报冲突**，不要悄悄改成 β。
- **不破坏 portal 对 context API 的调用**：现有 `/topics`、`/topics/{id}/context`、`/sources`、`POST /context-bundle`、availability、guidance 等路由与 contract **保持不变**；portal（`portal/src/api/queries.ts`、`contextApiClient.ts`）的 import/请求一行都不改。4 个 agent operation 是**复用 `contextBundleService`/resolvers 的新增 facade**；「`/topics` 下沉」= 只从根 `/openapi.json` 下架并移入 `/api/internal/openapi.json`，**路由仍在线**。改完必须跑 portal 的 context-api 测试确认不回归。

### 实现范围（**完整**实现提案，逐节对照；不得只改名/只做子集）

> 提案 = `docs/atlas-agent-discovery-and-api-redesign-proposal.md`。下面每条标注提案章节；执行时逐条核对，缺一不可。

> **「完整」的边界（评审并入）**：kind-first registry / 框架 + 投影·聚合 facade 必须做满且可扩展；但**内容 section 词表只要求 `service` 完整 + 至少一个非 service kind 作可扩展性证明**（与 §B 测试一致），其余 kind 的完整词表可 defer 到后续 commit。「做了子集」指砍主干面 / 只改名，**不是**指未把每个 kind 的词表一次塞满。

**API 端点面（提案 §4 / §5 / §6，这是主体，必须全做）**
1. **新增 resource 投影端点**（kind-first，live projection，提案 §5.1–§5.5）：
   - `GET /api/resources?query=` → `searchResources`：**跨系统所有 resource kind** 把名字解析成 canonical `{kind}/{slug}`，返回 `items[]`（含 `kind/id/name/aliases/matchReason/resourceUrl/markdownUrl`，提案 §5.7）。仅解析 ID，不回答问题。
   - `GET /api/resources/{kind}/{slug}` → `getResourceContext`：**kind-first，覆盖系统全部 resource kind**——service / landing-zone / guardrail / guidance / skill / …，由**可扩展的 resource-kind registry** 定义，**不是**写死的枚举。provider 只是 `service` 这一 kind 的 slug 尾部（`service/aws/textract`）。默认触发该资源**所有已注册 Section** 的 live resolve。
   - `?sections=` 收窄；`sections` 省略=全部；值取自**该 kind 的 section 词表**；缺失 Section 进 `missingSections`（提案 §5.3）。
   - `GET /resources/{kind}/{slug}.md` 与 `Accept: text/markdown` / `application/json` 内容协商（提案 §5.4、§11）：同一次投影的两种 representation。
2. **响应模型**（提案 §5.5/§5.6，对齐 ADR-0013 两轴 + 两时钟）：
   - 顶层 `resource`（含 `kind`）/ `requestedSections` / `sections{}` / `missingSections[]` / `resolvedAt`。
   - 每个 section：轴1 `status` ∈ {available, partial, unresolved}；`content`(可空) / `facts[]` / `citations[]`（`sourceId/title/url/anchor/resolvedAt`）/ 轴2 `warnings[]`。
   - `missingSections[].code` 与 `warnings[].code` **只取自 `@atlas/schema` warningCodes**。
   - 解析失败 → 该 section `status: unresolved` + warning，**绝不返回旧内容**；missing/failed ≠ negative；“unsupported” 只能是 resolved section `content` 里有 citation 的证据。
   - **两时钟分离（必须）**：`resolvedAt` = 内容**真正从 Source 解析的时刻**；**cache 命中用该 excerpt 当初被解析的时间**（随 excerpt 一起存），不是 request 时刻、也不是 cache 命中时刻。`stale_source`/freshness **在每次投影时按 registry 当前 `review_frequency`/记录版本重新计算**，与 cache 命中无关、**绝不和 excerpt 一起冻进 cache**；cache 命中也可能照样报 `stale_source`。perf-cache 时钟（别狂打 Confluence）与 staleness 时钟必须分开，否则 TTL 会吞掉该报的 stale、旧值自称"刚解析"。
3. **Section Projection Plan 数据模型**（提案 §5.2、§13-C、ADR-0013）：每个 Resource 持久化 **identity+kind+aliases / Section→Source·Anchor·Resolver·order 映射 / freshness·drift 配置 / 展示元数据**——**不持久化 Section 正文**。**Section 词表按 kind 分**（service: overview/availability/network/security/compliance/pricing/limits/guidance/examples；landing-zone: accounts/network-topology/baseline-controls/…；guardrail: scope/enforced-controls/exceptions/…；guidance/skill 各自）。不同 kind 由不同 backing records 解析（service→topics + availability resolver；guidance→guidance records；skill→skills；…），但都走同一投影/聚合 facade。
   - **⚠️ availability 是历史炸点，单独对待（评审并入）**：矩阵表内容已含 Textract 行（`context-layer/src/sourceContent/pilotSourceContent.ts`），但 `data/source-topic-mappings.yaml` 中 `availability-matrix` **没有任何 textract 映射可继承**——textract 的 `availability` section 投影计划是**净新建**，必须显式 wire 到治理版 `availability-matrix` Source（经 `availabilityMatrixResolver`，service 维 pin=Textract）。**治理 Source 是新面唯一的 availability 投影源**；**不得**误读正在 retire 的 portal fixture `portal/src/api/server/availability.ts`（ADR-0009）。**#2 = B（agent 面单源，本轮 in-scope）**：MCP `atlas_get_availability` 本轮一并改读治理 Source——`portal/src/api/server/mcp/tools.ts` **删掉 `import { ln } from "../availability"`**，改走治理矩阵（经 `availabilityMatrixResolver` / 同一投影 facade），使 **agent 侧 availability 单源、零分叉**（同步更新 MCP 工具测试）。迁移后该工具只返回**治理矩阵实际覆盖**的数据（pilot：us-east-1 / ca-central-1 × 少数服务，带 citation），矩阵外的服务诚实返回 `no_registered_source` 而非 seeded 假值——textract 在矩阵内，blind 测试不受影响。`portal/src/api/server/availability.ts` 仅余 portal UI explorer 用（`routes/availability.index.tsx`、`components/explore/*`、`lib/availability-*`、`api/queries.ts#fetchAvailability`），**本轮不动 portal UI**（守 §26）；UI + `availability.ts` 的退场（全栈单源 A）**另立后续 issue/plan**，不在本 commit。
4. **`/topics` 下沉**（提案 §5.8）：现有 `GET /topics?query=`、`GET /topics/{id}/context` 从根 agent OpenAPI 移除，迁到 `/api/internal/openapi.json`；**路由仍在线**（portal 继续用），只是不再向 blind agent 推荐（B 类失败根因）。
5. **精简 `/openapi.json`**（提案 §6）：只暴露 4 个 operation——`getAtlasInstructions`、`getAtlasCapabilityCatalog`、`searchResources`、`getResourceContext`；operationId 用任务语义；description 写「何时用/何时不用/前置/参数如何从问题映射/返回含义/缺失如何解释/404 后做什么/完整示例」；schema 组件齐全（`ResourceSearchResponse`、`ResourceContextResponse`、`ContextSection`(两轴)、`Citation`、`Warning`、`MissingSection`）；`kind` 参数**由 resource-kind registry 驱动**（文档化但 registry 权威），`sections` 列 union + 标注 per-kind applicability；`404` 指引调用 `searchResources`；OpenAPI 3.1 校验通过。
6. **完整后端 `/api/internal/openapi.json`**（提案 §6.7）：topics/source/metadata/admin/ingestion/diagnostics 等，不向 blind agent 推荐；根 agent OpenAPI 不得自动暴露全部内部 route。
6b. **改 `openapiDocument.test.ts` 不变量**：现有「path 与 router **精确镜像**」会被拆分打破。改成 **agent-openapi ⊆ router**（保留 forward：每个 documented path 都能 dispatch）；把 reverse（**无未文档化 route**）**移到 internal openapi**（要求 `router == internal-openapi`）。净不变量 `agent ⊆ router == internal`，没有 route 会漏文档。同步更新该测试里 `mutations` 期望集与 `dispatched.size` 下限。

**发现面（提案 §10 / §7 / §8 / §9 / §12）**
7. 首页 `/` SSR 正文：可见 “Machine-readable access” 段，正文链接 ai-catalog.json / openapi.json / llms.txt；冗余 `<link rel=ai-catalog/alternate/service-desc>` + HTTP `Link` header（提案 §10）。
8. `/llms.txt`（提案 §7）：精简，写 live-projection 调用流程、Section 映射提示、warningCodes 语义、机器入口链接；不复制 OpenAPI、不堆 Resource。
9. `/.well-known/ai-catalog.json`（提案 §8）：单个 API entry（capabilities + representativeQueries + tags），保留旧 `api-catalog` 别名或 308；不要每个 Section 一个 entry。
10. 可选 `/.well-known/agents.json`（提案 §9）：薄、生成、不引入 flows、不作为权威源。
11. `sitemap.xml`（提案 §12）：含 `/resources/{kind}/{slug}.md` 等可读页面；不放 `/openapi.json`、`/api/*`。

**一致性（提案 §13）**
12. 机器文件尽量从共享 registry 生成；一致性检查：capability 的 operationId 存在、**resource-kind registry 与 OpenAPI `kind` 文档一致**、每个 kind 的 section 词表与 registry/OpenAPI 一致、warning code 只取自 warningCodes、llms.txt 示例 URL 可达、JSON 与 MD 来自同一次投影、`{kind}/{slug}` canonical 唯一。

### LOOP（自定步调，每步先 verify 再进下一步）
- **A. 理解** → skill check + 读上面三类事实源 → verify：能复述每个面 + α 约束。
- **B. 实现** → 落地范围 1–12 → verify：`pnpm -w typecheck`/build 通过；相关 `pnpm vitest` 绿（含改后的 `openapiDocument.test.ts`、portal context-api 测试不回归）；为投影新增测试覆盖：success / partial / unresolved / no_registered_source / source_unavailable / 不 stale 兜底 / 两轴分离 / **多 kind（service + 至少一个非 service kind）** / **两时钟**（cache 命中时 `resolvedAt` 仍是当初解析时刻 且 registry 过期时照样报 `stale_source`）。**起 blind loop 前的硬门（pre-flight，评审并入）**：直接打 `GET /api/resources/service/aws/textract?sections=network,availability`，断言**两个 section 都 `status: available` 且各带 citation**（尤其 availability 真解析出 region 行）；不过此门不许进 D——否则就是在用 blind loop 找一个其实是「数据没接线」的问题。
- **C. 起服务** → 本地跑 portal（dev 或 preview），固定监听 `localhost:3000`，拿到 base URL。
- **D. Blind-agent 测试（Copilot CLI 承载，需连续 5 遍通过）** → blind agent 不能有任何 Atlas 先验：在**仓库之外的临时空目录**里跑，并 `--no-custom-instructions`（否则它会读仓库 AGENTS.md 就不 blind 了）；用 `--allow-url` 把它锁死在只允许那一个 link。

  载体已确认：本机 `copilot` v1.0.65（agentic 版）。每遍由**主 agent**亲自跑（不要派 subagent）：

  ```
  rundir=$(mktemp -d); sid=$(uuidgen)
  copilot -p "<本遍 prompt>" \
    -C "$rundir" --session-id "$sid" \
    --no-custom-instructions --no-ask-user --disable-builtin-mcps \
    --allow-all-tools --allow-url=localhost:3000 \
    --output-format json --log-level info -s \
    | tee "$rundir/stdout.jsonl"
  ```

  - `--session-id "$sid"` → 主 agent 据此确定性定位本遍 session history（见下）；
  - `--no-custom-instructions` + tmp `$rundir` → 不读仓库任何指令，真 blind；
  - `--disable-builtin-mcps` → 关掉内置 github-mcp，Copilot **够不到 GitHub/issue**；
  - `--allow-url=localhost:3000` → 只能访问 Atlas、不出网；`--output-format json` → stdout 逐步 JSONL。（**先确认 `--allow-url=localhost:3000` 放行整个 origin 的所有路径**——`/openapi.json`、`/api/resources/*`、`/.well-known/*`；若只放行根 URL，discovery 会因白名单太紧而非接口原因失败，需改用 origin 级允许规则。另确认 portal 在所选 dev/preview 模式下确实监听 3000、且 SSR 正文段 + 新 Nitro 路由都渲染。**依赖脆弱**：硬编死 `copilot v1.0.65` 与 `~/.copilot/session-state/$sid/events.jsonl` / `session-store.db` 的 `turns` schema——跑前先验证这些路径/表在本机当前版本存在，否则结构化步进 trace 取不到、§D 的 grounding 判据无从落实。）

  > 用 Copilot CLI 而非 Claude，是为了跨 agent 验证：证明这套机器面不是只对某一个模型有效。

  **逐轮收紧 prompt（每遍都要比上一遍更省，最终 5 遍都过）**：
  | 遍 | prompt（越来越省，仅示意，可微调但不得加 Atlas 内部提示） |
  |---|---|
  | 1 | `can aws textract be used in private subnet, and which regions is it available in, use url to discover http://localhost:3000` |
  | 2 | `aws textract: private subnet + regions? discover from http://localhost:3000` |
  | 3 | `textract private subnet & regions? from localhost:3000` |
  | 4 | `textract private subnet + regions? find from localhost:3000` |
  | 5（最小） | `textract private subnet, regions? find from localhost:3000` |

  最小情形的硬下限 = **只给问题 + 一个 link**（形如 `question? find from localhost:3000`），不得再少、不得再多。

  **附加判据 & loop triage（评审并入 §D/§E）**：
  - **判据④ grounding 可追溯**：读 `events.jsonl` 步进 trace，确认答案里的 **region 列表 + 私有子网结论来自 fetch 到的 Atlas 内容**而非模型先验（引用的 region 应恰是治理矩阵的 `us-east-1` / `ca-central-1`，而非模型记忆里更全的真实列表）；否则判 fail（假 PASS）。终版收紧后 prompt 已不含「don't use your own knowledge」，这条是唯一防假 PASS 的闸。
  - **判据③对本题恒真**：textract 两 facet 都可解析，③形同虚设；honesty 把关交给 §B 单测 + **一次 missing-facet 探针**（非计数遍）：问一个 Atlas 确无该 section 的资源（如某服务的 `pricing`），断言 agent 答「Atlas 无此数据」而非「不支持」。
  - **§E variance triage**：若 trace 显示**面已返回正确、可导航、带源、grounding 充分**而 agent 仍失败（无视数据 / 用记忆 / 随机走神），判为**模型 variance 而非接口缺陷**——该遍**作废、不计通过也不清零**，直接重跑同一 prompt（设每遍 variance 重跑上限，如 3 次，超限才当面的问题深挖）。只有**确属某个面没引导住**才修面 + 计数归零。

  **每遍通过判据（只看结果，不规定路径——blind agent 怎么走是它的自由）**：
  1. 仅凭那个 link 找到机器入口（discovery 成立）。
  2. 同时答出两个子问题（private subnet + regions）且带来源 URL。
  3. 不把 missing/failed 解读成 “unsupported”。

  > 不设定中间步骤（不要求"必须选 getResourceContext / 必须解析 aws/textract / 必须取 network+availability section"）；那是规定路径，违背 blind 测试。只判 ①入口 ②答全且带源 ③不误读缺失。

  **issue 更新由主 agent 亲自做**（不要让 Copilot、也不要让 subagent 去碰 issue）。每遍跑完，主 agent 读 Copilot session history 后，自己 `gh issue comment 14 --repo Cozy228/atlas -F <file>`。读取位置（按 `$sid` 确定性定位）：
  - 逐步事件流：`~/.copilot/session-state/$sid/events.jsonl`（`type/timestamp` 事件：user.message / assistant.message / 工具调用 / fetch，用于还原「逐步走法、如何进入下一步」）；
  - 最终问答：`sqlite3 ~/.copilot/session-store.db "SELECT user_message,assistant_response FROM turns WHERE session_id='$sid' ORDER BY turn_index"`；
  - 兜底：`$rundir/stdout.jsonl`。

  每条评论至少含：本遍 prompt、入口发现的第一跳、关键步骤序列（哪几个 URL/operation、如何从一步进到下一步）、最后一步的 response、最终回复、3 条判据逐条 ✓/✗、pass/fail、当前连续通过计数 N/5。

- **E. 任一遍失败 → 修面不修题 + 计数清零** → 读该遍 JSONL/transcript，定位是哪个面没引导住（首跳正文？operation 命名？section 映射？warning 语义？），**修 Atlas 的那个面**，回到 B；**连续计数归零**，从第 1 遍重新跑。绝不去“教”那句 blind prompt。
- **F. 连续 5 遍全过 → 停循环。** 在 issue #14 贴最终汇总评论。

### 完成 & 提交
- 全部相关测试 + typecheck 绿；blind-agent **连续 5 遍** 3 条判据全过。
- 把本轮所有改动 **squash 成一个 commit**（conventional commit；**不要 Co-Authored-By**，husky 会拒），commit message 里带 `Closes #14`。示例：
  `feat(atlas): resource-centric live-projection agent surface + blind-agent discovery (Closes #14)`
- 提交范围限定为实现改动；本 runbook（plans/011）可不纳入。
- 在 issue #14 汇报：每个面改了什么、5 遍 transcript 摘要、最终 commit hash，并关闭 issue。
