// --- Thread-based Interpreter System ---
function ScratchInterpreter() {
  this.sprites = {};
  this.globalVariables = {};
  this.broadcasts = {};
  this.threads = [];
  this.isRunning = false;
  this.threadIdCounter = 0;
}

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

  // Motion blocks
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

  // Looks blocks
  else if (text.includes('say') && text.includes('for')) {
    var message = this.getInputValue(inputs[0], thread) || 'Hello!';
    var duration = this.getInputValue(inputs[1], thread) || 2;

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
    world.addMorph(speechBubble);

    return duration * 1000;

  } else if (text.includes('say ') && !text.includes('for')) {
    var message = this.getInputValue(inputs[0], thread) || 'Hello!';

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
    world.addMorph(speechBubble);

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

  // Sound blocks
  else if (text.includes('play sound')) {
    var soundName = this.getInputValue(inputs[0], thread) || 'pop';
    console.log('Playing sound:', soundName);
    if (text.includes('until done')) {
      return 1000; // Simulate sound duration
    }
  }

  // Control blocks
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

  // Variables
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

  // Events
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

    // Check if it's a variable reference
    if (thread.variables[value] !== undefined) {
      return thread.variables[value];
    }

    // Check sprite variables
    if (this.sprites[thread.sprite.spriteName].variables[value] !== undefined) {
      return this.sprites[thread.sprite.spriteName].variables[value];
    }

    // Check global variables
    if (this.globalVariables[value] !== undefined) {
      return this.globalVariables[value];
    }

    return value;
  }
  return input;
};

ScratchInterpreter.prototype.evaluateCondition = function(condition, thread) {
  // Simplified condition evaluation
  return Math.random() > 0.5; // Random for now
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

  Object.keys(this.sprites).forEach(spriteName => {
    var spriteData = this.sprites[spriteName];
    var scripts = spriteData.scripts;

    scripts.forEach(script => {
      if (script.length > 0 && script[0].text.includes('when I receive')) {
        var receivedMessage = this.getInputValue(script[0].inputs[0]) || 'message1';
        if (receivedMessage === message) {
          this.executeScript(spriteData, script.slice(1), 'broadcast:' + message);
        }
      }
    });
  });
};

ScratchInterpreter.prototype.start = function() {
  this.isRunning = true;
  this.threads = [];

  // Clear existing threads for all sprites
  Object.keys(this.sprites).forEach(spriteName => {
    this.sprites[spriteName].threads = [];
  });

  // Find and execute all event scripts
  Object.keys(this.sprites).forEach(spriteName => {
    var spriteData = this.sprites[spriteName];
    var scripts = spriteData.scripts;

    scripts.forEach(script => {
      if (script.length > 0 && script[0].blockType === 'hat') {
        var eventType = script[0].text;
        if (eventType.includes('when ⚑ clicked')) {
          this.executeScript(spriteData, script.slice(1), 'flag_clicked');
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
    self.cleanupThread(thread);
  });
  this.threads = [];

  Object.keys(this.sprites).forEach(function(spriteName) {
    self.sprites[spriteName].threads = [];
  });

  // Clean up thread pool
  this.threadPool = [];

  console.log('Interpreter stopped. Active threads cleaned up.');
};

ScratchInterpreter.prototype.getExecutionStats = function() {
  var activeThreads = this.threads.filter(t => t.isActive).length;
  var totalThreads = this.threads.length;
  var avgExecutionTime = 0;

  if (totalThreads > 0) {
    var totalTime = this.threads.reduce((sum, thread) => sum + thread.executionTime, 0);
    avgExecutionTime = totalTime / totalThreads;
  }

  return {
    activeThreads: activeThreads,
    totalThreads: totalThreads,
    avgExecutionTime: avgExecutionTime.toFixed(2) + 'ms',
    maxThreads: this.maxThreads
  };
};

// --- Main Scratch Interface Setup ---
var world = new World(1200, 700, '#2d2d2d');
var interpreter = new ScratchInterpreter();

// Create interface elements
var topBar = new Morph(0, 0, 1200, 40, {
  draggable: false,
  fillColor: '#1a1a1a',
  outlineColor: '#444',
  outlineThickness: 1,
  cornerRadius: 0
});
world.addMorph(topBar);

var iconMorph = new ImageMorph(5, 5, 30, 30, 'IMG_0017.png', {
  draggable: false
});
world.addMorph(iconMorph);

// Top bar buttons
var saveButton = new TextMorph(50, 8, 80, 24, "💾 Save", {
  font: '12px Arial',
  color: '#fff',
  fillColor: '#4CAF50',
  outlineColor: '#45a049',
  outlineThickness: 1,
  cornerRadius: 3,
  textAlign: 'center'
});

var loadButton = new TextMorph(140, 8, 80, 24, "📁 Load", {
  font: '12px Arial',
  color: '#fff',
  fillColor: '#2196F3',
  outlineColor: '#1976D2',
  outlineThickness: 1,
  cornerRadius: 3,
  textAlign: 'center'
});

var extensionsButton = new TextMorph(230, 8, 100, 24, "🧩 Extensions", {
  font: '12px Arial',
  color: '#fff',
  fillColor: '#9C27B0',
  outlineColor: '#7B1FA2',
  outlineThickness: 1,
  cornerRadius: 3,
  textAlign: 'center'
});

// Save button functionality
saveButton.onMouseDown = function() {
  saveProject();
};

saveButton.onTouchStart = function(evt, pos) {
  saveProject();
};

// Load button functionality
loadButton.onMouseDown = function() {
  loadProject();
};

loadButton.onTouchStart = function(evt, pos) {
  loadProject();
};

// Extensions button functionality
extensionsButton.onMouseDown = function() {
  showExtensions();
};

extensionsButton.onTouchStart = function(evt, pos) {
  showExtensions();
};

world.addMorph(saveButton);
world.addMorph(loadButton);
world.addMorph(extensionsButton);

var blockPalette = new Morph(20, 90, 250, 560, {
  draggable: false,
  fillColor: '#1a1a1a',
  outlineColor: '#444',
  outlineThickness: 2,
  cornerRadius: 5
});
world.addMorph(blockPalette);

var scriptArea = new ScriptAreaMorph(290, 90, 450, 560, {
  draggable: false,
  fillColor: '#252525',
  outlineColor: '#444',
  outlineThickness: 2,
  cornerRadius: 5
});
world.addMorph(scriptArea);

var stage = new Morph(760, 90, 400, 300, {
  draggable: false,
  fillColor: '#fff',
  outlineColor: '#555',
  outlineThickness: 3,
  cornerRadius: 5
});
world.addMorph(stage);

var spriteList = new Morph(760, 410, 400, 240, {
  draggable: false,
  fillColor: '#1e1e1e',
  outlineColor: '#555',
  outlineThickness: 2,
  cornerRadius: 5
});
world.addMorph(spriteList);

// Add titles
var paletteTitle = new TextMorph(30, 60, 200, 25, "Block Palette", {
  font: 'bold 16px Arial',
  color: '#fff',
  fillColor: 'transparent',
  outlineColor: 'transparent'
});
world.addMorph(paletteTitle);

var scriptTitle = new TextMorph(300, 60, 200, 25, "Scripts", {
  font: 'bold 16px Arial',
  color: '#fff',
  fillColor: 'transparent',
  outlineColor: 'transparent'
});
world.addMorph(scriptTitle);

var stageTitle = new TextMorph(770, 60, 200, 25, "Stage", {
  font: 'bold 16px Arial',
  color: '#fff',
  fillColor: 'transparent',
  outlineColor: 'transparent'
});
world.addMorph(stageTitle);

var spriteTitle = new TextMorph(770, 385, 200, 25, "Sprites", {
  font: 'bold 16px Arial',
  color: '#fff',
  fillColor: 'transparent',
  outlineColor: 'transparent'
});
world.addMorph(spriteTitle);

// Block categories
var categories = [
  {name: 'Motion', color: '#4A90E2', darkColor: '#357ABD', y: 120},
  {name: 'Looks', color: '#9C59D1', darkColor: '#7D4BA6', y: 150},
  {name: 'Sound', color: '#CF63CF', darkColor: '#A64FA6', y: 180},
  {name: 'Events', color: '#C88330', darkColor: '#A06927', y: 210},
  {name: 'Control', color: '#E1A91A', darkColor: '#B88715', y: 240},
  {name: 'Sensing', color: '#5CB3CC', darkColor: '#4A8FA3', y: 270},
  {name: 'Operators', color: '#59C059', darkColor: '#479947', y: 300},
  {name: 'Variables', color: '#EE7D16', darkColor: '#BF6412', y: 330}
];

var selectedCategory = 'Motion';
var categoryButtons = [];

categories.forEach(function(cat) {
  var button = new CategoryButtonMorph(30, cat.y, 200, 25, cat, cat.name === selectedCategory);

  var label = new TextMorph(35, cat.y + 3, 190, 20, cat.name, {
    font: '14px Arial',
    color: cat.name === selectedCategory ? '#fff' : '#ccc',
    fillColor: 'transparent',
    outlineColor: 'transparent'
  });

  button.onMouseDown = function() {
    selectedCategory = cat.name;
    updateCategorySelection();
    showBlocksForCategory(cat.name);
  };

  button.onTouchStart = function(evt, pos) {
    selectedCategory = cat.name;
    updateCategorySelection();
    showBlocksForCategory(cat.name);
  };

  world.addMorph(button);
  world.addMorph(label);
  categoryButtons.push({button: button, label: label, category: cat});
});

function updateCategorySelection() {
  categoryButtons.forEach(function(item) {
    item.button.isSelected = item.category.name === selectedCategory;
    item.button.fillColor = item.button.isSelected ? item.category.color : '#444';
    item.label.color = item.button.isSelected ? '#fff' : '#ccc';
  });
}

// Enhanced block definitions
var blockDefinitions = {
  Motion: [
    {text: 'move [] steps', color: '#4A90E2', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '10'}]},
    {text: 'turn ↻ [] degrees', color: '#4A90E2', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '15'}]},
    {text: 'turn ↺ [] degrees', color: '#4A90E2', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '15'}]},
    {text: 'go to x: [] y: []', color: '#4A90E2', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '0'}, {type: 'number', default: '0'}]},
    {text: 'glide [] secs to x: [] y: []', color: '#4A90E2', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '1'}, {type: 'number', default: '0'}, {type: 'number', default: '0'}]},
    {text: 'point in direction []', color: '#4A90E2', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '90'}]},
    {text: 'change x by []', color: '#4A90E2', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '10'}]},
    {text: 'change y by []', color: '#4A90E2', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '10'}]}
  ],
  Looks: [
    {text: 'say [] for [] secs', color: '#9C59D1', type: 'command', shape: 'puzzle', inputs: [{type: 'text', default: 'Hello!'}, {type: 'number', default: '2'}]},
    {text: 'say []', color: '#9C59D1', type: 'command', shape: 'puzzle', inputs: [{type: 'text', default: 'Hello!'}]},
    {text: 'show', color: '#9C59D1', type: 'command', shape: 'puzzle'},
    {text: 'hide', color: '#9C59D1', type: 'command', shape: 'puzzle'},
    {text: 'change size by []', color: '#9C59D1', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '10'}]},
    {text: 'set size to []%', color: '#9C59D1', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '100'}]}
  ],
  Sound: [
    {text: 'play sound []', color: '#CF63CF', type: 'command', shape: 'puzzle', inputs: [{type: 'text', default: 'pop'}]},
    {text: 'play sound [] until done', color: '#CF63CF', type: 'command', shape: 'puzzle', inputs: [{type: 'text', default: 'pop'}]},
    {text: 'change volume by []', color: '#CF63CF', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '-10'}]}
  ],
  Events: [
    {text: 'when ⚑ clicked', color: '#C88330', type: 'hat', shape: 'hat'},
    {text: 'when [] key pressed', color: '#C88330', type: 'hat', shape: 'hat', inputs: [{type: 'text', default: 'space'}]},
    {text: 'when this sprite clicked', color: '#C88330', type: 'hat', shape: 'hat'},
    {text: 'broadcast []', color: '#C88330', type: 'command', shape: 'puzzle', inputs: [{type: 'text', default: 'message1'}]},
    {text: 'when I receive []', color: '#C88330', type: 'hat', shape: 'hat', inputs: [{type: 'text', default: 'message1'}]}
  ],
  Control: [
    {text: 'wait [] secs', color: '#E1A91A', type: 'command', shape: 'puzzle', inputs: [{type: 'number', default: '1'}]},
    {text: 'repeat []', color: '#E1A91A', type: 'c_block', shape: 'c_shape', inputs: [{type: 'number', default: '10'}]},
    {text: 'forever', color: '#E1A91A', type: 'c_block', shape: 'c_shape'},
    {text: 'if <> then', color: '#E1A91A', type: 'c_block', shape: 'c_shape'},
    {text: 'stop all', color: '#E1A91A', type: 'cap', shape: 'cap'},
    {text: 'stop this script', color: '#E1A91A', type: 'cap', shape: 'cap'}
  ],
  Sensing: [
    {text: 'touching []?', color: '#5CB3CC', type: 'boolean', shape: 'boolean', inputs: [{type: 'text', default: 'mouse-pointer'}]},
    {text: 'key [] pressed?', color: '#5CB3CC', type: 'boolean', shape: 'boolean', inputs: [{type: 'text', default: 'space'}]},
    {text: 'mouse x', color: '#5CB3CC', type: 'reporter', shape: 'oval'},
    {text: 'mouse y', color: '#5CB3CC', type: 'reporter', shape: 'oval'},
    {text: 'distance to []', color: '#5CB3CC', type: 'reporter', shape: 'oval', inputs: [{type: 'text', default: 'mouse-pointer'}]}
  ],
  Operators: [
    {text: '[] + []', color: '#59C059', type: 'reporter', shape: 'oval', inputs: [{type: 'number', default: ''}, {type: 'number', default: ''}]},
    {text: '[] - []', color: '#59C059', type: 'reporter', shape: 'oval', inputs: [{type: 'number', default: ''}, {type: 'number', default: ''}]},
    {text: '[] * []', color: '#59C059', type: 'reporter', shape: 'oval', inputs: [{type: 'number', default: ''}, {type: 'number', default: ''}]},
    {text: '[] / []', color: '#59C059', type: 'reporter', shape: 'oval', inputs: [{type: 'number', default: ''}, {type: 'number', default: ''}]},
    {text: '[] = []', color: '#59C059', type: 'boolean', shape: 'boolean', inputs: [{type: 'text', default: ''}, {type: 'text', default: ''}]},
    {text: '[] < []', color: '#59C059', type: 'boolean', shape: 'boolean', inputs: [{type: 'number', default: ''}, {type: 'number', default: ''}]},
    {text: '[] > []', color: '#59C059', type: 'boolean', shape: 'boolean', inputs: [{type: 'number', default: ''}, {type: 'number', default: ''}]},
    {text: '<> and <>', color: '#59C059', type: 'boolean', shape: 'boolean'},
    {text: '<> or <>', color: '#59C059', type: 'boolean', shape: 'boolean'},
    {text: 'not <>', color: '#59C059', type: 'boolean', shape: 'boolean'}
  ],
  Variables: [
    {text: 'set [] to []', color: '#EE7D16', type: 'command', shape: 'puzzle', inputs: [{type: 'text', default: 'my variable'}, {type: 'text', default: '0'}]},
    {text: 'change [] by []', color: '#EE7D16', type: 'command', shape: 'puzzle', inputs: [{type: 'text', default: 'my variable'}, {type: 'number', default: '1'}]},
    {text: '[]', color: '#EE7D16', type: 'reporter', shape: 'oval', inputs: [{type: 'text', default: 'my variable'}]}
  ]
};

var currentBlocks = [];
var duplicatedBlocks = [];

function showBlocksForCategory(categoryName) {
  currentBlocks.forEach(function(block) {
    if (block.world) {
      world.removeMorph(block);
    }
  });
  currentBlocks = [];

  var blocks = blockDefinitions[categoryName] || [];
  var yPos = 370;

  blocks.forEach(function(blockDef, index) {
    var block = new ScratchBlockMorph(40, yPos, blockDef.text, blockDef.color, blockDef.type, {
      draggable: false,
      isPalette: true,
      shape: blockDef.shape,
      inputs: blockDef.inputs || [],
      targetSprite: selectedSprite ? selectedSprite.spriteName : 'Sprite1'
    });

    block.onDragStart = function() {
      var duplicate = new ScratchBlockMorph(
        this.x + 250, 
        this.y, 
        this.text, 
        this.blockColor, 
        this.blockType, 
        {
          draggable: true,
          isPalette: false,
          shape: this.shape,
          inputs: blockDef.inputs || [],
          targetSprite: selectedSprite ? selectedSprite.spriteName : 'Sprite1'
        }
      );

      if (this.inputs && duplicate.inputs) {
        this.inputs.forEach(function(input, i) {
          if (duplicate.inputs[i]) {
            duplicate.inputs[i].value = input.value;
          }
        });
      }

      world.addMorph(duplicate);
      duplicatedBlocks.push(duplicate);

      world._draggingMorph = duplicate;
      duplicate._setActive(true);
    };

    block.onTouchStart = function(evt, pos) {
      if (this.isPalette) {
        var duplicate = new ScratchBlockMorph(
          this.x + 250, 
          this.y, 
          this.text, 
          this.blockColor, 
          this.blockType, 
          {
            draggable: true,
            isPalette: false,
            shape: this.shape,
            inputs: blockDef.inputs || [],
            targetSprite: selectedSprite ? selectedSprite.spriteName : 'Sprite1'
          }
        );

        if (this.inputs && duplicate.inputs) {
          this.inputs.forEach(function(input, i) {
            if (duplicate.inputs[i]) {
              duplicate.inputs[i].value = input.value;
            }
          });
        }

        world.addMorph(duplicate);
        duplicatedBlocks.push(duplicate);

        world._draggingMorph = duplicate;
        world._dragOffsetX = pos.x - duplicate.x;
        world._dragOffsetY = pos.y - duplicate.y;
        duplicate._setActive(true);
        if (duplicate.onDragStart) duplicate.onDragStart();
      }
    };

    world.addMorph(block);
    currentBlocks.push(block);
    yPos += 35;
  });
}

// Sprite management with JSON storage
var sprites = [];
var selectedSprite = null;
var spriteCounter = 1;

function createSprite(x, y, name, color) {
  var sprite = new CircleMorph(x || 860, y || 150, 20, {
    fillColor: color || '#ff6b6b',
    outlineColor: '#fff',
    outlineThickness: 2,
    draggable: true
  });
  sprite.spriteName = name || 'Sprite' + spriteCounter++;
  sprite.scripts = [];
  sprite.scriptJSON = '[]';
  sprite.x = x || 860;
  sprite.y = y || 150;
  sprite.direction = 90;
  sprite.size = 100;
  sprite.visible = true;

  world.addMorph(sprite);
  sprites.push(sprite);
  interpreter.addSprite(sprite);
  return sprite;
}

function saveCurrentSpriteScripts() {
  if (!selectedSprite) return;

  var spriteBlocks = duplicatedBlocks.filter(b => b.world && b.targetSprite === selectedSprite.spriteName);
  var scripts = [];

  spriteBlocks.forEach(function(block) {
    if (block.blockType === 'hat') {
      var script = [block.toJSON()];
      var current = block.connectBelow;
      while (current) {
        script.push(current.toJSON());
        current = current.connectBelow;
      }
      scripts.push(script);
    }
  });

  selectedSprite.scriptJSON = JSON.stringify(scripts);
  selectedSprite.scripts = scripts;
}

function loadSpriteScripts(sprite) {
  // Clear current blocks
  var blocksToRemove = duplicatedBlocks.filter(b => b.world);
  blocksToRemove.forEach(function(block) {
    world.removeMorph(block);
    var index = duplicatedBlocks.indexOf(block);
    if (index > -1) {
      duplicatedBlocks.splice(index, 1);
    }
  });

  if (!sprite.scriptJSON) return;

  try {
    var scripts = JSON.parse(sprite.scriptJSON);
    var yOffset = 0;

    scripts.forEach(function(script) {
      var prevBlock = null;

      script.forEach(function(blockData, index) {
        var block = new ScratchBlockMorph(
          blockData.x || (300 + index * 10),
          blockData.y || (120 + yOffset),
          blockData.text,
          blockData.blockColor,
          blockData.blockType,
          {
            draggable: true,
            isPalette: false,
            targetSprite: sprite.spriteName
          }
        );

        // Restore input values
        if (blockData.inputs) {
          blockData.inputs.forEach(function(inputData, i) {
            if (block.inputs[i]) {
              block.inputs[i].value = inputData.value;
            }
          });
        }

        if (prevBlock) {
          block.connectAbove = prevBlock;
          prevBlock.connectBelow = block;
          block.isConnected = true;
          block.y = prevBlock.y + prevBlock.height - 3;
        }

        world.addMorph(block);
        duplicatedBlocks.push(block);
        prevBlock = block;
      });

      yOffset += 60;
    });
  } catch (e) {
    console.error('Error loading sprite scripts:', e);
  }
}

function switchToSprite(sprite) {
  if (selectedSprite === sprite) return;

  if (selectedSprite) {
    saveCurrentSpriteScripts();
  }

  selectedSprite = sprite;
  loadSpriteScripts(sprite);
  updateSpriteList();
}

var defaultSprite = createSprite(860, 150, 'Sprite1', '#ff6b6b');
selectedSprite = defaultSprite;

function updateSpriteList() {
  var existingThumbs = world.morphs.filter(m => m.isSpriteThumb);
  existingThumbs.forEach(thumb => world.removeMorph(thumb));

  sprites.forEach(function(sprite, index) {
    var yPos = 430 + index * 30;

    var spriteThumb = new CircleMorph(780, yPos, 15, {
      fillColor: sprite.fillColor,
      outlineColor: selectedSprite === sprite ? '#fff' : '#666',
      outlineThickness: selectedSprite === sprite ? 2 : 1,
      draggable: false
    });
    spriteThumb.isSpriteThumb = true;
    spriteThumb.linkedSprite = sprite;

    spriteThumb.onMouseDown = function() {
      switchToSprite(this.linkedSprite);
    };

    spriteThumb.onTouchStart = function(evt, pos) {
      switchToSprite(this.linkedSprite);
    };

    var spriteLabel = new TextMorph(810, yPos - 5, 100, 20, sprite.spriteName, {
      font: '12px Arial',
      color: selectedSprite === sprite ? '#fff' : '#ccc',
      fillColor: 'transparent',
      outlineColor: 'transparent'
    });
    spriteLabel.isSpriteThumb = true;

    world.addMorph(spriteThumb);
    world.addMorph(spriteLabel);
  });
}

// Control buttons
var addSpriteButton = new TextMorph(770, 660, 80, 25, "+ Add Sprite", {
  font: '12px Arial',
  color: '#fff',
  fillColor: '#4CAF50',
  outlineColor: '#45a049',
  outlineThickness: 1,
  cornerRadius: 3
});

var deleteSpriteButton = new TextMorph(860, 660, 80, 25, "Delete Sprite", {
  font: '12px Arial',
  color: '#fff',
  fillColor: '#f44336',
  outlineColor: '#d32f2f',
  outlineThickness: 1,
  cornerRadius: 3
});

addSpriteButton.onMouseDown = function() {
  var colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#f368e0'];
  var randomColor = colors[Math.floor(Math.random() * colors.length)];
  var newSprite = createSprite(
    860 + Math.random() * 100, 
    150 + Math.random() * 100, 
    'Sprite' + spriteCounter, 
    randomColor
  );
  switchToSprite(newSprite);
};

addSpriteButton.onTouchStart = function(evt, pos) {
  var colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#f368e0'];
  var randomColor = colors[Math.floor(Math.random() * colors.length)];
  var newSprite = createSprite(
    860 + Math.random() * 100, 
    150 + Math.random() * 100, 
    'Sprite' + spriteCounter, 
    randomColor
  );
  switchToSprite(newSprite);
};

deleteSpriteButton.onMouseDown = function() {
  if (selectedSprite && sprites.length > 1) {
    world.removeMorph(selectedSprite);

    var spriteIndex = sprites.indexOf(selectedSprite);
    if (spriteIndex > -1) {
      sprites.splice(spriteIndex, 1);
    }

    var blocksToRemove = duplicatedBlocks.filter(b => b.targetSprite === selectedSprite.spriteName);
    blocksToRemove.forEach(function(block) {
      if (block.world) {
        world.removeMorph(block);
      }
      var blockIndex = duplicatedBlocks.indexOf(block);
      if (blockIndex > -1) {
        duplicatedBlocks.splice(blockIndex, 1);
      }
    });

    switchToSprite(sprites[0]);
  }
};

deleteSpriteButton.onTouchStart = function(evt, pos) {
  if (selectedSprite && sprites.length > 1) {
    world.removeMorph(selectedSprite);

    var spriteIndex = sprites.indexOf(selectedSprite);
    if (spriteIndex > -1) {
      sprites.splice(spriteIndex, 1);
    }

    var blocksToRemove = duplicatedBlocks.filter(b => b.targetSprite === selectedSprite.spriteName);
    blocksToRemove.forEach(function(block) {
      if (block.world) {
        world.removeMorph(block);
      }
      var blockIndex = duplicatedBlocks.indexOf(block);
      if (blockIndex > -1) {
        duplicatedBlocks.splice(blockIndex, 1);
      }
    });

    switchToSprite(sprites[0]);
  }
};

world.addMorph(addSpriteButton);
world.addMorph(deleteSpriteButton);

var runButton = new GradientButtonMorph(770, 690, 80, 30, "Run", '#4CAF50', '#45a049');
world.addMorph(runButton);

var stopButton = new GradientButtonMorph(860, 690, 80, 30, "Stop", '#f44336', '#d32f2f');
world.addMorph(stopButton);

runButton.onMouseDown = function() {
  console.log("Starting interpreter...");

  // Save current sprite scripts before running
  saveCurrentSpriteScripts();

  // Update all sprite scripts in interpreter
  sprites.forEach(function(sprite) {
    interpreter.sprites[sprite.spriteName].scripts = sprite.scripts || [];
  });

  interpreter.start();
};

runButton.onTouchStart = function(evt, pos) {
  console.log("Starting interpreter...");

  saveCurrentSpriteScripts();

  sprites.forEach(function(sprite) {
    interpreter.sprites[sprite.spriteName].scripts = sprite.scripts || [];
  });

  interpreter.start();
};

stopButton.onMouseDown = function() {
  console.log("Stopping interpreter...");
  interpreter.stop();
};

stopButton.onTouchStart = function(evt, pos) {
  console.log("Stopping interpreter...");
  interpreter.stop();
};

// Project Management Functions
function saveProject() {
  // Save current sprite scripts
  if (selectedSprite) {
    saveCurrentSpriteScripts();
  }

  var projectData = {
    version: "1.0",
    sprites: sprites.map(function(sprite) {
      return {
        spriteName: sprite.spriteName,
        x: sprite.x,
        y: sprite.y,
        fillColor: sprite.fillColor,
        direction: sprite.direction || 90,
        size: sprite.size || 100,
        visible: sprite.visible !== false,
        scriptJSON: sprite.scriptJSON || '[]',
        scripts: sprite.scripts || []
      };
    }),
    selectedSpriteName: selectedSprite ? selectedSprite.spriteName : null,
    createdAt: new Date().toISOString()
  };

  var dataStr = JSON.stringify(projectData, null, 2);
  var dataBlob = new Blob([dataStr], {type: 'application/json'});

  var link = document.createElement('a');
  link.href = URL.createObjectURL(dataBlob);
  link.download = 'scratch_project_' + new Date().toISOString().slice(0,19).replace(/:/g, '-') + '.json';
  link.click();

  console.log('Project saved successfully!');
}

function loadProject() {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = function(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
      try {
        var projectData = JSON.parse(e.target.result);

        // Clear existing sprites and blocks
        sprites.forEach(function(sprite) {
          world.removeMorph(sprite);
        });

        duplicatedBlocks.forEach(function(block) {
          if (block.world) {
            world.removeMorph(block);
          }
        });

        sprites = [];
        duplicatedBlocks = [];
        selectedSprite = null;

        // Load sprites
        projectData.sprites.forEach(function(spriteData) {
          var sprite = createSprite(
            spriteData.x,
            spriteData.y,
            spriteData.spriteName,
            spriteData.fillColor
          );

          sprite.direction = spriteData.direction || 90;
          sprite.size = spriteData.size || 100;
          sprite.visible = spriteData.visible !== false;
          sprite.scriptJSON = spriteData.scriptJSON || '[]';
          sprite.scripts = spriteData.scripts || [];
        });

        // Set selected sprite
        if (projectData.selectedSpriteName) {
          var foundSprite = sprites.find(s => s.spriteName === projectData.selectedSpriteName);
          if (foundSprite) {
            switchToSprite(foundSprite);
          }
        } else if (sprites.length > 0) {
          switchToSprite(sprites[0]);
        }

        updateSpriteList();
        console.log('Project loaded successfully!');

      } catch (error) {
        console.error('Error loading project:', error);
        alert('Error loading project file. Please check the file format.');
      }
    };

    reader.readAsText(file);
  };

  input.click();
}

var extensionsVisible = false;
var extensionPanel = null;

function showExtensions() {
  if (extensionsVisible) {
    hideExtensions();
    return;
  }

  extensionPanel = new Morph(400, 100, 400, 500, {
    draggable: false,
    fillColor: '#1a1a1a',
    outlineColor: '#555',
    outlineThickness: 2,
    cornerRadius: 8
  });

  var extensionTitle = new TextMorph(415, 120, 200, 30, "Extensions", {
    font: 'bold 18px Arial',
    color: '#fff',
    fillColor: 'transparent',
    outlineColor: 'transparent'
  });

  var closeButton = new TextMorph(750, 110, 30, 30, "✕", {
    font: 'bold 16px Arial',
    color: '#fff',
    fillColor: '#f44336',
    outlineColor: '#d32f2f',
    outlineThickness: 1,
    cornerRadius: 3,
    textAlign: 'center'
  });

  closeButton.onMouseDown = function() {
    hideExtensions();
  };

  closeButton.onTouchStart = function(evt, pos) {
    hideExtensions();
  };

  // Extension list
  var extensions = [
    {name: "Pen Extension", description: "Draw with your sprites", enabled: false},
    {name: "Music Extension", description: "Play instruments and beats", enabled: false},
    {name: "Video Sensing", description: "Detect motion with camera", enabled: false},
    {name: "Text to Speech", description: "Make your sprites talk", enabled: false},
    {name: "Translate", description: "Translate text between languages", enabled: false}
  ];

  extensions.forEach(function(ext, index) {
    var yPos = 160 + index * 60;

    var extBox = new Morph(420, yPos, 360, 50, {
      draggable: false,
      fillColor: '#2a2a2a',
      outlineColor: '#444',
      outlineThickness: 1,
      cornerRadius: 5
    });

    var extName = new TextMorph(430, yPos + 5, 200, 20, ext.name, {
      font: 'bold 14px Arial',
      color: '#fff',
      fillColor: 'transparent',
      outlineColor: 'transparent'
    });

    var extDesc = new TextMorph(430, yPos + 25, 250, 18, ext.description, {
      font: '12px Arial',
      color: '#ccc',
      fillColor: 'transparent',
      outlineColor: 'transparent'
    });

    var enableButton = new TextMorph(690, yPos + 15, 80, 20, ext.enabled ? "Enabled" : "Enable", {
      font: '12px Arial',
      color: '#fff',
      fillColor: ext.enabled ? '#4CAF50' : '#2196F3',
      outlineColor: ext.enabled ? '#45a049' : '#1976D2',
      outlineThickness: 1,
      cornerRadius: 3,
      textAlign: 'center'
    });

    enableButton.extensionData = ext;
    enableButton.nameLabel = extName;
    enableButton.onMouseDown = function() {
      this.extensionData.enabled = !this.extensionData.enabled;
      this.text = this.extensionData.enabled ? "Enabled" : "Enable";
      this.fillColor = this.extensionData.enabled ? '#4CAF50' : '#2196F3';
      this.outlineColor = this.extensionData.enabled ? '#45a049' : '#1976D2';
      console.log((this.extensionData.enabled ? "Enabled" : "Disabled") + " extension:", this.extensionData.name);
    };

    enableButton.onTouchStart = function(evt, pos) {
      this.extensionData.enabled = !this.extensionData.enabled;
      this.text = this.extensionData.enabled ? "Enabled" : "Enable";
      this.fillColor = this.extensionData.enabled ? '#4CAF50' : '#2196F3';
      this.outlineColor = this.extensionData.enabled ? '#45a049' : '#1976D2';
      console.log((this.extensionData.enabled ? "Enabled" : "Disabled") + " extension:", this.extensionData.name);
    };

    world.addMorph(extBox);
    world.addMorph(extName);
    world.addMorph(extDesc);
    world.addMorph(enableButton);
  });

  world.addMorph(extensionPanel);
  world.addMorph(extensionTitle);
  world.addMorph(closeButton);

  extensionsVisible = true;
}

function hideExtensions() {
  if (!extensionsVisible) return;

  // Remove all extension-related morphs
  var morphsToRemove = world.morphs.filter(function(morph) {
    return morph === extensionPanel || 
           (morph.x >= 400 && morph.x <= 800 && morph.y >= 100 && morph.y <= 600);
  });

  morphsToRemove.forEach(function(morph) {
    world.removeMorph(morph);
  });

  extensionPanel = null;
  extensionsVisible = false;
}

// Initialize
showBlocksForCategory('Motion');
updateSpriteList();

// Delete key handler
window.addEventListener('keydown', function(evt) {
  if (evt.key === 'Delete' || evt.key === 'Backspace') {
    var selectedBlock = world._draggingMorph || world._hoverMorph;

    if (selectedBlock && selectedBlock instanceof ScratchBlockMorph && !selectedBlock.isPalette) {
      world.removeMorph(selectedBlock);

      var blockIndex = duplicatedBlocks.indexOf(selectedBlock);
      if (blockIndex > -1) {
        duplicatedBlocks.splice(blockIndex, 1);
      }

      if (selectedBlock.connectAbove) {
        selectedBlock.connectAbove.connectBelow = null;
      }
      if (selectedBlock.connectBelow) {
        selectedBlock.connectBelow.connectAbove = null;
        selectedBlock.connectBelow.isConnected = false;
      }

      evt.preventDefault();
    }
  }
});
