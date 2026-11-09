# dsh-balance

[简体中文](./README.md) | [English](./README_EN.md)

DeepSeek Harness 插件，用于查询 DeepSeek / StepFun API 余额，以及 DeepSeek / StepFun / Tokener 的可用模型和多维消费统计。API Key 仅由本机 Host 使用，不会发送到浏览器。

界面使用 Harness 原生侧栏、主页面和主题变量。侧栏“插件”下方新增“用量统计”，独立查看所有对话的提供方、模型、会话和日期统计；默认显示全部提供方与全部时间，支持提供方和日期范围筛选。活动打卡图按浏览器时区的星期 × 24 小时汇总请求次数，圆点大小随次数变化；悬停或使用方向键可查看请求数与 token 明细。选择器采用主题化浮层菜单，支持方向键、Home/End、Enter、Escape 和按名称检索。设置页支持 DeepSeek / StepFun / Tokener 切换。统计范围除今日 / 7 天 / 30 天 / 全部时间外，还可自定义起止日期；时区默认跟随浏览器，可切换为 UTC 等常用时区，日期分组、打卡图与月度预测均按所选时区计算。总消费卡片在限定范围时显示与上一同期的对比，并按当月已用天数线性预测本月花费。余额走势仅保留在当前 Harness 进程内（最近 48 次实时查询），重启后重新累积。「会话」分类下点击会话名可下钻查看该会话的完整请求明细（不受范围与提供方筛选影响），随时返回总览；「导出 JSON / CSV」分别导出完整摘要与当前分类表格（会话视图导出请求级记录），汇率输入框可即时换算人民币合计。运行 `pnpm preview` 可查看使用示例数据的新版界面。

聊天框底部会跟随当前会话所选的提供方与模型更新余额；设置页可独立切换提供方。

## 功能

- DeepSeek：查看总余额、充值余额和赠送余额
- StepFun：查看可用余额、总充值金额、总赠送金额及预付费 / 后付费账户类型
- Tokener：按提供方、模型、会话、日期统计本地请求和 token，以公开目录价估算美元费用；通过官方 `/v1/models` 查询模型
- 提供方独立缓存；支持大小写不敏感的 Provider ID
- 在聊天框下方显示当前 provider、模型和余额，兼容模型选择器与 `/model` 切换
- 从当前提供方的 `/models` 接口读取可用模型、所属组织与创建时间
- 在设置页按所选 provider、模型、会话和日期查看实际 usage 消费，并在当前会话的“消费”Tab 查看请求明细
- 明确区分已计费、免费（已知价格且费用为 0）与未计费请求；缺少 provider usage、未知 provider 或未知模型时不进行费用估算
- 日期按浏览器 IANA 时区分组；DeepSeek 峰谷价格始终按北京时间计算
- DeepSeek 费用显示 USD、StepFun 显示原生 CNY；配置 `usdToCny` 后显示人民币合计
- 缓存查询结果并支持手动刷新
- 模型列表标注内置参考价（输入 / 输出每百万 tokens），未收录价格的模型明确标记
- 统计页「会话」分类中点击任一会话，下钻查看该会话的完整请求明细，可随时返回总览
- 一键导出当前视图为 JSON 或 CSV（总览导出所选分类或完整摘要，会话导出请求级记录），数据不离开本机
- 统计页可直接填写 USD→CNY 汇率（存于浏览器 localStorage，无需重启）；插件配置 `usdToCny` 优先生效
- 配置 `pricingOverrides` 可用自定义费率替换内置价格（按 provider + model 匹配，支持生效时间），模型列表与计费估算同步生效
- 设置页展示近期余额走势（进程内最近 48 次查询），并可按币种配置低额预警（`lowBalance`），聊天框下方同步提示
- 统计页支持自定义日期范围与 12 个常用时区（默认跟随浏览器），月度按当前节奏预测，限定范围时与上一同期对比
- 余额与模型查询对 429 / 5xx 自动重试（尊重 `Retry-After`，指数退避，最多 3 次尝试）
- 依据 DeepSeek 峰谷定价，在高峰时段（北京时间 9:00–12:00、14:00–18:00）将聊天框下方的余额指示灯变为橙色
- 原生支持简体中文和英文，并跟随 Harness 系统语言切换
- 支持 Harness 已保存的 `DEEPSEEK_API_KEY`

![会话消费页示例](./docs/dsh-session-usage-v0100.jpg)

## 兼容性

自 0.13.1 起，插件采用宽泛兼容范围：**`>=0.2.2-rc.1 <1.0.0-0`**，需要 Node.js **24.9+**。`engines.dsh` 和所有 DSH peer 依赖使用同一范围；DSH 的版本检查包含预发布版，因此后续 0.x 的 RC、补丁版和次版本不会仅因版本号变化而被拒绝加载。Cordis peer 范围为 `^4.1.0`。开发依赖仍固定在 DSH `0.2.2-rc.1` 和 Cordis `~4.1.0`，以保持构建可复现。已实测 [DSH 0.2.2-rc.1](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.2-rc.1)；宽泛声明不代表未来版本已完成运行测试，若上游改变 API，仍需适配。Harness `0.2.0-rc.2` 用户请继续使用插件 `0.10.2`；本次源码不再兼容 Harness 0.1 的接口。

新版 dsh 会在安装及启动时校验插件兼容版本。旧版插件精确锁定 DSH 版本，会在升级 DSH 后被拒绝加载；请升级到插件 `0.13.1` 并重启 Harness。上述兼容范围内无需添加版本豁免；低于 `0.2.2-rc.1` 或进入 `1.0.0` 预发布/正式版时仍保留版本检查。仍使用 dsh `0.2.1-rc.5` 的用户请保留插件 `0.12.1`；dsh `0.2.1-rc.2` 用户请保留插件 `0.11.0`。

也可在本地构建并打包源码，再用 `dsh plugin --profile web add /absolute/path/to/package.tgz` 安装生成的 `.tgz` 文件，随后重启 Harness：

```bash
pnpm install --frozen-lockfile
pnpm pack
```

消费统计通过新版只读会话句柄读取，以 `inheritedEventCount` 排除分叉继承的记录；会话页在 token 用量变化或一轮运行结束后刷新；统计页面每 15 秒检查更新，重新聚焦或返回页面时刷新，隐藏页面暂停查询。兼容 `assistant/message` 和重试/取消请求的 `assistant/attempt`，读取最后一条 stream usage，并以重试边界区分独立请求，同一次请求的重复结算仅计一次。

全局统计会跳过当前 dsh 无法读取的旧格式或损坏会话，并显示未纳入统计的会话数量；其余会话仍正常统计。部分汇总结果不缓存，下次刷新会重试失败会话；已成功读取且 revision 未变化的会话复用精简用量记录。单个会话无法读取或所有会话都读取失败时，仍明确显示读取错误，不将失败记录当作零消费。

自 `0.12.1` 起，统计查询逐个读取会话，提取请求用量后即释放完整日志；所有请求共享读取队列，同一会话的并发读取合并。缓存仅保留用量与标题，不保留消息或工具输出。切换提供方、日期范围或重复刷新不再同时加载多份完整历史，避免大量会话引起堆内存耗尽。手动强制刷新会重新读取日志。

分类明细采用带数量的 Tab 面板，在模型、提供方、会话和日期之间切换；窄屏自动改用主题化选择器。每页默认 10 条，可选择 5 / 10 / 20 条。会话消费页分别查看模型汇总与请求明细，请求支持模型筛选。长名称省略显示，悬停保留完整名称。

![分类面板与分页示例](./docs/dsh-usage-tabs.jpg)

## 安装

```bash
npm install -g @deepseek-ai/dsh@latest
dsh plugin --profile web add @pinkbanana/dsh-balance@latest
dsh --profile web
```

打开 <http://127.0.0.1:3080/>，进入“设置 → 模型余额”。该入口位于“Agent 预设”下方，余额摘要也会显示在已有会话的聊天框下方。API Key 可在“设置 → 模型”中保存，或通过 `DEEPSEEK_API_KEY` 环境变量提供。

消费统计从已保存会话日志读取，包含当前运行会话已写入的记录，不展示 prompt 内容。可在插件配置中增加固定汇率，例如：

```yaml
usdToCny: 7.2
```

也可按币种配置低额预警阈值（币种大小写不敏感，低于阈值时设置页与聊天框下方会出现提示）：

```yaml
lowBalance:
  - currency: CNY
    amount: 20
  - currency: USD
    amount: 5
```

还可用自定义费率替换内置价格（需完整的 USD 或 CNY 三项费率，`effectiveFrom` 可省略，默认立即生效；修改后需重启 Harness）：

```yaml
pricingOverrides:
  - provider: deepseek
    model: deepseek-v4-flash
    cacheMissUsdPerMillion: 0.10
    cacheHitUsdPerMillion: 0.01
    outputUsdPerMillion: 0.30
  - provider: stepfun
    model: step-5-preview
    effectiveFrom: "2026-11-01T00:00:00Z"
    cacheMissCnyPerMillion: 6
    cacheHitCnyPerMillion: 0.3
    outputCnyPerMillion: 18
```

自定义价格同时作用于设置页模型列表标注与消费统计估算；未覆盖的模型仍按内置价格计算。汇率除配置 `usdToCny` 外，也可在统计页直接填写（仅保存在本浏览器，插件配置优先生效）。

官方提供方 ID `deepseek-official` 与旧 ID `deepseek` 均受支持（大小写不敏感），共享 DeepSeek 凭据、余额及模型缓存。底部保留实际模型 ID，例如 `deepseek-flash`；价格未知的新模型仍标为“未计费”。

## StepFun 配置

在“设置 → 模型”中添加自定义提供方，Provider ID 填写 `StepFun`（`stepfun`、`STEPFUN` 等大小写写法均可），保存 API Key。Harness 默认将其保存为 `STEPFUN_API_KEY`；也可以直接设置该环境变量。在“设置 → 模型余额”选择 StepFun 即可查询。

按 [StepFun 账户 API](https://platform.stepfun.com/docs/zh/api-reference/accounts/get) 使用 Bearer 认证请求 `GET https://api.stepfun.com/v1/accounts`。金额按 CNY 展示；总充值 / 总赠送金额按文档展示为累计金额，不与当前余额相加。接口没有服务可用性字段，后付费账户不会因为余额为零或负数而显示“服务不可用”。

若模型配置使用其他凭据引用，可在本插件配置中覆盖（`baseUrl` 是 API 前缀，StepFun 应包含 `/v1`）：

```yaml
providers:
  - id: StepFun
    apiKeyRef: MY_STEPFUN_KEY
    baseUrl: https://api.stepfun.com/v1
```

已有的顶层 `apiKeyRef` / `baseUrl` 继续用于 DeepSeek；`providers` 覆盖对应提供方的余额与模型查询。配置不读取自定义模型的 Base URL，默认查询官方 API。余额、可用模型与设置页统计随所选提供方切换。聊天框摘要使用当前会话的实时选择；会话“消费”保留该会话历史上所有 provider 的用量。

模型列表按 [StepFun 列表 API](https://platform.stepfun.com/docs/zh/api-reference/models/list) 请求 `GET /v1/models`，解析 [Model 对象](https://platform.stepfun.com/docs/zh/api-reference/models/object) 的 `id`、`owned_by`、`created`（秒级 Unix 时间戳）。列表已包含这些信息，不需要逐个调用单模型详情接口。Host 路由为 `GET /dsh-balance/api/models?provider=StepFun`，模型缓存按 provider 隔离，`refresh=1` 强制刷新。

## Tokener 配置与统计

在“设置 → 模型”中添加自定义提供方，Provider ID 使用 `Tokener`（大小写不限，也支持 `tokener.ai`），Base URL 使用 `https://api.tokener.ai/v1`，并保存 API Key。插件默认使用 `TOKENER_API_KEY`，也支持 `providers` 配置覆盖：

```yaml
providers:
  - id: tokener
    apiKeyRef: TOKENER_API_KEY
    baseUrl: https://api.tokener.ai/v1
```

根据 [Tokener API 文档](https://www.tokener.ai/zh/docs/reference/api-endpoint)，可用模型由 Host 使用 Bearer 认证查询 `/v1/models`，密钥不发送到浏览器。文档没有公开 API Key 可访问的余额或组织用量接口，因此设置页提供控制台入口，聊天框提示查看“用量统计”，不尝试未知端点。

统计仅覆盖当前 dsh 保存的本地会话，不包含其他客户端或整个组织的调用，也不提供 API Key 维度。请求数、输入、输出、缓存读取与缓存写入按 dsh 标准化的 usage 统计；缓存读取已从标准化输入中拆出，不重复计数。支持提供方、模型、会话、日期和活动时段明细，提供方别名统一归为 Tokener。

内置 2026-11-03 核验的 [Tokener 模型目录](https://www.tokener.ai/zh/models) 对话/推理模型美元参考价，逐个匹配完整模型 ID。使用 Tokener 目录价格，不套用原厂价格或 DeepSeek 峰谷倍率。参考价快照同样用于已有历史记录的估算，不代表历史实际扣款。未知模型、缺少 usage，以及包含未公开价格的缓存写入请求，保留请求数与 token 并标为“未计费”。账户余额、折扣和实际消费以 [Tokener 控制台](https://console.tokener.ai) 为准。

## 统计口径

每条请求按实际返回消息的 provider / model 归属，兼容旧日志的请求头；日期和峰谷价格按该次请求时间计算。Token 总量包括未缓存输入、输出、缓存读取与缓存写入。设置页默认筛选所选 provider，也可选择“全部提供方”；会话页保留混用模型的完整历史。

内置 DeepSeek 美元定价，以及 2026-09-30 核验的 [StepFun 官方人民币标准价](https://platform.stepfun.com/docs/zh/guides/pricing/details)：`step-5-preview`、`step-3.7-flash`、`step-3.5-flash` 和 `step-3.5-flash-2603`。StepFun 未缓存输入（含缓存写入）、缓存读取、输出分别计价，不套用 DeepSeek 峰谷倍率。费用是公开标准价估算，不代表账户实际账单；套餐、折扣和未保存的历史调价不包含在内。

美元和原生人民币费用分别展示；设置 `usdToCny` 后，人民币合计才会包含美元折算金额，并明确标为固定汇率换算。未设置汇率时，原生人民币金额不会被表述为包含美元费用的完整人民币合计。已知价格且费用为 0 的请求单列为“免费”；未知 provider / model 和缺失 usage 的请求保留请求数与 token，显示“未计费”。账户余额是实时查询值，与本地用量估算独立；赠送余额与充值余额分别展示，StepFun 的总充值/总赠送为累计值而非剩余余额。会话消费页采用居中内容宽度、响应式外边距，并为底部输入框保留空间。

## 扩展与设计

- `src/providers.ts` 保存可在前后端共享的 provider 元数据；`src/balance.ts` 的 adapter 表只负责端点与响应解析，传输、错误分类和缓存由公共逻辑处理。
- `GET /dsh-balance/api/balance?provider=StepFun` 查询 StepFun；省略 provider 保持 DeepSeek 兼容，`refresh=1` 绕过对应缓存。不支持的 provider 返回 `UNSUPPORTED_PROVIDER`。
- 通过原生 `sidebar.panellist` 与 `main` 插槽接入侧栏和主页面，菜单、选中态、侧栏折叠和页面导航由 Harness 管理；插件使用 Harness 的颜色、圆角和布局变量，支持深浅色主题与窄屏。

## 开发

```bash
pnpm install
pnpm check
pnpm preview
```

预览不使用真实密钥。可使用 `?page=session` 检查会话消费页（124 次 StepFun 请求、7,161,128 tokens），使用 `?page=usage` 查看独立统计页，使用 `?page=usage&lang=en&theme=dark` 检查英文与深色主题，`?state=missing` / `error` / `empty` / `loading` 检查不同状态。顶部示例模型选择器可验证底部 provider / 模型切换。StepFun 余额与模型查询、新版账户页面自 `0.6.0` 起提供。实时模型余额和统计修复自 `0.7.0` 起提供。

## License

[MIT](./LICENSE)

<a href="https://www.buymeacoffee.com/pinkbanana"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Crazywoola a coffee" width="199" height="55" /></a>
