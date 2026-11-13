# YetToTell 目录分工

## 根目录：从这里使用课程

保留 README、课程.md、依赖清单和四个操作脚本。课件.html 是构建结果，可离线打开，不作为内容编辑源。当前本机工作文件夹仍沿用原名称，发布压缩包的顶层目录为 YetToTell，不影响已有启动路径。

## docs：项目文档

- usage.md：操作步骤、课程格式、互动控件和导出说明。
- structure.md：本文件。
- images/course-outline.png：课堂目录截图。
- images/images-and-formulas.png：图片与公式截图。

这两张截图用于 README 展示，不参与课件构建。添加项目展示图也放在这里，使用语义清楚的英文文件名，便于 Markdown 相对链接和跨平台访问。

## assets：课程运行资源

example.svg、logo.svg 为示例图片；widgets 保存自包含的互动 HTML；uploads 保存从网页导入的图片；katex 保存离线公式脚本、字体和上游许可证。不要把文档截图、PDF 或测试输出放进这里，因为此目录会随发布包收集。

## lesson：引擎与运行文件

- build_markdown.py：读取课程、校验格式并构建。
- source_text.py：定位和回写原文字段。
- classroom.py：布局、字体、媒体与互动配置校验。
- package_v2.py：组装页面与离线 HTML。
- server.py：本机保存、图片导入、PDF 导出与结束服务接口。
- pdf_export.py：PDF 排版及可选署名。
- start.ps1、update.ps1、stop.ps1、stop_server.py：启动、更新和退出流程。
- package_release.py：生成 YetToTell-minimal.zip。

lesson/dist 顶层的 HTML、JS 和 CSS 是网页源码。这个目录名称沿用早期实现；不要把整个 dist 当成可删除的构建缓存。其中的 assets 子目录才是自动复制的依赖和脚本，不直接编辑。

content.json、build-info.json、生成的讲稿、server.pid 和日志属于本机运行产物。exports 保存导出的 PDF。这些文件被 Git 忽略，并且不进入最小发布包。

## 开发与发布

开发工作区的 tests 保存回归脚本，tests/output 保存隔离验收副本和结果；.local 保存本机备份及归档；.venv 保存本机 Python 环境。不要把这些目录复制进发布压缩包。

运行 `python lesson/package_release.py` 会按明确的清单收集文件，生成到项目目录外。包内保留两张 README 展示图，排除测试、PDF、日志、备份、环境与生成课件。解压后先运行 `python lesson/build_markdown.py`。

后续增加目录或更改源码位置时，需要同时更新导入路径、启动脚本、文档链接和发布清单。当前整理保留引擎入口与课程媒体路径，以免改变已有课程的引用。
