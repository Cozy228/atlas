# 016 — Domain decontamination(把核心域从 pilot 种子上剥离)

> 前置 findings:[`docs/architecture/seed-decoupling-findings.md`](../docs/architecture/seed-decoupling-findings.md)
> (含 2026-06-27 删除实验 + 泄漏量化:`pilot|fixture|seed` 在生产代码 144 hits / 33 files)。
>
> 原则(memory `seed-dev-adapter-principle`):核心只依赖 registry/source 的 **port**;`data/` 等
> 种子是 **dev-only adapter** 的实现;生产用真实 adapter(live Confluence discovery / Git ingestion);
> 迁移后种子由模型重新生成,不再手改。**Schema(类型/约束)留 `@atlas/schema`;实例/内容(seed)外移。**

## 目标

核心代码(`context-layer/src` 除 dev-adapter 目录)**零 `pilot|seed|fixture` 词**、**零硬编码数据**、
**零程序化伪造**;只依赖 `Registry` / `SourceContentProvider` / `AvailabilityProvider` 等种子无关 port。
`data/` 缺失时 **honest-gap 而非 throw**。

## 前置 gate

**模型层(ADR-0015 / `plans/015`:resource-kind registry + section vocabulary + disposition)须先就绪**
(用户定序:模型层 → 迁移 → 模型重生成种子)。模型层未定则本计划 park 在其后,避免 schema/section
重塑造成返工。

## Port 盘点

| Port | 现状 | 动作 |
|---|---|---|
| `Registry`(sources/topics/anchors/mappings/feedback 仓储) | 现名 `PilotRegistry`,核心直接 typed | **改名 + 提为核心 port**;缝 `registrySeed?`→`registry?` |
| `SourceContentProvider` | **已存在** `resolvers/sourceContentProvider.ts:3` + `createInMemorySourceContentProvider` | 复用;核心加 `contentProvider?` 缝(债 #1) |
| `AvailabilityProvider` | **不存在**,`availabilityRoute` 直 import 伪造常量 | **新建 port + 缝**(债 #2) |
| in-memory/dev adapter | `loadPilotRegistry` / `pilotSourceContent` / `availabilityFixture` 混在核心 | 改名 + 移出核心到 `adapters/dev/` |

## 改名映射

| 现状(污染) | 目标(干净) |
|---|---|
| `type PilotRegistry` | `type Registry`(核心 port) |
| `type PilotRegistrySeed` / `PilotRegistryOptions` | `RegistrySeed` / `RegistryOptions`(归 dev adapter) |
| `loadPilotRegistry(seed)` | `createInMemoryRegistry(seed)`(dev adapter) |
| `pilotRegistrySeed` / `pilotFeedbackSeed`(常量) | 外移 `data/`,dev adapter 装配 |
| `createPilotSourceContentProvider()` | 直接 `createInMemorySourceContentProvider({…})`(内容外移 data/) |
| `pilotSourceContent.ts` / `availabilityFixture.ts` / `seeds/` | 移入 `context-layer/src/adapters/dev/` |
| `ContextBundleService.registry: PilotRegistry` | `: Registry` |
| `options.registrySeed: PilotRegistrySeed` | `options.registry?: Registry`(注入 port,非种子) |

## 删除项

- `seededAvailability` / `seedHash` / `availabilityZones` 伪造(`availabilityFixture.ts:376-392,476`)——
  availability 改为真 adapter 或 honest-gap,**绝不 hash 编造**。
- `loadRegistryFromManifests.test.ts:9-10` 的 `deepEquals(pilotRegistrySeed)` oracle → 换
  `@atlas/schema` 校验 + count + manifest 自洽(保 count/schema 守护,去代码副本)。

## 分步(每步 verify = `pnpm typecheck && pnpm -r test`,Phase 1–3 全程保绿)

**Phase 1 — 词汇去污(纯改名,行为不变)**
1. `PilotRegistry`→`Registry`、`loadPilotRegistry`→`createInMemoryRegistry`、`PilotRegistrySeed`→
   `RegistrySeed`(6 个生产文件 + 测试;barrel 未导出这些符号,不波及 portal)。→ verify 绿。
2. `createPilotSourceContentProvider`→直接 `createInMemorySourceContentProvider`;
   `pilotSourceContent.ts`→`inMemorySourceContent.ts`。→ verify 绿。

**Phase 2 — port 提取 + 注入缝(结构,行为不变)**
3. `ContextBundleService.registry` 改 `Registry` port;缝 `registrySeed?`→`registry?: Registry`,
   默认工厂用 dev/in-memory adapter 从 data/ 装配。→ verify 绿。
4. 加 `contentProvider?` 缝(债 #1):`options.contentProvider ?? <dev provider>`。→ verify 绿。
5. 新建 `AvailabilityProvider` port + `availabilityProvider?` 缝;`availabilityRoute` 依赖 port 非
   直 import(债 #2)。→ verify 绿。

**Phase 3 — 逐出核心**
6. `seeds/`、in-memory content/availability adapter 移到 `context-layer/src/adapters/dev/`(核心 src
   不再含种子词汇);更新 barrel/import。→ verify 绿。
7. in-code 种子内容外移 `data/`(registry / source content / feedback);换掉 deepEquals oracle
   (债 #3)。→ verify 绿(count/schema 守护保留)。

**Phase 4 — 诚实 + 真 adapter(行为变更)**
8. **删伪造 availability**;availability 来自真 adapter 或 honest-gap(空 + `no_registered_source`)。
   availability 测试改注入 fixture / 断言空态。⚠ 交叉:治理矩阵投影自此 fixture
   (`availability-single-source` / `plans/014`),一并处理。
9. 生产默认 = 真 adapter(**live Confluence discovery** —— 本会话前半设计)/ honest-gap 不 throw;
   dev 默认 = in-memory-from-data/,按 env(`ATLAS_DATA_DIR` / `NODE_ENV`)装配。
10. ~80 行为测试改经 port 注入共享 in-memory fixture,不再走默认 file-load。

**Phase 5 — live adapter(独立,承接本会话前半)**
- 约定驱动、标题前缀派生、reference-only 的 live Confluence discovery 实现 `Registry` /
  `SourceContentProvider` port。详见本会话 Confluence 发现设计。

## 验收

- `rg -i "pilot|fixture|seed" context-layer/src portal/src -g '!*.test.ts' -g '!**/adapters/dev/**'`
  → **0 hit**(核心零种子词汇)。
- `rm -rf data/` 后 `pnpm -r test`:**不再 throw ENOENT**,改为 honest-gap / 测试经 port 注入 → 绿。
- 无 `seedHash` / 程序化伪造数据残留。
