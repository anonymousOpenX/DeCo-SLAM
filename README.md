# 页面内容维护

页面已恢复为原来的深色布局：左侧点云、右侧视频，顶部按钮切换场景。

在项目根目录启动服务：

```bash
python3 -m http.server 8000
```

访问 http://localhost:8000 。双击 HTML 可查看正文，但浏览器会限制本地 PLY 读取。

## 文件职责

| 文件 | 修改内容 |
| --- | --- |
| `index.html` | 标题、作者、论文链接、摘要、方法图、实验结果和结论 |
| `config/scenes.js` | 点云/视频路径、名称、说明、元数据、初始视角、点数上限和播放选项 |
| `assets/css/site.css` | 深色样式、布局和移动端适配 |
| `assets/js/page.js` | 阶段卡片展开、返回顶部 |
| `assets/js/viewer.js` | WebGL 绘制、场景切换、视频播放和鼠标交互 |
| `assets/js/ply-worker.js` | PLY 后台流式解析与抽样 |
| `assets/js/demo-scenes.js` | 可删除的合成示例与模拟视频 |

## 替换或新增场景

在 `config/scenes.js` 的 `scenes` 数组中修改或复制场景对象：

```js
{
  id: 'room02',
  title: 'Room 02',
  description: '填写采集环境或重建说明',
  color: '#34d399',
  pointCloud: 'media/room02/cloud.ply',
  video: 'media/room02/video.mp4',
  poster: '',
  maxPoints: 2000000,
  camera: { distance: 16, pitch: 0.15, yaw: 0 },
  metadata: [
    { label: 'Sequence', value: 'Room 02' }
  ]
}
```

路径相对于 **index.html**；`id` 不能重复。场景按钮、视频和信息自动生成，不必改动渲染代码。删除对象即可移除场景，调整数组顺序即可排序，`defaultScene` 指定初始场景。

无视频时填写 `video: ''`。将合成场景改为真实场景时，删除 `demo` 并添加 `pointCloud` 和 `video`。

## 交互和播放

- 拖动旋转、滚轮缩放，点击“重置视角”恢复场景的相机配置。
- `camera.pitch` 和 `camera.yaw` 为弧度；点云自动居中并统一缩放，`distance` 越小越近。
- `maxPoints` 是抽样上限。Room 85 和 Room 20 保留当前 2,000 万上限；设备较慢时可调低。Room 20 目前仍引用 Room 85 文件，后续可直接替换路径。
- `playback: { autoplay: true, loop: true, muted: true }` 控制自动播放、循环与静音，可按场景覆盖全局 `defaults.playback`。浏览器可能限制有声自动播放。
- 页面自动加载默认场景。仍需完整下载 PLY；抽样降低内存和绘制负担，不减少下载量。每个保留点的坐标/颜色数组约 15 字节，GPU 还需要对应缓冲区。

## 格式与缓存

支持二进制小端或大端 PLY，`vertex` 必须是第一个元素，包含标量 `x/y/z`；可选 `red/green/blue` 为 0–255 颜色。支持常见整数、float、double 顶点属性；不支持 ASCII PLY 或顶点 list 属性。只显示顶点，不渲染面。

缓存只保留最近完成的一份点云，以文件路径和点数上限区分。切换场景会取消正在进行的旧加载。更换同名资源后可强制刷新页面。
