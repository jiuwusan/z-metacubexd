# 项目架构

Nuxt/Vue UI、Nitro 服务端和 Electron 桌面通过 pnpm workspace 共享 agent 与配置编辑器；遵循现有技术边界，不强行把浏览器组件套入 HTTP controller/service 结构。

## 工作区与方向

- packages/config-editor：纯配置 patch、schema、引用与合并规则；不导入 UI/agent、Electron 或 Node I/O。
- packages/agent：共享用例/运行协调，profiles、scheduler、supervisor 管状态，http.ts 是 h3 协议适配，kernel/webdav 等模块负责外部边界；仅依赖 config-editor 的公开 exports。
- packages/ui：pages/layouts/components 展示，composables 管请求和交互用例，stores 管共享状态，utils/constants/types 管具体能力和契约。网络和桌面调用通过既有 composables；不直接导入 agent、server 或 desktop 运行实现，只共享 config-editor 的公开 API。
- apps/server：Nitro routes/middleware 负责 HTTP/认证，lib/supervisor 为 agent 组合根，plugins 负责启动；通过 agent exports 使用共享用例。
- apps/desktop：main 装配 agent、系统代理/TUN/helper/更新/窗口生命周期；preload 定义受限 IPC 桥，renderer 继续使用 UI 静态产物。main/helper 的特权逻辑不得进入 renderer。

有向 workspace 图：UI → config-editor；agent → config-editor；server/desktop → agent。跨工作区禁止相对路径读取源码，必须声明 workspace 依赖并使用 package.json exports 中存在的公开子路径；部署配置引用 UI 构建产物路径不属于源码 import。共享包不得反向依赖宿主应用，UI 不得使用 Node/Electron API。

scripts/check-architecture.mjs 解析 Babel 的 TypeScript/Vue script AST 的 import/export/import type/动态 import，检查工作区图、公开 exports、manifest 声明与跨目录导入、浏览器/纯包特权导入。只扫描人工运行源码，排除构建、生成、测试和资源目录。其约束是包边界；包内职责由现有框架约定、测试和审查维护，不宣称检查所有运行时反射或包内循环。

## 兼容与生命周期

保留 Mihomo control API、配置 patch、订阅/profile 格式、UI 路由、Nitro 转发完整 URL、桌面 IPC 和 helper 协议。所有平台能力由现有 capability gate 暴露，不绕过 context isolation/窗口来源限制。代理/TUN 修改与退出清理保持原生命周期，失败必须能够恢复原系统配置，后台任务在停止时清理。

生成 UI → Nitro 静态目录或 desktop renderer 的既有装配保持不变，容器和桌面打包继续各自工作流；不把 server 的私密参数打包进 Nuxt 客户端。

## 工具链兼容记录

当前 Vue 类型检查和 typescript-eslint 需要 TypeScript 编译器 API；原 catalog 的 TS7 原生版本不再导出该 API，导致 vue-tsc 与 ESLint 无法启动。catalog 固定在兼容的 ~5.9.3，升级 TypeScript 时必须先验证这两个工具的支持范围。supervisor 测试使用注入的平台和假进程，通用 FakeProc 默认 POSIX，专门的 Windows 测试显式覆盖；禁止根据宿主平台对虚构 PID 执行真实 tree-kill。
