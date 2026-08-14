# dsh-balance

[简体中文](./README.md) | [English](./README_EN.md)

DeepSeek Harness 设置插件，用于查询 API 余额和当前可用模型。API Key 仅由本机 Host 使用，不会发送到浏览器。

![DeepSeek 余额插件界面](./docs/dsh-balance-settings.jpg)

![DeepSeek 模型插件界面](./docs/dsh-models-settings.jpg)

## 功能

- 查看总余额、充值余额和赠送余额
- 查看当前 API Key 可用的模型
- 缓存查询结果并支持手动刷新
- 原生支持简体中文和英文，并跟随 Harness 系统语言切换
- 支持 Harness 已保存的 `DEEPSEEK_API_KEY`

## 安装

```bash
dsh plugin --profile web add @pinkbanana/dsh-balance
dsh --profile web
```

打开 <http://127.0.0.1:3080/>，进入“设置 → 插件 → DeepSeek 余额 / DeepSeek 模型”。API Key 可在“设置 → 模型”中保存，或通过 `DEEPSEEK_API_KEY` 环境变量提供。

## 开发

```bash
pnpm install
pnpm check
```

## License

[MIT](./LICENSE)

<a href="https://www.buymeacoffee.com/pinkbanana"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Crazywoola a coffee" width="199" height="55" /></a>
