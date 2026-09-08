# 月森守卫

手机触控塔防小游戏：8 波敌人，三种防御塔，升级/回收，月霜技能，暂停、两倍速及胜负重开。

- `npm install`
- `npm run dev`
- `npm test` 验证经济、建造边界、移动、暂停、技能冷却、战斗及完整胜负流程。
- `npm run build`

战斗进度仅保留在当前页面，刷新会重新开始。音效默认关闭，点击声音按钮开启操作提示音。

WebMCP 在支持 document.modelContext 的浏览器注册 read_defense 与 command_defense，复用游戏规则。当前环境未提供可用的 WebMCP 验证上下文，未执行该接口的浏览器契约验证。
