// Paint-fluid background for the "Before" page.
// A small stable-fluids solver (velocity, curl, pressure) advects a dye buffer that
// starts as the cover art and keeps healing back towards a slowly drifting copy of it.
// Pointer movement and audio onsets push the paint around.
(function () {
  'use strict';

  const VS = `#version 300 es
  precision highp float;
  in vec2 aPos;
  uniform vec2 texelSize;
  out vec2 vUv; out vec2 vL; out vec2 vR; out vec2 vT; out vec2 vB;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    vL = vUv - vec2(texelSize.x, 0.0);
    vR = vUv + vec2(texelSize.x, 0.0);
    vT = vUv + vec2(0.0, texelSize.y);
    vB = vUv - vec2(0.0, texelSize.y);
    gl_Position = vec4(aPos, 0.0, 1.0);
  }`;

  const HEAD = `#version 300 es
  precision highp float;
  precision highp sampler2D;
  in vec2 vUv; in vec2 vL; in vec2 vR; in vec2 vT; in vec2 vB;
  out vec4 o;
  `;

  const FS = {
    splat: `
      uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color;
      uniform vec2 point; uniform float radius;
      void main() {
        vec2 p = vUv - point; p.x *= aspectRatio;
        vec3 s = exp(-dot(p, p) / radius) * color;
        o = vec4(texture(uTarget, vUv).xyz + s, 1.0);
      }`,
    advect: `
      uniform sampler2D uVelocity; uniform sampler2D uSource;
      uniform vec2 texelSize; uniform float dt; uniform float dissipation;
      void main() {
        vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
        o = vec4(texture(uSource, coord).xyz / (1.0 + dissipation * dt), 1.0);
      }`,
    heal: `
      uniform sampler2D uVelocity; uniform sampler2D uSource; uniform sampler2D uCover;
      uniform vec2 texelSize; uniform float dt; uniform float heal; uniform float time;
      uniform vec2 coverScale; uniform float drift;
      void main() {
        vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
        vec3 c = texture(uSource, coord).rgb;
        vec2 w = vec2(
          sin(vUv.y * 3.1 + time * 0.11) + sin(vUv.x * 5.3 - time * 0.07),
          cos(vUv.x * 2.7 - time * 0.09) + cos(vUv.y * 4.1 + time * 0.05)) * drift;
        vec2 cuv = (vUv + w - 0.5) * coverScale + 0.5;
        vec3 t = texture(uCover, cuv).rgb;
        o = vec4(mix(c, t, 1.0 - exp(-heal * dt)), 1.0);
      }`,
    curl: `
      uniform sampler2D uVelocity;
      void main() {
        float L = texture(uVelocity, vL).y; float R = texture(uVelocity, vR).y;
        float T = texture(uVelocity, vT).x; float B = texture(uVelocity, vB).x;
        o = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
      }`,
    vorticity: `
      uniform sampler2D uVelocity; uniform sampler2D uCurl; uniform float curl; uniform float dt;
      void main() {
        float L = texture(uCurl, vL).x; float R = texture(uCurl, vR).x;
        float T = texture(uCurl, vT).x; float B = texture(uCurl, vB).x;
        float C = texture(uCurl, vUv).x;
        vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
        force /= length(force) + 0.0001;
        force *= curl * C; force.y *= -1.0;
        vec2 vel = texture(uVelocity, vUv).xy + force * dt;
        o = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
      }`,
    divergence: `
      uniform sampler2D uVelocity;
      void main() {
        float L = texture(uVelocity, vL).x; float R = texture(uVelocity, vR).x;
        float T = texture(uVelocity, vT).y; float B = texture(uVelocity, vB).y;
        vec2 C = texture(uVelocity, vUv).xy;
        if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
        if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
        o = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
      }`,
    scale: `
      uniform sampler2D uTexture; uniform float value;
      void main() { o = value * texture(uTexture, vUv); }`,
    pressure: `
      uniform sampler2D uPressure; uniform sampler2D uDivergence;
      void main() {
        float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
        float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
        float d = texture(uDivergence, vUv).x;
        o = vec4((L + R + B + T - d) * 0.25, 0.0, 0.0, 1.0);
      }`,
    gradient: `
      uniform sampler2D uPressure; uniform sampler2D uVelocity;
      void main() {
        float L = texture(uPressure, vL).x; float R = texture(uPressure, vR).x;
        float T = texture(uPressure, vT).x; float B = texture(uPressure, vB).x;
        vec2 vel = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
        o = vec4(vel, 0.0, 1.0);
      }`,
    display: `
      uniform sampler2D uDye; uniform float intensity; uniform float glow; uniform float time;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec3 c = texture(uDye, vUv).rgb;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, mix(0.3, 1.12, intensity));
        c *= mix(0.5, 1.04, intensity) + glow * 0.14;
        vec2 q = vUv - 0.5;
        c *= 1.0 - dot(q, q) * 0.85;
        c += (hash(gl_FragCoord.xy + fract(time) * 91.7) - 0.5) * 0.03;
        o = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
  };

  function create(canvas, coverImage) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return null;
    gl.getExtension('OES_texture_float_linear');

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    const vs = compile(gl.VERTEX_SHADER, VS);
    const programs = {};
    for (const [name, body] of Object.entries(FS)) {
      const p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HEAD + body));
      gl.bindAttribLocation(p, 0, 'aPos');
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        u[info.name] = gl.getUniformLocation(p, info.name);
      }
      programs[name] = { p, u };
    }

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    function fbo(w, h, internal, format) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
      const fb = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fb, w, h, tx: 1 / w, ty: 1 / h };
    }
    function double(w, h, internal, format) {
      let a = fbo(w, h, internal, format), b = fbo(w, h, internal, format);
      return {
        get read() { return a; }, get write() { return b; },
        w, h, tx: 1 / w, ty: 1 / h,
        swap() { const t = a; a = b; b = t; },
      };
    }

    const cover = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, cover);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, coverImage);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.MIRRORED_REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);

    const cfg = { simRes: 128, dyeRes: 1024, velDiss: 1.2, pressure: 0.8, iterations: 20, curl: 12, heal: 0.45, drift: 0.012 };
    let velocity, dye, divergence, curlFbo, pressure;

    function res(base) {
      const a = gl.drawingBufferWidth / gl.drawingBufferHeight;
      const min = Math.round(base), max = Math.round(base * Math.max(a, 1 / a));
      return a > 1 ? { w: max, h: min } : { w: min, h: max };
    }
    function bind(target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
      if (target) gl.viewport(0, 0, target.w, target.h);
      else gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }
    function use(name) { gl.useProgram(programs[name].p); return programs[name].u; }
    function tex(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); return unit; }
    function draw() { gl.drawArrays(gl.TRIANGLES, 0, 3); }
    function coverScale() {
      const a = canvas.width / canvas.height;
      return a > 1 ? [1, 1 / a] : [a, 1];
    }

    let time = 0;
    function heal(dt, amount) {
      const u = use('heal');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uVelocity, tex(0, velocity.read.tex));
      gl.uniform1i(u.uSource, tex(1, dye.read.tex));
      gl.uniform1i(u.uCover, tex(2, cover));
      gl.uniform1f(u.dt, dt);
      gl.uniform1f(u.heal, amount);
      gl.uniform1f(u.time, time);
      gl.uniform1f(u.drift, cfg.drift);
      gl.uniform2fv(u.coverScale, coverScale());
      bind(dye.write); draw(); dye.swap();
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width === w && canvas.height === h && velocity) return;
      // Mobile browsers change the height while the address bar slides; keep the paint then.
      const keep = velocity && canvas.width === w;
      canvas.width = w; canvas.height = h;
      if (keep) return;
      const s = res(cfg.simRes), d = res(Math.min(cfg.dyeRes, Math.max(w, h)));
      velocity = double(s.w, s.h, gl.RG16F, gl.RG);
      divergence = fbo(s.w, s.h, gl.R16F, gl.RED);
      curlFbo = fbo(s.w, s.h, gl.R16F, gl.RED);
      pressure = double(s.w, s.h, gl.R16F, gl.RED);
      dye = double(d.w, d.h, gl.RGBA16F, gl.RGBA);
      heal(1, 60);
    }

    function splat(x, y, dx, dy, radius) {
      const u = use('splat');
      const aspect = canvas.width / canvas.height;
      let r = (radius || 0.25) / 100;
      if (aspect > 1) r *= aspect;
      gl.uniform1i(u.uTarget, tex(0, velocity.read.tex));
      gl.uniform1f(u.aspectRatio, aspect);
      gl.uniform2f(u.point, x, y);
      gl.uniform3f(u.color, dx, dy, 0);
      gl.uniform1f(u.radius, r);
      bind(velocity.write); draw(); velocity.swap();
    }

    function step(dt) {
      gl.disable(gl.BLEND);
      let u = use('curl');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uVelocity, tex(0, velocity.read.tex));
      bind(curlFbo); draw();

      u = use('vorticity');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uVelocity, tex(0, velocity.read.tex));
      gl.uniform1i(u.uCurl, tex(1, curlFbo.tex));
      gl.uniform1f(u.curl, cfg.curl);
      gl.uniform1f(u.dt, dt);
      bind(velocity.write); draw(); velocity.swap();

      u = use('divergence');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uVelocity, tex(0, velocity.read.tex));
      bind(divergence); draw();

      u = use('scale');
      gl.uniform1i(u.uTexture, tex(0, pressure.read.tex));
      gl.uniform1f(u.value, cfg.pressure);
      bind(pressure.write); draw(); pressure.swap();

      u = use('pressure');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uDivergence, tex(0, divergence.tex));
      for (let i = 0; i < cfg.iterations; i++) {
        gl.uniform1i(u.uPressure, tex(1, pressure.read.tex));
        bind(pressure.write); draw(); pressure.swap();
      }

      u = use('gradient');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uPressure, tex(0, pressure.read.tex));
      gl.uniform1i(u.uVelocity, tex(1, velocity.read.tex));
      bind(velocity.write); draw(); velocity.swap();

      u = use('advect');
      gl.uniform2f(u.texelSize, velocity.tx, velocity.ty);
      gl.uniform1i(u.uVelocity, tex(0, velocity.read.tex));
      gl.uniform1i(u.uSource, tex(0, velocity.read.tex));
      gl.uniform1f(u.dt, dt);
      gl.uniform1f(u.dissipation, cfg.velDiss);
      bind(velocity.write); draw(); velocity.swap();

      heal(dt, cfg.heal);
    }

    function render(intensity, glow) {
      const u = use('display');
      gl.uniform1i(u.uDye, tex(0, dye.read.tex));
      gl.uniform1f(u.intensity, intensity);
      gl.uniform1f(u.glow, glow);
      gl.uniform1f(u.time, time);
      bind(null); draw();
    }

    resize();
    return {
      cfg,
      resize,
      splat,
      frame(dt, intensity, glow) {
        time += dt;
        resize();
        step(dt);
        render(intensity, glow);
      },
    };
  }

  window.BeforeFluid = { create };
})();
