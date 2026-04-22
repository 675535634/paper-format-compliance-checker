# 论文格式合规检查器

[English README](./README.md)

论文格式合规检查器是一个用于检查毕业论文或学位论文是否符合学校 Word 模板要求的 monorepo 项目。

当前版本重点解决几件事：`.docx` 解析、规则化格式检查、可读的问题报告、用于验证“到底读没读对”的解析日志，以及高置信度问题的一键修复与下载导出。

## 强调 Vibe Coding

这个项目明确采用 `vibe coding` 的开发方式。

我们的取向是：

- 先把真实可用的流程跑起来，再逐步补细节
- 用短反馈回路持续迭代，而不是一开始就追求过度设计
- 对论文格式这种高要求场景，坚持“人审 + 工具辅助”
- 优先解决最实际的问题：有没有读到、有没有读对、哪些地方能自动修

简单说，就是先把有用的东西做出来，再持续把规则、修复能力和体验打磨细。

## 目前能做什么

- 上传并检测 `.docx` 论文文档
- 解析文档结构、页眉、摘要、关键词、标题、参考文献等内容
- 按可配置模板执行格式规则检查
- 按严重程度、分类、位置展示问题
- 下载解析日志，核对系统是否真的读到了、读对了
- 对高置信度问题执行一键修复，并导出修正后的 `.docx`
- 管理多个学校模板、专业模板或个人模板
- 支持局域网开发访问，以及可配置的自定义开发域名

## 技术栈

- 前端：React 19、Vite、Ant Design、Zustand、React Router
- 后端：Node.js、Express、TypeScript、Zod
- 文档解析：JSZip、fast-xml-parser
- 测试：Vitest

## 仓库结构

```text
.
├─ backend/    Express API、文档解析、规则引擎、修复与导出服务
├─ frontend/   React 前端，负责上传、模板编辑、检测与结果展示
├─ prompts/    开发过程中使用的提示与流程记录
└─ PROJECT_PLAN.md
```

## 当前亮点

- 不再依赖难懂的组合规则字符串，而是结构化规则编辑
- 标题层级可动态扩展
- 多数规则项支持“无要求”
- 支持下载解析日志，方便核对解析是否正确
- 支持一键修复并下载
- 已覆盖摘要、关键词、封面项、必需章节、图表题注等学校模板型检查

## 快速开始

环境要求：

- Node.js 20+
- npm 10+

安装依赖：

```bash
npm install
npm --prefix backend install
npm --prefix frontend install
```

启动前后端开发环境：

```bash
npm run dev
```

默认地址：

- 前端：`http://localhost:16666`
- 后端：`http://localhost:16667`

局域网 / 开发域名访问：

- 前端监听 `0.0.0.0:16666`
- 后端监听 `0.0.0.0:16667`
- Vite 默认放行 localhost，并支持通过 `DEV_ALLOWED_HOSTS` 配置自定义开发域名白名单
- 例如：`DEV_ALLOWED_HOSTS=.dev.example.com,.lab.local`

构建：

```bash
npm run build
```

只运行后端：

```bash
npm --prefix backend run dev
npm --prefix backend run build
npm --prefix backend run test
```

只运行前端：

```bash
npm --prefix frontend run dev
npm --prefix frontend run build
```

## 使用流程

1. 新建或编辑规则模板。
2. 上传 `.docx` 论文。
3. 执行格式检测。
4. 查看分类后的问题结果。
5. 如需核对解析正确性，下载解析日志。
6. 对高置信度问题执行一键修复并导出文档。

## 当前阶段

项目仍在持续迭代，接下来会继续加强：

- 更深的 Word / WPS 兼容性
- 更精细的学校规范检查
- 更完整的一键修复覆盖范围
- 更可靠的真实论文样本夹具与回归测试

## 参与贡献

欢迎一起参与，尤其欢迎喜欢 `vibe coding`、愿意在真实反馈中快速迭代的人。

这个项目特别适合以下类型的贡献：

- 提高解析准确率
- 增加更安全的规则检查
- 扩展自动修复能力
- 用真实论文样本补测试
- 在不增加使用门槛的前提下改进规则配置体验

## 许可

当前仓库还没有补充正式许可证。
