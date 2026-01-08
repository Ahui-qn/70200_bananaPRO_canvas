# 需求文档

## 简介

本功能为画布应用添加撤回（Undo）和重做（Redo）功能，允许用户快速撤销误操作（如误删图片、误移动图片等），并支持重做已撤销的操作。该功能提升用户体验，减少误操作带来的困扰。

## 术语表

- **Undo_System**: 撤回系统，负责记录、管理和执行撤回/重做操作的核心模块
- **Action**: 操作记录，表示用户在画布上执行的一个可撤回的操作
- **Action_Stack**: 操作栈，存储操作历史记录的数据结构
- **Canvas_App**: 画布应用，用户进行图片生成和管理的主界面
- **Image**: 画布上的图片对象

## 需求

### 需求 1：操作记录

**用户故事：** 作为用户，我希望系统能自动记录我在画布上的操作，以便我可以在需要时撤回这些操作。

#### 验收标准

1. WHEN 用户删除一张或多张图片 THEN Undo_System SHALL 记录删除操作，包含被删除图片的完整信息
2. WHEN 用户移动一张或多张图片 THEN Undo_System SHALL 记录移动操作，包含图片的原始位置和新位置
3. WHEN 用户批量移动多张图片 THEN Undo_System SHALL 将其记录为单个操作，以便一次性撤回
4. THE Undo_System SHALL 限制操作历史记录的最大数量为 50 条，超出时自动删除最早的记录

### 需求 2：撤回操作

**用户故事：** 作为用户，我希望能够撤回最近的操作，以便在误操作时快速恢复。

#### 验收标准

1. WHEN 用户按下 Ctrl+Z（Mac 上为 Cmd+Z）THEN Undo_System SHALL 撤回最近一次操作
2. WHEN 用户点击撤回按钮 THEN Undo_System SHALL 撤回最近一次操作
3. WHEN 撤回删除操作 THEN Undo_System SHALL 恢复被删除的图片到原来的位置
4. WHEN 撤回移动操作 THEN Undo_System SHALL 将图片恢复到移动前的位置
5. IF 没有可撤回的操作 THEN Undo_System SHALL 禁用撤回按钮并忽略撤回快捷键

### 需求 3：重做操作

**用户故事：** 作为用户，我希望能够重做已撤回的操作，以便在撤回过多时恢复。

#### 验收标准

1. WHEN 用户按下 Ctrl+Shift+Z 或 Ctrl+Y（Mac 上为 Cmd+Shift+Z）THEN Undo_System SHALL 重做最近一次被撤回的操作
2. WHEN 用户点击重做按钮 THEN Undo_System SHALL 重做最近一次被撤回的操作
3. WHEN 重做删除操作 THEN Undo_System SHALL 再次删除之前恢复的图片
4. WHEN 重做移动操作 THEN Undo_System SHALL 将图片移动到之前的目标位置
5. IF 没有可重做的操作 THEN Undo_System SHALL 禁用重做按钮并忽略重做快捷键
6. WHEN 用户执行新操作后 THEN Undo_System SHALL 清空重做栈

### 需求 4：用户界面

**用户故事：** 作为用户，我希望能够直观地看到撤回/重做功能的状态，以便了解是否可以执行这些操作。

#### 验收标准

1. THE Canvas_App SHALL 在工具栏显示撤回和重做按钮
2. WHEN 有可撤回的操作时 THEN Canvas_App SHALL 启用撤回按钮并显示正常状态
3. WHEN 没有可撤回的操作时 THEN Canvas_App SHALL 禁用撤回按钮并显示灰色状态
4. WHEN 有可重做的操作时 THEN Canvas_App SHALL 启用重做按钮并显示正常状态
5. WHEN 没有可重做的操作时 THEN Canvas_App SHALL 禁用重做按钮并显示灰色状态
6. WHEN 用户将鼠标悬停在撤回按钮上 THEN Canvas_App SHALL 显示提示文字"撤回 (Ctrl+Z)"
7. WHEN 用户将鼠标悬停在重做按钮上 THEN Canvas_App SHALL 显示提示文字"重做 (Ctrl+Shift+Z)"

### 需求 5：数据持久化

**用户故事：** 作为用户，我希望撤回操作能够正确处理已持久化的数据，以便撤回后数据状态一致。

#### 验收标准

1. WHEN 撤回删除操作 THEN Undo_System SHALL 调用后端 API 恢复图片记录
2. WHEN 撤回移动操作 THEN Undo_System SHALL 更新图片在数据库中的位置信息
3. IF 撤回操作的 API 调用失败 THEN Undo_System SHALL 显示错误提示并保持当前状态
4. WHEN 重做删除操作 THEN Undo_System SHALL 调用后端 API 删除图片记录
5. WHEN 项目切换时 THEN Undo_System SHALL 清空当前项目的操作历史

### 需求 6：边界情况处理

**用户故事：** 作为用户，我希望撤回系统能够正确处理各种边界情况，以便系统稳定可靠。

#### 验收标准

1. IF 撤回恢复的图片位置已被其他图片占用 THEN Undo_System SHALL 仍将图片恢复到原位置（允许重叠）
2. WHEN 用户快速连续按下撤回快捷键 THEN Undo_System SHALL 依次撤回多个操作而不产生冲突
3. IF 撤回操作涉及的图片已被永久删除（如从回收站清空）THEN Undo_System SHALL 跳过该操作并显示提示
4. WHEN 页面刷新或重新加载时 THEN Undo_System SHALL 清空操作历史（不持久化操作历史）
