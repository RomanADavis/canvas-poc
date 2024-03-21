const $ = (s, c) => (c ? c : document).querySelector(s);

function main() {
  let {devicePixelRatio: dpr} = window;
  let contextAttrs = {colorSpace: 'srgb'};
  let layers = {
    bg: highDPIScale($('#bg'), dpr).getContext('2d', contextAttrs),
    grid: highDPIScale($('#grid'), dpr).getContext('2d', contextAttrs),
    fg: highDPIScale($('#fg'), dpr).getContext('2d', {...contextAttrs, desynchronized: true}), // set desynchronized for top-most layer
  };
  if (dpr >= 2) {
    layers.bg.scale(dpr, dpr);
    layers.grid.scale(dpr, dpr);
    layers.fg.scale(dpr, dpr);
  }
  initBgLayer(layers.bg, $('#bgColor').value);
  initGridLayer(layers.grid, '#ffffff');
  initFgLayer(layers.fg, $('#fgColor').value);

  $('#bgColor').addEventListener('input', (e) => {
    let color = e.target.value;
    $('#bgColorHex').value = color;
    let context = layers.bg;
    let {width, height} = context.canvas;
    context.fillStyle = color;
    context.fillRect(0, 0, width, height);

    let v = parseInt(color.slice(1), 16);
    let rgb = getContrastColor([v >> 16, (v >> 8) & 0xFF, v & 0xFF]);
    let color2 = '#' + (rgb[0] << 16 | rgb[1] << 9 | rgb[2]).toString(16).padStart(6, '0');
    if (layers.grid.fillStyle !== color2) {
      initGridLayer(layers.grid, color2);
    }
  });
  $('#transparent').addEventListener('click', (e) => {
    let transparent = e.target.checked;
    let context = layers.bg;
    let {width, height} = context.canvas;
    if (transparent) {
      context.clearRect(0, 0, width, height);
      $('#bgColor').disabled = true;
    } else {
      let color = $('#bgColor').value;
      context.fillStyle = color;
      context.fillRect(0, 0, width, height);
      context.canvas.style.background = '';
      $('#bgColor').disabled = false;
    }
  });
  $('#fgColor').addEventListener('input', (e) => {
    let color = e.target.value;
    $('#fgColorHex').value = color;
    layers.fg.strokeStyle = color;
  });
  $('#showGrid').addEventListener('click', (e) => {
    let show = e.target.checked;
    layers.grid.canvas.style.visibility = show ? 'visible' : 'hidden';
  });
  $('#clearFg').addEventListener('click', () => {
    let {width, height} = layers.fg.canvas.dataset;
    layers.fg.clearRect(0, 0, +width, +height);
  });
  $('#exportAsPNG').addEventListener('click', () => {
    let {bg, fg} = layers;
    let {width, height} = fg.canvas;
    let canvas = new OffscreenCanvas(width, height);
    let context = canvas.getContext('2d', contextAttrs);
    context.drawImage(bg.canvas, 0, 0);
    context.drawImage(fg.canvas, 0, 0);
    canvas.convertToBlob({type: 'png'}).then((blob) => {
      saveBlob(blob);
    });
  });
}
queueMicrotask(main);

function getContrastColor([r, g, b]) {
  let y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  let oy = 255 - y;
  let d = Math.round(oy - y);
  if (d < y) {
    return [0, 0, 0];
  } else if (d < oy) {
    return [255, 255, 255];
  }
  return [oy, oy, oy];
}
function highDPIScale(canvas, scale) {
  let {width, height} = canvas;
  canvas.dataset.width = width; // backup original size
  canvas.dataset.height = height;
  if (scale >= 2) {
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
  }
  return canvas;
}
function saveBlob(blob, defaultName) {
  let name = defaultName || blob.name;
  if (!name) {
    name = 'download' + (blob.type ? '.' + blob.type.split('/')[1] : '');
  }
  let a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
  }, 200);
}
function initBgLayer(context, color = '#000000') {
  let {canvas} = context;
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return context;
}

function initGridLayer(context, color = '#ffffff') {
  let {canvas} = context;
  let {width, height} = canvas.dataset;
  width = +width;
  height = +height;
  context.clearRect(0, 0, width, height);
  context.fillStyle = color;
  let rows = 3;
  let cols = 3;
  for (let i = 0, y = 0, cellHeight = (height - context.lineWidth) / rows; i <= rows; i++, y += cellHeight) {
    // context.beginPath();
    // context.moveTo(0, y);
    // context.lineTo(width, y);
    // context.stroke();
    context.fillRect(0, y, width, 1);
  }
  for (let i = 0, x = 0, cellWidth = (width - context.lineWidth) / cols; i <= cols; i++, x += cellWidth) {
    // context.beginPath();
    // context.moveTo(x, 0);
    // context.lineTo(x, height);
    // context.stroke();
    context.fillRect(x, 0, 1, height);
  }
  return context;
}
function initFgLayer(context, color = '#00ff00') {
  let {canvas} = context;
  context.strokeStyle = color;
  let rect = null;
  let pointerId = -1;
  let points = [];
  let canvas_pointerdownHandler = (e) => {
    if (pointerId !== -1)
      return; // in case of multi-touch
    canvas.addEventListener('pointermove', canvas_pointermoveHandler);
    canvas.addEventListener('pointerup', canvas_pointerupHandler);
    canvas.addEventListener('pointercancel', canvas_pointerupHandler);
    rect = e.target.getBoundingClientRect();
    pointerId = e.pointerId;
    e.target.setPointerCapture(pointerId);
    points = [{x: e.clientX - rect.x, y: e.clientY - rect.y}];
  };
  let drawLineTo = (e) => {
    let lastP = points[points.length - 1];
    let x = e.clientX - rect.x;
    let y = e.clientY - rect.y;
    points.push({x, y});
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(lastP.x, lastP.y);
    context.lineTo(x, y);
    context.stroke();
  };
  let canvas_pointermoveHandler = (e) => {
    if (e.pointerId !== pointerId)
      return;
    if (e.getCoalescedEvents) { // use getCoalescedEvents() to more samples
      e.getCoalescedEvents().forEach(drawLineTo);
    } else {
      drawLineTo(e);
    }
  };
  let canvas_pointerupHandler = (e) => {
    if (e.pointerId !== pointerId)
      return;
    e.target.releasePointerCapture(e.pointerId);
    canvas.removeEventListener('pointermove', canvas_pointermoveHandler);
    canvas.removeEventListener('pointerup', canvas_pointerupHandler);
    canvas.removeEventListener('pointercancel', canvas_pointerupHandler);
    pointerId = -1;
  };
  canvas.addEventListener('pointerdown', canvas_pointerdownHandler);
}
