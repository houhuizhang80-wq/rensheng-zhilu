# 人生之路

一款人生模拟游戏：从创建角色开始，走过一段可自选方向的人生。

## 在线试玩

<https://houhuizhang80-wq.github.io/rensheng-zhilu/>

> 根目录的 `index.html` 只是一个跳转壳，会自动进入 `www/` 下的主程序。

## 本地游玩

```
双击 www/index.html
```

直接双击仓库根目录的 `index.html` 也可以，它会自动跳转到主程序。

## 目录结构

```
人生之路/
├── index.html          # 跳转页（337 字节）
└── www/
    ├── index.html      # 主程序入口
    ├── entry.js        # 游戏主逻辑（打包后，约 6.5 MB）
    ├── local-backend.js    # 本地离线后端模拟层
    ├── local-handlers.js   # 离线数据处理器
    └── web.css         # 样式
```

## 技术说明

- 前端单页应用，全部逻辑打包在 `www/entry.js` 里。
- **完全离线可玩**：仓库内置了一套本地后端模拟层（`local-backend.js` +
  `local-handlers.js`），会拦截原本要发给服务器的请求并在本地模拟响应，
  数据全部保存在浏览器里，不需要联网、不需要账号。
- 无构建步骤，直接用浏览器打开即可。

## 备注

存档保存在浏览器本地存储中，清理浏览器数据会导致进度丢失。
