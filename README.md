# 武理沪联

面向在沪武汉理工大学校友的微信小程序，用于分享内推、职业经验等资源，发布求助需求，以及向信息发布者申请联系。

## 功能

- **首页**：浏览、搜索和筛选校友发布的资源与需求，查看详情和收藏。
- **发布**：填写资源或需求，设置分类、地区和有效期。云端模式下，提交成功后会在校友广场展示。
- **消息**：查看收到和发出的联系申请，按需同意或拒绝。
- **我的**：查看自己的发布、收藏和联系记录，提交待审核的校友认证资料。

## 本地运行

1. 用微信开发者工具导入仓库根目录。
2. 如果需要重建 npm 组件，在根目录运行 `npm install`，然后在开发者工具中选择「工具 → 构建 npm」。
3. 在 [config/alumni-cloud.js](config/alumni-cloud.js) 选择运行模式，再点击「编译」。

| 模式 | 配置 | 数据来源 |
| --- | --- | --- |
| 本地演示 | `alumniCloudEnabled = false` | 示例数据和当前设备的本地存储，无需配置后端 |
| 云端模式（仓库默认） | `alumniCloudEnabled = true`，`alumniApiUrl` 填写网关接口地址 | CloudBase 云数据库，发布和联系申请会真实入库 |

使用自己的小程序账号接入时，在微信开发者工具中选择对应的 AppID，并完成下面的后端配置。

## 后端配置

前端使用微信原生小程序的 WXML、WXSS 和 JavaScript。小程序通过 `wx.login` 获取临时登录码，再通过 HTTPS 调用 Node.js 云函数。云函数向微信校验身份，并使用 `wx-server-sdk` 读写 CloudBase 托管的 PostgreSQL 文档数据库。

1. 在 CloudBase 的 PostgreSQL 环境中开启文档数据库能力（`pgdoc`），创建 `alumni_records` 集合，并设为仅管理员可读写。小程序通过云函数访问。
2. 将 [cloudfunctions/alumni](cloudfunctions/alumni/) 部署为 Node.js 20 普通云函数，入口为 `index.main`。在云函数环境变量中配置 `WX_APPID` 和 `WX_SECRET`。小程序密钥只填在服务端环境变量中。
3. 在 CloudBase HTTP 网关配置 `/api/alumni` 路由，指向 `alumni` 云函数。在 [config/alumni-cloud.js](config/alumni-cloud.js) 填写包含该路径的完整 HTTPS 地址。
4. 在微信公众平台的「开发管理 → 开发设置 → 服务器域名」中，把网关的 HTTPS 域名加入「request 合法域名」。此处只填写域名，接口路径保留在小程序配置中。 [腾讯云域名配置说明](https://docs.cloudbase.net/recipes/fix-auth-wechat-miniprogram)

维护项目时，可在 CloudBase 控制台的「PostgreSQL → 文档编辑器 → alumni_records」查看数据，按 `recordType` 筛选发布（`post`）、联系申请（`contact`）、收藏（`favorite`）或认证申请（`verification`）。

## 体验版

在微信开发者工具点击「上传」，然后到微信公众平台的「版本管理 → 开发版本」将该版本设为体验版。通过「成员管理」添加体验成员后，即可分享体验版二维码。体验版使用代码中配置的数据来源。使用当前云端配置时，体验成员的发布会进入同一个校友广场。
