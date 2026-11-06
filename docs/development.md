# 开发规范

## 工具链与安装

使用 packageManager 指定的 pnpm 10.34.1 和 pnpm-lock.yaml，Node 选择与 Nuxt/Nitro/Electron/TypeScript 锁定版本兼容的当前 LTS。依赖版本在 pnpm-workspace.yaml catalog 管理，不切换 npm 或重建其他锁。

普通开发安装 `pnpm install --frozen-lockfile` 会执行已有 prepare/husky 与 Nuxt postinstall。自动审计使用 `pnpm install --frozen-lockfile --ignore-scripts`，然后显式执行 `pnpm --filter @metacubexd/ui exec nuxt prepare` 生成类型；不能假定跳过 scripts 后 .nuxt 和 Electron 二进制已存在。需要 Electron 打包时显式准备二进制，不运行 fetch:mihomo 作为离线测试。

- `pnpm dev:ui`、`pnpm dev:server`、`pnpm dev:desktop` 为各宿主入口；desktop 命令会下载内核，仅在确需真实桌面运行时使用。
- `pnpm lint`：现有各包 lint（UI ESLint 非写入）；修复用 UI 的 lint:fix。`pnpm typecheck`：递归各包，server 会显式 nitro prepare。
- `pnpm check:architecture`：Babel AST workspace 与公开出口检查。
- `pnpm test`：config-editor、agent、server、desktop 及 UI 单元测试，补齐原根命令未聚合的 config-editor。
- `pnpm build`：现有 UI generate + Nitro build；`pnpm build:desktop` 为 Electron 编译，平台安装包仍走原发布流程。
- `pnpm check`：架构、lint、typecheck、聚合测试、UI/server build，失败即停止。UI 的 test:coverage、test:e2e 和 desktop 的 test:helper-package 仍独立保留。

## 编码与平台边界

遵循现有 TypeScript strict、Vue script setup 和包内 ESLint/格式风格。共享类型/API 从公共入口导出，不从另一个包 src 深路径引用；新增 workspace 依赖前先检查 architecture.md 的有向图。UI 所有特权动作通过 useDesktop/useControlApi 等既有适配；组件不直接读磁盘、执行子进程或导入 Electron。状态 stores、请求缓存、页面本地状态保持唯一所有者，切换 profile/endpoint 后旧响应不能覆盖新状态。

agent 的 HTTP 输入先校验再调用用例；配置 patch、订阅和 YAML 使用既有解析/校验，不静默修复不兼容结构。桌面主进程验证 IPC 参数与请求来源，preload 只暴露所需方法；不向 renderer 暴露任意 fs、exec 或凭据。系统代理/TUN/helper 的失败回滚和退出清理必须有测试，Windows 特权检查在对应平台执行；不能用 Linux 单测代替管理员 helper 验证。

## CI、部署与回滚

保留 unit-tests、e2e、release 的平台和发布布局，质量工作流额外执行完整 check；发布/签名和联网下载不属于本地离线检查。修改桌面生命周期时运行已有 Windows helper/package 检查；变更 UI 时运行单元与适用的 e2e/视觉检查，记录浏览器和平台限制。

发布前备份 profile/配置、原程序或镜像版本，核对静态 UI 路径、Nitro 认证/转发、桌面 preload/helper 打包和能力限制；不运行真实系统代理切换作无意验证。回滚先停止新实例和后台任务，恢复原系统代理/TUN，再恢复旧产物及兼容配置；凭据、WebDAV、内核资产与用户 profile 均不得加入仓库或日志。

## 编码、变更与审查

使用 UTF-8、文件末尾换行，保持相邻文件缩进和现有工具链；不批量格式化无关文件。模块按职责命名，优先小函数、明确输入输出及可替换的外部依赖。禁止循环依赖、隐式全局状态、静默吞错和为目录形式添加无行为转发；遗留兼容导出仅供已有调用方，新运行代码使用所属层。

修改行为前先复现并覆盖失败路径；纯逻辑测试输入、输出与边界，用例测试状态、并发、取消和失败隔离，适配器测试协议和文件边界，交付前执行完整检查。外部系统用虚构数据、临时目录及注入依赖，不连接私人服务或发送真实通知。异步资源在关闭时清理，晚到响应不得覆盖新状态，失败不能标记为成功。检查器是静态约束，不是安全沙箱，反射、别名、第三方副作用与状态所有权仍需人工审查。

新增依赖说明用途、许可证及运行成本，区分生产与开发依赖，同时更新原有锁文件，不手改解析结果。变更接口、数据格式、环境参数或部署流程时同步 README 和设计文档；说明兼容、失败场景、回滚方法。审查先看安全、数据所有权与并发，再看可读性。

## 安全、日志与配置

不得提交、读取输出或在测试快照中暴露 .env、凭据、真实私人服务地址、生产数据。日志仅输出脱敏摘要，异常不透传密钥、上游正文或堆栈给终端用户。外部请求应定义超时、取消、响应校验与错误转换；新增写操作需要授权、输入校验和重复提交防护，客户端校验不能替代可信边界的校验。配置由现有配置入口管理，不在组件或业务函数里散落环境变量。

## Git 与交付

默认当前分支工作，不擅自创建分支/worktree、提交、推送或发布。获授权提交时用 `<类型>: <中文摘要>`；项目迁入 E:\code 后必须使用 `<类型>: <B/C/D><准确飞书工作项ID>-<中文摘要>`，默认 C，不得省略或编造 ID。

交付检查：需求和失败路径实现完整；完整检查真实执行；无越层、循环、敏感信息、无关变更或遗留调试输出；锁文件一致；说明命令、结果、跳过项和真实环境限制。未经执行的桌面、浏览器、Docker 或真实服务检查不能声称通过。部署前记录当前版本、配置与数据备份，升级后验证健康及只读关键路径；回滚恢复旧产物、匹配配置和兼容数据，禁止新旧实例同时写共享数据。

## 工具链兼容记录

当前 Vue 类型检查和 typescript-eslint 需要 TypeScript 编译器 API；原 catalog 的 TS7 原生版本不再导出该 API，导致 vue-tsc 与 ESLint 无法启动。catalog 固定在兼容的 ~5.9.3，升级 TypeScript 时必须先验证这两个工具的支持范围。supervisor 测试使用注入的平台和假进程，通用 FakeProc 默认 POSIX，专门的 Windows 测试显式覆盖；禁止根据宿主平台对虚构 PID 执行真实 tree-kill。

UI 单元测试按文件隔离 jsdom，以最多 4 个 worker 执行；共享浏览器服务的 e2e 仍沿用配置中的单 worker。不要将需要共享端口或进程状态的测试混入可并行单元目录。
