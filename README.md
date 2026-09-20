# dsh-balance

[简体中文](./README.md) | [English](./README_EN.md)

DeepSeek Harness 插件，用于查询 DeepSeek / StepFun API 余额、DeepSeek 可用模型和多维消费统计。API Key 仅由本机 Host 使用，不会发送到浏览器。

设置页采用账户总览布局，支持 DeepSeek / StepFun 切换。运行 `pnpm preview` 可查看使用示例数据的新版界面。

![聊天框下方的 DeepSeek 余额](./docs/dsh-balance-composer-v040.png)

## 功能

- DeepSeek：查看总余额、充值余额和赠送余额
- StepFun：查看可用余额、总充值金额、总赠送金额及预付费 / 后付费账户类型
- 提供方独立缓存；支持大小写不敏感的 Provider ID
- 在聊天框下方持续显示 DeepSeek 余额摘要
- 查看当前 API Key 可用的模型
- 在设置页按模型、会话和日期查看实际 usage 消费，并在当前会话的“消费”Tab 查看请求明细
- 缺少 provider usage、未知 provider 或未知模型时标记为“未计费”，不进行 token 估算
- 日期按浏览器 IANA 时区分组；DeepSeek 峰谷价格始终按北京时间计算
- 默认显示 USD；配置 `usdToCny` 后额外显示固定汇率换算的 CNY
- 缓存查询结果并支持手动刷新
- 依据 DeepSeek 峰谷定价，在高峰时段（北京时间 9:00–12:00、14:00–18:00）将聊天框下方的余额指示灯变为橙色
- 原生支持简体中文和英文，并跟随 Harness 系统语言切换
- 支持 Harness 已保存的 `DEEPSEEK_API_KEY`

## 安装

```bash
dsh plugin --profile web add @pinkbanana/dsh-balance@latest
dsh --profile web
```

打开 <http://127.0.0.1:3080/>，进入“设置 → 模型余额”。该入口位于“Agent 预设”下方，余额摘要也会显示在已有会话的聊天框下方。API Key 可在“设置 → 模型”中保存，或通过 `DEEPSEEK_API_KEY` 环境变量提供。

消费统计从已保存会话和当前运行中的 live session 读取，不展示 prompt 内容。可在插件配置中增加固定汇率，例如：

```yaml
usdToCny: 7.2
```

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

已有的顶层 `apiKeyRef` / `baseUrl` 继续用于 DeepSeek；`providers` 仅覆盖对应提供方的余额查询。配置不读取自定义模型的 Base URL，默认查询官方 API。模型目录和聊天框摘要仍属于 DeepSeek；消费统计保持原有定价覆盖，未支持的 StepFun 价格会标为未计费。

## 扩展与设计

- `src/providers.ts` 保存可在前后端共享的 provider 元数据；`src/balance.ts` 的 adapter 表只负责端点与响应解析，传输、错误分类和缓存由公共逻辑处理。
- `GET /dsh-balance/api/balance?provider=StepFun` 查询 StepFun；省略 provider 保持 DeepSeek 兼容，`refresh=1` 绕过对应缓存。不支持的 provider 返回 `UNSUPPORTED_PROVIDER`。
- 排版参考 [Codrops 的 Kononenko 案例](https://tympanus.net/codrops/2026/09/18/kononenko-architectural-bureau/)：大字号、留白、建筑式网格和几何线条，使用原创 CSS 实现；支持深浅色主题、窄屏与减少动态效果偏好。

## 开发

```bash
pnpm install
pnpm check
pnpm preview
```

预览不使用真实密钥。可使用 `?lang=en&theme=dark` 检查英文与深色主题，`?state=missing` / `error` / `empty` / `loading` 检查不同状态。当前 main 中的 StepFun 接入和页面改版尚未发布 npm；上面的 `@latest` 安装命令仍使用已发布版本。

## License

[MIT](./LICENSE)

<a href="https://www.buymeacoffee.com/pinkbanana"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Crazywoola a coffee" width="199" height="55" /></a>
