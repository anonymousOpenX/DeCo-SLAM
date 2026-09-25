// Rendering and interaction. Edit config/scenes.js to change content.
(function () {
'use strict';
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function cross(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }
  function norm3(a) {
    var l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }
  function fmtTime(sec) {
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  var config = window.VIEWER_CONFIG || {};
  var sceneList = Array.isArray(config.scenes) ? config.scenes : [];
  var defaults = config.defaults || {};
  var SCENES = Object.create(null);
  var tabs = document.getElementById('sceneTabs');
  document.getElementById('viewerTitle').textContent = config.title || 'Reconstruction';
  document.getElementById('viewerDescription').textContent = config.description || '';
  try {
    sceneList.forEach(function (entry) {
      if (!entry.id || SCENES[entry.id]) throw new Error('Scene IDs are required and must be unique');
      ['pointCloud', 'video', 'poster'].forEach(function (field) {
        if (entry[field] != null && typeof entry[field] !== 'string')
          throw new Error(entry.id + ': ' + field + ' must be a path string');
      });
      if (entry.metadata != null && (!Array.isArray(entry.metadata) || entry.metadata.some(function (item) {
        return !item || typeof item.label !== 'string' || item.value == null;
      }))) throw new Error(entry.id + ': metadata must be an array of objects with label and value fields');
      var demo = entry.demo ? (window.DEMO_SCENES || {})[entry.demo] : null;
      if (!entry.pointCloud && !demo) throw new Error(entry.id + ': provide a pointCloud path or a valid demo');
      var camera = Object.assign({distance:16, pitch:0.15, yaw:0}, defaults.camera, entry.camera);
      var budget = entry.maxPoints ?? defaults.maxPoints ?? 2000000;
    if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(entry.id + ': maxPoints must be a positive integer');
      if (![camera.distance, camera.pitch, camera.yaw].every(Number.isFinite) || camera.distance <= 0)
        throw new Error(entry.id + ': invalid camera settings');
      var s = Object.assign({}, demo, {
        name: entry.title || entry.id, sub: entry.description || '',
        ply: entry.pointCloud || '', videoUrl: entry.video || '',
        poster: entry.poster || '', maxPoints: budget,
        metadata: entry.metadata || [],
        playback: Object.assign({autoplay:true, loop:true, muted:true}, defaults.playback, entry.playback),
        dist: camera.distance, rotX: camera.pitch, rotY: camera.yaw,
        simulatedVideo: !entry.video && !entry.pointCloud && !!demo
      });
      SCENES[entry.id] = s;
      var button = document.createElement('button');
      button.className = 'scene-tab'; button.type = 'button';
      button.dataset.scene = entry.id;
      button.setAttribute('aria-pressed', 'false');
      var swatch = document.createElement('span'); swatch.className = 'swatch';
      swatch.style.backgroundColor = entry.color || '#22d3ee';
      button.append(swatch, document.createTextNode(' ' + s.name));
      tabs.appendChild(button);
    });
    if (!sceneList.length) throw new Error('Add at least one scene in config/scenes.js');
  } catch (error) {
    document.getElementById('plyStatus').textContent = 'Scene configuration error: ' + error.message;
    return;
  }
  var defaultScene = SCENES[config.defaultScene] ? config.defaultScene : sceneList[0].id;
  var stage = document.getElementById('viewerStage');
  var canvas = document.getElementById('pcCanvas');
  var gl = canvas.getContext('webgl', {alpha: true, antialias: false});
  if (!gl) {
    document.getElementById('plyStatus').textContent = 'This viewer requires WebGL. Enable browser hardware acceleration and reload the page.';
    return;
  }
  var gpuCount = 0, gpuData = null;
  var positionBuffer, colorBuffer, program;
  function setupGPU() {
    function shader(type, source) {
      var item = gl.createShader(type);
      gl.shaderSource(item, source); gl.compileShader(item);
      if (!gl.getShaderParameter(item, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(item));
      return item;
    }
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `
      attribute vec3 position;
      attribute vec3 color;
      uniform vec2 rotation;
      uniform vec2 viewport;
      uniform float distance;
      uniform float focal;
      uniform float pixelRatio;
      varying vec3 vColor;
      void main() {
        float cy = cos(rotation.y), sy = sin(rotation.y);
        float cx = cos(rotation.x), sx = sin(rotation.x);
        vec3 p = vec3(position.x*cy + position.z*sy, position.y, -position.x*sy + position.z*cy);
        float y = p.y*cx - p.z*sx;
        float depth = distance - (p.y*sx + p.z*cx);
        float near = 0.1, far = 100.0;
        gl_Position = vec4(2.0*focal*p.x/viewport.x, 2.0*focal*y/viewport.y,
          (far+near)/(far-near)*depth - 2.0*far*near/(far-near), depth);
        gl_PointSize = clamp(22.0 / max(depth, near), 1.2, 3.0) * pixelRatio;
        vColor = color;
      }
    `));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec3 vColor;
      void main() {
        vec2 delta = gl_PointCoord - vec2(0.5);
        if (dot(delta, delta) > 0.25) discard;
        gl_FragColor = vec4(vColor, 1.0);
      }
    `));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);
    positionBuffer = gl.createBuffer(); colorBuffer = gl.createBuffer();
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
  }
  function uploadCloud(data) {
    gpuData = data;
    gpuCount = data.count;
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.positions, gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, data.colors, gl.STATIC_DRAW);
    loc = gl.getAttribLocation(program, 'color');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.UNSIGNED_BYTE, true, 0, 0);
  }
  function uploadDemo(cloud) {
    var positions = new Float32Array(cloud.length * 3), colors = new Uint8Array(cloud.length * 3);
    var colorCanvas = document.createElement('canvas'); colorCanvas.width = colorCanvas.height = 1;
    var colorContext = colorCanvas.getContext('2d', {willReadFrequently: true});
    cloud.forEach(function (p, i) {
      positions.set([p.x, p.y, p.z], i*3);
      colorContext.fillStyle = p.c; colorContext.fillRect(0, 0, 1, 1);
      colors.set(colorContext.getImageData(0, 0, 1, 1).data.subarray(0, 3), i*3);
    });
    uploadCloud({positions: positions, colors: colors, count: cloud.length});
  }
  setupGPU();
  canvas.addEventListener('webglcontextlost', function (event) {
    event.preventDefault();
    document.getElementById('plyStatus').textContent = 'Graphics context paused. Waiting for it to resume…';
  });
  canvas.addEventListener('webglcontextrestored', function () {
    setupGPU();
    if (gpuData) uploadCloud(gpuData);
    if (SCENES[currentSceneKey].ply && plyCache) showPLYInfo(plyCache.total);
    else document.getElementById('plyStatus').textContent = '';
  });

  var sceneNameEl = document.getElementById('sceneName');
  var sceneSubEl = document.getElementById('sceneSub');
  var ptCountEl = document.getElementById('ptCount');
  var ptCountFootEl = document.getElementById('ptCountFoot');
  var sceneMetadata = document.getElementById('sceneMetadata');
  var hintEl = document.getElementById('viewerHint');
  var resetBtn = document.getElementById('viewerReset');

  var currentSceneKey = defaultScene;
  var points = [];
  var W = 0, H = 0, DPR = 1;

  var rotX = 0.5, rotY = 0.6;
  var targetZoom = 1, zoom = 1;
  var camDist = 15;

  var dragging = false;
  var activePointerId = null;
  var lastX = 0, lastY = 0;
  var velocityY = 0, velocityX = 0;
  var lastInteraction = 0;


  var videoSim = null;

  function resizeCanvas() {
    var rect = stage.getBoundingClientRect();
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = rect.width;
    H = rect.height;
    canvas.width = Math.max(1, Math.round(W * DPR));
    canvas.height = Math.max(1, Math.round(H * DPR));
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  var plyWorker = null, plyCache = null;
  var plyStatus = document.getElementById('plyStatus');
  var sceneVideo = document.getElementById('sceneVideo');
  var videoStatus = document.getElementById('videoStatus');
  sceneVideo.addEventListener('error', function () {
    if (!sceneVideo.hidden && sceneVideo.getAttribute('src')) {
      videoStatus.hidden = false;
      videoStatus.textContent = 'Video failed to load. Check the file path and format.';
    }
  });
  function loadPLY(url, maxPoints) {
    var absoluteURL = new URL(url, document.baseURI).href;
    var cacheKey = absoluteURL + ':' + maxPoints;
    if (plyCache && plyCache.key === cacheKey) { uploadCloud(plyCache); showPLYInfo(plyCache.total); return; }
    if (location.protocol === 'file:') {
    plyStatus.textContent = 'Open this page through an HTTP server: python3 -m http.server 8000, then visit http://localhost:8000';
      return;
    }
    // Keep only the last completed cloud; a scene switch cannot accumulate large arrays.
    plyCache = null;
    var label = SCENES[currentSceneKey].name;
    plyStatus.textContent = 'Loading ' + label + '… 0%';
    var worker;
    try { worker = new Worker(new URL('assets/js/ply-worker.js', document.baseURI)); }
    catch (error) { plyStatus.textContent = 'Could not start the point-cloud loader: ' + error.message; return; }
    plyWorker = worker;
    function fail(message) {
      if (plyWorker !== worker) return;
      plyStatus.textContent = 'Point cloud failed to load: ' + message + '. Check the PLY file and HTTP server, then switch scenes to retry.';
      worker.terminate(); plyWorker = null;
    }
    worker.onmessage = function (event) {
      if (plyWorker !== worker) return;
      var data = event.data;
      if (data.error) { fail(data.error); return; }
      if (data.positions) {
        data.key = cacheKey;
        plyCache = data; uploadCloud(data); showPLYInfo(data.total);
        worker.terminate(); plyWorker = null;
      } else {
        plyStatus.textContent = 'Loading ' + label + '… ' + Math.round(data.progress * 100) + '%';
      }
    };
    worker.onerror = function (event) { fail(event.message || 'Worker unavailable'); };
    worker.postMessage({url: absoluteURL, maxPoints: maxPoints});
  }
  function showPLYInfo(total) {
    plyStatus.textContent = total.toLocaleString() + ' input points · displaying ' + gpuCount.toLocaleString() + ' sampled points';
  }

  function loadScene(key, animate) {
    var s = SCENES[key];
    if (!s) return;

    cancelDrag();
    currentSceneKey = key;
    if (plyWorker) { plyWorker.terminate(); plyWorker = null; }
    plyStatus.textContent = '';
    points = s.ply ? [] : s.gen();
    uploadDemo(points);
    sceneVideo.pause();
    sceneVideo.hidden = !s.videoUrl;
    videoStatus.hidden = true;
    document.querySelector('.video-wrap').hidden = !s.simulatedVideo;
    document.querySelector('.video-bar').hidden = !s.simulatedVideo;
    if (s.videoUrl) {
      sceneVideo.autoplay = s.playback.autoplay;
      sceneVideo.loop = s.playback.loop;
      sceneVideo.muted = s.playback.muted;
      sceneVideo.poster = s.poster;
      sceneVideo.src = s.videoUrl;
      sceneVideo.load();
      if (s.playback.autoplay) sceneVideo.play().catch(function () { /* Native controls remain available. */ });
    } else {
      sceneVideo.removeAttribute('src'); sceneVideo.removeAttribute('poster'); sceneVideo.load();
      if (!s.simulatedVideo) {
        videoStatus.hidden = false; videoStatus.textContent = 'No video is available for this scene.';
      }
    }
    if (s.ply) loadPLY(s.ply, s.maxPoints);
    camDist = s.dist;
    rotX = s.rotX;
    rotY = s.rotY;
    targetZoom = 1;
    zoom = 1;
    velocityX = 0;
    velocityY = 0;
    lastInteraction = performance.now();

    sceneNameEl.textContent = s.name;
    sceneSubEl.textContent = s.sub;
    sceneMetadata.replaceChildren();
    s.metadata.forEach(function (item) {
      var row = document.createElement('div'); row.className = 'side-meta-row';
      var label = document.createElement('span'); label.className = 'smk'; label.textContent = item.label;
      var value = document.createElement('span'); value.className = 'smv'; value.textContent = item.value;
      row.append(label, value); sceneMetadata.appendChild(row);
    });

    document.querySelectorAll('.scene-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.scene === key);
      b.setAttribute('aria-pressed', String(b.dataset.scene === key));
    });

    if (videoSim && s.simulatedVideo) { videoSim.setScene(key, points); videoSim.resize(); }

    if (animate) {
      canvas.style.transition = 'none';
      canvas.style.opacity = '0';
      requestAnimationFrame(function () {
        canvas.style.transition = 'opacity .45s ease';
        canvas.style.opacity = '1';
      });
    }
  }

  var lastTs = 0;

  function render(ts) {
    var dt = lastTs ? Math.min((ts - lastTs) / 1000, 0.1) : 0;
    lastTs = ts;

    if (W && H) {
      var now = performance.now();

      if (!dragging && now - lastInteraction > 2200) {
        rotY += 0.0016;
      }
      if (!dragging) {
        if (Math.abs(velocityY) > 0.0001) {
          rotY += velocityY;
          velocityY *= 0.94;
        }
        if (Math.abs(velocityX) > 0.0001) {
          rotX += velocityX;
          velocityX *= 0.94;
        }
      }

      zoom += (targetZoom - zoom) * 0.12;

      if (!gl.isContextLost()) {
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.uniform2f(gl.getUniformLocation(program, 'rotation'), rotX, rotY);
        gl.uniform2f(gl.getUniformLocation(program, 'viewport'), W, H);
        gl.uniform1f(gl.getUniformLocation(program, 'distance'), camDist);
        gl.uniform1f(gl.getUniformLocation(program, 'focal'), Math.min(W, H) * 1.05 * zoom);
        gl.uniform1f(gl.getUniformLocation(program, 'pixelRatio'), DPR);
        gl.drawArrays(gl.POINTS, 0, gpuCount);
      }
      var countStr = gpuCount.toLocaleString();
      if (ptCountEl.textContent !== countStr) {
        ptCountEl.textContent = countStr;
        ptCountFootEl.textContent = countStr;
      }
    }

    if (videoSim && SCENES[currentSceneKey].simulatedVideo) {
      videoSim.update(dt);
      videoSim.render();
    }

    requestAnimationFrame(render);
  }

  function onPointerDown(e) {
    if (e.target && e.target.closest && e.target.closest('.viewer-reset')) return;
    if (activePointerId !== null || e.button !== 0) return;
    e.preventDefault();
    activePointerId = e.pointerId;

    dragging = true;
    stage.classList.add('grabbing');
    lastX = e.clientX;
    lastY = e.clientY;
    velocityX = 0;
    velocityY = 0;
    lastInteraction = performance.now();
    hintEl.classList.add('hide');
    if (stage.setPointerCapture) {
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    }
  }

  function onPointerMove(e) {
    if (!dragging || e.pointerId !== activePointerId) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    var k = 0.0072;
    rotY += dx * k;
    rotX += dy * k;
    velocityY = dx * k * 0.55;
    velocityX = dy * k * 0.55;
    lastInteraction = performance.now();
  }

  function onPointerUp(e) {
    if (e.pointerId !== activePointerId) return;
    activePointerId = null;
    dragging = false;
    stage.classList.remove('grabbing');
    lastInteraction = performance.now();
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
  }

  function cancelDrag() {
    var pointerId = activePointerId;
    activePointerId = null;
    dragging = false;
    velocityX = velocityY = 0;
    stage.classList.remove('grabbing');
    lastInteraction = performance.now();
    if (pointerId !== null && stage.hasPointerCapture(pointerId)) stage.releasePointerCapture(pointerId);
  }

  function onWheel(e) {
    e.preventDefault();
    var factor = e.deltaY > 0 ? 0.9 : 1.1;
    targetZoom = Math.max(0.45, Math.min(3.2, targetZoom * factor));
    lastInteraction = performance.now();
  }

  stage.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('lostpointercapture', function (e) {
    if (e.pointerId === activePointerId) cancelDrag();
  });
  window.addEventListener('pointercancel', function (e) {
    if (e.pointerId === activePointerId) cancelDrag();
  });
  window.addEventListener('blur', cancelDrag);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) cancelDrag();
  });
  stage.addEventListener('wheel', onWheel, { passive: false });

  resetBtn.addEventListener('pointerdown', function (e) {
    e.stopPropagation();
  });

  resetBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    cancelDrag();
    var s = SCENES[currentSceneKey];
    rotX = s.rotX;
    rotY = s.rotY;
    targetZoom = 1;
    zoom = 1;
    velocityX = 0;
    velocityY = 0;
    dragging = false;
    stage.classList.remove('grabbing');
    lastInteraction = performance.now();
    hintEl.classList.remove('hide');
  });

  /* =========================================================
     5. 视频模拟器
     ========================================================= */
  function VideoSim() {
    this.canvas = document.getElementById('videoCanvas');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.wrap = this.canvas.parentElement;
    this.DPR = 1;
    this.W = 320;
    this.H = 180;
    this.playing = true;
    this.time = 0;
    this.duration = 12;
    this.sceneKey = null;
    this.obsPoints = [];

    this.fillEl = document.getElementById('videoFill');
    this.timeEl = document.getElementById('videoTime');
    this.playBtn = document.getElementById('videoPlayBtn');
    this.trackEl = document.getElementById('videoTrack');
    this.tcEl = document.getElementById('videoTC');
    this.sceneLabelEl = document.getElementById('videoSceneLabel');

    this.resize();
    this.bindControls();
  }

  VideoSim.prototype.resize = function () {
    var rect = this.wrap.getBoundingClientRect();
    this.DPR = Math.min(window.devicePixelRatio || 1, 2);
    this.W = Math.max(1, Math.round(rect.width));
    this.H = Math.max(1, Math.round(rect.height));
    this.canvas.width = Math.round(this.W * this.DPR);
    this.canvas.height = Math.round(this.H * this.DPR);
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);
  };

  VideoSim.prototype.setScene = function (key, pointCloud) {
    this.sceneKey = key;
    this.time = 0;

    var cfg = SCENES[key].video;
    if (this.sceneLabelEl) this.sceneLabelEl.textContent = cfg.label;

    var maxN = 1500;
    var step = Math.max(1, Math.floor(pointCloud.length / maxN));
    this.obsPoints = [];
    for (var i = 0; i < pointCloud.length; i += step) {
      this.obsPoints.push(pointCloud[i]);
    }
  };

  VideoSim.prototype.update = function (dt) {
    if (!this.playing) return;
    this.time += dt;
    if (this.time >= this.duration) this.time = 0;
  };

  VideoSim.prototype.render = function () {
    var ctx = this.ctx;
    var W = this.W, H = this.H;
    if (W < 2 || H < 2) return;

    if (!this.sceneKey || !SCENES[this.sceneKey].simulatedVideo) return;
    var cfg = SCENES[this.sceneKey].video;
    var t = this.time / this.duration;

    var pos = cfg.pos(t);
    var look = cfg.look(t);

    var f = norm3(sub(look, pos));
    var worldUp = [0, 1, 0];
    var r = norm3(cross(f, worldUp));
    var u = cross(r, f);

    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, cfg.bg[0]);
    grad.addColorStop(1, cfg.bg[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    var focal = H * cfg.fov;
    var cx = W / 2, cy = H / 2;

    var buf = [];
    for (var i = 0; i < this.obsPoints.length; i++) {
      var p = this.obsPoints[i];
      var dx = p.x - pos[0];
      var dy = p.y - pos[1];
      var dz = p.z - pos[2];

      var zc = dx * f[0] + dy * f[1] + dz * f[2];
      if (zc <= 0.15) continue;

      var xc = dx * r[0] + dy * r[1] + dz * r[2];
      var yc = dx * u[0] + dy * u[1] + dz * u[2];

      var sx = cx + (xc / zc) * focal;
      var sy = cy - (yc / zc) * focal;

      if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) continue;

      buf.push({ sx: sx, sy: sy, z: zc, c: p.c });
    }

    buf.sort(function (a, b) { return b.z - a.z; });

    for (var k = 0; k < buf.length; k++) {
      var o = buf[k];
      var rr = Math.max(0.7, Math.min(2.6, focal * 0.011 / o.z));
      ctx.fillStyle = o.c;
      if (rr <= 1.0) ctx.fillRect(o.sx, o.sy, 1, 1);
      else ctx.fillRect(o.sx - rr * 0.5, o.sy - rr * 0.5, rr, rr);
    }

    // 颗粒噪点
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = '#ffffff';
    for (var n = 0; n < 46; n++) {
      ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }
    ctx.globalAlpha = 1;

    // 暗角
    var vg = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.28, cx, cy, Math.max(W, H) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);

    // 进度条与时间码
    var progress = this.time / this.duration;
    if (this.fillEl) this.fillEl.style.transform = 'scaleX(' + progress + ')';

    var tc = fmtTime(this.time);
    if (this.tcEl && this.tcEl.textContent !== tc) this.tcEl.textContent = tc;

    var timeStr = tc + ' / ' + fmtTime(this.duration);
    if (this.timeEl && this.timeEl.textContent !== timeStr) this.timeEl.textContent = timeStr;
  };

  VideoSim.prototype.bindControls = function () {
    var self = this;

    this.playBtn.addEventListener('click', function () {
      self.playing = !self.playing;
      self.playBtn.classList.toggle('paused', !self.playing);
    });

    function seek(clientX) {
      var rect = self.trackEl.getBoundingClientRect();
      var p = (clientX - rect.left) / rect.width;
      p = Math.max(0, Math.min(1, p));
      self.time = p * self.duration;
      self.render();
    }

    var seeking = false;
    this.trackEl.addEventListener('pointerdown', function (e) {
      seeking = true;
      seek(e.clientX);
      if (self.trackEl.setPointerCapture) {
        try { self.trackEl.setPointerCapture(e.pointerId); } catch (err) {}
      }
    });
    window.addEventListener('pointermove', function (e) {
      if (seeking) seek(e.clientX);
    });
    window.addEventListener('pointerup', function () { seeking = false; });
  };

  /* =========================================================
     6. 初始化
     ========================================================= */
  function init() {
    resizeCanvas();

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { resizeCanvas(); });
      ro.observe(stage);

      var vro = new ResizeObserver(function () {
        if (videoSim) videoSim.resize();
      });
      vro.observe(document.querySelector('.video-wrap'));
    } else {
      window.addEventListener('resize', resizeCanvas);
      window.addEventListener('resize', function () { if (videoSim) videoSim.resize(); });
    }
    window.addEventListener('orientationchange', function () {
      setTimeout(function () {
        resizeCanvas();
        if (videoSim) videoSim.resize();
      }, 120);
    });

    videoSim = new VideoSim();
    loadScene(defaultScene, false);
    render(0);

    document.querySelectorAll('.scene-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.scene;
        if (key === currentSceneKey) return;
        loadScene(key, true);
        hintEl.classList.remove('hide');
      });
    });

    setTimeout(function () { hintEl.classList.add('hide'); }, 6500);
  }

  init();

})();
