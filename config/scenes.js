/*
 * 场景内容入口：替换 pointCloud / video 即可接入自己的文件。
 * 所有资源路径相对于 index.html，不是相对于本配置文件。
 * 新增场景：复制一个对象到 scenes 数组，使用唯一 id，按钮会自动生成。
 * 删除场景：删除对应对象。排序：调整数组顺序。
 */
window.VIEWER_CONFIG = {
  title: 'Dense point clouds from uncalibrated monocular video',
  description: 'Select a scene to view its colored point cloud and corresponding video. Drag to rotate and scroll to zoom. Scenes marked “Demo” are for interaction previews only.',
  defaultScene: 'room85',

  // 全局默认值；单个场景可填写同名选项覆盖。
  defaults: {
    maxPoints: 2000000,
    camera: { distance: 16, pitch: 0.15, yaw: 0 }, // 角度单位为弧度。
    playback: { autoplay: true, loop: true, muted: true }
  },

  scenes: [
    {
      id: 'room85',
      title: 'Room 85',
      description: 'RGB point cloud',
      color: '#22d3ee',
      pointCloud: 'room-85.ply', // 替换此处：二进制 PLY 文件路径。
      video: 'room-85.mp4',     // 替换此处：视频文件路径；无视频填空字符串。
      poster: '',              // 可选：视频封面图片路径。
      maxPoints: 20000000,     // 保留目前为 Room 85 设置的点数上限。
      camera: { distance: 16, pitch: -1.7, yaw: 0 },
      // 按显示顺序填写，可自由增删；未知信息不必填写。
      metadata: [
        { label: 'Sequence', value: 'Room 85' },
        { label: 'Keyframe groups', value: '—' },
        { label: 'Backbone', value: 'Depth Anything 3' },
        { label: 'Intrinsics', value: 'Not required' },
        { label: 'Loop closure', value: 'Verified' }
      ]
    },
    {
      id: 'room20',
      title: 'Room 20',
      description: 'RGB point cloud',
      color: '#22d3ee',
      pointCloud: 'room-85.ply', // 替换此处：二进制 PLY 文件路径。
      video: 'room-85.mp4',     // 替换此处：视频文件路径；无视频填空字符串。
      poster: '',              // 可选：视频封面图片路径。
      maxPoints: 20000000,     // 保留目前为 Room 85 设置的点数上限。
      camera: { distance: 16, pitch: 0.15, yaw: 0 },
      // 按显示顺序填写，可自由增删；未知信息不必填写。
      metadata: [
        { label: 'Sequence', value: 'Room 85' },
        { label: 'Keyframe groups', value: '—' },
        { label: 'Backbone', value: 'Depth Anything 3' },
        { label: 'Intrinsics', value: 'Not required' },
        { label: 'Loop closure', value: 'Verified' }
      ]
    },
    // 以下三个为可删除的合成示例。
    // 换成真实数据时：删除 demo，添加 pointCloud 和 video，其余字段照常使用。
    {
      id: 'aerial', title: 'Aerial', description: 'Demo · drone footage',
      color: '#5b9eff', demo: 'aerial',
      camera: { distance: 15.5, pitch: 0.52, yaw: 0.6 },
      metadata: [{ label: 'Sequence', value: 'Aerial · demo' }]
    },
    {
      id: 'forest', title: 'Forest', description: 'Demo · handheld capture',
      color: '#34d399', demo: 'forest',
      camera: { distance: 14, pitch: 0.24, yaw: 0.85 },
      metadata: [{ label: 'Sequence', value: 'Forest · demo' }]
    },
    {
      id: 'office', title: 'Indoor Office', description: 'Demo · complex layout',
      color: '#a78bfa', demo: 'office',
      camera: { distance: 11.5, pitch: 0.28, yaw: 0.9 },
      metadata: [{ label: 'Sequence', value: 'Office · demo' }]
    }
  ]
};
