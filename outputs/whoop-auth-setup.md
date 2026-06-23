# WHOOP 授权接入步骤

## 你需要先准备

1. 登录 WHOOP Developer Dashboard  
   https://developer-dashboard.whoop.com

2. 创建一个 App

3. 记录以下信息：

```text
WHOOP_CLIENT_ID=
WHOOP_CLIENT_SECRET=
WHOOP_REDIRECT_URI=
```

`CLIENT_SECRET` 只能放在后端环境变量里，不能放进网页、小程序或前端代码。

## Redirect URI

开发阶段建议先用：

```text
http://localhost:3000/api/whoop/callback
```

如果 WHOOP Dashboard 不接受 localhost，就用一个 HTTPS 开发地址，例如 ngrok / Cloudflare Tunnel：

```text
https://your-dev-domain.example.com/api/whoop/callback
```

上线后再换成正式域名：

```text
https://your-domain.com/api/whoop/callback
```

## 推荐 Scope

第一版建议申请：

```text
read:profile
read:recovery
read:cycles
read:sleep
read:workout
read:body_measurement
offline
```

说明：

- `read:profile`：确认用户身份
- `read:recovery`：读取 Recovery、HRV、静息心率
- `read:cycles`：读取日周期和 Strain
- `read:sleep`：读取睡眠数据
- `read:workout`：读取训练数据
- `read:body_measurement`：读取身高、体重、最大心率等
- `offline`：获取 refresh token，用于自动同步

如果想最小权限起步，可以先用：

```text
read:profile
read:recovery
read:cycles
read:sleep
offline
```

## OAuth 地址

WHOOP Authorization URL：

```text
https://api.prod.whoop.com/oauth/oauth2/auth
```

WHOOP Token URL：

```text
https://api.prod.whoop.com/oauth/oauth2/token
```

## 授权流程

1. 用户点击“连接 WHOOP”
2. 后端生成授权 URL
3. 用户跳到 WHOOP 登录并授权
4. WHOOP 跳回 `/api/whoop/callback?code=...&state=...`
5. 后端用 `code` 换 `access_token` 和 `refresh_token`
6. 后端加密保存 token
7. 后端开始同步 WHOOP 数据

## 连接 WHOOP 的授权 URL 形状

```text
https://api.prod.whoop.com/oauth/oauth2/auth
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=YOUR_REDIRECT_URI
  &response_type=code
  &scope=read:profile read:recovery read:cycles read:sleep read:workout offline
  &state=RANDOM8
```

注意：`state` 用来防 CSRF。WHOOP 文档说明如果自己生成 state，需要 8 个字符。

## Token Refresh

Access token 会过期。后端需要用 refresh token 换新 token：

```json
{
  "grant_type": "refresh_token",
  "refresh_token": "REFRESH_TOKEN",
  "client_id": "CLIENT_ID",
  "client_secret": "CLIENT_SECRET",
  "scope": "offline"
}
```

WHOOP 刷新 token 后，旧 refresh token 会失效。因此数据库里必须用新返回的 refresh token 覆盖旧值。

## 第一版实现建议

先做这 4 个后端接口：

```text
GET /api/whoop/connect
GET /api/whoop/callback
POST /api/whoop/sync
GET /api/today
```

然后再做前端页面：

```text
/              Today 页面
/connect       连接 WHOOP 状态页
/chat          AI 问答页
```

## 当前要向你确认的信息

要进入真实接入，你只需要提供：

```text
WHOOP_CLIENT_ID
WHOOP_CLIENT_SECRET
WHOOP_REDIRECT_URI
```

不要直接把 secret 发到公开地方。开发时可以放进本地 `.env.local`。

## 官方参考

- WHOOP Developer Platform: https://developer.whoop.com/
- OAuth 2.0 Docs: https://developer.whoop.com/docs/developing/oauth/
- API Docs: https://developer.whoop.com/api/
