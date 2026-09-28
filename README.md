# 小小成长电影

手机和电脑都可以打开的生日成长影片编辑器。支持姓名、年龄、生日、主题、照片回忆、自动播放、蛋糕和烟花。

## 本地运行

```bash
npm install
npm run dev
```

## 发布到 GitHub Pages

本仓库的 `main/docs` 存放已编译的网站。在仓库的 Settings → Pages → Build and deployment 中选择 **Deploy from a branch**、`main`、`/docs`，然后保存。

改动源代码后，运行 `npm run build`，再将 `dist` 中的全部内容复制到 `docs` 并提交。`vite.config.js` 使用相对路径，适配仓库子路径。

编辑内容和上传照片只保存在当前浏览器（Local Storage / IndexedDB）。其他人打开公开网址不会看到这些本地照片；公开仓库也不应放入未获授权的儿童照片。要分享完整影片，需要另外设计照片的发布方式。
