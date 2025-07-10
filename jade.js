// ==== Extend helper for prototype inheritance ====
function extend(Child, Parent) {
  Child.prototype = Object.create(Parent.prototype);
  Child.prototype.constructor = Child;
  Child.__super__ = Parent.prototype;
}

// ==== Morph Base Class ====
function Morph(x, y, width, height, options) {
  options = options || {};
  this.x = x || 0;
  this.y = y || 0;
  this.width = width || 50;
  this.height = height || 50;

  this.draggable = !!options.draggable;

  this.fillColor = options.fillColor || '#ffffff';
  this.outlineColor = options.outlineColor || '#000000';
  this.outlineThickness = options.outlineThickness || 3;
  this.cornerRadius = options.cornerRadius || 10;

  this.opacity = options.opacity !== undefined ? options.opacity : 1.0;

  this.shadowColor = options.shadowColor || 'rgba(0,0,0,0.2)';
  this.shadowBlur = options.shadowBlur || 8;
  this.shadowOffsetX = options.shadowOffsetX || 0;
  this.shadowOffsetY = options.shadowOffsetY || 4;

  this.world = null;
  this.parent = null;
  this.children = [];

  this.hover = false;
  this.active = false;

  this.zIndex = options.zIndex || 0;
  this._animations = [];
  this.rotation = options.rotation || 0;
}

// ==== Morph Prototype Methods ====
Morph.prototype.getX = function () { return this.x; };
Morph.prototype.setX = function (val) { this.x = val; };
Morph.prototype.getY = function () { return this.y; };
Morph.prototype.setY = function (val) { this.y = val; };
Morph.prototype.getRotation = function () { return this.rotation || 0; };
Morph.prototype.setRotation = function (angle) { this.rotation = angle; };
Morph.prototype.addChild = function(morph) {
  morph.parent = this;
  morph.world = this.world;
  this.children.push(morph);
  this._sortChildrenByZIndex();

  if (morph instanceof PenMorph) {
    // Inject drawing hook only once
    if (!this._hasPenInjection) {
      const originalDraw = this.draw.bind(this);
      const self = this;

      this.draw = function(ctx) {
        originalDraw(ctx);
        self.children
          .filter(child => child instanceof PenMorph)
          .forEach(pen => pen._drawPenPath(ctx));
      };

      this._hasPenInjection = true;
    }
  }
};

Morph.prototype.tick = function () {};

Morph.prototype.setPosition = function(x, y) {
  this.x = x;
  this.y = y;
  if (this.onPositionChanged) this.onPositionChanged(x, y);
};

Morph.prototype.addChild = function(morph) {
  morph.parent = this;
  morph.world = this.world;
  this.children.push(morph);
  this._sortChildrenByZIndex();
};

Morph.prototype.removeChild = function(morph) {
  var idx = this.children.indexOf(morph);
  if (idx !== -1) {
    morph.parent = null;
    morph.world = null;
    this.children.splice(idx, 1);
  }
};

Morph.prototype._sortChildrenByZIndex = function() {
  this.children.sort(function(a, b) { return a.zIndex - b.zIndex; });
};

Morph.prototype.hitTest = function(px, py) {
  for (var i = this.children.length - 1; i >= 0; i--) {
    var child = this.children[i];
    var hit = child.hitTest(px, py);
    if (hit) return hit;
  }
  if (this.isPointInside(px, py)) return this;
  return null;
};

Morph.prototype.isPointInside = function(px, py) {
  return px >= this.x && px <= this.x + this.width &&
         py >= this.y && py <= this.y + this.height;
};

Morph.prototype._setHover = function(state) {
  this.hover = state;
};

Morph.prototype._setActive = function(state) {
  this.active = state;
};

Morph.prototype._runAnimations = function () {
  this._animations = this._animations.filter(animation => animation());
};

Morph.prototype._drawRoundedRect = function(ctx, x, y, w, h, r, fillColor) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
};

Morph.prototype._drawRoundedRectStroke = function(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.stroke();
};

Morph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();
  ctx.globalAlpha = this.opacity;

  const centerX = this.x + this.width / 2;
  const centerY = this.y + this.height / 2;

  ctx.translate(centerX, centerY);
  ctx.rotate((this.rotation || 0) * Math.PI / 180);
  ctx.translate(-centerX, -centerY);

  if (this.active || this.hover) {
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.shadowBlur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, this.fillColor);

  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);

  ctx.restore();

  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// ==== ImageMorph ====
function ImageMorph(x, y, width, height, imageUrl, options) {
  options = options || {};
  Morph.call(this, x, y, width, height, options);
  this.image = new Image();
  this.imageLoaded = false;
  this.imageError = false;

  this.image.onload = () => {
    this.imageLoaded = true;
  };

  this.image.onerror = () => {
    this.imageError = true;
  };

  this.image.src = imageUrl;
}
extend(ImageMorph, Morph);

ImageMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  const centerX = this.x + this.width / 2;
  const centerY = this.y + this.height / 2;

  ctx.translate(centerX, centerY);
  ctx.rotate((this.rotation || 0) * Math.PI / 180);
  ctx.translate(-centerX, -centerY);

  ctx.globalAlpha = this.opacity;

  if (this.imageLoaded && this.image.complete && !this.imageError) {
    ctx.drawImage(this.image, this.x, this.y, this.width, this.height);
  } else {
    ctx.fillStyle = this.imageError ? '#ff9999' : '#ccc';
    ctx.fillRect(this.x, this.y, this.width, this.height);
    if (this.imageError) {
      ctx.fillStyle = '#000';
      ctx.font = '12px Arial';
      ctx.fillText('Image Error', this.x + 5, this.y + 15);
    }
  }

  ctx.restore();

  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// ==== PenMorph ====
function PenMorph(x, y, width, height, options) {
  options = options || {};
  Morph.call(this, x, y, width, height, options);
  this.penPaths = [];
}
extend(PenMorph, Morph);

PenMorph.prototype.penDown = function(x, y) {
  this.penPaths.push({ x: x, y: y });
};

PenMorph.prototype.penMove = function(x, y) {
  this.penPaths.push({ x: x, y: y });
};

PenMorph.prototype.clearPen = function() {
  this.penPaths = [];
};

PenMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  const centerX = this.x + this.width / 2;
  const centerY = this.y + this.height / 2;
  ctx.translate(centerX, centerY);
  ctx.rotate((this.rotation || 0) * Math.PI / 180);
  ctx.translate(-centerX, -centerY);

  ctx.fillStyle = this.fillColor;
  ctx.fillRect(this.x, this.y, this.width, this.height);

  if (this.penPaths.length > 1) {
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black';
    ctx.moveTo(this.penPaths[0].x, this.penPaths[0].y);
    for (let i = 1; i < this.penPaths.length; i++) {
      ctx.lineTo(this.penPaths[i].x, this.penPaths[i].y);
    }
    ctx.stroke();
  }

  ctx.restore();

  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};
PenMorph.prototype._drawPenPath = function(ctx) {
  if (this.penPaths.length > 1) {
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(this.penPaths[0].x, this.penPaths[0].y);
    for (let i = 1; i < this.penPaths.length; i++) {
      ctx.lineTo(this.penPaths[i].x, this.penPaths[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
};

// ==== RotatingImageMorph ====
function RotatingImageMorph(x, y, w, h, img) {
  ImageMorph.call(this, x, y, w, h, img);
  this.angle = 0;
}
extend(RotatingImageMorph, ImageMorph);

RotatingImageMorph.prototype.tick = function() {
  this.angle += 1;
  this.setRotation(this.angle % 360);
};

// ==== World ====
function World(width, height, background) {
  this.width = width;
  this.height = height;
  this.background = background || '#fff';

  this.canvas = document.createElement('canvas');
  this.canvas.width = this.width;
  this.canvas.height = this.height;
  document.body.appendChild(this.canvas);

  this.ctx = this.canvas.getContext('2d');
  this.morphs = [];

  this._draggingMorph = null;
  this._dragOffsetX = 0;
  this._dragOffsetY = 0;
  this._hoverMorph = null;

  this._tick = this._tick.bind(this);

  this.canvas.addEventListener('touchstart', this._touchStartHandler.bind(this), false);
  this.canvas.addEventListener('touchmove', this._touchMoveHandler.bind(this), false);
  this.canvas.addEventListener('touchend', this._touchEndHandler.bind(this), false);

  this.canvas.addEventListener('mousedown', this._mouseDownHandler.bind(this), false);
  this.canvas.addEventListener('mousemove', this._mouseMoveHandler.bind(this), false);
  this.canvas.addEventListener('mouseup', this._mouseUpHandler.bind(this), false);

  window.addEventListener('keydown', this._keyDownHandler.bind(this));
  window.addEventListener('keyup', this._keyUpHandler.bind(this));

  requestAnimationFrame(this._tick);
}

World.prototype._tick = function () {
  this.ctx.clearRect(0, 0, this.width, this.height);
  this.ctx.fillStyle = this.background;
  this.ctx.fillRect(0, 0, this.width, this.height);

  this.morphs.forEach(morph => {
    morph.tick();
    morph.draw(this.ctx);
  });

  requestAnimationFrame(this._tick);
};

World.prototype.addMorph = function(morph) {
  morph.world = this
  this.morphs.push(morph);
  morph.parent = this;

  if (morph instanceof PenMorph) {
    if (!this._hasPenInjection) {
      const originalDraw = this._tick.bind(this);
      const self = this;

      this._tick = function() {
        self.ctx.clearRect(0, 0, self.width, self.height);
        self.ctx.fillStyle = self.background;
        self.ctx.fillRect(0, 0, self.width, self.height);

        self.morphs.forEach(morph => {
          morph.tick();
          morph.draw(self.ctx);
          if (morph instanceof PenMorph) {
            morph._drawPenPath(self.ctx);
          }
        });

        requestAnimationFrame(self._tick);
      };

      this._hasPenInjection = true;
    }
  }
};


World.prototype.removeMorph = function(morph) {
  const idx = this.morphs.indexOf(morph);
  if (idx !== -1) {
    morph.parent = null;
    this.morphs.splice(idx, 1);
  }
};

World.prototype._getCanvasCoords = function(clientX, clientY) {
  var rect = this.canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
};

World.prototype._hitTestMorphs = function(x, y) {
  for (var i = this.morphs.length - 1; i >= 0; i--) {
    var morph = this.morphs[i];
    var hit = morph.hitTest(x, y);
    if (hit) return hit;
  }
  return null;
};

World.prototype._touchStartHandler = function(evt) {
  evt.preventDefault();
  if (!evt.touches || evt.touches.length === 0) return;
  var touch = evt.touches[0];
  var pos = this._getCanvasCoords(touch.clientX, touch.clientY);
  var morph = this._hitTestMorphs(pos.x, pos.y);

  // Handle touch start event first (for custom behaviors like block duplication)
  if (morph && morph.onTouchStart) {
    morph.onTouchStart(evt, pos);
  }

  // Then handle dragging if the morph is draggable and not already being dragged
  if (morph && morph.draggable && !this._draggingMorph) {
    this._draggingMorph = morph;
    this._dragOffsetX = pos.x - morph.x;
    this._dragOffsetY = pos.y - morph.y;
    morph._setActive(true);
    if (morph.onDragStart) morph.onDragStart();
  }
};

World.prototype._touchMoveHandler = function(evt) {
  evt.preventDefault();
  if (!this._draggingMorph) return;
  var touch = evt.touches[0];
  var pos = this._getCanvasCoords(touch.clientX, touch.clientY);
  this._draggingMorph.setPosition(pos.x - this._dragOffsetX, pos.y - this._dragOffsetY);
  if (this._draggingMorph.onDragMove) this._draggingMorph.onDragMove(pos);
};

World.prototype._touchEndHandler = function(evt) {
  evt.preventDefault();
  if (this._draggingMorph) {
    this._draggingMorph._setActive(false);
    if (this._draggingMorph.onDragEnd) this._draggingMorph.onDragEnd();
    if (this._draggingMorph.onTouchEnd) this._draggingMorph.onTouchEnd(evt);
  }
  this._draggingMorph = null;
};

World.prototype._mouseDownHandler = function(evt) {
  evt.preventDefault();
  var pos = this._getCanvasCoords(evt.clientX, evt.clientY);
  var morph = this._hitTestMorphs(pos.x, pos.y);
  if (morph && morph.draggable) {
    this._draggingMorph = morph;
    this._dragOffsetX = pos.x - morph.x;
    this._dragOffsetY = pos.y - morph.y;
    morph._setActive(true);
    if (morph.onDragStart) morph.onDragStart();
  }
  if (morph && morph.onMouseDown) morph.onMouseDown(evt, pos);
};

World.prototype._mouseMoveHandler = function(evt) {
  evt.preventDefault();
  var pos = this._getCanvasCoords(evt.clientX, evt.clientY);
  if (this._draggingMorph) {
    this._draggingMorph.setPosition(pos.x - this._dragOffsetX, pos.y - this._dragOffsetY);
    if (this._draggingMorph.onDragMove) this._draggingMorph.onDragMove(pos);
  } else {
    var morph = this._hitTestMorphs(pos.x, pos.y);
    if (morph !== this._hoverMorph) {
      if (this._hoverMorph) this._hoverMorph._setHover(false);
      this._hoverMorph = morph;
      if (this._hoverMorph) this._hoverMorph._setHover(true);
    }
    if (morph && morph.onMouseMove) morph.onMouseMove(evt, pos);
  }
};

World.prototype._mouseUpHandler = function(evt) {
  evt.preventDefault();
  if (this._draggingMorph) {
    this._draggingMorph._setActive(false);
    if (this._draggingMorph.onDragEnd) this._draggingMorph.onDragEnd();
  }
  this._draggingMorph = null;
};

World.prototype._keyDownHandler = function(evt) {
  if (this._hoverMorph && this._hoverMorph.onKeyDown) {
    this._hoverMorph.onKeyDown(evt);
  }
};

World.prototype._keyUpHandler = function(evt) {
  if (this._hoverMorph && this._hoverMorph.onKeyUp) {
    this._hoverMorph.onKeyUp(evt);
  }
};
function CircleMorph(x, y, radius, options) {
  options = options || {};
  Morph.call(this, x, y, radius * 2, radius * 2, options);
  this.radius = radius;
}
extend(CircleMorph, Morph);

// Override draw to draw a circle instead of rounded rect
CircleMorph.prototype.draw = function(ctx) {
  this._runAnimations();

  ctx.save();
  ctx.globalAlpha = this.opacity;

  if (this.active || this.hover) {
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.shadowBlur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  ctx.beginPath();
  ctx.arc(this.x + this.radius, this.y + this.radius, this.radius, 0, Math.PI * 2);
  ctx.fillStyle = this.fillColor;
  ctx.fill();

  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  ctx.stroke();

  ctx.restore();

  // Draw children if any
  this.children.forEach(function(child) {
    child.draw(ctx);
  });
};
// New morph type extending Morph with extra features
function BouncyMorph(x, y, width, height, options) {
  Morph.call(this, x, y, width, height, options);
  this.vx = 2; // velocity X
  this.vy = 2; // velocity Y
  this.colorToggle = false;
  this.draggable = true;
}

extend(BouncyMorph, Morph);

BouncyMorph.prototype.draw = function(ctx) {
  // Bounce logic: reverse velocity at edges of world
  if (!this.world) return; // no world attached yet
  if (this.x <= 0 || this.x + this.width >= this.world.width) this.vx = -this.vx;
  if (this.y <= 0 || this.y + this.height >= this.world.height) this.vy = -this.vy;

  // Update position
  this.x += this.vx;
  this.y += this.vy;

  // Change fill color on drag
  if (this === this.world._draggingMorph) {
    this.fillColor = this.colorToggle ? '#FF6666' : '#66FF66';
    this.colorToggle = !this.colorToggle;
  } else {
    this.fillColor = '#3399FF';
  }

  // Call parent draw method
  BouncyMorph.__super__.draw.call(this, ctx);
};
// Extend helper remains same
// extend(Child, Parent) {...} // Already defined

// --- TextMorph ---
function TextMorph(x, y, width, height, text, options) {
  options = options || {};
  Morph.call(this, x, y, width, height, options);
  this.text = text || '';
  this.font = options.font || '16px Arial';
  this.color = options.color || '#000';
  this.textAlign = options.textAlign || 'left';
  this.verticalAlign = options.verticalAlign || 'middle';
  this.padding = options.padding || 5;
}
extend(TextMorph, Morph);

TextMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  ctx.globalAlpha = this.opacity;

  const centerX = this.x + this.width / 2;
  const centerY = this.y + this.height / 2;

  ctx.translate(centerX, centerY);
  ctx.rotate((this.rotation || 0) * Math.PI / 180);
  ctx.translate(-centerX, -centerY);

  if (this.active || this.hover) {
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.shadowBlur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // Draw background shape for base
  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, this.fillColor);
  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);

  // Draw text
  ctx.fillStyle = this.color;
  ctx.font = this.font;
  ctx.textAlign = this.textAlign;
  ctx.textBaseline = this.verticalAlign === 'middle' ? 'middle' : 'top';

  let textX = this.x + this.padding;
  if (this.textAlign === 'center') textX = this.x + this.width / 2;
  else if (this.textAlign === 'right') textX = this.x + this.width - this.padding;

  let textY = this.y + this.height / 2;
  if (this.verticalAlign === 'top') textY = this.y + this.padding;
  else if (this.verticalAlign === 'bottom') textY = this.y + this.height - this.padding;

  ctx.fillText(this.text, textX, textY);

  ctx.restore();

  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// --- HandleMorph ---
function HandleMorph(x, y, size, options) {
  options = options || {};
  Morph.call(this, x, y, size, size, options);
  this.fillColor = options.fillColor || '#007aff';
  this.outlineColor = options.outlineColor || '#0051a8';
  this.cornerRadius = size / 2;
}
extend(HandleMorph, Morph);

HandleMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  ctx.globalAlpha = this.opacity;

  const centerX = this.x + this.width / 2;
  const centerY = this.y + this.height / 2;

  ctx.translate(centerX, centerY);
  ctx.rotate((this.rotation || 0) * Math.PI / 180);
  ctx.translate(-centerX, -centerY);

  if (this.active || this.hover) {
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.shadowBlur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, this.fillColor);

  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);

  ctx.restore();
};
function FrameMorph(x, y, width, height, options) {
  options = options || {};
  Morph.call(this, x, y, width, height, options);
  this.fillColor = options.fillColor || '#eee';
  this.outlineColor = options.outlineColor || '#333';
  this.cornerRadius = options.cornerRadius || 5;
  this.padding = options.padding || 10;

  this.relativeChildren = [];
  this._isDragging = false;
  this._dragOffsetX = 0;
  this._dragOffsetY = 0;

  // Register global input once
  FrameMorph._registerGlobalInputOnce();
  FrameMorph.instances.push(this);
}
extend(FrameMorph, Morph);

FrameMorph.instances = [];
FrameMorph._inputRegistered = false;

FrameMorph._registerGlobalInputOnce = function() {
  if (FrameMorph._inputRegistered) return;

  window.addEventListener('mousedown', FrameMorph._handleGlobalMouseDown);
  window.addEventListener('mousemove', FrameMorph._handleGlobalMouseMove);
  window.addEventListener('mouseup', FrameMorph._handleGlobalMouseUp);

  window.addEventListener('touchstart', FrameMorph._handleGlobalTouchStart);
  window.addEventListener('touchmove', FrameMorph._handleGlobalTouchMove);
  window.addEventListener('touchend', FrameMorph._handleGlobalTouchEnd);

  FrameMorph._inputRegistered = true;
};

FrameMorph._handleGlobalMouseDown = function(e) {
  const x = e.clientX;
  const y = e.clientY;
  for (let i = FrameMorph.instances.length - 1; i >= 0; i--) {
    const f = FrameMorph.instances[i];
    if (f.containsPoint(x, y)) {
      f._isDragging = true;
      f._dragOffsetX = x - f.x;
      f._dragOffsetY = y - f.y;
      break;
    }
  }
};

FrameMorph._handleGlobalMouseMove = function(e) {
  const x = e.clientX;
  const y = e.clientY;
  FrameMorph.instances.forEach(f => {
    if (f._isDragging) {
      f.moveTo(x - f._dragOffsetX, y - f._dragOffsetY);
    }
  });
};

FrameMorph._handleGlobalMouseUp = function() {
  FrameMorph.instances.forEach(f => f._isDragging = false);
};

FrameMorph._handleGlobalTouchStart = function(e) {
  const touch = e.touches[0];
  if (!touch) return;
  FrameMorph._handleGlobalMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
};

FrameMorph._handleGlobalTouchMove = function(e) {
  const touch = e.touches[0];
  if (!touch) return;
  FrameMorph._handleGlobalMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
};

FrameMorph._handleGlobalTouchEnd = function() {
  FrameMorph._handleGlobalMouseUp();
};

// Add child with initial relative position inside frame and store child's "old" inside position
FrameMorph.prototype.addChild = function(child) {
  // Calculate child's position relative to frame's top-left
  const relativeX = child.x - this.x;
  const relativeY = child.y - this.y;

  child._relativeToFrame = { x: relativeX, y: relativeY };
  child._oldRelativePosition = { x: relativeX, y: relativeY };

  this.relativeChildren.push(child);
  this.children.push(child);
};

// Move frame and reposition children at their stored old relative position inside frame
FrameMorph.prototype.moveTo = function(newX, newY) {
  this.x = newX;
  this.y = newY;

  this.relativeChildren.forEach(child => {
    child.x = this.x + child._oldRelativePosition.x;
    child.y = this.y + child._oldRelativePosition.y;
  });
};

FrameMorph.prototype.moveBy = function(dx, dy) {
  this.moveTo(this.x + dx, this.y + dy);
};

// Clamp value between min and max
FrameMorph._clamp = function(value, min, max) {
  return Math.min(Math.max(value, min), max);
};

// Tick: check if dragging frame, lock children positions, and
// **detect if child has been moved independently** -- clamp or update old position accordingly
FrameMorph.prototype.tick = function() {
  if (this._isDragging) {
    // When dragging frame, keep children locked at their old relative positions
    this.relativeChildren.forEach(child => {
      child.x = this.x + child._oldRelativePosition.x;
      child.y = this.y + child._oldRelativePosition.y;
    });
  } else {
    // Not dragging frame, check children positions for moves outside frame or inside updates
    this.relativeChildren.forEach(child => {
      // Calculate child's position relative to frame
      const relX = child.x - this.x;
      const relY = child.y - this.y;

      // Clamp relative position to frame's bounds (with optional padding)
      const clampedX = FrameMorph._clamp(relX, 0, this.width - child.width);
      const clampedY = FrameMorph._clamp(relY, 0, this.height - child.height);

      if (relX !== clampedX || relY !== clampedY) {
        // Child moved outside frame - clamp it back inside
        child.x = this.x + clampedX;
        child.y = this.y + clampedY;
        // Also update old relative position because child visually snaps inside
        child._oldRelativePosition.x = clampedX;
        child._oldRelativePosition.y = clampedY;
      } else {
        // Child moved inside frame, update old relative position
        child._oldRelativePosition.x = relX;
        child._oldRelativePosition.y = relY;
      }

      // Tick child if it has tick method
      if (typeof child.tick === 'function') child.tick();
    });
  }
};

// Draw frame and children normally
FrameMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  ctx.globalAlpha = this.opacity;

  const centerX = this.x + this.width / 2;
  const centerY = this.y + this.height / 2;

  ctx.translate(centerX, centerY);
  ctx.rotate((this.rotation || 0) * Math.PI / 180);
  ctx.translate(-centerX, -centerY);

  if (this.active || this.hover) {
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.shadowBlur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
  } else {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, this.fillColor);

  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);

  ctx.restore();

  this.relativeChildren.forEach(child => {
    child.draw(ctx);
  });
};

FrameMorph.prototype.containsPoint = function(x, y) {
  return x >= this.x && x <= this.x + this.width &&
         y >= this.y && y <= this.y + this.height;
};




// --- ShadowMorph ---
function ShadowMorph(x, y, width, height, options) {
  options = options || {};
  Morph.call(this, x, y, width, height, options);
  this.shadowColor = options.shadowColor || 'rgba(0,0,0,0.5)';
  this.shadowBlur = options.shadowBlur || 10;
  this.shadowOffsetX = options.shadowOffsetX || 5;
  this.shadowOffsetY = options.shadowOffsetY || 5;
}
extend(ShadowMorph, Morph);

ShadowMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  ctx.globalAlpha = this.opacity;

  ctx.shadowColor = this.shadowColor;
  ctx.shadowBlur = this.shadowBlur;
  ctx.shadowOffsetX = this.shadowOffsetX;
  ctx.shadowOffsetY = this.shadowOffsetY;

  ctx.fillStyle = this.fillColor || 'transparent';

  ctx.fillRect(this.x, this.y, this.width, this.height);

  ctx.restore();

  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// --- ColorPickerMorph ---
function ColorPickerMorph(x, y, size, options) {
  options = options || {};
  Morph.call(this, x, y, size, size, options);
  this.selectedColor = options.selectedColor || '#ff0000';
}
extend(ColorPickerMorph, Morph);

ColorPickerMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  const centerX = this.x + this.width / 2;
  const centerY = this.y + this.height / 2;

  ctx.translate(centerX, centerY);
  ctx.rotate((this.rotation || 0) * Math.PI / 180);
  ctx.translate(-centerX, -centerY);

  // Draw color wheel background (simplified solid for now)
  ctx.fillStyle = this.selectedColor;
  ctx.beginPath();
  ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, 2 * Math.PI);
  ctx.fill();

  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor || '#000';
  ctx.stroke();

  ctx.restore();

  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// --- CursorMorph ---
function CursorMorph(x, y, width, height, options) {
  options = options || {};
  Morph.call(this, x, y, width, height, options);
  this.cursorType = options.cursorType || 'default'; // Could be 'pointer', 'text', 'crosshair', etc.
}
extend(CursorMorph, Morph);

CursorMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  // For simplicity, draw a basic arrow cursor shape or text cursor depending on cursorType
  ctx.fillStyle = this.fillColor;
  ctx.strokeStyle = this.outlineColor;
  ctx.lineWidth = this.outlineThickness;

  ctx.beginPath();
  if (this.cursorType === 'text') {
    // draw I-beam
    ctx.moveTo(this.x + this.width/2, this.y);
    ctx.lineTo(this.x + this.width/2, this.y + this.height);
    ctx.moveTo(this.x + this.width/4, this.y + this.height/4);
    ctx.lineTo(this.x + 3*this.width/4, this.y + this.height/4);
    ctx.moveTo(this.x + this.width/4, this.y + 3*this.height/4);
    ctx.lineTo(this.x + 3*this.width/4, this.y + 3*this.height/4);
  } else if (this.cursorType === 'crosshair') {
    ctx.moveTo(this.x + this.width/2, this.y);
    ctx.lineTo(this.x + this.width/2, this.y + this.height);
    ctx.moveTo(this.x, this.y + this.height/2);
    ctx.lineTo(this.x + this.width, this.y + this.height/2);
  } else {
    // arrow cursor (simplified)
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x + this.width/2, this.y + this.height/2);
    ctx.lineTo(this.x, this.y + this.height);
    ctx.lineTo(this.x + this.width/4, this.y + this.height/2);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();

  ctx.restore();
};

// --- BlockMorph ---
function BlockMorph(x, y, width, height, shape, color, options) {
  options = options || {};
  Morph.call(this, x, y, width, height, options);
  this.shape = shape || 'I'; // I, L, T, O, S, Z, J
  this.blockColor = color || '#3399ff';
  this.fillColor = this.blockColor;
  this.draggable = options.draggable !== false;
  this.cornerRadius = 8;
  this.outlineThickness = 2;
  this.outlineColor = '#000';
  this.blockSize = 30;
  this.blocks = this._getShapeBlocks();
}
extend(BlockMorph, Morph);

BlockMorph.prototype._getShapeBlocks = function() {
  const shapes = {
    'I': [[0,0], [1,0], [2,0], [3,0]],
    'L': [[0,0], [0,1], [0,2], [1,2]],
    'T': [[0,1], [1,0], [1,1], [1,2]],
    'O': [[0,0], [0,1], [1,0], [1,1]],
    'S': [[0,1], [1,0], [1,1], [2,0]],
    'Z': [[0,0], [1,0], [1,1], [2,1]],
    'J': [[0,2], [1,0], [1,1], [1,2]],
    'bar': [[0,0], [1,0], [2,0]],
    'small': [[0,0]]
  };
  return shapes[this.shape] || shapes['I'];
};

BlockMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  ctx.globalAlpha = this.opacity;

  if (this.active || this.hover) {
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.shadowBlur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
  }

  // Draw each block in the shape
  this.blocks.forEach(block => {
    const blockX = this.x + block[0] * this.blockSize;
    const blockY = this.y + block[1] * this.blockSize;

    // Draw block with rounded corners
    this._drawRoundedRect(ctx, blockX, blockY, this.blockSize, this.blockSize, this.cornerRadius, this.blockColor);

    // Draw outline
    ctx.lineWidth = this.outlineThickness;
    ctx.strokeStyle = this.outlineColor;
    this._drawRoundedRectStroke(ctx, blockX, blockY, this.blockSize, this.blockSize, this.cornerRadius);

    // Add highlight effect
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    this._drawRoundedRect(ctx, blockX + 2, blockY + 2, this.blockSize - 10, 8, 3, 'rgba(255,255,255,0.3)');
  });

  ctx.restore();

  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// --- ScratchBlockMorph ---
function ScratchBlockMorph(x, y, text, color, blockType, options) {
  options = options || {};
  var inputs = options.inputs || [];
  var width = Math.max(text.length * 8 + inputs.length * 60 + 20, 120);
  var height = blockType === 'c_block' ? 60 : 30;

  Morph.call(this, x, y, width, height, options);
  this.text = text;
  this.blockColor = color;
  this.fillColor = color;
  this.blockType = blockType; // 'command', 'hat', 'c_block', 'cap', 'reporter', 'boolean'
  this.shape = options.shape || 'puzzle';
  this.cornerRadius = 5;
  this.outlineColor = '#000';
  this.outlineThickness = 1;
  this.draggable = options.draggable !== false;
  this.isPalette = options.isPalette || false;
  this.connectAbove = null;
  this.connectBelow = null;
  this.isConnected = false;
  this.inputs = [];
  this.targetSprite = options.targetSprite || (selectedSprite ? selectedSprite.spriteName : 'Sprite1');

  // Create input fields
  this.createInputFields(inputs);
}
extend(ScratchBlockMorph, Morph);

ScratchBlockMorph.prototype.createInputFields = function(inputDefs) {
  inputDefs.forEach(function(inputDef, index) {
    var input = {
      type: inputDef.type,
      value: inputDef.default || '',
      x: 0,
      y: 0,
      width: inputDef.type === 'number' ? 40 : 60,
      height: 18,
      isEditing: false
    };
    this.inputs.push(input);
  }.bind(this));

  this.updateInputPositions();
};

ScratchBlockMorph.prototype.updateInputPositions = function() {
  var textParts = this.text.split('[]');
  var currentX = this.x + 10;
  var currentY = this.y + (this.height - 18) / 2;

  this.inputs.forEach(function(input, index) {
    // Calculate position based on text layout
    var textBeforeInput = textParts.slice(0, index + 1).join('');
    input.x = currentX + textBeforeInput.length * 7;
    input.y = currentY;
  });
};

ScratchBlockMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  ctx.globalAlpha = this.opacity;

  if (this.active || this.hover) {
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.shadowBlur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
  }

  // Draw block shape based on type
  this._drawBlockShape(ctx);

  // Update input positions
  this.updateInputPositions();

  // Draw text and inputs
  this._drawTextWithInputs(ctx);

  ctx.restore();

  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

ScratchBlockMorph.prototype._drawTextWithInputs = function(ctx) {
  var textParts = this.text.split('[]');
  var startX = this.x + (this.blockType === 'boolean' ? 15 : 10);
  var currentX = startX;
  var textY = this.y + this.height / 2;

  ctx.fillStyle = '#fff';
  ctx.font = this.blockType === 'boolean' ? '11px Arial' : '12px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  // For boolean blocks, center the text horizontally
  if (this.blockType === 'boolean') {
    var totalTextWidth = 0;
    textParts.forEach(function(part, index) {
      totalTextWidth += part.length * 6;
      if (index < this.inputs.length) {
        totalTextWidth += this.inputs[index].width + 5;
      }
    }.bind(this));
    currentX = this.x + (this.width - totalTextWidth) / 2;
  }

  textParts.forEach(function(part, index) {
    // Draw text part
    if (part.trim()) {
      ctx.fillText(part, currentX, textY);
    }
    currentX += part.length * (this.blockType === 'boolean' ? 6 : 7);

    // Draw input field if exists
    if (index < this.inputs.length) {
      var input = this.inputs[index];

      // Update input position
      input.x = currentX;
      input.y = this.y + (this.height - input.height) / 2;

      // Draw input background
      ctx.fillStyle = input.isEditing ? '#fff' : 'rgba(255,255,255,0.9)';
      ctx.fillRect(input.x, input.y, input.width, input.height);

      // Draw input border
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(input.x, input.y, input.width, input.height);

      // Draw input text
      ctx.fillStyle = input.isEditing ? '#000' : '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(input.value || '', input.x + input.width/2, input.y + input.height/2);

      currentX += input.width + 5;
      ctx.fillStyle = '#fff';
      ctx.font = this.blockType === 'boolean' ? '11px Arial' : '12px Arial';
      ctx.textAlign = 'left';
    }
  }.bind(this));
};

ScratchBlockMorph.prototype._drawBlockShape = function(ctx) {
  ctx.fillStyle = this.blockColor;
  ctx.strokeStyle = this.outlineColor;
  ctx.lineWidth = this.outlineThickness;

  if (this.blockType === 'hat') {
    // Hat block (rounded top)
    this._drawHatBlock(ctx);
  } else if (this.blockType === 'cap') {
    // Cap block (rounded bottom)
    this._drawCapBlock(ctx);
  } else if (this.blockType === 'reporter') {
    // Oval reporter block
    this._drawReporterBlock(ctx);
  } else if (this.blockType === 'boolean') {
    // Hexagonal boolean block
    this._drawBooleanBlock(ctx);
  } else if (this.blockType === 'c_block') {
    // C-shaped control block
    this._drawCBlock(ctx);
  } else {
    // Regular command block
    this._drawCommandBlock(ctx);
  }
};

ScratchBlockMorph.prototype._drawHatBlock = function(ctx) {
  // Use existing rounded rect method
  this._drawRoundedRect(ctx, this.x, this.y + 10, this.width, this.height - 10, this.cornerRadius, this.blockColor);
  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y + 10, this.width, this.height - 10, this.cornerRadius);

  // Top curved part
  ctx.beginPath();
  ctx.ellipse(this.x + this.width/2, this.y + 8, this.width/3, 8, 0, 0, Math.PI);
  ctx.fillStyle = this.blockColor;
  ctx.fill();
  ctx.strokeStyle = this.outlineColor;
  ctx.stroke();
};

ScratchBlockMorph.prototype._drawCapBlock = function(ctx) {
  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height - 5, this.cornerRadius, this.blockColor);
  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height - 5, this.cornerRadius);
};

ScratchBlockMorph.prototype._drawReporterBlock = function(ctx) {
  ctx.beginPath();
  ctx.ellipse(this.x + this.width/2, this.y + this.height/2, this.width/2, this.height/2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
};

ScratchBlockMorph.prototype._drawBooleanBlock = function(ctx) {
  // Hexagonal boolean block with better proportions
  var h = this.height;
  var w = this.width;
  var indent = Math.min(h/2, 12); // Limit indent for better text space

  ctx.beginPath();
  ctx.moveTo(this.x + indent, this.y);
  ctx.lineTo(this.x + w - indent, this.y);
  ctx.lineTo(this.x + w, this.y + h/2);
  ctx.lineTo(this.x + w - indent, this.y + h);
  ctx.lineTo(this.x + indent, this.y + h);
  ctx.lineTo(this.x, this.y + h/2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

ScratchBlockMorph.prototype._drawCBlock = function(ctx) {
  // Draw main block
  ctx.fillRect(this.x, this.y, this.width, 25);
  ctx.strokeRect(this.x, this.y, this.width, 25);

  // Draw side arms
  ctx.fillRect(this.x, this.y + 25, 15, this.height - 50);
  ctx.strokeRect(this.x, this.y + 25, 15, this.height - 50);

  ctx.fillRect(this.x + this.width - 15, this.y + 25, 15, this.height - 50);
  ctx.strokeRect(this.x + this.width - 15, this.y + 25, 15, this.height - 50);

  // Draw bottom
  ctx.fillRect(this.x, this.y + this.height - 25, this.width, 25);
  ctx.strokeRect(this.x, this.y + this.height - 25, this.width, 25);
};

ScratchBlockMorph.prototype._drawCommandBlock = function(ctx) {
  this._drawPuzzlePiece(ctx);
};

ScratchBlockMorph.prototype._drawPuzzlePiece = function(ctx) {
  ctx.fillStyle = this.blockColor;
  ctx.strokeStyle = this.outlineColor;
  ctx.lineWidth = this.outlineThickness;

  ctx.beginPath();

  // Draw puzzle piece shape like in the image
  var x = this.x, y = this.y, w = this.width, h = this.height;
  var notchW = 15, notchH = 4;

  // Start from top-left
  ctx.moveTo(x + this.cornerRadius, y);

  // Top edge with input notch (if not hat block)
  if (this.blockType !== 'hat' && !this.isConnected) {
    ctx.lineTo(x + 20, y);
    ctx.lineTo(x + 20 + notchW/2, y - notchH);
    ctx.lineTo(x + 20 + notchW, y);
  }
  ctx.lineTo(x + w - this.cornerRadius, y);

  // Top-right corner
  ctx.arcTo(x + w, y, x + w, y + this.cornerRadius, this.cornerRadius);

  // Right edge
  ctx.lineTo(x + w, y + h - this.cornerRadius);

  // Bottom-right corner
  ctx.arcTo(x + w, y + h, x + w - this.cornerRadius, y + h, this.cornerRadius);

  // Bottom edge with output notch (if not cap block)
  if (this.blockType !== 'cap') {
    ctx.lineTo(x + 20 + notchW, y + h);
    ctx.lineTo(x + 20 + notchW/2, y + h + notchH);
    ctx.lineTo(x + 20, y + h);
  }
  ctx.lineTo(x + this.cornerRadius, y + h);

  // Bottom-left corner
  ctx.arcTo(x, y + h, x, y + h - this.cornerRadius, this.cornerRadius);

  // Left edge
  ctx.lineTo(x, y + this.cornerRadius);

  // Top-left corner
  ctx.arcTo(x, y, x + this.cornerRadius, y, this.cornerRadius);

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Add shadow effect
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 2, y + h - 3, w - 4, 3);
};

ScratchBlockMorph.prototype.onDragEnd = function() {
  // Check for connection to other blocks
  this._checkForConnection();
};

ScratchBlockMorph.prototype.onTouchEnd = function(evt) {
  // Check for connection to other blocks on touch end
  this._checkForConnection();
};

ScratchBlockMorph.prototype._checkForConnection = function() {
  if (!this.world) return;

  // Simple connection logic - snap to nearby blocks
  var snapDistance = 20;
  var connected = false;

  for (var i = 0; i < this.world.morphs.length; i++) {
    var otherBlock = this.world.morphs[i];
    if (otherBlock instanceof ScratchBlockMorph && otherBlock !== this) {
      var distance = Math.sqrt(
        Math.pow(this.x - otherBlock.x, 2) + 
        Math.pow(this.y - (otherBlock.y + otherBlock.height), 2)
      );

      if (distance < snapDistance && !otherBlock.connectBelow && !this.connectAbove) {
        // Snap this block below the other block
        this.x = otherBlock.x;
        this.y = otherBlock.y + otherBlock.height - 3;
        this.connectAbove = otherBlock;
        otherBlock.connectBelow = this;
        this.isConnected = true;
        connected = true;
        break;
      }
    }
  }

  if (!connected) {
    this.isConnected = false;
    this.connectAbove = null;
    if (this.connectBelow) {
      this.connectBelow.connectAbove = null;
      this.connectBelow.isConnected = false;
    }
    this.connectBelow = null;
  }
};

// --- SpeechBubbleMorph ---
function SpeechBubbleMorph(x, y, text, options) {
  options = options || {};
  
  // Calculate bubble size based on text
  var padding = options.padding || 10;
  var maxWidth = options.maxWidth || 200;
  var lineHeight = options.lineHeight || 16;
  var font = options.font || '12px Arial';
  
  // Estimate text dimensions (rough calculation)
  var words = text.split(' ');
  var lines = [];
  var currentLine = '';
  var wordsPerLine = Math.floor(maxWidth / 60); // rough estimate
  
  for (var i = 0; i < words.length; i++) {
    if (currentLine.split(' ').length >= wordsPerLine && currentLine !== '') {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine += (currentLine === '' ? '' : ' ') + words[i];
    }
  }
  if (currentLine !== '') lines.push(currentLine);
  
  var width = Math.min(maxWidth, Math.max(text.length * 7, 80)) + padding * 2;
  var height = lines.length * lineHeight + padding * 2;
  
  Morph.call(this, x, y, width, height, options);
  
  this.text = text;
  this.lines = lines;
  this.font = font;
  this.textColor = options.textColor || '#000';
  this.bubbleColor = options.bubbleColor || '#fff';
  this.borderColor = options.borderColor || '#333';
  this.borderWidth = options.borderWidth || 2;
  this.tailHeight = options.tailHeight || 15;
  this.tailWidth = options.tailWidth || 20;
  this.tailOffset = options.tailOffset || 30; // from left edge
  this.cornerRadius = options.cornerRadius || 8;
  this.lineHeight = lineHeight;
  this.padding = padding;
  this.duration = options.duration || 3000; // ms to show bubble
  this.fadeOut = options.fadeOut !== false;
  this.targetSprite = options.targetSprite || null;
  
  // Auto-positioning relative to target sprite
  if (this.targetSprite) {
    this.x = this.targetSprite.x + this.targetSprite.width/2 - this.width/2;
    this.y = this.targetSprite.y - this.height - this.tailHeight - 5;
    
    // Keep bubble on screen
    if (this.x < 10) this.x = 10;
    if (this.x + this.width > (this.world ? this.world.width - 10 : 800)) {
      this.x = (this.world ? this.world.width - 10 : 800) - this.width;
    }
    if (this.y < 10) {
      this.y = this.targetSprite.y + this.targetSprite.height + this.tailHeight + 5;
      this.tailPointingUp = true;
    }
  }
  
  // Auto-remove after duration
  if (this.duration > 0) {
    setTimeout(function() {
      if (this.world && this.fadeOut) {
        this.fadeOutAndRemove();
      } else if (this.world) {
        this.world.removeMorph(this);
      }
    }.bind(this), this.duration);
  }
}
extend(SpeechBubbleMorph, Morph);

SpeechBubbleMorph.prototype.fadeOutAndRemove = function() {
  var fadeSpeed = 0.05;
  var fadeInterval = setInterval(function() {
    this.opacity -= fadeSpeed;
    if (this.opacity <= 0) {
      clearInterval(fadeInterval);
      if (this.world) {
        this.world.removeMorph(this);
      }
    }
  }.bind(this), 16); // ~60fps
};

SpeechBubbleMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();
  
  ctx.globalAlpha = this.opacity;
  
  // Draw bubble with tail
  this._drawSpeechBubble(ctx);
  
  // Draw text
  this._drawText(ctx);
  
  ctx.restore();
  
  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

SpeechBubbleMorph.prototype._drawSpeechBubble = function(ctx) {
  ctx.fillStyle = this.bubbleColor;
  ctx.strokeStyle = this.borderColor;
  ctx.lineWidth = this.borderWidth;
  
  // Main bubble (rounded rectangle)
  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, this.bubbleColor);
  
  // Draw tail pointing to sprite
  ctx.beginPath();
  if (this.tailPointingUp) {
    // Tail pointing up (bubble below sprite)
    ctx.moveTo(this.x + this.tailOffset, this.y);
    ctx.lineTo(this.x + this.tailOffset - this.tailWidth/2, this.y - this.tailHeight);
    ctx.lineTo(this.x + this.tailOffset + this.tailWidth/2, this.y - this.tailHeight);
  } else {
    // Tail pointing down (bubble above sprite)
    ctx.moveTo(this.x + this.tailOffset, this.y + this.height);
    ctx.lineTo(this.x + this.tailOffset - this.tailWidth/2, this.y + this.height + this.tailHeight);
    ctx.lineTo(this.x + this.tailOffset + this.tailWidth/2, this.y + this.height + this.tailHeight);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  // Draw border for main bubble
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);
};

SpeechBubbleMorph.prototype._drawText = function(ctx) {
  ctx.fillStyle = this.textColor;
  ctx.font = this.font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  
  var startY = this.y + this.padding;
  
  this.lines.forEach(function(line, index) {
    var textY = startY + (index * this.lineHeight);
    ctx.fillText(line, this.x + this.padding, textY);
  }.bind(this));
};

// --- AppMorph ---
function AppMorph(x, y, width, height, options) {
  options = options || {};
  Morph.call(this, x, y, width, height, options);
  this.title = options.title || 'AppMorph';
  this.menuItems = options.menuItems || [];
  this.statusText = options.statusText || '';
}
extend(AppMorph, Morph);

AppMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  ctx.globalAlpha = this.opacity;

  const centerX = this.x + this.width / 2;
  const centerY = this.y + this.height / 2;

  ctx.translate(centerX, centerY);
  ctx.rotate((this.rotation || 0) * Math.PI / 180);
  ctx.translate(-centerX, -centerY);

  // Background
  ctx.fillStyle = this.fillColor || '#fff';
  ctx.fillRect(this.x, this.y, this.width, this.height);

  // Border
  ctx.lineWidth = this.outlineThickness || 2;
  ctx.strokeStyle = this.outlineColor || '#000';
  ctx.strokeRect(this.x, this.y, this.width, this.height);

  // Title bar
  ctx.fillStyle = '#444';
  ctx.fillRect(this.x, this.y, this.width, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 18px Arial';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(this.title, this.x + 10, this.y + 15);

  // Draw menu items
  ctx.fillStyle = '#eee';
  ctx.font = '14px Arial';
  this.menuItems.forEach((item, i) => {
    ctx.fillText(item, this.x + 10, this.y + 40 + i * 20);
  });

  // Status text at bottom
  if(this.statusText){
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(this.statusText, this.x + this.width - 10, this.y + this.height - 10);
  }

  ctx.restore();

  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// --- ScratchBlockMorph ---
function ScratchBlockMorph(x, y, text, color, blockType, options) {
  options = options || {};
  var inputs = options.inputs || [];
  var width = Math.max(text.length * 8 + inputs.length * 60 + 20, 120);
  var height = blockType === 'c_block' ? 95 : 30;

  Morph.call(this, x, y, width, height, options);
  this.text = text;
  this.blockColor = color;
  this.fillColor = color;
  this.blockType = blockType;
  this.shape = options.shape || 'puzzle';
  this.cornerRadius = 5;
  this.outlineColor = '#000';
  this.outlineThickness = 1;
  this.draggable = options.draggable !== false;
  this.isPalette = options.isPalette || false;
  this.connectAbove = null;
  this.connectBelow = null;
  this.isConnected = false;
  this.inputs = [];
  this.targetSprite = options.targetSprite || 'Sprite1';
  this.insideCBlock = false;

  this.createInputFields(inputs);
}
extend(ScratchBlockMorph, Morph);

ScratchBlockMorph.prototype.createInputFields = function(inputDefs) {
  inputDefs.forEach(function(inputDef, index) {
    var input = {
      type: inputDef.type,
      value: inputDef.default || '',
      x: 0,
      y: 0,
      width: inputDef.type === 'number' ? 40 : 60,
      height: 18,
      isEditing: false
    };
    this.inputs.push(input);
  }.bind(this));

  this.updateInputPositions();
};

ScratchBlockMorph.prototype.updateInputPositions = function() {
  var textParts = this.text.split('[]');
  var currentX = this.x + 10;
  var currentY = this.y + (this.height - 18) / 2;

  this.inputs.forEach(function(input, index) {
    var textBeforeInput = textParts.slice(0, index + 1).join('');
    input.x = currentX + textBeforeInput.length * 7;
    input.y = currentY;
  });
};

ScratchBlockMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();

  ctx.globalAlpha = this.opacity;

  if (this.active || this.hover) {
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.shadowBlur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
  }

  this._drawBlockShape(ctx);
  this.updateInputPositions();
  this._drawTextWithInputs(ctx);

  ctx.restore();

  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

ScratchBlockMorph.prototype._drawTextWithInputs = function(ctx) {
  var textParts = this.text.split('[]');
  var startX = this.x + (this.blockType === 'boolean' ? 15 : 10);
  var currentX = startX;
  var textY;
  
  if (this.blockType === 'c_block') {
    textY = this.y + 15;
  } else {
    textY = this.y + this.height / 2;
  }

  ctx.fillStyle = '#fff';
  ctx.font = this.blockType === 'boolean' ? '11px Arial' : '12px Arial';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  if (this.blockType === 'boolean') {
    var totalTextWidth = 0;
    textParts.forEach(function(part, index) {
      totalTextWidth += part.length * 6;
      if (index < this.inputs.length) {
        totalTextWidth += this.inputs[index].width + 5;
      }
    }.bind(this));
    currentX = this.x + (this.width - totalTextWidth) / 2;
  }

  textParts.forEach(function(part, index) {
    if (part.trim()) {
      ctx.fillText(part, currentX, textY);
    }
    currentX += part.length * (this.blockType === 'boolean' ? 6 : 7);

    if (index < this.inputs.length) {
      var input = this.inputs[index];

      input.x = currentX;
      if (this.blockType === 'c_block') {
        input.y = this.y + (30 - input.height) / 2;
      } else {
        input.y = this.y + (this.height - input.height) / 2;
      }

      ctx.fillStyle = input.isEditing ? '#fff' : 'rgba(255,255,255,0.9)';
      ctx.fillRect(input.x, input.y, input.width, input.height);

      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.strokeRect(input.x, input.y, input.width, input.height);

      ctx.fillStyle = input.isEditing ? '#000' : '#333';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(input.value || '', input.x + input.width/2, input.y + input.height/2);

      currentX += input.width + 5;
      ctx.fillStyle = '#fff';
      ctx.font = this.blockType === 'boolean' ? '11px Arial' : '12px Arial';
      ctx.textAlign = 'left';
    }
  }.bind(this));
};

ScratchBlockMorph.prototype._drawBlockShape = function(ctx) {
  ctx.fillStyle = this.blockColor;
  ctx.strokeStyle = this.outlineColor;
  ctx.lineWidth = this.outlineThickness;

  if (this.blockType === 'hat') {
    this._drawHatBlock(ctx);
  } else if (this.blockType === 'cap') {
    this._drawCapBlock(ctx);
  } else if (this.blockType === 'reporter') {
    this._drawReporterBlock(ctx);
  } else if (this.blockType === 'boolean') {
    this._drawBooleanBlock(ctx);
  } else if (this.blockType === 'c_block') {
    this._drawCBlock(ctx);
  } else {
    this._drawCommandBlock(ctx);
  }
};

ScratchBlockMorph.prototype._drawHatBlock = function(ctx) {
  ctx.fillStyle = this.blockColor;
  ctx.strokeStyle = this.outlineColor;
  ctx.lineWidth = this.outlineThickness;

  var domeWidth = this.width * 0.4;
  var domeHeight = 8;
  var domeX = this.x + this.cornerRadius;
  var baseY = this.y + domeHeight;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-over';
  ctx.fillStyle = this.blockColor;
  ctx.strokeStyle = this.outlineColor;
  ctx.beginPath();
  ctx.arc(domeX + domeWidth/2, baseY, domeWidth/2, Math.PI, 0, false);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(domeX, baseY);
  ctx.lineTo(this.x + this.width - this.cornerRadius, baseY);
  ctx.arcTo(this.x + this.width, baseY, this.x + this.width, baseY + this.cornerRadius, this.cornerRadius);
  ctx.lineTo(this.x + this.width, this.y + this.height - this.cornerRadius);
  ctx.arcTo(this.x + this.width, this.y + this.height, this.x + this.width - this.cornerRadius, this.y + this.height, this.cornerRadius);
  ctx.lineTo(this.x + this.cornerRadius, this.y + this.height);
  ctx.arcTo(this.x, this.y + this.height, this.x, this.y + this.height - this.cornerRadius, this.cornerRadius);
  ctx.lineTo(this.x, baseY + this.cornerRadius);
  ctx.arcTo(this.x, baseY, domeX, baseY, this.cornerRadius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

ScratchBlockMorph.prototype._drawCapBlock = function(ctx) {
  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height - 5, this.cornerRadius, this.blockColor);
  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height - 5, this.cornerRadius);
};

ScratchBlockMorph.prototype._drawReporterBlock = function(ctx) {
  ctx.beginPath();
  ctx.ellipse(this.x + this.width/2, this.y + this.height/2, this.width/2, this.height/2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
};

ScratchBlockMorph.prototype._drawBooleanBlock = function(ctx) {
  var h = this.height;
  var w = this.width;
  var indent = Math.min(h/2, 12);

  ctx.beginPath();
  ctx.moveTo(this.x + indent, this.y);
  ctx.lineTo(this.x + w - indent, this.y);
  ctx.lineTo(this.x + w, this.y + h/2);
  ctx.lineTo(this.x + w - indent, this.y + h);
  ctx.lineTo(this.x + indent, this.y + h);
  ctx.lineTo(this.x, this.y + h/2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

ScratchBlockMorph.prototype._drawCBlock = function(ctx) {
  var innerIndent = 20;
  var topHeight = 30;
  var bottomHeight = 25;
  
  this._updateCBlockHeight();
  
  ctx.fillStyle = this.blockColor;
  ctx.strokeStyle = this.outlineColor;
  ctx.lineWidth = this.outlineThickness;
  
  ctx.beginPath();
  ctx.moveTo(this.x, this.y);
  ctx.lineTo(this.x + this.width, this.y);
  ctx.lineTo(this.x + this.width, this.y + topHeight);
  ctx.lineTo(this.x + innerIndent, this.y + topHeight);
  ctx.lineTo(this.x + innerIndent, this.y + this.height - bottomHeight);
  ctx.lineTo(this.x + this.width, this.y + this.height - bottomHeight);
  ctx.lineTo(this.x + this.width, this.y + this.height);
  ctx.lineTo(this.x, this.y + this.height);
  ctx.lineTo(this.x, this.y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  
  var trapW = 20;
  var trapH = 6;
  var trapOffset = 25;
  
  if (!this.isConnected) {
    ctx.fillStyle = this.blockColor;
    ctx.beginPath();
    ctx.moveTo(this.x + trapOffset, this.y);
    ctx.lineTo(this.x + trapOffset + 3, this.y - trapH);
    ctx.lineTo(this.x + trapOffset + trapW - 3, this.y - trapH);
    ctx.lineTo(this.x + trapOffset + trapW, this.y);
    ctx.lineTo(this.x + trapOffset, this.y);
    ctx.fill();
    ctx.stroke();
  }
  
  ctx.fillStyle = this.blockColor;
  ctx.beginPath();
  ctx.moveTo(this.x + trapOffset, this.y + this.height);
  ctx.lineTo(this.x + trapOffset + 3, this.y + this.height + trapH);
  ctx.lineTo(this.x + trapOffset + trapW - 3, this.y + this.height + trapH);
  ctx.lineTo(this.x + trapOffset + trapW, this.y + this.height);
  ctx.lineTo(this.x + trapOffset, this.y + this.height);
  ctx.fill();
  ctx.stroke();
};

ScratchBlockMorph.prototype._drawCommandBlock = function(ctx) {
  this._drawPuzzlePiece(ctx);
};

ScratchBlockMorph.prototype._drawPuzzlePiece = function(ctx) {
  ctx.fillStyle = this.blockColor;
  ctx.strokeStyle = this.outlineColor;
  ctx.lineWidth = this.outlineThickness;

  ctx.beginPath();

  var x = this.x, y = this.y, w = this.width, h = this.height;
  var trapW = 20;
  var trapH = 6;
  var trapOffset = 25;

  ctx.moveTo(x + this.cornerRadius, y);

  if (this.blockType !== 'hat' && !this.isConnected) {
    ctx.lineTo(x + trapOffset, y);
    ctx.lineTo(x + trapOffset + 3, y - trapH);
    ctx.lineTo(x + trapOffset + trapW - 3, y - trapH);
    ctx.lineTo(x + trapOffset + trapW, y);
  }
  ctx.lineTo(x + w - this.cornerRadius, y);

  ctx.arcTo(x + w, y, x + w, y + this.cornerRadius, this.cornerRadius);
  ctx.lineTo(x + w, y + h - this.cornerRadius);
  ctx.arcTo(x + w, y + h, x + w - this.cornerRadius, y + h, this.cornerRadius);

  if (this.blockType !== 'cap') {
    ctx.lineTo(x + trapOffset + trapW, y + h);
    ctx.lineTo(x + trapOffset + trapW - 3, y + h - trapH);
    ctx.lineTo(x + trapOffset + 3, y + h - trapH);
    ctx.lineTo(x + trapOffset, y + h);
  }
  ctx.lineTo(x + this.cornerRadius, y + h);

  ctx.arcTo(x, y + h, x, y + h - this.cornerRadius, this.cornerRadius);
  ctx.lineTo(x, y + this.cornerRadius);
  ctx.arcTo(x, y, x + this.cornerRadius, y, this.cornerRadius);

  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 2, y + h - 3, w - 4, 3);
};

ScratchBlockMorph.prototype.onDragEnd = function() {
  this._checkForConnection();
};

ScratchBlockMorph.prototype.onTouchEnd = function(evt) {
  this._checkForConnection();
};

ScratchBlockMorph.prototype._checkForConnection = function() {
  if (!this.world) return;

  var snapDistance = 20;
  var connected = false;

  for (var i = 0; i < this.world.morphs.length; i++) {
    var otherBlock = this.world.morphs[i];
    if (otherBlock instanceof ScratchBlockMorph && otherBlock !== this) {
      var distance = Math.sqrt(
        Math.pow(this.x - otherBlock.x, 2) + 
        Math.pow(this.y - (otherBlock.y + otherBlock.height), 2)
      );

      if (distance < snapDistance && !otherBlock.connectBelow && !this.connectAbove) {
        this.x = otherBlock.x;
        this.y = otherBlock.y + otherBlock.height - 3;
        this.connectAbove = otherBlock;
        otherBlock.connectBelow = this;
        this.isConnected = true;
        
        if (otherBlock.insideCBlock) {
          this.insideCBlock = true;
        }
        
        connected = true;
        break;
      }
      
      if (otherBlock.blockType === 'c_block' && !this.connectAbove) {
        var innerX = otherBlock.x + 20;
        var innerY = otherBlock.y + 30;
        var innerDistance = Math.sqrt(
          Math.pow(this.x - innerX, 2) + 
          Math.pow(this.y - innerY, 2)
        );
        
        if (innerDistance < snapDistance * 2) {
          var existingInnerBlocks = [];
          for (var j = 0; j < this.world.morphs.length; j++) {
            var existingBlock = this.world.morphs[j];
            if (existingBlock instanceof ScratchBlockMorph && 
                existingBlock.connectAbove === otherBlock && 
                existingBlock.insideCBlock &&
                existingBlock !== this) {
              existingInnerBlocks.push(existingBlock);
            }
          }
          
          if (existingInnerBlocks.length > 0) {
            var bottomBlock = existingInnerBlocks[0];
            existingInnerBlocks.forEach(function(block) {
              var current = block;
              while (current.connectBelow) {
                current = current.connectBelow;
              }
              if (current.y + current.height > bottomBlock.y + bottomBlock.height) {
                bottomBlock = current;
              }
            });
            
            this.x = bottomBlock.x;
            this.y = bottomBlock.y + bottomBlock.height - 3;
            this.connectAbove = bottomBlock;
            bottomBlock.connectBelow = this;
            this.isConnected = true;
            this.insideCBlock = true;
          } else {
            this.x = innerX;
            this.y = innerY;
            this.connectAbove = otherBlock;
            this.isConnected = true;
            this.insideCBlock = true;
          }
          
          connected = true;
          otherBlock._updateCBlockHeight();
          break;
        }
      }
    }
  }

  if (!connected) {
    this.isConnected = false;
    var wasInsideCBlock = this.insideCBlock;
    var previousAbove = this.connectAbove;
    
    this.connectAbove = null;
    this.insideCBlock = false;
    
    if (this.connectBelow) {
      this.connectBelow.connectAbove = null;
      this.connectBelow.isConnected = false;
      if (wasInsideCBlock) {
        var current = this.connectBelow;
        while (current) {
          current.insideCBlock = false;
          current = current.connectBelow;
        }
      }
    }
    this.connectBelow = null;
  }
  
  this._updateAllCBlockHeights();
};

ScratchBlockMorph.prototype._updateAllCBlockHeights = function() {
  if (!this.world) return;
  
  for (var i = 0; i < this.world.morphs.length; i++) {
    var morph = this.world.morphs[i];
    if (morph instanceof ScratchBlockMorph && morph.blockType === 'c_block') {
      morph._updateCBlockHeight();
    }
  }
};

ScratchBlockMorph.prototype._updateCBlockHeight = function() {
  if (this.blockType !== 'c_block' || !this.world) return;
  
  var topHeight = 30;
  var bottomHeight = 25;
  var minInnerHeight = 40;
  var innerBlocks = [];
  
  for (var i = 0; i < this.world.morphs.length; i++) {
    var morph = this.world.morphs[i];
    if (morph instanceof ScratchBlockMorph && morph.connectAbove === this && morph.insideCBlock) {
      innerBlocks.push(morph);
    }
  }
  
  var requiredInnerHeight = minInnerHeight;
  
  if (innerBlocks.length > 0) {
    var bottomMostY = 0;
    innerBlocks.forEach(function(block) {
      var current = block;
      while (current.connectBelow) {
        current = current.connectBelow;
      }
      var blockBottom = current.y + current.height - (this.y + topHeight);
      if (blockBottom > bottomMostY) {
        bottomMostY = blockBottom;
      }
    }.bind(this));
    
    requiredInnerHeight = Math.max(minInnerHeight, bottomMostY + 10);
  }
  
  var newHeight = topHeight + requiredInnerHeight + bottomHeight;
  
  if (newHeight !== this.height) {
    this.height = newHeight;
    
    if (this.connectBelow) {
      this._updateConnectedBlockPositions();
    }
  }
};

ScratchBlockMorph.prototype._updateConnectedBlockPositions = function() {
  var current = this.connectBelow;
  var currentY = this.y + this.height - 3;
  
  while (current) {
    current.y = currentY;
    currentY += current.height - 3;
    current = current.connectBelow;
  }
};

ScratchBlockMorph.prototype.toJSON = function() {
  var blockData = {
    text: this.text,
    blockColor: this.blockColor,
    blockType: this.blockType,
    x: this.x,
    y: this.y,
    width: this.width,
    height: this.height,
    inputs: this.inputs.map(function(input) {
      return {
        type: input.type,
        value: input.value
      };
    }),
    connectAbove: null,
    connectBelow: null,
    insideCBlock: this.insideCBlock
  };
  
  return blockData;
};

// --- ScriptAreaMorph ---
function ScriptAreaMorph(x, y, width, height, options) {
  Morph.call(this, x, y, width, height, options);
  this.gridSize = 20;
  this.gridColor = '#2a2a2a';
}
extend(ScriptAreaMorph, Morph);

ScriptAreaMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();
  
  ctx.globalAlpha = this.opacity;
  
  ctx.fillStyle = this.fillColor;
  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, this.fillColor);
  
  ctx.strokeStyle = this.gridColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([]);
  
  for (var x = this.x + this.gridSize; x < this.x + this.width; x += this.gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, this.y);
    ctx.lineTo(x, this.y + this.height);
    ctx.stroke();
  }
  
  for (var y = this.y + this.gridSize; y < this.y + this.height; y += this.gridSize) {
    ctx.beginPath();
    ctx.moveTo(this.x, y);
    ctx.lineTo(this.x + this.width, y);
    ctx.stroke();
  }
  
  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);
  
  ctx.restore();
  
  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// --- CategoryButtonMorph ---
function CategoryButtonMorph(x, y, width, height, category, isSelected) {
  Morph.call(this, x, y, width, height, {
    draggable: false,
    fillColor: isSelected ? category.color : '#444',
    outlineColor: '#666',
    outlineThickness: 1,
    cornerRadius: 3
  });
  this.category = category;
  this.isSelected = isSelected;
}
extend(CategoryButtonMorph, Morph);

CategoryButtonMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();
  
  ctx.globalAlpha = this.opacity;
  
  if (this.isSelected) {
    var gradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
    gradient.addColorStop(0, this.category.color);
    gradient.addColorStop(1, this.category.darkColor);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = this.fillColor;
  }
  
  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, 
                        this.isSelected ? gradient : this.fillColor);
  
  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);
  
  ctx.restore();
  
  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// --- GradientButtonMorph ---
function GradientButtonMorph(x, y, width, height, text, color1, color2) {
  Morph.call(this, x, y, width, height, {
    draggable: false,
    fillColor: color1,
    outlineColor: color2,
    outlineThickness: 2,
    cornerRadius: 5
  });
  this.text = text;
  this.color1 = color1;
  this.color2 = color2;
}
extend(GradientButtonMorph, Morph);

GradientButtonMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();
  
  ctx.globalAlpha = this.opacity;
  
  if (this.active || this.hover) {
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.shadowBlur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
  }
  
  var gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
  gradient.addColorStop(0, this.color1);
  gradient.addColorStop(1, this.color2);
  
  ctx.fillStyle = gradient;
  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, gradient);
  
  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);
  
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(this.text, this.x + this.width/2, this.y + this.height/2);
  
  ctx.restore();
  
  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// --- ScriptAreaMorph ---
function ScriptAreaMorph(x, y, width, height, options) {
  Morph.call(this, x, y, width, height, options);
  this.gridSize = 20;
  this.gridColor = '#2a2a2a';
}
extend(ScriptAreaMorph, Morph);

ScriptAreaMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();
  
  ctx.globalAlpha = this.opacity;
  
  ctx.fillStyle = this.fillColor;
  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, this.fillColor);
  
  ctx.strokeStyle = this.gridColor;
  ctx.lineWidth = 0.5;
  ctx.setLineDash([]);
  
  for (var x = this.x + this.gridSize; x < this.x + this.width; x += this.gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, this.y);
    ctx.lineTo(x, this.y + this.height);
    ctx.stroke();
  }
  
  for (var y = this.y + this.gridSize; y < this.y + this.height; y += this.gridSize) {
    ctx.beginPath();
    ctx.moveTo(this.x, y);
    ctx.lineTo(this.x + this.width, y);
    ctx.stroke();
  }
  
  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);
  
  ctx.restore();
  
  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// --- CategoryButtonMorph ---
function CategoryButtonMorph(x, y, width, height, category, isSelected) {
  Morph.call(this, x, y, width, height, {
    draggable: false,
    fillColor: isSelected ? category.color : '#444',
    outlineColor: '#666',
    outlineThickness: 1,
    cornerRadius: 3
  });
  this.category = category;
  this.isSelected = isSelected;
}
extend(CategoryButtonMorph, Morph);

CategoryButtonMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();
  
  ctx.globalAlpha = this.opacity;
  
  if (this.isSelected) {
    var gradient = ctx.createLinearGradient(this.x, this.y, this.x + this.width, this.y + this.height);
    gradient.addColorStop(0, this.category.color);
    gradient.addColorStop(1, this.category.darkColor);
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = this.fillColor;
  }
  
  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, 
                        this.isSelected ? gradient : this.fillColor);
  
  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);
  
  ctx.restore();
  
  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

// --- GradientButtonMorph ---
function GradientButtonMorph(x, y, width, height, text, color1, color2) {
  Morph.call(this, x, y, width, height, {
    draggable: false,
    fillColor: color1,
    outlineColor: color2,
    outlineThickness: 2,
    cornerRadius: 5
  });
  this.text = text;
  this.color1 = color1;
  this.color2 = color2;
}
extend(GradientButtonMorph, Morph);

GradientButtonMorph.prototype.draw = function(ctx) {
  this._runAnimations();
  ctx.save();
  
  ctx.globalAlpha = this.opacity;
  
  if (this.active || this.hover) {
    ctx.shadowColor = this.shadowColor;
    ctx.shadowBlur = this.shadowBlur;
    ctx.shadowOffsetX = this.shadowOffsetX;
    ctx.shadowOffsetY = this.shadowOffsetY;
  }
  
  var gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
  gradient.addColorStop(0, this.color1);
  gradient.addColorStop(1, this.color2);
  
  ctx.fillStyle = gradient;
  this._drawRoundedRect(ctx, this.x, this.y, this.width, this.height, this.cornerRadius, gradient);
  
  ctx.lineWidth = this.outlineThickness;
  ctx.strokeStyle = this.outlineColor;
  this._drawRoundedRectStroke(ctx, this.x, this.y, this.width, this.height, this.cornerRadius);
  
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(this.text, this.x + this.width/2, this.y + this.height/2);
  
  ctx.restore();
  
  this.children.forEach(child => {
    child.tick();
    child.draw(ctx);
  });
};

ScratchInterpreter.prototype.addSprite = function(sprite) {
  this.sprites[sprite.spriteName] = {
    sprite: sprite,
    variables: {},
    scripts: sprite.scripts || [],
    threads: []
  };
};

ScratchInterpreter.prototype.executeScript = function(spriteData, scriptBlocks, eventType) {
  var thread = {
    id: ++this.threadIdCounter,
    sprite: spriteData.sprite,
    blocks: scriptBlocks,
    currentIndex: 0,
    isActive: true,
    eventType: eventType,
    variables: Object.assign({}, spriteData.variables),
    loopStack: [],
    waitUntil: 0
  };
  
  spriteData.threads.push(thread);
  this.threads.push(thread);
  
  this.executeThread(thread);
};

ScratchInterpreter.prototype.executeThread = function(thread) {
  if (!thread.isActive || !this.isRunning) {
    thread.isActive = false;
    return;
  }
  
  if (Date.now() < thread.waitUntil) {
    setTimeout(() => this.executeThread(thread), 50);
    return;
  }
  
  if (thread.currentIndex >= thread.blocks.length) {
    if (thread.loopStack.length > 0) {
      var loop = thread.loopStack[thread.loopStack.length - 1];
      if (loop.type === 'forever' || (loop.type === 'repeat' && loop.count > 0)) {
        if (loop.type === 'repeat') loop.count--;
        thread.currentIndex = loop.startIndex;
      } else {
        thread.loopStack.pop();
        thread.currentIndex = loop.endIndex;
      }
    } else {
      thread.isActive = false;
      return;
    }
  }
  
  var block = thread.blocks[thread.currentIndex];
  if (block) {
    var delay = this.executeBlock(block, thread);
    thread.currentIndex++;
    
    if (delay > 0) {
      thread.waitUntil = Date.now() + delay;
    }
  }
  
  if (thread.isActive) {
    setTimeout(() => this.executeThread(thread), 10);
  }
};

ScratchInterpreter.prototype.executeBlock = function(block, thread) {
  var sprite = thread.sprite;
  var text = block.text;
  var inputs = block.inputs || [];
  
  console.log('Executing on', sprite.spriteName + ':', text);
  
  if (text.includes('move') && text.includes('steps')) {
    var steps = this.getInputValue(inputs[0], thread) || 10;
    var radians = (sprite.direction || 90) * Math.PI / 180;
    sprite.x += Math.cos(radians) * steps;
    sprite.y += Math.sin(radians) * steps;
    
  } else if (text.includes('turn ↻')) {
    var degrees = this.getInputValue(inputs[0], thread) || 15;
    sprite.direction = (sprite.direction || 90) + degrees;
    
  } else if (text.includes('turn ↺')) {
    var degrees = this.getInputValue(inputs[0], thread) || 15;
    sprite.direction = (sprite.direction || 90) - degrees;
    
  } else if (text.includes('go to x:')) {
    var x = this.getInputValue(inputs[0], thread) || 0;
    var y = this.getInputValue(inputs[1], thread) || 0;
    sprite.x = 860 + x;
    sprite.y = 150 + y;
    
  } else if (text.includes('glide') && text.includes('secs to x:')) {
    var secs = this.getInputValue(inputs[0], thread) || 1;
    var targetX = 860 + (this.getInputValue(inputs[1], thread) || 0);
    var targetY = 150 + (this.getInputValue(inputs[2], thread) || 0);
    
    var startX = sprite.x;
    var startY = sprite.y;
    var duration = secs * 1000;
    var startTime = Date.now();
    
    var glide = () => {
      var elapsed = Date.now() - startTime;
      var progress = Math.min(elapsed / duration, 1);
      
      sprite.x = startX + (targetX - startX) * progress;
      sprite.y = startY + (targetY - startY) * progress;
      
      if (progress < 1) {
        setTimeout(glide, 16);
      }
    };
    glide();
    return duration;
    
  } else if (text.includes('point in direction')) {
    sprite.direction = this.getInputValue(inputs[0], thread) || 90;
    
  } else if (text.includes('change x by')) {
    var delta = this.getInputValue(inputs[0], thread) || 10;
    sprite.x += delta;
    
  } else if (text.includes('change y by')) {
    var delta = this.getInputValue(inputs[0], thread) || 10;
    sprite.y += delta;
  }
  
  else if (text.includes('say') && text.includes('for')) {
    var message = this.getInputValue(inputs[0], thread) || 'Hello!';
    var duration = this.getInputValue(inputs[1], thread) || 2;
    
    if (typeof SpeechBubbleMorph !== 'undefined') {
      var speechBubble = new SpeechBubbleMorph(
        sprite.x + sprite.width/2 - 100, 
        sprite.y - 80, 
        message, 
        {
          targetSprite: sprite,
          duration: duration * 1000,
          bubbleColor: '#fff',
          textColor: '#000',
          borderColor: '#333'
        }
      );
      sprite.world.addMorph(speechBubble);
    }
    
    return duration * 1000;
    
  } else if (text.includes('say ') && !text.includes('for')) {
    var message = this.getInputValue(inputs[0], thread) || 'Hello!';
    
    if (typeof SpeechBubbleMorph !== 'undefined') {
      var speechBubble = new SpeechBubbleMorph(
        sprite.x + sprite.width/2 - 100, 
        sprite.y - 80, 
        message, 
        {
          targetSprite: sprite,
          duration: 3000,
          bubbleColor: '#fff',
          textColor: '#000',
          borderColor: '#333'
        }
      );
      sprite.world.addMorph(speechBubble);
    }
    
  } else if (text === 'show') {
    sprite.visible = true;
    sprite.opacity = 1;
    
  } else if (text === 'hide') {
    sprite.visible = false;
    sprite.opacity = 0;
    
  } else if (text.includes('change size by')) {
    var change = this.getInputValue(inputs[0], thread) || 10;
    sprite.size = Math.max(0, (sprite.size || 100) + change);
    var scale = sprite.size / 100;
    sprite.radius = 20 * scale;
    sprite.width = sprite.radius * 2;
    sprite.height = sprite.radius * 2;
    
  } else if (text.includes('set size to')) {
    sprite.size = this.getInputValue(inputs[0], thread) || 100;
    var scale = sprite.size / 100;
    sprite.radius = 20 * scale;
    sprite.width = sprite.radius * 2;
    sprite.height = sprite.radius * 2;
  }
  
  else if (text.includes('play sound')) {
    var soundName = this.getInputValue(inputs[0], thread) || 'pop';
    console.log('Playing sound:', soundName);
    if (text.includes('until done')) {
      return 1000;
    }
  }
  
  else if (text.includes('wait') && text.includes('secs')) {
    var seconds = this.getInputValue(inputs[0], thread) || 1;
    return seconds * 1000;
    
  } else if (text.includes('repeat')) {
    var times = this.getInputValue(inputs[0], thread) || 10;
    thread.loopStack.push({
      type: 'repeat',
      count: times - 1,
      startIndex: thread.currentIndex + 1,
      endIndex: this.findLoopEnd(thread.blocks, thread.currentIndex)
    });
    
  } else if (text === 'forever') {
    thread.loopStack.push({
      type: 'forever',
      startIndex: thread.currentIndex + 1,
      endIndex: this.findLoopEnd(thread.blocks, thread.currentIndex)
    });
    
  } else if (text.includes('if') && text.includes('then')) {
    var condition = this.evaluateCondition(inputs[0], thread);
    if (!condition) {
      thread.currentIndex = this.findIfEnd(thread.blocks, thread.currentIndex);
    }
    
  } else if (text === 'stop all') {
    this.stop();
    
  } else if (text === 'stop this script') {
    thread.isActive = false;
  }
  
  else if (text.includes('set') && text.includes('to')) {
    var varName = this.getInputValue(inputs[0], thread) || 'my variable';
    var value = this.getInputValue(inputs[1], thread) || 0;
    thread.variables[varName] = value;
    this.sprites[sprite.spriteName].variables[varName] = value;
    
  } else if (text.includes('change') && text.includes('by')) {
    var varName = this.getInputValue(inputs[0], thread) || 'my variable';
    var change = this.getInputValue(inputs[1], thread) || 1;
    var currentValue = thread.variables[varName] || this.sprites[sprite.spriteName].variables[varName] || 0;
    var newValue = currentValue + change;
    thread.variables[varName] = newValue;
    this.sprites[sprite.spriteName].variables[varName] = newValue;
  }
  
  else if (text.includes('broadcast')) {
    var message = this.getInputValue(inputs[0], thread) || 'message1';
    this.broadcast(message);
  }
  
  return 0;
};

ScratchInterpreter.prototype.getInputValue = function(input, thread) {
  if (!input) return null;
  if (typeof input === 'string') return input;
  if (typeof input === 'object' && input.value !== undefined) {
    var value = input.value;
    
    if (thread.variables[value] !== undefined) {
      return thread.variables[value];
    }
    
    if (this.sprites[thread.sprite.spriteName].variables[value] !== undefined) {
      return this.sprites[thread.sprite.spriteName].variables[value];
    }
    
    if (this.globalVariables[value] !== undefined) {
      return this.globalVariables[value];
    }
    
    return value;
  }
  return input;
};

ScratchInterpreter.prototype.evaluateCondition = function(condition, thread) {
  return Math.random() > 0.5;
};

ScratchInterpreter.prototype.findLoopEnd = function(blocks, startIndex) {
  var depth = 1;
  for (var i = startIndex + 1; i < blocks.length; i++) {
    var block = blocks[i];
    if (block.blockType === 'c_block') {
      depth++;
    } else if (block.text === 'end' || depth === 0) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return blocks.length;
};

ScratchInterpreter.prototype.findIfEnd = function(blocks, startIndex) {
  return this.findLoopEnd(blocks, startIndex);
};

ScratchInterpreter.prototype.broadcast = function(message) {
  console.log('Broadcasting:', message);
  
  var self = this;
  Object.keys(this.sprites).forEach(function(spriteName) {
    var spriteData = self.sprites[spriteName];
    var scripts = spriteData.scripts;
    
    scripts.forEach(function(script) {
      if (script.length > 0 && script[0].text.includes('when I receive')) {
        var receivedMessage = self.getInputValue(script[0].inputs[0]) || 'message1';
        if (receivedMessage === message) {
          self.executeScript(spriteData, script.slice(1), 'broadcast:' + message);
        }
      }
    });
  });
};

ScratchInterpreter.prototype.start = function() {
  this.isRunning = true;
  this.threads = [];
  
  var self = this;
  Object.keys(this.sprites).forEach(function(spriteName) {
    self.sprites[spriteName].threads = [];
  });
  
  Object.keys(this.sprites).forEach(function(spriteName) {
    var spriteData = self.sprites[spriteName];
    var scripts = spriteData.scripts;
    
    scripts.forEach(function(script) {
      if (script.length > 0 && script[0].blockType === 'hat') {
        var eventType = script[0].text;
        if (eventType.includes('when ⚑ clicked')) {
          self.executeScript(spriteData, script.slice(1), 'flag_clicked');
        }
      }
    });
  });
};

ScratchInterpreter.prototype.stop = function() {
  this.isRunning = false;
  var self = this;
  this.threads.forEach(function(thread) {
    thread.isActive = false;
  });
  this.threads = [];
  
  Object.keys(this.sprites).forEach(function(spriteName) {
    self.sprites[spriteName].threads = [];
  });
};
