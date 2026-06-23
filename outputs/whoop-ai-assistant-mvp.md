# WHOOP AI 身体状态助手 MVP

## 目标

为个人使用打造一个手机端身体状态助手，把 WHOOP 数据转成每天可读、可问、可行动的建议。

第一版先做 Web/PWA，后续可复用同一个后端迁移到微信小程序。

## 第一版范围

### 1. Today 首页

展示今天最重要的身体状态：

- Recovery 分数
- Sleep 表现
- Strain
- HRV
- Resting Heart Rate
- 今日训练建议

训练建议分为四档：

- Push：适合高强度训练
- Build：正常训练
- Light：轻量训练或 Zone 2
- Rest：恢复、拉伸、补睡眠

### 2. 7 天趋势

展示最近 7 天：

- Recovery 趋势
- Sleep 趋势
- Strain 趋势
- HRV 趋势

第一版重点回答：

- 高 Strain 是否影响第二天 Recovery
- 睡眠不足是否拉低 HRV
- 最近是否存在连续疲劳

### 3. AI 问答

用户可以用自然语言提问：

- 今天适合练什么？
- 我最近为什么恢复差？
- 这周训练量是不是太高？
- 哪些天我睡得好但恢复还是低？
- 帮我总结本周身体状态。

AI 回答只基于已同步的 WHOOP 数据，不做医疗诊断。

### 4. 每日 Briefing

每天生成一句简短总结：

> 今天恢复偏低，HRV 低于近期均值，昨晚睡眠不足。建议降低训练强度，优先补睡眠或做轻有氧。

## 推荐技术架构

```text
手机 Web/PWA
    ↓
后端 API
    ↓
数据库
    ↓
WHOOP API
    ↓
OpenAI 分析层
```

## 技术选型

### 前端

- Next.js 或 React
- 手机优先设计
- 后续可迁移到微信小程序 / Taro / uni-app

### 后端

- Node.js / Next.js API routes，或 Python FastAPI
- 负责 WHOOP OAuth、数据同步、AI 分析

### 数据库

第一版：

- SQLite

后续：

- Postgres / Supabase

### AI

- OpenAI API
- 使用结构化 WHOOP 数据生成简短建议、趋势解释和问答

## 数据模型草案

### user

```text
id
whoop_user_id
created_at
timezone
```

### whoop_token

```text
user_id
access_token_encrypted
refresh_token_encrypted
expires_at
created_at
updated_at
```

### daily_metric

```text
id
user_id
date
recovery_score
strain_score
sleep_score
hrv_rmssd
resting_heart_rate
sleep_duration_minutes
sleep_need_minutes
respiratory_rate
created_at
updated_at
```

### workout

```text
id
user_id
whoop_workout_id
start_time
end_time
sport_name
strain_score
average_heart_rate
max_heart_rate
calories
created_at
updated_at
```

### ai_briefing

```text
id
user_id
date
readiness_level
summary
recommendation
created_at
```

## API 设计草案

### Auth

```text
GET /api/whoop/connect
GET /api/whoop/callback
POST /api/whoop/disconnect
```

### Sync

```text
POST /api/sync/whoop
GET /api/sync/status
```

### App Data

```text
GET /api/today
GET /api/trends?days=7
GET /api/workouts?days=30
```

### AI

```text
POST /api/ai/briefing
POST /api/ai/chat
```

## AI 输入结构

AI 不直接访问 WHOOP。后端先整理数据，再传给 AI：

```json
{
  "today": {
    "date": "2026-06-22",
    "recovery_score": 42,
    "strain_score": 11.8,
    "sleep_score": 68,
    "hrv_rmssd": 48,
    "resting_heart_rate": 58
  },
  "last_7_days": [
    {
      "date": "2026-06-21",
      "recovery_score": 55,
      "strain_score": 14.2,
      "sleep_score": 72,
      "hrv_rmssd": 52
    }
  ],
  "question": "今天适合高强度训练吗？"
}
```

## AI 回答规则

AI 应该：

- 简短直接
- 给出原因
- 给出行动建议
- 明确不做医疗诊断
- 不夸大单日数据
- 优先比较用户自己的近期趋势，而不是通用标准

示例：

```text
今天不太适合冲高强度。你的恢复分偏低，HRV 低于最近 7 天均值，同时昨晚睡眠也不够完整。更适合做 Zone 2、技术训练、拉伸或休息。如果你一定要练，建议降低总量和强度。
```

## 微信小程序迁移路径

第一版 Web/PWA 完成后，迁移到小程序时保留：

- 后端 API
- 数据库
- WHOOP OAuth 逻辑
- AI 分析逻辑

只替换前端：

```text
React/PWA 前端 → 微信小程序前端
```

注意点：

- WHOOP token 不放在小程序端
- 小程序只调用自己的后端
- OAuth callback 可能需要通过后端中转
- 微信登录可以后加，个人版第一阶段不必做复杂账号系统

## MVP 开发顺序

1. 搭后端项目和数据库
2. 做 WHOOP OAuth 授权
3. 拉取并保存最近 30 天 WHOOP 数据
4. 做 Today API
5. 做手机端 Today 页面
6. 做 7 天趋势页面
7. 加 AI Briefing
8. 加 AI Chat
9. 再考虑微信小程序版本

## 需要确认的外部事项

- WHOOP Developer App 是否已创建
- OAuth redirect URI 支持的域名
- WHOOP API 当前 endpoint 和字段名
- API rate limit
- 是否能稳定获取 Recovery、Sleep、Strain、Workout 数据
- 部署环境是否需要公网 HTTPS

## 第一版完成标准

当你每天早上打开手机，可以看到：

- 今天身体状态
- 今天训练建议
- 最近 7 天趋势
- 可以问 AI 一个关于自己 WHOOP 数据的问题

这就算第一版成功。
