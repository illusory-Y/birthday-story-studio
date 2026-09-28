# 小小成长电影 · 未来星际生日工坊

本机优先的儿童生日成长影片制作工具。照片和项目数据默认保存在当前浏览器，不上传到云端。

## 当前功能

- 首页控制台、主题选择、故事编辑、剧场播放、导出中心
- 6 个儿童未来主题：星际、糖果云、未来城市、海底、森林、恐龙
- 姓名、年龄、生日、成长回忆和照片时间线
- IndexedDB 本地照片保存
- .birthday 本地项目备份文件导入/导出
- PWA manifest 和 Service Worker 离线基础
- GitHub Pages 静态发布

## 本地运行

npm install
npm run dev

## 发布

生产文件位于 docs。GitHub Pages 选择 main 分支的 /docs 目录即可。

修改源码后执行 npm run build，再将 dist 的内容同步到 docs 后提交。

## 后续模块

视频导出会采用本机 Canvas/MediaRecorder；APK 会使用 Capacitor 封装；投屏会先提供全屏剧场模式，再扩展设备投屏。

公开仓库不应放入儿童真实照片。当前浏览器上传的照片只保存在本机项目数据中。
