# 解题流程：Jev 作为第一道关卡

```
学生在网页输入题目
        │  POST /api/solve（密钥只在服务器）
        ▼
① 预处理（程序）   找出所有“数值+单位”，换算成国际单位；拆分小问；检测“如图”
        │
        ▼
② Jev 第一道关卡   一次请求，同时回答：
        │           · 题型（Choice，15 个候选模板）
        │           · 每个物理量的角色（Choice，候选只含量纲匹配的角色）
        │           · 模板前提是否成立（Noul）
        │           · 对象类型：货车/汽车/自行车…，质子/电子…（Choice）
        │           · 是否缺图、是否有模板外的附加过程、是否是物理题（Noul）
        ▼
③ 路由（程序）     题型置信度 ≥ 60%、角色置信度 ≥ 50%、前提成立、
        │           量纲一致、无角色冲突、必要条件齐全 → 走模板
        │           否则 → 兜底
        ├──────────────► ④′ 大模型文字讲解（配置了 LLM 时）→ 黑板场景
        │                   未配置 → 标记“需老师审核”，写入 server/logs/solves.jsonl
        ▼
④ 模板求解器（程序）计算全部中间量；自检（位移相等、速度不超限、分速度平方和…）
        │           物理上不可能（如最大速度 ≤ 前车速度）→ 兜底并给出原因
        ▼
⑤ 讲解脚本（程序）  每步 { mark, title, say 旁白, math 公式, t0–t1 动画区间 }
        │           旁白和公式里的数字全部来自求解器
        ▼
⑥ 3D 场景按脚本播放：mark 决定镜头、标注和图像；数值决定车辆、路程牌、坐标轴范围
```

分工原则：**Jev 只做“选择”，不做计算，也不生成文字**。候选项全部由程序给出（例如一个 `m/s²` 的量只会被问“是追赶者的加速度，还是其他”），数值计算和讲解词由程序根据模板生成，因此答案可复现、可检验。

## Jev 请求示例

一道追及题约 11–13 个问题、5 KB（约 1.5K token），按 $0.042 / 百万 token 计，每题约 0.00006 美元；延迟 70–500 ms。

```json
{
  "model": "jev-1.13.0",
  "state": {
    "problem": "一辆货车以 10 m/s 的速度匀速行驶，经过停在路边的警车时……",
    "given_quantities": [
      { "id": "q0", "value": "10 m/s", "dimension": "velocity", "context": "一辆货车以 10 m/s 的速度匀速行驶，经过" },
      { "id": "q2", "value": "2.5 m/s^2", "dimension": "acceleration", "context": "…" }
    ]
  },
  "questions": {
    "template": { "type": "choice", "instructions": "Which physical model …?", "criteria": { "pursuit": "Pursuit on a straight road …", "magnetic_helix": "…", "projectile": "…", "other": "…" } },
    "role_q0": { "type": "choice", "instructions": "What does the given quantity q0 (\"10 m/s\" …) represent?", "criteria": { "lead_speed": "…", "chaser_vmax": "…", "particle_speed": "…", "other": "…" } },
    "cond_start_same_point": { "type": "noul", "instructions": "The chasing object starts from rest at the same position …" },
    "obj_lead": { "type": "choice", "instructions": "…", "criteria": { "truck": "货车 truck / lorry", "car": "…", "bike": "…" } },
    "flag_needs_figure": { "type": "noul", "instructions": "Essential information … is only in a figure …" }
  }
}
```

页面“流程追踪（教师视图）”里可以看到每道题完整的请求、Jev 的回答和各步耗时。

## 配置

| 环境变量 | 作用 |
| --- | --- |
| `TYPESAFE_API_KEY` | Jev 密钥（console.typesafe.ai）。未设置时使用本地模拟判断 |
| `JEV_MODEL` | 默认 `jev-1.13.0`；固定版本，避免模型升级后门槛失准 |
| `JEV_TIMEOUT_MS` | 默认 8000。Jev 超时或出错时自动改用本地模拟判断，课堂不中断，追踪里会注明 |
| `LLM_API_KEY` / `LLM_MODEL` / `LLM_BASE_URL` | 可选，OpenAI 兼容接口，用于无模板题型的文字讲解 |
| `PORT` / `RATE_PER_MIN` | 端口（默认 8787）/ 每个 IP 每分钟最多请求数（默认 30） |

## 新增一个模板

1. `src/engine/templates.js`：登记模板的英文描述（给 Jev）、中文名、用到的角色、前提条件、对象类型；新角色写进 `ROLES`（带量纲）。
2. `src/engine/solvers/xxx.js`：写 `solve(params)`、`checks(params, derived)`、`script(params, derived, names)`，每步带 `mark`。
3. `src/problems/xxx.js`：写 `createXxxProblem({ params, derived, steps })`，按 `mark` 安排镜头与标注；在 `src/problems/fromResult.js` 注册。
4. `src/engine/samples.js` 加示例题，`npm run solve` 回归。

## 需要注意

- Jev 官方说明以英文为主，中文题准确率会低一些。因此：问题和选项描述用英文、题目原文用中文；候选项由程序按量纲预先筛选；门槛偏保守，拿不准就兜底。
- **上线前建议校准门槛**：准备 100–200 道标注过题型和物理量角色的真题，在配置好密钥后批量运行 `npm run solve`，统计各置信度区间的正确率，再调整 `router.js` 里的 `THRESHOLDS`。
- 本地模拟判断只是关键词规则，用于演示和离线；正式判断以 Jev 为准。
- Jev 只接受文字，题目里的图需要老师补成文字（系统会用 `flag_needs_figure` 拦下来）。
