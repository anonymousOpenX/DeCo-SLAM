'use strict';
  function plyWorkerMain() {
    self.onmessage = async function (event) {
      try {
        var response = await fetch(event.data.url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var reader = response.body.getReader();
        var pending = new Uint8Array(0), header = null, stride = 0;
        var properties = {}, total = 0, processed = 0, step = 1, positions, colors, sampled = 0;
        var lastProgress = 0;
        var types = {char: [1, 'getInt8'], uchar: [1, 'getUint8'],
          short: [2, 'getInt16'], ushort: [2, 'getUint16'],
          int: [4, 'getInt32'], uint: [4, 'getUint32'],
          float: [4, 'getFloat32'], double: [8, 'getFloat64']};
        var aliases = {int8:'char', uint8:'uchar', int16:'short', uint16:'ushort',
          int32:'int', uint32:'uint', float32:'float', float64:'double'};
        var little = true;
        while (true) {
          var chunk = await reader.read();
          if (chunk.done) break;
          var bytes = new Uint8Array(pending.length + chunk.value.length);
          bytes.set(pending); bytes.set(chunk.value, pending.length);
          var offset = 0;
          if (!header) {
            var prefix = new TextDecoder().decode(bytes.subarray(0, 65536));
            var match = /(?:^|\n)end_header\r?\n/.exec(prefix);
            if (!match) {
              if (bytes.length > 65536) throw new Error('PLY header too large or missing');
              pending = bytes; continue;
            }
            offset = match.index + match[0].length;
            header = prefix.slice(0, offset);
            if (!header.startsWith('ply\n') && !header.startsWith('ply\r\n')) throw new Error('Invalid PLY');
            var format = /format (\S+) 1.0/.exec(header);
            if (!format || !/^binary_(little|big)_endian$/.test(format[1]))
              throw new Error('Expected binary PLY (little or big endian)');
            little = format[1] === 'binary_little_endian';
            var element = null, firstElement = true;
            header.split(/\r?\n/).forEach(function (line) {
              var fields = line.trim().split(/\s+/);
              if (fields[0] === 'element') {
                element = fields[1];
                if (firstElement && element !== 'vertex') throw new Error('Vertices must be the first PLY element');
                firstElement = false;
                if (element === 'vertex') total = Number(fields[2]);
              } else if (fields[0] === 'property' && element === 'vertex') {
                var type = types[aliases[fields[1]] || fields[1]];
                if (!type) throw new Error('Unsupported vertex property: ' + fields[1]);
                properties[fields[2]] = {offset: stride, type: type}; stride += type[0];
              }
            });
            if (!Number.isSafeInteger(total) || total <= 0 || !properties.x || !properties.y || !properties.z)
              throw new Error('Missing PLY vertices or XYZ coordinates');
            step = Math.max(1, Math.ceil(total / event.data.maxPoints));
            var capacity = Math.ceil(total / step);
            positions = new Float32Array(capacity * 3);
            colors = new Uint8Array(capacity * 3);
          }
          var view = new DataView(bytes.buffer);
          var count = Math.min(Math.floor((bytes.length - offset) / stride), total - processed);
          function read(name, base, fallback) {
            var prop = properties[name];
            return prop ? view[prop.type[1]](base + prop.offset, little) : fallback;
          }
          for (var i = (step - processed % step) % step; i < count; i += step) {
            var base = offset + i * stride;
            var x = read('x', base), y = read('y', base), z = read('z', base);
            if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
            var n = sampled++ * 3;
            positions[n] = x; positions[n+1] = y; positions[n+2] = z;
            colors[n] = read('red', base, 180);
            colors[n+1] = read('green', base, 200);
            colors[n+2] = read('blue', base, 220);
          }
          processed += count;
          pending = bytes.slice(offset + count * stride);
          if (performance.now() - lastProgress > 200) {
            self.postMessage({progress: processed / total}); lastProgress = performance.now();
          }
          if (processed === total) { await reader.cancel(); break; }
        }
        if (!header || processed !== total) throw new Error('Truncated PLY file');
        if (!sampled) throw new Error('No finite points in PLY');
        var min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
        for (var n = 0; n < sampled * 3; n++) {
          var axis = n % 3, value = positions[n];
          min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value);
        }
        var scale = 10 / (Math.max(max[0]-min[0], max[1]-min[1], max[2]-min[2]) || 1);
        for (var n = 0; n < sampled * 3; n++) {
          var axis = n % 3;
          positions[n] = (positions[n] - (min[axis]+max[axis])/2) * scale;
        }
        self.postMessage({positions: positions, colors: colors, count: sampled, total: total},
          [positions.buffer, colors.buffer]);
      } catch (error) { self.postMessage({error: error.message}); }
    };
  }


plyWorkerMain();
