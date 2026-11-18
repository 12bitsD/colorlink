# Pocket Backend Architecture v1

状态：**需求与架构候选稿，待 review；未授权实现。**

本文先通过高价值场景对齐后端和三个独立客户端需要具备的 Feature，再给出可扩展的后端结构。它不是 Clock 专用后端，也不会把 Clock、Calendar、Notes 合成一个 App。

## 1. 已确认的需求边界

- Clock、Calendar、Notes 是三个独立 Android App，各自 UI、包名、数据职责和 release。
- 三个 App 共用一个后端、User ID、设备 Link 和权限体系，但不共享业务所有权。
- Agent 的核心访问方式是 HTTP/JSON；不维护 CLI。
- 客户端与云端保持逻辑上的长期 Link，以 WebSocket 主动推送代替业务轮询。
- 本地、Agent、Calendar 都可以产生 Clock 写操作；这些入口必须进入同一套同步语义。
- 本地有缓存和离线 outbox；云端保存可同步的当前快照与有序操作。
- 云端受理、客户端接收、本地数据库生效、Android 执行成功是不同状态。
- 项目是通用 Android；ColorOS 只增加后台运行和权限适配。

## 2. 本版建议

1. **后端先做模块化单体**：一个 HTTP/WebSocket 服务、一个后台 Worker、一个关系数据库。领域模块在代码内隔离，不先做微服务、Kafka 或插件平台。
2. **同步采用“当前快照＋操作日志＋持久 outbox”**，不做全量双向覆盖，也不做完整 Event Sourcing。
3. **普通闹钟由 Android 执行；Agent Cron 默认由云端 Scheduler 触发**。后者仍可在运行时通过 HTTP 调用三个 App 的云端能力。
4. **Agent 默认读取已获授权且已同步到云端的 Notes 版本**，避免 Cron 必须等待手机在线。实时读取设备作为后续能力。
5. **直连设备延后**。首版所有远程 Agent 调用都经云端，直连只能复用同一能力契约，不能另做业务协议。

其中 3、4 仍需在 review 中确认；其余是建议的实现形态，不是已验证能力。

## 3. 高价值场景与 Feature 对齐

### S1：Agent 远程设置一个闹钟

用户在外面对 Agent 说“工作日 07:30 叫我起床”，OPPO 当时可能离线。

**后端 Feature**

- 提供 `alarm.set`，校验 `alarm.write` 权限、参数和幂等键。
- 写入 Clock 当前快照与操作日志，返回 `ACCEPTED + operation_id`。
- 在线则通过 Link 推送；离线则进入 pending，并根据 `expires_at` 决定补发或过期。
- 分开保存云端受理、推送、客户端应用和 Android 执行结果。

**Clock 客户端 Feature**

- 接收操作并校验 `operation_id`、`alarm_id`、`base_revision`。
- 本地数据库事务生效后，调用 Android 闹钟能力。
- 返回 `APPLIED`、`EXECUTED` 或带原因的 `FAILED`。
- UI 显示来源为 Agent；离线期间显示等待同步，而不是伪装成功。

**需要的基础能力**

HTTP RPC、权限、幂等、持久 outbox、Link 推送、设备回执、操作过期。

### S2：用户在地铁里离线新增／修改闹钟

**Clock 客户端 Feature**

- 本地数据库与 outbox 在同一事务中写入。
- 立即修改 Android 闹钟，离线体验不依赖云端。
- 保存 `last_server_seq`；重连后发送 outbox，并处理云端回执。

**后端 Feature**

- 按 `operation_id` 去重，按 `base_revision` 检查冲突。
- 分配 `server_seq`，更新快照与操作日志。
- 如果另一入口已修改同一闹钟，返回 `CONFLICT + 当前版本`，不静默覆盖。

**需要的基础能力**

本地 outbox、断点续传、服务端排序、版本冲突、删除 tombstone。

### S3：Calendar 创建事件并联动 Clock 提醒

用户在 Calendar App 创建“明天 09:00 出差”，要求提前 90 分钟提醒；随后修改或取消事件。

**后端 Feature**

- Calendar 模块拥有 Event 和提醒策略，Clock 模块不拥有 Event。
- Calendar 提交后产生带 `linked_event_id` 的 Clock 操作，通过内部领域接口交接。
- 修改和取消引用同一关联 ID，保证不会重复创建提醒。
- 保存 `correlation_id`，使用户能追踪 Event → 提醒操作 → Android 结果。

**Calendar 客户端 Feature**

- 管理 Event、提醒策略和同步状态，展示提醒是否已被 Clock 执行。

**Clock 客户端 Feature**

- 只接收并执行提醒，不展示 Event 编辑器，也不允许主动关联已有 Event。
- 展示来源为 Calendar；事件取消后取消对应本地提醒。

**需要的基础能力**

领域间接口、关联 ID、因果追踪、跨领域幂等、独立权限。

### S4：每周定时 Prompt 读取 Notes，生成周报并创建日程提醒

用户在 Clock 中创建 Agent Cron Job：“每周五 16:00 读取指定笔记，生成周报，并为下周一 10:00 的评审创建日程和提前提醒。”

**后端 Feature**

- Agent Job 模块保存 Prompt、Cron、时区、上下文授权和通知策略。
- 云端 Scheduler 到点创建独立 `agent_run`，而不是创建 Android 闹钟。
- Agent Run Connector 启动远程 Agent，并只允许本次 Run 使用被授予的 HTTP 能力。
- Notes 模块返回指定笔记的已同步版本及 `context_revision`。
- Agent 写回周报时生成新 Notes revision；创建评审日程时调用 Calendar 接口；Calendar 再按 S3 联动 Clock。
- 保存 Prompt run、输入版本、输出引用和各领域执行结果，通知策略与设备执行状态分开。

**三个客户端 Feature**

- Clock：编辑 Cron Job、查看下次运行和执行记录；不把 Agent Run 当作响铃。
- Notes：控制哪些笔记可同步、可被 Agent 读取或写入，展示版本来源。
- Calendar：接收 Agent 创建的 Event，并按统一提醒契约调用 Clock。

**需要的基础能力**

云端 Scheduler、Run 级权限、上下文版本、Agent 连接器、跨领域审计、结果通知。

### S5：断线恢复与权限撤销

- 手机断线期间产生的操作不丢失；重连使用同一 `link_id` 和 `last_applied_seq` 补同步。
- 过期闹钟操作不得在高延迟后突然执行。
- 撤销 Agent 的 `alarm.write` 后，新请求立即被拒绝，但已有本地闹钟不自动删除。
- 撤销 Notes 授权后，后续 Agent Run 不得再读取内容；既有结果如何保留由数据保留策略决定。

## 4. 总体结构

```text
Remote Agent ───────────────┐
                            │ HTTP/JSON
Android Apps ───────────────┤
                            ▼
              HTTP Interface / Schema / Idempotency
                            │
              Identity + Link + Permission + Grants
                            │
        ┌───────────────────┼────────────────────┐
        ▼                   ▼                    ▼
   Clock Module        Calendar Module       Notes Module
        └───────────────────┼────────────────────┘
                            ▼
             Operations + Revisions + Persistent Outbox
                            │
              ┌─────────────┴──────────────┐
              ▼                            ▼
        Link Gateway                 Scheduler / Agent Runs
        WebSocket push               Jobs + Run Connector
              │                            │
        Android clients              Remote Agent runtime

              Relational DB: snapshots + operations + grants
```

### 为什么先采用模块化单体

当前是单用户、少量设备、三个领域。模块化单体足以提供事务、权限和统一同步，同时让跨领域流程保持简单。每个领域有独立接口和数据所有权；未来只有 Link Gateway 或 Agent Worker 需要独立扩容时，再拆出部署单元。

不引入通用消息总线。首版使用进程内领域调用和数据库持久 outbox，避免“为了扩展性”提前承担分布式系统成本。

## 5. 后端模块职责

| 模块 | 负责 | 不负责 |
| --- | --- | --- |
| HTTP Interface | JSON Schema、命名 RPC、同步读、幂等键、错误格式 | Android 执行结果伪造 |
| Identity & Grants | User ID、Agent、Device、Link、权限和撤销 | 各领域业务规则 |
| Link | 连接注册、心跳、在线状态、推送、重连握手 | 操作业务校验 |
| Sync | `server_seq`、操作日志、outbox、回执、断点补发 | 直接修改领域表 |
| Clock | Alarm 快照、revision、提醒关联 | Calendar Event 内容 |
| Calendar | Event、提醒策略、向 Clock 发出提醒请求 | Android 闹钟执行 |
| Notes | 内容、revision、可同步范围和读写授权 | 无授权的全库 Agent 读取 |
| Agent Jobs / Runs | Cron、Prompt、上下文授权、运行状态、结果引用 | Android 闹钟状态 |
| Scheduler / Connector | 到点触发 Run、调用远程 Agent、记录结果 | 未经授予的任意工具调用 |
| Observation | 操作审计、因果链、错误和延迟 | 默认记录全部 Notes 内容 |

## 6. 客户端共同能力与 App 职责

三个 App 可以共享一个 Android Link/Sync 库，但它不是共享 App 壳。

**共同客户端能力**

- `LinkClient`：握手、心跳、重连、当前连接状态。
- `SyncStore`：`last_server_seq`、本地 outbox、回执重试。
- `OperationApplier`：版本检查、去重、tombstone、领域事务。
- `ReceiptSender`：分别报告本地应用与原生执行结果。

**App 各自拥有**

- Clock：Alarm 本地数据库、Android 闹钟、通知、Agent Job 编辑界面。
- Calendar：Event 本地数据库、Event 编辑、提醒策略、关联状态展示。
- Notes：笔记编辑、revision、可同步范围、Agent 读写授权和内容来源展示。

## 7. 数据所有权与最小模型

| 数据组 | 建议对象 | 权威职责 |
| --- | --- | --- |
| Identity | users、agents、devices、links、grants | 谁可以通过哪个 Link 做什么 |
| Sync | operations、operation_receipts、outbox | 顺序、去重、补发和结果 |
| Clock | alarms | 当前期望闹钟与 revision |
| Calendar | events、reminder_links | Event 与提醒关联 |
| Notes | notes、note_revisions | 内容版本与可同步范围 |
| Agent | agent_jobs、agent_runs | Prompt 调度、上下文版本与运行结果 |

数据库按领域表隔离，不做一个所有字段混用的通用 `documents` 表。共享的是 `operations` 的同步协议，不是领域数据结构。

云端是当前快照和同步顺序的权威；各 App 本地数据库是其原生能力执行与离线工作的权威。Agent Run 的状态与 Android 操作回执不能混成一个 `success`。

## 8. 统一操作契约

### HTTP 能力

首版保持少量命名 RPC：

```text
capabilities.list / device.status / operation.get
alarm.list / alarm.set / alarm.cancel
event.list / event.set / event.cancel
note.list / note.get / note.set
agent_job.list / agent_job.set / agent_job.cancel
agent_run.get
```

未来 MCP 只是这些 HTTP 能力的薄适配，没有 CLI。

### 写请求需要表达

- `request_id`：调用方幂等键；同一 User 下重复提交返回首次结果。
- `user_id`、`link_id`：账户与目标连接。
- `base_revision`：调用方看到的实体版本。
- `source`：`local`、`agent`、`calendar`。
- `expires_at`：过期后不允许再执行的操作截止时间。
- `correlation_id`：跨领域追踪；跨步操作时保留同一链路。

### 状态语义

```text
ACCEPTED       云端已持久化请求
OFFLINE_QUEUED 当前无可用 Link，等待或即将过期
DELIVERED      已推送到客户端，不代表业务生效
APPLIED        客户端领域数据库已提交
EXECUTED       Android 或外部系统已确认实际效果
CONFLICT       base_revision 已过期，返回当前版本
REJECTED       权限或参数拒绝
FAILED         客户端或外部执行失败
EXPIRED        超过允许执行时间，不再执行
```

同步读可以直接返回云端快照；设备写操作返回 `202 ACCEPTED + operation_id`。Agent 通过 `operation.get` 查询实际结果。

## 9. 同步、冲突与可靠性

- 云端在同一个数据库事务中写领域快照、操作日志和 outbox，避免“数据库成功但推送事件丢失”。
- Link 断线后使用 `last_applied_seq` 补发，不做周期业务轮询。
- 客户端重复接收同一操作时只应用一次。
- 删除使用带 revision 的 tombstone，防止离线旧更新复活对象。
- 不用设备时间做 Last-Write-Wins；服务端分配顺序。
- Android 执行失败时保留云端期望状态并标记 `FAILED`，不自动回滚成虚假的成功。
- Agent Run 失败与 Clock／Calendar／Notes 操作失败分别记录，通过 `correlation_id` 串联。

首版冲突策略是 `base_revision + CONFLICT`，不是 CRDT。单用户场景下足够，后续确有高频多端协同再评估合并策略。

## 10. 权限与扩展性

权限至少包含：调用主体、User ID、Link、动作、资源范围、过期与撤销状态。

```text
alarm.write / event.write / note.read / note.write / agent_job.write
```

Agent Job 的权限不等于 Agent Run 自动获得全部能力。每次 Run 只继承 Job 明确声明的上下文和动作；读取 Notes 应记录实际使用的 `context_revision`。

新增一个领域或 App 的步骤固定为：

1. 注册 HTTP 能力、JSON Schema 和权限动作。
2. 新增领域模块与自有数据表，不改其他领域表。
3. 复用 operation、outbox、receipt 和 Link 协议。
4. 在对应独立客户端实现 Operation Applier。
5. 加入端到端正常、重复、离线、过期和撤销测试。

首版不做第三方插件系统。接口版本采用向后兼容的增量变更；改变已有语义时新增方法或版本，不让旧客户端静默误解。

## 11. 分阶段开发与验收

### Phase 0：契约样例

交付 HTTP 方法、操作状态、错误与同步消息样例。

退出条件：S1–S4 每一步都能映射到明确状态，没有“成功”语义混用。

### Phase 1：最小 Clock 垂直链路

实现 User／Link／Grant、`alarm.set`、云端快照与操作、WebSocket、Clock apply 和 Android 回执。

验收：真实 Android 设备创建一个闹钟；重复请求只创建一次；云端未收到 `EXECUTED` 前不显示设备成功。

### Phase 2：离线与恢复

实现本地 outbox、断点补发、revision、删除和过期。

验收：离线本地创建可响铃；重连不重复；离线 Agent 操作按策略补发或过期；旧更新不能复活已删除闹钟。

### Phase 3：Calendar 联动

实现 Event、提醒关联和跨领域因果链。

验收：Event 创建、修改、取消分别正确驱动 Clock，且不产生重复提醒。

### Phase 4：Notes 与 Agent Run

实现授权 Notes 同步、Agent Job Scheduler、Run Connector 和结果记录。

验收：S4 能读取指定版本 Notes，写回新 revision，创建 Event 和提醒；撤销授权后的 Run 无法读取。

## 12. 本版不做

- 不把三个 App 合并，不让 Clock 成为统一客户端。
- 不做 CLI、微服务、Kafka、CRDT、完整 Event Sourcing 或第三方插件平台。
- 不让 Agent 直接执行任意 Android RPC，只允许注册能力。
- 不默认同步全部 Notes，也不默认永久保存 Prompt 和结果内容。
- 不把云端 Cron 当成 Android 闹钟，不承诺未经实测的 ColorOS 后台可靠性。

## 13. 需要 review 的决策

1. **Agent Cron 默认由云端 Scheduler 触发**，是否符合你的预期？
2. **Agent 默认读取已同步 Notes 版本**，实时读取手机后置，是否可以接受？
3. Prompt、Agent 结果和操作日志分别保留什么内容、多久？
4. 首版是否只保留云端访问，设备直连明确延后？
5. 离线操作的默认过期策略：普通闹钟建议不晚于原计划触发时间执行；其他写操作是否需要不同 TTL？
6. 后端实现语言和部署位置在架构确认后另选，本版不提前绑定。
