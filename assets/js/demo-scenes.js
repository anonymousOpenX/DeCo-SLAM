// Optional synthetic examples. Real scenes only need config/scenes.js.
(function () {
'use strict';
  function terrainH(x, z) {
    return Math.sin(x * 0.38) * 0.55
         + Math.cos(z * 0.32) * 0.45
         + Math.sin((x + z) * 0.21) * 0.70
         + Math.cos(x * 0.85 + z * 0.60) * 0.15;
  }

  function genAerial() {
    var pts = [];
    var N = 5200;
    for (var i = 0; i < N; i++) {
      var x = (Math.random() - 0.5) * 20;
      var z = (Math.random() - 0.5) * 20;
      var y = terrainH(x, z);
      var t = (y + 1.5) / 3.0;
      pts.push({
        x: x, y: y, z: z,
        c: 'hsl(' + (202 + t * 16) + ',' + (32 + t * 26) + '%,' + (42 + t * 20) + '%)'
      });
    }
    for (var b = 0; b < 15; b++) {
      var bx = (Math.random() - 0.5) * 15;
      var bz = (Math.random() - 0.5) * 15;
      var bw = 0.40 + Math.random() * 0.85;
      var bd = 0.40 + Math.random() * 0.85;
      var bh = 0.70 + Math.random() * 2.10;
      var base = terrainH(bx, bz);
      for (var j = 0; j < 100; j++) {
        var px = bx + (Math.random() - 0.5) * 2 * bw;
        var pz = bz + (Math.random() - 0.5) * 2 * bd;
        var py = base + Math.random() * bh;
        var tt = py / 3.0;
        pts.push({
          x: px, y: py, z: pz,
          c: 'hsl(' + (196 + tt * 22) + ',' + (52 + tt * 22) + '%,' + (50 + tt * 16) + '%)'
        });
      }
    }
    return pts;
  }

  function genForest() {
    var pts = [];
    var N = 3200;
    for (var i = 0; i < N; i++) {
      var x = (Math.random() - 0.5) * 20;
      var z = (Math.random() - 0.5) * 20;
      var y = terrainH(x, z) * 0.32 - 0.55;
      pts.push({
        x: x, y: y, z: z,
        c: 'hsl(' + (152 + Math.random() * 18) + ',' + (16 + Math.random() * 14) + '%,' + (26 + Math.random() * 10) + '%)'
      });
    }
    for (var t = 0; t < 26; t++) {
      var tx = (Math.random() - 0.5) * 17;
      var tz = (Math.random() - 0.5) * 17;
      var base = terrainH(tx, tz) * 0.32 - 0.55;
      var th = 1.30 + Math.random() * 1.60;

      for (var k = 0; k < 62; k++) {
        var yy = base + Math.random() * th;
        var rr = 0.055 + Math.random() * 0.045;
        var aa = Math.random() * Math.PI * 2;
        pts.push({
          x: tx + Math.cos(aa) * rr,
          y: yy,
          z: tz + Math.sin(aa) * rr,
          c: 'hsl(' + (26 + Math.random() * 12) + ',28%,' + (28 + Math.random() * 8) + '%)'
        });
      }

      var cy = base + th + 0.38;
      var cr = 0.55 + Math.random() * 0.48;
      for (var m = 0; m < 175; m++) {
        var u = Math.random() * 2 - 1;
        var ang = Math.random() * Math.PI * 2;
        var rad2 = Math.sqrt(1 - u * u);
        var rad = cr * Math.cbrt(Math.random());
        pts.push({
          x: tx + Math.cos(ang) * rad2 * rad,
          y: cy + u * rad * 0.85,
          z: tz + Math.sin(ang) * rad2 * rad,
          c: 'hsl(' + (142 + Math.random() * 26) + ',' + (34 + Math.random() * 22) + '%,' + (30 + Math.random() * 18) + '%)'
        });
      }
    }
    return pts;
  }

  function genOffice() {
    var pts = [];
    var W = 8.0, D = 6.0, H = 3.0, FLOOR = -0.5;

    for (var i = 0; i < 2600; i++) {
      pts.push({
        x: (Math.random() - 0.5) * W,
        y: FLOOR,
        z: (Math.random() - 0.5) * D,
        c: 'hsl(' + (216 + Math.random() * 10) + ',' + (12 + Math.random() * 10) + '%,' + (36 + Math.random() * 12) + '%)'
      });
    }

    function wall(x0, z0, x1, z1) {
      for (var n = 0; n < 560; n++) {
        var t = Math.random();
        pts.push({
          x: x0 + (x1 - x0) * t,
          y: FLOOR + Math.random() * H,
          z: z0 + (z1 - z0) * t,
          c: 'hsl(' + (212 + Math.random() * 12) + ',' + (10 + Math.random() * 10) + '%,' + (32 + Math.random() * 12) + '%)'
        });
      }
    }
    wall(-W / 2, -D / 2,  W / 2, -D / 2);
    wall(-W / 2,  D / 2,  W / 2,  D / 2);
    wall(-W / 2, -D / 2, -W / 2,  D / 2);
    wall( W / 2, -D / 2,  W / 2,  D / 2);

    function box(cx, cy, cz, w, h, d, hue, sat, li, density) {
      var n = Math.max(30, Math.floor(w * h * d * (density || 240)));
      for (var q = 0; q < n; q++) {
        pts.push({
          x: cx + (Math.random() - 0.5) * w,
          y: cy + (Math.random() - 0.5) * h,
          z: cz + (Math.random() - 0.5) * d,
          c: 'hsl(' + (hue + Math.random() * 12) + ',' + sat + '%,' + (li + Math.random() * 10) + '%)'
        });
      }
    }

    box(-2.2, -0.14, -1.4, 1.8, 0.12, 0.9, 30, 26, 40);
    box(-2.2, -0.32, -1.4, 0.10, 0.42, 0.10, 30, 26, 34);
    box(-2.2, -0.32, -0.9, 0.10, 0.42, 0.10, 30, 26, 34);
    box(2.0, -0.14, 1.2, 2.0, 0.12, 1.0, 30, 26, 40);
    box(2.0, -0.32, 1.2, 0.10, 0.42, 0.10, 30, 26, 34);
    box(3.2, 0.55, -2.0, 0.40, 2.00, 1.60, 210, 16, 34, 320);
    box(-0.8, -0.28, -1.0, 0.50, 0.50, 0.50, 200, 20, 36, 400);
    box( 0.8, -0.28,  0.6, 0.50, 0.50, 0.50, 200, 20, 36, 400);

    return pts;
  }


window.DEMO_SCENES = {
    aerial: {
      name: 'Aerial',
      sub: 'drone footage · uncalibrated intrinsics',
      seqLabel: 'Aerial · drone',
      groups: '11',
      gen: genAerial,
      dist: 15.5,
      rotX: 0.52,
      rotY: 0.6,
      video: {
        pos: function (t) { return [Math.sin(t * 1.6) * 3.0, 3.8 + Math.sin(t * 2.2) * 0.30, -8 + t * 15]; },
        look: function (t) { return [Math.sin(t * 1.2) * 1.5, 0.5, -3 + t * 15]; },
        fov: 1.05,
        bg: ['#182236', '#0a1018'],
        label: 'Aerial · 1080p'
      }
    },
    forest: {
      name: 'Forest',
      sub: 'handheld capture · repetitive texture',
      seqLabel: 'Forest · handheld',
      groups: '9',
      gen: genForest,
      dist: 14.0,
      rotX: 0.24,
      rotY: 0.85,
      video: {
        pos: function (t) { return [Math.sin(t * 1.5) * 1.2, 0.60 + Math.sin(t * 3.5) * 0.05, -8 + t * 15]; },
        look: function (t) { return [Math.sin(t * 1.0) * 0.8, 0.55, 0 + t * 15]; },
        fov: 1.10,
        bg: ['#16200f', '#070b05'],
        label: 'Forest · 1080p'
      }
    },
    office: {
      name: 'Indoor Office',
      sub: 'handheld capture · complex layout',
      seqLabel: 'Office · handheld',
      groups: '7',
      gen: genOffice,
      dist: 11.5,
      rotX: 0.28,
      rotY: 0.9,
      video: {
        pos: function (t) { return [-3.2 + t * 6.4, 0.65 + Math.sin(t * 4) * 0.03, 1.4 + Math.sin(t * 1.6) * 0.70]; },
        look: function (t) { return [-3.2 + t * 6.4 + 1.8, 0.50, -1.2 + Math.sin(t * 1.6) * 0.50]; },
        fov: 0.95,
        bg: ['#1a1d24', '#0c0e13'],
        label: 'Office · 1080p'
      }
    }
  };

})();
