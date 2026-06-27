# Seed ↔ code decoupling — 探查发现(交接文档)

> **目的**:记录一次只读探查的发现,交接给负责「种子去耦合」的 agent。本文件是 findings,
> 不是已拍板的方案。
>
> **诉求(用户)**:核心代码只依赖 registry / source 的 **port(抽象接口)**,绝不直接 import
> 种子、也不把数据硬编码进 `.ts`。`data/*.yaml` 等种子只是一个 **dev-only adapter** 的实现;
> 生产用真实 adapter(Git ingestion / 真实 registry / live Source)。迁移完成后,种子由模型
> **重新生成**,不再手改。
>
> **与既有决策的关系**:比 [ADR-0013](../adr/0013-resource-projection-not-materialization.md) 更进一步
> —— 0013 管「不 durably 存 *resolved content*」;本诉求管「连 Atlas 自有的 *registry/projection
> 元数据 + pilot content* 也不耦合进代码,经 adapter 注入」。尚未落 ADR。
>
> **来源**:下列 `file:line` 来自一次只读子代理探查,接手者请以实际代码为准复核。

## 现状地图

### ✅ 已合规(已有 loader / port + 注入缝)

| Domain | 入口 / 模式 | 注入缝 | file:line |
|---|---|---|---|
| Registry seed | `loadRegistryFromManifests(DATA_DIR)` ← `data/{sources,topics,anchors,source-topic-mappings}.yaml` + `validateRegistryManifest` | `options.registrySeed` | `context-layer/src/seeds/loadRegistryFromManifests.ts:36-52`;`services/contextBundleService.ts:59-61,67-87`(70 注入 / 76 `loadPilotRegistry`);`dataDir.ts:24-38`(`ATLAS_DATA_DIR` override) |
| Resources | file loader ← `data/resources.yaml` | dir 参数 | `context-layer/src/resources/loadResources.ts:24` |
| Guidance | file loader ← `data/guidance/*.yaml` | dir 参数 | `portal/src/api/server/loadGuidance.ts:63` |
| Release notes | file loader ← `data/newsletter.yaml` | dir 参数 | `context-layer/src/releaseNotes/loadReleaseNotes.ts:38` |
| Feedback | `FeedbackRepository` 接口 + InMemory / Dynamo | `options.feedbackRepository` | `context-layer/src/repositories/feedbackRepository.ts:7-15`;注入 `contextBundleService.ts:46` |

### ❌ 三处硬编码债(要剥离)

**1. Source content —— `context-layer/src/sourceContent/pilotSourceContent.ts:4-69`**
- 硬编码:`sourceId → {anchorSelector → markdown}` 全图(terraform / confluence / policy 片段;`:66` 还把 availability 矩阵 `toAvailabilityMatrixMarkdown()` 注入进来)。
- 耦合点:`contextBundleService.ts:31,83` **硬 import + 硬调** `createPilotSourceContentProvider()`;`ContextBundleServiceOptions`(`:46-51`)**没有 `contentProvider` 注入缝**。
- 接口已存在(只差缝):`SourceContentProvider`(`resolvers/sourceContentProvider.ts:3-5`)+ `createInMemorySourceContentProvider`(`:7-14`)。
- 建议:① options 加 `contentProvider?: SourceContentProvider` ② factory 改 `options.contentProvider ?? createPilotSourceContentProvider()` ③ pilot content 外移到 `data/`(manifest 化),dev adapter 从文件装配 provider。

**2. Availability —— `context-layer/src/sourceContent/availabilityFixture.ts`**
- 硬编码:AWS `:41-314`(40+ 服务)、Azure `:320-469`(48+)、`availabilityZones` 导出 `:476-479`、`toAvailabilityMatrixMarkdown()` `:497-515`。
- 耦合点:`context-layer/src/api/availabilityRoute.ts:3,56` 直接 `import { availabilityZones }` 并 `zones: availabilityZones` 返回;无抽象、无注入。
- 注:availability 也经 `pilotSourceContent.ts:2,66` 进 source content(矩阵 markdown)。
- 建议:`loadAvailabilityData(dir)` loader(← `data/availability.yaml`)或 route 注入。与治理 `availability-matrix` Source 的关系见 [ADR-0009](../adr/0009-availability-matrix-resolver.md) / `plans/013`(`availability.ts` 退场 gated on 治理矩阵 **data coverage**)。

**3. Registry 代码内副本 —— `context-layer/src/seeds/pilotRegistry.ts:88-775`**
- 硬编码:整份 registry(12 topics / 16 sources / 24 anchors / 20 mappings;`:716` `feedback: pilotFeedbackSeed`)作为对象字面量。`pilotFeedbackSeed.ts:1-10` 同类。
- 现状:运行时其实走 manifest loader(`data/*.yaml`);这份**代码副本目前只作 equivalence-oracle 的对照物**。
- 约束:`loadRegistryFromManifests.test.ts:9-10` 断言 `loadRegistryFromManifests(DATA_DIR)` **deepEquals** `pilotRegistrySeed`;`:13-20` 断言计数(sources 16 / topics 12 / anchors 24 / mappings 20 / feedback > 0)。**剥离 `pilotRegistry.ts` 会让该 deepEquals 失去对照物**。
- 建议:把 oracle 从「deepEquals 代码副本」改为「`@atlas/schema` 校验 + count + manifest 自洽」,保留 count/schema 守护、去掉代码副本;`pilotFeedbackSeed` 一并外移 `data/`。

## 实测补强 —— `data/` 删除实验 + 泄漏量化(2026-06-27)

> 在本 findings 基础上做了一次**破坏性验证**(可逆):`rm -rf data/` 后跑全套验证器。结论是本 doc
> **低估了债的性质**——不是「数据位置」,是「**核心域被种子塑形**」。

**删 `data/` 的炸面**:typecheck ✅、portal build ✅(`gen-agent-skills-index` 读 skills 非 data/),
但 **test 85 failed / 21 files / 4 packages**,根因单一:`loadRegistryFromManifests` /
`loadResources` / `loadReleaseNotes` / `loadGuidance` 在 data/ 缺失时 **throw ENOENT**,而 registry
seed 是 `contextBundleService` 缓存的脊柱,所有 read 传递性失败(context-layer 12 files/60、portal
6/19、atlas-acceptance 1/5、atlas-schema 2 suite-load)。

**对「✅ 已合规」表的修正**:那些 loader **有注入缝 ≠ 真依赖 port**。默认路径仍硬读文件、**缺失即
throw(不是 honest-gap)**,且 ~80 个行为测试走默认 load、**没经缝注入**。"合规"只对一半:缝在,但
默认路径硬耦合到文件存在性。

**泄漏量化**:`pilot|fixture|seed` 在**生产(非测试)代码** = **144 hits / 33 files**。要害不是数量,是位置:
- **核心服务类型本身是 Pilot**:`contextBundleService.ts:36` `registry: PilotRegistry`;`:19-22,31`
  import `loadPilotRegistry`/`PilotRegistry`/`PilotRegistrySeed`/`createPilotSourceContentProvider`。
  核心不是「依赖 Registry port」,是**被 typed 成 PilotRegistry**;注入缝也错位——`registrySeed?`
  (注入种子)而非 `registry?`(注入 port)。
- **availability 是程序化伪造**:`availabilityFixture.ts:376-392` `seedHash(serviceId:locId)%100`
  给 ~40 AWS + ~48 Azure 服务**按名字 hash 编造**可用性/ETA,经 `pilotSourceContent.ts:66` + 治理
  矩阵投影当真数据出。**这是 honesty 违背,不只是命名**(交叉:`availability-single-source` / `plans/014`)。
- **核心 src 挂 `seeds/` 整目录** + portal `src/fixtures/contextBundles.ts` + `components/seed-badge.tsx`。

**重定性结论**:种子不在 adapter 后面——**种子就是域**。`PilotRegistry`-as-domain 就是那道焊缝;删
data/ 不能直接换 live adapter 正因为此。修复 = **域去污(port 提取 + 改名 + 逐出 seeds/fixtures/伪造
availability)**,执行计划见 [`plans/016-domain-decontamination.md`](../../plans/016-domain-decontamination.md)。

## 可复用模式(当模板)

- **注入缝**:`FeedbackRepository`(接口 + InMemory/Dynamo + options 注入)、`options.registrySeed`。
- **Loader**:`readFileSync` + `yaml.parse` + `@atlas/schema` validate(loadResources / loadGuidance / loadReleaseNotes 一致)。
- **Dir 解析**:`dataDir.ts` `resolveDataDir`(`ATLAS_DATA_DIR` override → self-locate → fallback)。

## 关键边界建议(**未与用户最终敲定** —— 问到一半被中断)

- **Schema vs Seed**:类型/约束(resource-kind 清单、每个 kind 的 **section vocabulary**、字段 schema、disposition 规则、`{kind}/{slug}` 寻址)属 **`@atlas/schema` 的 zod 定义**,是「类型」不是「数据」,建议**留代码**(保编译期类型安全 + zod 校验基准)。具体 instances + content(topics / resources / anchors / mappings / source content / availability)属 **seed**,外移 `data/` 经 dev-only adapter。
- **dev-only**:adapter 只在 dev/test 装配(如 `ATLAS_DATA_DIR` 存在或 `NODE_ENV !== production`);生产装配真实 adapter,缺失内容由 Atlas 既有 honest-gap(`no_registered_source` / `broken_anchor`)如实呈现,不臆造。

## 与「模型层」工作的关系(另一条线,勿混)

- 本会话另一条线在 [ADR-0015](../adr/0015-portal-resource-first-ia.md) / `plans/015` 推进:resource-kind
  registry + section vocabulary + disposition(三分法 Resource/Facet/Decompose)+ 寻址。它是
  **schema / 模型**,与种子内容解耦。
- 顺序(用户定):**先模型层 → 迁移 → 迁移后由模型重新生成 dev 种子**(不再手改)。本「种子去耦合」
  是支撑迁移落地的架构缝,两者交织但分开。
