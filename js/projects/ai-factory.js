(function(){
'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// AI FACTORY BUILDER — Complete Portfolio Edition
// Self-contained IIFE with all core, UI, and integration logic.
// Scoped under .af-root for CSS, af- prefixed IDs for DOM.
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// AI FACTORY BUILDER — CORE SECTION
// Adapted for portfolio IIFE embedding. No ES6 imports/exports.
// All classes share a single closure scope.
// MOCK executors only — no real API calls.
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
//  EventBus — Lightweight pub/sub system
// ═══════════════════════════════════════════════════════════════════════════

class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = new Set();
    this._listeners[event].add(fn);
    return () => this.off(event, fn);
  }

  once(event, fn) {
    const wrapper = (...args) => { fn(...args); this.off(event, wrapper); };
    return this.on(event, wrapper);
  }

  off(event, fn) {
    this._listeners[event]?.delete(fn);
  }

  emit(event, data) {
    this._listeners[event]?.forEach(fn => fn(data));
  }
}

const Bus = new EventBus();


// ═══════════════════════════════════════════════════════════════════════════
//  Port — Represents a single input or output port on a block
// ═══════════════════════════════════════════════════════════════════════════

class Port {
  constructor({ id, label, type = 'any', direction }) {
    this.id        = id;
    this.label     = label;
    this.type      = type;      // text | number | bool | json | image | trigger | any
    this.direction = direction; // 'in' | 'out'
    this.blockId   = null;      // set when added to a block
  }

  get portKey() { return `${this.blockId}::${this.id}`; }

  isCompatible(otherPort) {
    if (this.direction === otherPort.direction) return false;
    if (this.type === 'any' || otherPort.type === 'any') return true;
    return this.type === otherPort.type;
  }

  toJSON() {
    return { id: this.id, label: this.label, type: this.type, direction: this.direction };
  }

  static fromJSON(data) { return new Port(data); }
}


// ═══════════════════════════════════════════════════════════════════════════
//  Registry — Defines all block types available in the library
// ═══════════════════════════════════════════════════════════════════════════

class Registry {
  constructor() {
    this._types      = {};
    this._categories = {};
    this._executors  = {};   // type -> async executor fn
    this._registerDefaults();
  }

  register(typeDef) {
    this._types[typeDef.type] = typeDef;
    const cat = typeDef.category || 'General';
    if (!this._categories[cat]) this._categories[cat] = [];
    if (!this._categories[cat].includes(typeDef.type)) {
      this._categories[cat].push(typeDef.type);
    }
  }

  registerExecutor(type, fn) {
    this._executors[type] = fn;
  }

  getExecutor(type) {
    return this._executors[type] || null;
  }

  get(type) { return this._types[type] || null; }

  getCategories() { return Object.keys(this._categories); }

  getByCategory(cat) {
    return (this._categories[cat] || []).map(t => this._types[t]);
  }

  getAll() { return Object.values(this._types); }

  _registerDefaults() {
    // ── AI Agents ───────────────────────────────────────────
    this.register({
      type: 'llm-agent',
      name: 'LLM Agent',
      icon: '\u{1F916}',
      category: 'AI Agents',
      color: '#4a7aff',
      description: 'General-purpose language model agent',
      requiresPrep: true,
      defaultPorts: {
        inputs:  [{ id: 'prompt', label: 'Prompt', type: 'text' },
                  { id: 'context', label: 'Context', type: 'json' }],
        outputs: [{ id: 'response', label: 'Response', type: 'text' },
                  { id: 'done', label: 'Done', type: 'trigger' }]
      },
      defaultSettings: {
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        maxTokens: 2048,
        systemPrompt: 'You are a helpful AI assistant.',
      }
    });

    this.register({
      type: 'code-agent',
      name: 'Code Agent',
      icon: '\u{1F4BB}',
      category: 'AI Agents',
      color: '#00ff9d',
      description: 'Reads and writes code with execution',
      requiresPrep: true,
      defaultPorts: {
        inputs:  [{ id: 'task', label: 'Task', type: 'text' },
                  { id: 'code', label: 'Code', type: 'text' }],
        outputs: [{ id: 'result', label: 'Result', type: 'text' },
                  { id: 'code-out', label: 'Code', type: 'text' },
                  { id: 'error', label: 'Error', type: 'text' }]
      },
      defaultSettings: {
        language: 'python',
        executeCode: false,
        model: 'llama-3.3-70b-versatile',
      }
    });

    this.register({
      type: 'reasoning-agent',
      name: 'Reasoning Agent',
      icon: '\u{1F9E0}',
      category: 'AI Agents',
      color: '#9d4aff',
      description: 'Multi-step chain-of-thought reasoning',
      requiresPrep: true,
      defaultPorts: {
        inputs:  [{ id: 'problem', label: 'Problem', type: 'text' }],
        outputs: [{ id: 'answer', label: 'Answer', type: 'text' },
                  { id: 'steps', label: 'Steps', type: 'json' }]
      },
      defaultSettings: { model: 'llama-3.3-70b-versatile', maxIterations: 10 }
    });

    // ── I/O ────────────────────────────────────────────────
    this.register({
      type: 'input-text',
      name: 'Text Input',
      icon: '\u{1F4DD}',
      category: 'Input / Output',
      color: '#00d4ff',
      description: 'Static or dynamic text input',
      defaultPorts: {
        inputs:  [],
        outputs: [{ id: 'text', label: 'Text', type: 'text' }]
      },
      defaultSettings: { value: '' }
    });

    this.register({
      type: 'output-display',
      name: 'Display',
      icon: '\u{1F4FA}',
      category: 'Input / Output',
      color: '#ffd600',
      description: 'Show final output',
      defaultPorts: {
        inputs:  [{ id: 'value', label: 'Value', type: 'any' }],
        outputs: []
      },
      defaultSettings: { format: 'auto' }
    });

    this.register({
      type: 'chat-block',
      name: 'Chat',
      icon: '\u{1F4AC}',
      category: 'Input / Output',
      color: '#ff8c00',
      description: 'AI-powered chat \u2014 responds using LLM, stays open until Stop is triggered',
      defaultPorts: {
        inputs:  [{ id: 'trigger',  label: 'Trigger',  type: 'trigger' },
                  { id: 'stop',     label: 'Stop',      type: 'trigger' },
                  { id: 'prompt',   label: 'Prompt',    type: 'text'    },
                  { id: 'context',  label: 'Context',   type: 'json'    }],
        outputs: [{ id: 'sentence',      label: 'Sentence',      type: 'text'    },
                  { id: 'ai_reply',      label: 'AI Reply',      type: 'text'    },
                  { id: 'user_msg',      label: 'User Message',  type: 'text'    },
                  { id: 'conversation',  label: 'Conversation',  type: 'text'    },
                  { id: 'history',       label: 'History',       type: 'json'    },
                  { id: 'done',          label: 'Done',          type: 'trigger' }]
      },
      defaultSettings: {
        systemPrompt: 'You are a friendly conversational AI assistant. Respond naturally and helpfully.',
        model: '',
      }
    });

    // ── Logic ──────────────────────────────────────────────
    this.register({
      type: 'condition',
      name: 'Condition',
      icon: '\u26A1',
      category: 'Logic',
      color: '#ff8c00',
      description: 'Branch based on condition',
      defaultPorts: {
        inputs:  [{ id: 'value', label: 'Value', type: 'any' },
                  { id: 'trigger', label: 'Trigger', type: 'trigger' }],
        outputs: [{ id: 'true', label: 'True', type: 'trigger' },
                  { id: 'false', label: 'False', type: 'trigger' }]
      },
      defaultSettings: { expression: 'value !== ""' }
    });

    this.register({
      type: 'loop',
      name: 'Loop',
      icon: '\u{1F504}',
      category: 'Logic',
      color: '#ff8c00',
      description: 'Iterate over a list',
      defaultPorts: {
        inputs:  [{ id: 'list', label: 'List', type: 'json' },
                  { id: 'trigger', label: 'Trigger', type: 'trigger' }],
        outputs: [{ id: 'item', label: 'Item', type: 'any' },
                  { id: 'index', label: 'Index', type: 'number' },
                  { id: 'done', label: 'Done', type: 'trigger' }]
      },
      defaultSettings: {}
    });

    this.register({
      type: 'merge',
      name: 'Merge',
      icon: '\u{1F500}',
      category: 'Logic',
      color: '#5a6a8a',
      description: 'Wait for all inputs',
      defaultPorts: {
        inputs:  [{ id: 'a', label: 'A', type: 'any' },
                  { id: 'b', label: 'B', type: 'any' }],
        outputs: [{ id: 'merged', label: 'Merged', type: 'json' }]
      },
      defaultSettings: {}
    });

    this.register({
      type: 'loop-controller',
      name: 'Loop Controller',
      icon: '\u267B',
      category: 'Logic',
      color: '#00c8ff',
      description: 'Controls loop iterations via backflow pipelines. Connect "loop" output back to an upstream block with a backflow pipe. Outputs on "done" when break is triggered or max iterations reached.',
      defaultPorts: {
        inputs:  [
          { id: 'data',    label: 'Data',    type: 'any' },
          { id: 'break',   label: 'Break',   type: 'trigger' },
        ],
        outputs: [
          { id: 'loop',      label: 'Loop',      type: 'any' },
          { id: 'done',      label: 'Done',       type: 'any' },
          { id: 'iteration', label: 'Iteration',  type: 'number' },
        ]
      },
      defaultSettings: {
        maxIterations: 10,
      }
    });

    // ── Data ───────────────────────────────────────────────
    this.register({
      type: 'json-parse',
      name: 'JSON Parse',
      icon: '{ }',
      category: 'Data',
      color: '#ffd600',
      description: 'Parse or transform JSON',
      defaultPorts: {
        inputs:  [{ id: 'text', label: 'Text', type: 'text' }],
        outputs: [{ id: 'json', label: 'JSON', type: 'json' }]
      },
      defaultSettings: {}
    });

    this.register({
      type: 'template',
      name: 'Template',
      icon: '\u{1F4C4}',
      category: 'Data',
      color: '#4a7aff',
      description: 'String template with variable substitution',
      defaultPorts: {
        inputs:  [{ id: 'vars', label: 'Vars', type: 'json' }],
        outputs: [{ id: 'text', label: 'Text', type: 'text' }]
      },
      defaultSettings: { template: 'Hello, {{name}}!' }
    });

    this.register({
      type: 'transform',
      name: 'Transform',
      icon: '\u27F3',
      category: 'Data',
      color: '#ffd600',
      description: 'Applies a JS expression to data. Variable is "data". Supports map / filter / reduce.',
      defaultPorts: {
        inputs:  [{ id: 'data', label: 'Data', type: 'any' }],
        outputs: [
          { id: 'result', label: 'Result', type: 'any' },
          { id: 'error',  label: 'Error',  type: 'text' },
        ]
      },
      defaultSettings: {
        expression: 'data.toUpperCase()',
        mode:       'single',
        reduceInit: '[]',
      }
    });

    this.register({
      type: 'compare',
      name: 'Compare',
      icon: '\u27FA',
      category: 'Data',
      color: '#4a7aff',
      description: 'Compares A and B. Strategy adapts to value types and pipeline goal from _ctx.',
      defaultPorts: {
        inputs:  [
          { id: 'a',        label: 'A',        type: 'any' },
          { id: 'b',        label: 'B',        type: 'any' },
          { id: 'strategy', label: 'Strategy', type: 'text' },
        ],
        outputs: [
          { id: 'result',    label: 'Result',    type: 'json' },
          { id: 'similar',   label: 'Similar',   type: 'trigger' },
          { id: 'different', label: 'Different', type: 'trigger' },
          { id: 'score',     label: 'Score',     type: 'number' },
        ]
      },
      defaultSettings: {
        mode:      'auto',
        threshold: 0.8,
      }
    });

    this.register({
      type: 'accumulator',
      name: 'Accumulator',
      icon: '\u{1F4E6}',
      category: 'Data',
      color: '#ff8c00',
      description: 'Collects values across loop iterations. Flush empties the bucket downstream.',
      defaultPorts: {
        inputs:  [
          { id: 'item',    label: 'Item',  type: 'any' },
          { id: 'trigger', label: 'Flush', type: 'trigger' },
        ],
        outputs: [
          { id: 'list',  label: 'List',  type: 'json' },
          { id: 'count', label: 'Count', type: 'number' },
          { id: 'last',  label: 'Last',  type: 'any' },
        ]
      },
      defaultSettings: {
        mode:         'append',
        maxItems:     0,
        resetOnFlush: false,
      }
    });

    // ── Flow Control ──────────────────────────────────────
    this.register({
      type: 'clarification',
      name: 'Clarification',
      icon: '\u2753',
      category: 'Flow Control',
      color: '#ff3d5a',
      description: 'Knows what info is required; stops chat when obtained',
      defaultPorts: {
        inputs:  [{ id: 'required', label: 'Required', type: 'json' },
                  { id: 'chat-out', label: 'Chat Out', type: 'text' }],
        outputs: [{ id: 'info', label: 'Info', type: 'json' },
                  { id: 'stop', label: 'Stop', type: 'trigger' }]
      },
      defaultSettings: {}
    });

    this.register({
      type: 'annotator',
      name: 'Annotator',
      icon: '\u{1F3F7}',
      category: 'Flow Control',
      color: '#00d4ff',
      description: 'Tags pipeline context with goal, constraints and topic labels. Data passes through unchanged.',
      defaultPorts: {
        inputs:  [{ id: 'data', label: 'Data', type: 'any' }],
        outputs: [{ id: 'data', label: 'Data', type: 'any' }]
      },
      defaultSettings: {
        goal:      '',
        tags:      '',
        maxTokens: '',
        language:  '',
        format:    '',
      }
    });

    this.register({
      type: 'router',
      name: 'Router',
      icon: '\u2194',
      category: 'Flow Control',
      color: '#ff8c00',
      description: 'Routes data to one of several outputs. Expression must return "a", "b", "c" or "else".',
      defaultPorts: {
        inputs:  [{ id: 'value', label: 'Value', type: 'any' }],
        outputs: [
          { id: 'a',    label: 'A',    type: 'any' },
          { id: 'b',    label: 'B',    type: 'any' },
          { id: 'c',    label: 'C',    type: 'any' },
          { id: 'else', label: 'Else', type: 'any' },
        ]
      },
      defaultSettings: {
        expression: 'value.length > 100 ? "a" : "b"',
      }
    });

    this.register({
      type: 'validator',
      name: 'Validator',
      icon: '\u2714',
      category: 'Flow Control',
      color: '#00ff9d',
      description: 'Validates data against rules. Routes to valid or invalid port with a report.',
      defaultPorts: {
        inputs:  [{ id: 'data', label: 'Data', type: 'any' }],
        outputs: [
          { id: 'valid',   label: 'Valid',   type: 'any' },
          { id: 'invalid', label: 'Invalid', type: 'any' },
          { id: 'report',  label: 'Report',  type: 'json' },
        ]
      },
      defaultSettings: {
        rules: 'data !== null && data !== "" || "Value must not be empty"',
        mode:  'all',
      }
    });

    this.register({
      type: 'gate',
      name: 'Gate',
      icon: '\u26E9',
      category: 'Flow Control',
      color: '#9d4aff',
      description: 'Holds data until trigger arrives. Synchronises parallel branches.',
      defaultPorts: {
        inputs:  [
          { id: 'data',    label: 'Data',    type: 'any' },
          { id: 'trigger', label: 'Trigger', type: 'trigger' },
        ],
        outputs: [
          { id: 'data', label: 'Data',   type: 'any' },
          { id: 'open', label: 'Opened', type: 'trigger' },
        ]
      },
      defaultSettings: { mode: 'and' }
    });

    // ── Utilities ──────────────────────────────────────────
    this.register({
      type: 'prompt-builder',
      name: 'Prompt Builder',
      icon: '\u270D',
      category: 'Utilities',
      color: '#00d4ff',
      description: 'Builds structured prompts from parts',
      defaultPorts: {
        inputs:  [{ id: 'system', label: 'System', type: 'text' },
                  { id: 'context', label: 'Context', type: 'text' },
                  { id: 'query', label: 'Query', type: 'text' }],
        outputs: [{ id: 'prompt', label: 'Prompt', type: 'text' }]
      },
      defaultSettings: {
        template: 'Context: {{context}}\n\nTask: {{query}}',
      }
    });

    this.register({
      type: 'http-request',
      name: 'HTTP Request',
      icon: '\u{1F310}',
      category: 'Utilities',
      color: '#ff8c00',
      description: 'Fetch data from a URL',
      defaultPorts: {
        inputs:  [{ id: 'url', label: 'URL', type: 'text' },
                  { id: 'trigger', label: 'Trigger', type: 'trigger' }],
        outputs: [{ id: 'body', label: 'Body', type: 'text' },
                  { id: 'json', label: 'JSON', type: 'json' },
                  { id: 'status', label: 'Status', type: 'number' }]
      },
      defaultSettings: { method: 'GET', headers: '{}' }
    });

    this.register({
      type: 'web-search',
      name: 'Web Search',
      icon: '\u{1F50D}',
      category: 'Utilities',
      color: '#00c896',
      description: 'Search the web and return summarised results',
      defaultPorts: {
        inputs:  [{ id: 'query',   label: 'Query',   type: 'text'    },
                  { id: 'trigger', label: 'Trigger',  type: 'trigger' }],
        outputs: [{ id: 'summary', label: 'Summary',  type: 'text'    },
                  { id: 'results', label: 'Results',  type: 'json'    },
                  { id: 'urls',    label: 'URLs',     type: 'json'    }]
      },
      defaultSettings: {
        numResults:  5,
        includeBody: false,
      }
    });

    this.register({
      type: 'text-splitter',
      name: 'Text Splitter',
      icon: '\u2702',
      category: 'Utilities',
      color: '#9d4aff',
      description: 'Split text into chunks or lines',
      defaultPorts: {
        inputs:  [{ id: 'text', label: 'Text', type: 'text' }],
        outputs: [{ id: 'chunks', label: 'Chunks', type: 'json' },
                  { id: 'count', label: 'Count', type: 'number' }]
      },
      defaultSettings: { splitBy: 'paragraph', chunkSize: 500, overlap: 50 }
    });

    this.register({
      type: 'note',
      name: 'Note',
      icon: '\u{1F4CC}',
      category: 'Utilities',
      color: '#ffd600',
      description: 'Sticky note \u2014 no execution',
      defaultPorts: { inputs: [], outputs: [] },
      defaultSettings: { text: 'Add a note\u2026', color: '#ffd600' }
    });

    // ── Media ──────────────────────────────────────────────
    this.register({
      type: 'image-generator',
      name: 'Image Generator',
      icon: '\u{1F5BC}',
      category: 'Media',
      color: '#9d4aff',
      description: 'Generate images from text prompts \u2014 free via Pollinations.AI (no API key needed)',
      requiresPrep: false,
      defaultPorts: {
        inputs:  [{ id: 'prompt', label: 'Prompt', type: 'text' }],
        outputs: [
          { id: 'image_url', label: 'Image URL', type: 'text'  },
          { id: 'image',     label: 'Image',     type: 'image' },
          { id: 'done',      label: 'Done',      type: 'trigger' },
        ]
      },
      defaultSettings: {
        model:         'flux',
        width:         1024,
        height:        1024,
        enhance:       false,
        negativePrompt: '',
        seed:          -1,
      }
    });

    this.register({
      type: 'image-interpreter',
      name: 'Image Interpreter',
      icon: '\u{1F441}',
      category: 'Media',
      color: '#00d4ff',
      description: 'Describe or analyse an image URL using vision AI',
      requiresPrep: false,
      defaultPorts: {
        inputs:  [
          { id: 'image_url', label: 'Image URL', type: 'text' },
          { id: 'question',  label: 'Question',  type: 'text' },
        ],
        outputs: [
          { id: 'description', label: 'Description', type: 'text' },
          { id: 'done',        label: 'Done',         type: 'trigger' },
        ]
      },
      defaultSettings: {
        question:    'Describe this image in detail.',
        model:       '',
        maxTokens:   1024,
      }
    });
  }  // end _registerDefaults
}  // end class Registry

const BlockRegistry = new Registry();
const Reg = BlockRegistry;   // convenience alias


// ═══════════════════════════════════════════════════════════════════════════
//  Block — Core data model for a factory block
// ═══════════════════════════════════════════════════════════════════════════

class Block {
  constructor({ type, x = 0, y = 0, width = null }) {
    this.id       = Block._uid();
    this.type     = type;
    this.x        = x;
    this.y        = y;
    this.width    = width;   // null = auto; number = world-px width (grid-snapped)

    const def     = BlockRegistry.get(type);
    if (!def) throw new Error(`Unknown block type: ${type}`);

    this.name     = def.name;
    this.icon     = def.icon;
    this.color    = def.color;
    this.category = def.category;

    this.ports = {
      inputs:  (def.defaultPorts.inputs  || []).map(p => {
        const port = new Port({ ...p, direction: 'in' });
        port.blockId = this.id;
        return port;
      }),
      outputs: (def.defaultPorts.outputs || []).map(p => {
        const port = new Port({ ...p, direction: 'out' });
        port.blockId = this.id;
        return port;
      })
    };

    this.settings = JSON.parse(JSON.stringify(def.defaultSettings || {}));
    this.notes    = '';        // Sticky note attached to block
    this.status   = 'idle';   // idle | waiting | running | done | error
    this.results  = [];
    this.selected = false;
    this.collapsed = false;   // For group/machine blocks
  }

  // ── Port helpers ──────────────────────────────────────
  getPort(portId) {
    return this.ports.inputs.find(p => p.id === portId)
        || this.ports.outputs.find(p => p.id === portId)
        || null;
  }

  addPort(direction, portDef) {
    const port = new Port({ ...portDef, direction });
    port.blockId = this.id;
    this.ports[direction === 'in' ? 'inputs' : 'outputs'].push(port);
    Bus.emit('block:ports-changed', { blockId: this.id });
    return port;
  }

  removePort(portId) {
    this.ports.inputs  = this.ports.inputs.filter(p => p.id !== portId);
    this.ports.outputs = this.ports.outputs.filter(p => p.id !== portId);
    Bus.emit('block:ports-changed', { blockId: this.id });
  }

  // ── Settings ─────────────────────────────────────────
  updateSettings(patch) {
    Object.assign(this.settings, patch);
    Bus.emit('block:settings-changed', { blockId: this.id });
  }

  // ── Results ──────────────────────────────────────────
  addResult(data) {
    const result = {
      id:        `r${this.results.length + 1}`,
      timestamp: new Date().toISOString(),
      data
    };
    this.results.push(result);
    Bus.emit('block:result', { blockId: this.id, result });
    return result;
  }

  clearResults() {
    this.results = [];
    Bus.emit('block:result', { blockId: this.id, result: null });
  }

  // ── Status ────────────────────────────────────────────
  setStatus(status) {
    this.status = status;
    Bus.emit('block:status-changed', { blockId: this.id, status });
  }

  // ── Position / size ───────────────────────────────────
  moveTo(x, y) {
    this.x = x; this.y = y;
    Bus.emit('block:moved', { blockId: this.id, x, y });
  }

  // ── Serialization ─────────────────────────────────────
  toJSON() {
    return {
      id:       this.id,
      type:     this.type,
      x:        this.x,
      y:        this.y,
      width:    this.width,
      name:     this.name,
      notes:    this.notes,
      settings: this.settings,
      ports: {
        inputs:  this.ports.inputs.map(p => p.toJSON()),
        outputs: this.ports.outputs.map(p => p.toJSON()),
      }
    };
  }

  static fromJSON(data) {
    const block = new Block({ type: data.type, x: data.x, y: data.y, width: data.width ?? null });
    block.id       = data.id;
    block.name     = data.name ?? block.name;
    block.notes    = data.notes ?? '';
    block.settings = data.settings;
    block.ports.inputs  = data.ports.inputs.map(p => {
      const port = Port.fromJSON(p); port.blockId = block.id; return port;
    });
    block.ports.outputs = data.ports.outputs.map(p => {
      const port = Port.fromJSON(p); port.blockId = block.id; return port;
    });
    return block;
  }

  static _uid() {
    return 'b_' + Math.random().toString(36).slice(2, 9);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  Pipeline — A directed connection between two ports
// ═══════════════════════════════════════════════════════════════════════════

class Pipeline {
  constructor({ fromBlockId, fromPortId, toBlockId, toPortId, backflow = false }) {
    this.id         = Pipeline._uid();
    this.fromBlockId = fromBlockId;
    this.fromPortId  = fromPortId;
    this.toBlockId   = toBlockId;
    this.toPortId    = toPortId;
    this.backflow    = backflow;   // true = ignored by topo sort, used for loops
    this.selected    = false;
  }

  get fromKey() { return `${this.fromBlockId}::${this.fromPortId}`; }
  get toKey()   { return `${this.toBlockId}::${this.toPortId}`; }

  resolveType(workspace) {
    const block = workspace.blocks.get(this.fromBlockId);
    if (!block) return 'any';
    const port = block.getPort(this.fromPortId);
    return port ? port.type : 'any';
  }

  toJSON() {
    const obj = {
      id: this.id,
      fromBlockId: this.fromBlockId, fromPortId: this.fromPortId,
      toBlockId: this.toBlockId,     toPortId: this.toPortId,
    };
    if (this.backflow) obj.backflow = true;
    return obj;
  }

  static fromJSON(data) { return new Pipeline(data); }

  static _uid() {
    return 'p_' + Math.random().toString(36).slice(2, 9);
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  Workspace — Block/pipeline storage, viewport, grid, undo/redo
// ═══════════════════════════════════════════════════════════════════════════

class Workspace {
  constructor() {
    this.blocks    = new Map();  // id -> Block
    this.pipelines = new Map();  // id -> Pipeline

    // Viewport state
    this.viewX  = 0;
    this.viewY  = 0;
    this.zoom   = 1;

    // Grid
    this.gridSize = 24;

    // Undo/redo stacks
    this._history     = [];
    this._historyIdx  = -1;
    this._maxHistory  = 80;

    this._saveSnapshot();
  }

  // ── Grid snapping ─────────────────────────────────────
  snap(value) {
    return Math.round(value / this.gridSize) * this.gridSize;
  }

  snapPoint(x, y) {
    return { x: this.snap(x), y: this.snap(y) };
  }

  // ── Viewport ──────────────────────────────────────────
  setView(x, y, zoom) {
    this.viewX = x;
    this.viewY = y;
    this.zoom  = Math.max(0.15, Math.min(4, zoom));
    Bus.emit('workspace:view-changed', { x: this.viewX, y: this.viewY, zoom: this.zoom });
  }

  panBy(dx, dy) {
    this.setView(this.viewX + dx, this.viewY + dy, this.zoom);
  }

  zoomAt(factor, screenX, screenY, containerRect) {
    const before = this._screenToWorld(screenX, screenY, containerRect);
    const newZoom = Math.max(0.15, Math.min(4, this.zoom * factor));
    const after = {
      x: (screenX - containerRect.left - this.viewX) / newZoom,
      y: (screenY - containerRect.top  - this.viewY) / newZoom,
    };
    this.setView(
      this.viewX + (before.x - after.x) * newZoom,
      this.viewY + (before.y - after.y) * newZoom,
      newZoom
    );
  }

  screenToWorld(screenX, screenY, containerRect) {
    return {
      x: (screenX - containerRect.left - this.viewX) / this.zoom,
      y: (screenY - containerRect.top  - this.viewY) / this.zoom,
    };
  }

  worldToScreen(worldX, worldY, containerRect) {
    return {
      x: worldX * this.zoom + this.viewX + containerRect.left,
      y: worldY * this.zoom + this.viewY + containerRect.top,
    };
  }

  _screenToWorld(sx, sy, rect) { return this.screenToWorld(sx, sy, rect); }

  // ── Blocks ────────────────────────────────────────────
  addBlock(block, recordHistory = true) {
    this.blocks.set(block.id, block);
    Bus.emit('workspace:block-added', { block });
    if (recordHistory) this._saveSnapshot();
    return block;
  }

  removeBlock(blockId, recordHistory = true) {
    const toRemove = [];
    this.pipelines.forEach((p, id) => {
      if (p.fromBlockId === blockId || p.toBlockId === blockId) toRemove.push(id);
    });
    toRemove.forEach(id => this.removePipeline(id, false));

    this.blocks.delete(blockId);
    Bus.emit('workspace:block-removed', { blockId });
    if (recordHistory) this._saveSnapshot();
  }

  // ── Pipelines ─────────────────────────────────────────
  addPipeline(pipeline, recordHistory = true) {
    const exists = Array.from(this.pipelines.values()).find(
      p => p.toBlockId === pipeline.toBlockId && p.toPortId === pipeline.toPortId
    );
    if (exists) this.removePipeline(exists.id, false);

    this.pipelines.set(pipeline.id, pipeline);
    Bus.emit('workspace:pipeline-added', { pipeline });
    if (recordHistory) this._saveSnapshot();
    return pipeline;
  }

  removePipeline(pipelineId, recordHistory = true) {
    this.pipelines.delete(pipelineId);
    Bus.emit('workspace:pipeline-removed', { pipelineId });
    if (recordHistory) this._saveSnapshot();
  }

  getPipelinesForPort(blockId, portId) {
    return Array.from(this.pipelines.values()).filter(p =>
      (p.fromBlockId === blockId && p.fromPortId === portId) ||
      (p.toBlockId === blockId   && p.toPortId   === portId)
    );
  }

  // ── Selection helpers ────────────────────────────────
  getBlocksInRect(worldX, worldY, worldW, worldH) {
    const result = [];
    this.blocks.forEach(block => {
      if (block.x + 200 >= worldX && block.x <= worldX + worldW &&
          block.y + 80  >= worldY && block.y <= worldY + worldH) {
        result.push(block);
      }
    });
    return result;
  }

  // ── Undo/Redo ─────────────────────────────────────────
  _saveSnapshot() {
    this._history = this._history.slice(0, this._historyIdx + 1);
    this._history.push(this._serialize());
    if (this._history.length > this._maxHistory) this._history.shift();
    this._historyIdx = this._history.length - 1;
  }

  undo() {
    if (this._historyIdx <= 0) return;
    this._historyIdx--;
    this._deserialize(this._history[this._historyIdx]);
    Bus.emit('workspace:history-changed', {});
  }

  redo() {
    if (this._historyIdx >= this._history.length - 1) return;
    this._historyIdx++;
    this._deserialize(this._history[this._historyIdx]);
    Bus.emit('workspace:history-changed', {});
  }

  _serialize() {
    return JSON.stringify({
      blocks:    Array.from(this.blocks.values()).map(b => b.toJSON()),
      pipelines: Array.from(this.pipelines.values()).map(p => p.toJSON()),
    });
  }

  _deserialize(json) {
    const data = JSON.parse(json);
    this.blocks.clear();
    this.pipelines.clear();
    data.blocks.forEach(b => this.blocks.set(b.id, Block.fromJSON(b)));
    data.pipelines.forEach(p => this.pipelines.set(p.id, Pipeline.fromJSON(p)));
    Bus.emit('workspace:rebuilt', {});
  }

  // ── Save / Load ───────────────────────────────────────
  save() {
    const data = this._serialize();
    localStorage.setItem('ai-factory-workspace', data);
    Bus.emit('workspace:saved', {});
    return data;
  }

  load() {
    const data = localStorage.getItem('ai-factory-workspace');
    if (!data) return false;
    this._deserialize(data);
    this._saveSnapshot();
    return true;
  }

  loadFromData(json) {
    let data;
    try {
      const parsed = JSON.parse(json);
      const { _meta, ...rest } = parsed;
      data = JSON.stringify(rest);
    } catch (e) {
      throw new Error('Invalid save file: ' + e.message);
    }
    this._deserialize(data);
    this._history    = [];
    this._historyIdx = -1;
    this._saveSnapshot();
  }

  toFileData() {
    return this._serialize();
  }

  clear() {
    this.blocks.clear();
    this.pipelines.clear();
    Bus.emit('workspace:rebuilt', {});
    this._saveSnapshot();
  }
}


// ═══════════════════════════════════════════════════════════════════════════
//  Factory — Execution engine (simplified: mock-only, no preparation step)
// ═══════════════════════════════════════════════════════════════════════════

class Factory {
  constructor() {
    this.state             = 'idle';
    this._ws               = null;
    this._portValues       = new Map();   // "blockId::portId" -> { data, ctx }
    this._globalIndex      = {};
    this._iterCount        = new Map();   // blockId -> current iteration number
    this._execQueue        = [];
    this._chatBlocksWaiting = new Set();
    this._paused           = false;
    this._stopFlag         = false;
    this._runId            = null;
    this._loopCounts       = new Map();   // "fromBlockId::toBlockId" -> iteration count
  }

  get isRunning() { return this.state === 'running'; }
  get isPaused()  { return this.state === 'paused';  }
  get isIdle()    { return this.state === 'idle';    }

  // ── Public API ──────────────────────────────────────────────────

  run(workspace) {
    if (this.state === 'running') return;
    this._ws         = workspace;
    this._paused     = false;
    this._stopFlag   = false;
    this._runId      = 'run_' + Date.now().toString(36);
    this._portValues.clear();
    this._iterCount.clear();
    this._loopCounts.clear();
    this._chatBlocksWaiting.clear();
    this._globalIndex = {};

    workspace.blocks.forEach(b => b.setStatus('idle'));

    const order = this._topoSort(workspace);
    if (order === null) {
      Bus.emit('ui:flash', { message: 'Cycle detected \u2014 cannot run', type: 'error' });
      return;
    }
    if (order.length === 0) {
      Bus.emit('ui:flash', { message: 'No blocks to run', type: 'info' });
      return;
    }

    this._execQueue = order;
    this.state = 'running';
    Bus.emit('factory:state', { state: 'running' });
    this._runNext();
  }

  pause() {
    if (this.state !== 'running') return;
    this._paused = true;
    this.state   = 'paused';
    Bus.emit('factory:state', { state: 'paused' });
  }

  resume() {
    if (this.state !== 'paused') return;
    this._paused = false;
    this.state   = 'running';
    Bus.emit('factory:state', { state: 'running' });
    this._runNext();
  }

  stop() {
    this._stopFlag  = true;
    this._paused    = false;
    this._execQueue = [];
    this._ws?.blocks.forEach(b => {
      if (b.status === 'running' || b.status === 'waiting') b.setStatus('idle');
    });
    this.state = 'idle';
    Bus.emit('factory:state',   { state: 'idle' });
    Bus.emit('factory:stopped', {});
    this._portValues.clear();
    this._iterCount.clear();
    this._loopCounts.clear();
    this._globalIndex = {};
  }

  chatCompleted(blockId, messages) {
    // No-op — kept for backward compat with Bus listener
  }

  getByAddress(address) {
    const parts = address.split('::');
    if (parts.length < 3) return undefined;
    return this._portValues.get(`${parts[0]}::${parts[2]}`)?.data;
  }

  // ── Topological sort (Kahn's algorithm) ────────────────────────

  _topoSort(workspace) {
    const blocks    = Array.from(workspace.blocks.values());
    const pipelines = Array.from(workspace.pipelines.values()).filter(p => !p.backflow);
    const inDegree  = new Map(blocks.map(b => [b.id, 0]));
    const adj       = new Map(blocks.map(b => [b.id, []]));

    pipelines.forEach(p => {
      inDegree.set(p.toBlockId, (inDegree.get(p.toBlockId) || 0) + 1);
      adj.get(p.fromBlockId)?.push(p.toBlockId);
    });

    const queue  = blocks.filter(b => inDegree.get(b.id) === 0).map(b => b.id);
    const result = [];
    while (queue.length > 0) {
      const id = queue.shift();
      result.push(id);
      (adj.get(id) || []).forEach(nextId => {
        const deg = inDegree.get(nextId) - 1;
        inDegree.set(nextId, deg);
        if (deg === 0) queue.push(nextId);
      });
    }
    if (result.length !== blocks.length) return null;
    return result.map(id => workspace.blocks.get(id)).filter(Boolean);
  }

  // ── Execution loop ──────────────────────────────────────────────

  async _runNext() {
    if (this._stopFlag || this._paused) return;
    if (this._execQueue.length === 0) { this._onComplete(); return; }

    const block = this._execQueue.shift();
    const iter  = this._getIter(block.id);
    const _ctx  = this._collectCtx(block);

    // Chat blocks ─────────────────────────────────────────────────────
    if (block.type === 'chat-block') {
      const inputs = this._collectInputs(block);

      if (inputs.stop !== undefined) {
        Bus.emit('chat:stop', { blockId: block.id });
        this._runNext();
        return;
      }

      block.setStatus('waiting');
      this._chatBlocksWaiting.add(block.id);

      const systemPrompt = inputs.prompt
        ?? block.settings?.systemPrompt
        ?? 'You are a friendly conversational AI assistant.';

      Bus.emit('chat:open', {
        blockId:      block.id,
        systemPrompt: systemPrompt,
        context:      inputs.context || null,
      });

      const onMessage = ({ blockId, text, aiReply, messages, sentences }) => {
        if (blockId !== block.id) return;
        const ctx  = this._collectCtx(block);
        const iter = this._getIter(block.id);

        const convText = messages.map(m =>
          `${m.role === 'ai' ? 'AI' : 'You'}: ${m.text}`
        ).join('\n');

        this._storeAndIndex(block.id, 'user_msg',     text,     ctx, iter, block);
        this._storeAndIndex(block.id, 'ai_reply',     aiReply,  ctx, iter, block);
        this._storeAndIndex(block.id, 'history',      messages, ctx, iter, block);
        this._storeAndIndex(block.id, 'conversation', convText, ctx, iter, block);
        this._storeAndIndex(block.id, 'done',          true,    ctx, iter, block);

        const sentenceList = sentences || [aiReply];
        sentenceList.forEach(s => {
          this._storeAndIndex(block.id, 'sentence', s, ctx, iter, block);
          this._runDownstreamOf(block.id);
        });
      };

      const onStop = ({ blockId }) => {
        if (blockId !== block.id) return;
        Bus.off('chat:message', onMessage);
        Bus.off('chat:stop',    onStop);
        this._chatBlocksWaiting.delete(block.id);
        block.setStatus('done');
        this._runNext();
      };

      Bus.on('chat:message', onMessage);
      Bus.on('chat:stop',    onStop);
      return;
    }

    block.setStatus('running');

    // ── Collect direct inputs ──────────────────────────────────
    const inputs   = this._collectInputs(block);

    // ── Run the block's executor (no preparation step) ────────
    const executor = BlockRegistry.getExecutor(block.type);
    const context  = { factory: this, workspace: this._ws, _ctx };

    try {
      const outputs = executor
        ? await executor(inputs, block, context)
        : this._stubExecute(block, inputs);

      if (outputs && typeof outputs === 'object') {
        const ctxPatch = outputs._ctxPatch || {};
        const outCtx   = this._mergeCtxPatch(_ctx, ctxPatch);

        Object.entries(outputs).forEach(([portId, val]) => {
          if (portId === '_ctxPatch') return;
          this._storeAndIndex(block.id, portId, val, outCtx, iter, block);
        });

        this._iterCount.set(block.id, iter + 1);

        const displayData = Object.fromEntries(
          Object.entries(outputs).filter(([k]) => k !== '_ctxPatch')
        );
        block.addResult(displayData);
      }

      block.setStatus('done');

      // ── Backflow: re-queue loop body if backflow pipes fired ──
      if (outputs && typeof outputs === 'object') {
        const didBackflow = this._handleBackflow(block, outputs);
        if (didBackflow) {
          Bus.emit('factory:block-log', { blockId: block.id, blockName: block.name });
          await this._delay(80);
          if (!this._stopFlag && !this._paused) this._runNext();
          return;
        }
      }

    } catch (err) {
      block.setStatus('error');
      block.addResult({ error: String(err.message || err) });
      Bus.emit('ui:flash', { message: `"${block.name}": ${err.message}`, type: 'error' });
    }

    Bus.emit('factory:block-log', { blockId: block.id, blockName: block.name });

    await this._delay(80);
    if (!this._stopFlag && !this._paused) this._runNext();
  }

  // ── Backflow handling ──────────────────────────────────────────

  _handleBackflow(block, outputs) {
    const backflowPipes = Array.from(this._ws.pipelines.values()).filter(
      p => p.backflow && p.fromBlockId === block.id
    );
    if (backflowPipes.length === 0) return false;

    let triggered = false;

    for (const bp of backflowPipes) {
      const val = outputs[bp.fromPortId];
      if (val === undefined || val === null) continue;

      const loopKey = `${bp.fromBlockId}::${bp.toBlockId}`;
      const count   = (this._loopCounts.get(loopKey) || 0) + 1;
      this._loopCounts.set(loopKey, count);

      const maxIter = block.settings?.maxIterations ?? 50;
      if (count > maxIter) {
        Bus.emit('ui:flash', {
          message: `Loop limit reached (${maxIter}) on "${block.name}" \u2014 skipping backflow`,
          type: 'warning'
        });
        continue;
      }

      const targetBlock = this._ws.blocks.get(bp.toBlockId);
      if (!targetBlock) continue;

      const loopBody = this._findLoopBody(bp.toBlockId, block.id);

      for (const lb of loopBody) {
        if (lb.id === block.id) continue;
        for (const port of lb.ports.outputs) {
          this._portValues.delete(`${lb.id}::${port.id}`);
        }
      }

      const ctx  = this._collectCtx(targetBlock);
      const iter = this._getIter(bp.toBlockId);
      this._storeAndIndex(bp.toBlockId, bp.toPortId, val, ctx, iter, targetBlock);

      this._execQueue = [...loopBody, ...this._execQueue];
      triggered = true;

      Bus.emit('factory:loop-iteration', {
        loopKey, iteration: count, maxIterations: maxIter,
        fromBlock: block.name, toBlock: targetBlock.name,
      });
    }

    return triggered;
  }

  _findLoopBody(startId, endId) {
    const forwardPipes = Array.from(this._ws.pipelines.values()).filter(p => !p.backflow);
    const adj = new Map();
    forwardPipes.forEach(p => {
      if (!adj.has(p.fromBlockId)) adj.set(p.fromBlockId, []);
      adj.get(p.fromBlockId).push(p.toBlockId);
    });

    const visited = new Set();
    const queue   = [startId];
    const order   = [];
    while (queue.length) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      order.push(id);
      if (id === endId) continue;
      (adj.get(id) || []).forEach(next => queue.push(next));
    }

    if (!visited.has(endId)) {
      const b = this._ws.blocks.get(startId);
      return b ? [b] : [];
    }

    return order.map(id => this._ws.blocks.get(id)).filter(Boolean);
  }

  _onComplete() {
    if (this._chatBlocksWaiting.size > 0) return;
    this.state = 'idle';
    Bus.emit('factory:state',     { state: 'idle' });
    Bus.emit('factory:completed', { index: this._buildGlobalIndex() });
    Bus.emit('ui:flash', { message: 'Factory run complete', type: 'success' });
  }

  _runDownstreamOf(blockId) {
    const directNext = Array.from(this._ws.pipelines.values())
      .filter(p => p.fromBlockId === blockId && !p.backflow)
      .map(p => p.toBlockId);

    const seen  = new Set();
    const queue = [...new Set(directNext)];
    const order = [];
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      order.push(id);
      Array.from(this._ws.pipelines.values())
        .filter(p => p.fromBlockId === id && !p.backflow)
        .forEach(p => queue.push(p.toBlockId));
    }

    const blocks = order.map(id => this._ws.blocks.get(id)).filter(Boolean);
    this._execQueue = [...blocks, ...this._execQueue];
    this.state = 'running';
    this._runNext();
  }

  // ── Port value store + indexing ─────────────────────────────────

  _storeAndIndex(blockId, portId, data, ctx, iter, block) {
    const address  = `${blockId}::iter${iter}::${portId}`;
    const entry    = _buildIndexEntry(address, blockId, block, iter, portId, data);
    const newIndex = { ...(ctx.index || {}), [address]: entry };
    const newCtx   = { ...ctx, index: newIndex };
    this._portValues.set(`${blockId}::${portId}`, { data, ctx: newCtx });

    this._globalIndex[address] = entry;
    Bus.emit('factory:index-updated', { address, entry, index: { ...this._globalIndex } });
  }

  _getPortValue(blockId, portId) {
    return this._portValues.get(`${blockId}::${portId}`)?.data;
  }

  _getPortEnvelope(blockId, portId) {
    return this._portValues.get(`${blockId}::${portId}`) ?? null;
  }

  // ── Input / ctx collection ──────────────────────────────────────

  _collectInputs(block) {
    const inputs = {};
    block.ports.inputs.forEach(port => {
      const pipeline = Array.from(this._ws.pipelines.values()).find(
        p => p.toBlockId === block.id && p.toPortId === port.id
      );
      if (pipeline) {
        const env = this._getPortEnvelope(pipeline.fromBlockId, pipeline.fromPortId);
        if (env !== null) inputs[port.id] = env.data;
      }
    });
    return inputs;
  }

  _collectCtx(block) {
    const ctxList = [];
    block.ports.inputs.forEach(port => {
      const pipeline = Array.from(this._ws.pipelines.values()).find(
        p => p.toBlockId === block.id && p.toPortId === port.id
      );
      if (pipeline) {
        const env = this._getPortEnvelope(pipeline.fromBlockId, pipeline.fromPortId);
        if (env?.ctx) ctxList.push(env.ctx);
      }
    });

    return ctxList.reduce((acc, ctx) => {
      const result = { ...acc, ...ctx };
      result.index = { ...(acc.index || {}), ...(ctx.index || {}) };
      if (acc.tags || ctx.tags) {
        result.tags = [...new Set([...(acc.tags || []), ...(ctx.tags || [])])];
      }
      result.trace = [...(acc.trace || []), ...(ctx.trace || [])];
      return result;
    }, { runId: this._runId, index: {}, trace: [] });
  }

  _mergeCtxPatch(ctx, patch) {
    const result = { ...ctx, ...patch };
    result.index = { ...(ctx.index || {}), ...(patch.index || {}) };
    if (ctx.tags || patch.tags) {
      result.tags = [...new Set([...(ctx.tags || []), ...(patch.tags || [])])];
    }
    return result;
  }

  // ── Iteration tracking ──────────────────────────────────────────

  _getIter(blockId) { return this._iterCount.get(blockId) ?? 0; }

  // ── Global index ────────────────────────────────────────────────

  _buildGlobalIndex() {
    return { ...this._globalIndex };
  }

  // ── Stub executor ───────────────────────────────────────────────

  _stubExecute(block, inputs) {
    const outputs   = {};
    const firstText = Object.values(inputs).find(v => typeof v === 'string') ?? '';
    block.ports.outputs.forEach(port => {
      if      (port.type === 'trigger') outputs[port.id] = true;
      else if (port.type === 'text')    outputs[port.id] = firstText ? `[${block.name}] \u2192 ${firstText.slice(0,200)}` : `[${block.name}] output`;
      else if (port.type === 'number')  outputs[port.id] = 0;
      else if (port.type === 'bool')    outputs[port.id] = true;
      else if (port.type === 'json')    outputs[port.id] = { block: block.name, inputs };
      else                              outputs[port.id] = firstText || null;
    });
    return outputs;
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}


// ═══════════════════════════════════════════════════════════════════════════
//  Helper functions (index entry builder, summarise, etc.)
// ═══════════════════════════════════════════════════════════════════════════

function _buildIndexEntry(address, blockId, block, iter, portId, data) {
  const port     = block.getPort(portId);
  const strValue = _summarise(data);
  return {
    address, blockId,
    blockName: block.name,
    blockType: block.type,
    iteration: iter,
    portId,
    portLabel: port?.label ?? portId,
    portType:  port?.type  ?? 'any',
    summary:   strValue.slice(0, 120),
    size:      strValue.length,
    timestamp: new Date().toISOString(),
  };
}

function _summarise(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value === 'string')  return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const preview = value.slice(0, 3).map(v => _summarise(v)).join(', ');
    return `[${preview}${value.length > 3 ? `, \u2026+${value.length - 3}` : ''}]`;
  }
  try { return JSON.stringify(value); } catch { return '[Object]'; }
}

function _formatSize(bytes) {
  if (!bytes) return '0B';
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function _interpolate(template, vars) {
  return template.replace(/\{\{([\w._\[\]"':]+)\}\}/g, (_, key) => {
    const parts = key.split('.');
    let val = vars;
    for (const p of parts) {
      if (val === undefined || val === null) break;
      val = val[p];
    }
    return val !== undefined ? String(val) : `{{${key}}}`;
  });
}

function _indexSummary(ctx) {
  const index = ctx?.index;
  if (!index || Object.keys(index).length === 0) return '';

  const lines = Object.values(index)
    .filter(e => !['trigger', 'bool'].includes(e.portType))
    .map(e => {
      const addr    = `[${e.address}]`;
      const source  = `${e.blockName} / ${e.portLabel}`;
      const preview = e.summary ? `"${e.summary.slice(0, 80)}"` : '(empty)';
      return `  ${addr.padEnd(36)} ${source.padEnd(30)} ${preview}`;
    });

  if (lines.length === 0) return '';
  return `\n=== Available outputs (${lines.length}) ===\n${lines.join('\n')}\n`;
}

function _indexLookup(ctx, { blockType, portType, blockName } = {}) {
  const index = ctx?.index ?? {};
  return Object.values(index).filter(e =>
    (!blockType || e.blockType === blockType) &&
    (!portType  || e.portType  === portType)  &&
    (!blockName || e.blockName.toLowerCase().includes(blockName.toLowerCase()))
  );
}

function _diffValues(a, b) {
  if (typeof a === 'string' && typeof b === 'string')
    return { type: 'text-diff', lines: _lineDiff(a.split('\n'), b.split('\n')) };
  if (typeof a === 'object' && typeof b === 'object') {
    const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    const diff = {};
    allKeys.forEach(k => {
      if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) diff[k] = { a: a?.[k], b: b?.[k] };
    });
    return { type: 'object-diff', changed: diff };
  }
  return { type: 'value-diff', a, b, equal: a === b };
}

function _lineDiff(linesA, linesB) {
  const result = [];
  const maxLen = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < maxLen; i++) {
    const la = linesA[i], lb = linesB[i];
    if (la === lb)          result.push({ type: 'same',    line: la });
    else if (!la)           result.push({ type: 'added',   line: lb });
    else if (!lb)           result.push({ type: 'removed', line: la });
    else                    result.push({ type: 'changed', from: la, to: lb });
  }
  return result;
}


// ═══════════════════════════════════════════════════════════════════════════
//  MOCK Executors — All blocks use simulated responses, no real API calls
// ═══════════════════════════════════════════════════════════════════════════

// ── Input / Output ─────────────────────────────────────────────────

BlockRegistry.registerExecutor('input-text', async (inputs, block) => ({
  text: block.settings.value || ''
}));

BlockRegistry.registerExecutor('output-display', async (inputs) => ({
  _display: inputs.value
}));

// ── AI Agents (MOCK) ───────────────────────────────────────────────

BlockRegistry.registerExecutor('llm-agent', async (inputs, block) => {
  const prompt = String(inputs.prompt ?? '');
  if (!prompt.trim()) throw new Error('LLM Agent: Prompt input is empty.');

  await _sleep(600 + Math.random() * 800);

  const model = block.settings.model || 'mock-llm';
  const response = `[Mock LLM Response | model: ${model}]\n\n`
    + `Based on your prompt: "${prompt.slice(0, 100)}${prompt.length > 100 ? '...' : ''}"\n\n`
    + `This is a simulated AI response for the portfolio demo. `
    + `In the full application, this block connects to Groq or Anthropic APIs `
    + `to generate real language model responses.\n\n`
    + `The system prompt was: "${(block.settings.systemPrompt || '').slice(0, 80)}"`;

  return { response, done: true };
});

BlockRegistry.registerExecutor('reasoning-agent', async (inputs, block) => {
  const problem = String(inputs.problem ?? '');
  if (!problem.trim()) throw new Error('Reasoning Agent: Problem input is empty.');

  await _sleep(800 + Math.random() * 1200);

  const steps = [
    `Step 1: Analyze the problem \u2014 "${problem.slice(0, 60)}"`,
    'Step 2: Break down into sub-components',
    'Step 3: Apply logical reasoning to each component',
    'Step 4: Synthesize findings into a coherent answer',
  ];

  const answer = `[Mock Reasoning] After analyzing "${problem.slice(0, 80)}", `
    + `the conclusion is that this requires further investigation with a real AI model. `
    + `This is a simulated chain-of-thought response for the portfolio demo.`;

  return { answer, steps };
});

BlockRegistry.registerExecutor('code-agent', async (inputs, block) => {
  const task     = String(inputs.task ?? '');
  const codeIn   = String(inputs.code ?? '');
  const language = block.settings.language || 'python';
  if (!task.trim()) throw new Error('Code Agent: Task input is empty.');

  await _sleep(700 + Math.random() * 900);

  const codeOut = `# Mock ${language} code generated for: ${task.slice(0, 60)}\n`
    + `# This is a simulated code output for the portfolio demo.\n\n`
    + `def mock_solution():\n`
    + `    """Generated by AI Factory Builder (mock mode)"""\n`
    + `    print("Task: ${task.slice(0, 40).replace(/"/g, '\\"')}")\n`
    + `    return {"status": "simulated", "language": "${language}"}\n`;

  const result = `Mock ${language} code generated for: ${task.slice(0, 80)}`;

  return { result, 'code-out': codeOut };
});

// ── Logic ──────────────────────────────────────────────────────────

BlockRegistry.registerExecutor('condition', async (inputs, block) => {
  const value = inputs.value;
  let result  = false;
  try {
    result = new Function('value', `return !!(${block.settings.expression || 'value !== ""'})`)(value);
  } catch { result = Boolean(value); }
  return result ? { true: true } : { false: true };
});

BlockRegistry.registerExecutor('loop', async (inputs, block) => {
  const list  = inputs.list ?? [];
  const arr   = Array.isArray(list)
    ? list
    : (typeof list === 'string' ? list.split('\n').filter(Boolean) : [list]);
  const total = arr.length;
  const item  = arr[0] ?? null;

  return {
    item,
    index: 0,
    done:  total <= 1,
    _ctxPatch: {
      iteration: { index: 0, total, key: String(item ?? 0), isFirst: true, isLast: total <= 1 }
    }
  };
});

BlockRegistry.registerExecutor('loop-controller', async (inputs, block, context) => {
  const iter = context.factory._getIter(block.id);
  const max  = block.settings?.maxIterations ?? 10;
  const shouldBreak = inputs.break !== undefined && inputs.break !== null;
  const limitReached = iter >= max;

  const outputs = { iteration: iter };

  if (shouldBreak || limitReached) {
    outputs.done = inputs.data ?? null;
  } else {
    outputs.loop = inputs.data ?? null;
  }

  return outputs;
});

BlockRegistry.registerExecutor('merge', async (inputs, block, context) => {
  const a    = inputs.a;
  const b    = inputs.b;
  const goal = (context._ctx?.goal || '').toLowerCase();

  let strategy = 'merge';
  if (/diff|difference|changed|delta/.test(goal))   strategy = 'diff';
  else if (/concat|append|combine|join/.test(goal)) strategy = 'concat';
  else if (/synthes|summar|dedup/.test(goal))       strategy = 'synthesis';

  let merged;
  switch (strategy) {
    case 'diff':
      merged = _diffValues(a, b);
      break;
    case 'concat':
      merged = (typeof a === 'string' && typeof b === 'string')
        ? a + '\n' + b
        : (Array.isArray(a) && Array.isArray(b) ? [...a, ...b] : [a, b]);
      break;
    case 'synthesis':
      merged = { synthesis: '[Stub \u2014 connect LLM for real synthesis]', a, b };
      break;
    default:
      merged = (typeof a === 'object' && a && typeof b === 'object' && b)
        ? { ...a, ...b }
        : { a, b };
  }

  return { merged, _ctxPatch: { mergeStrategy: strategy } };
});

// ── Data ───────────────────────────────────────────────────────────

BlockRegistry.registerExecutor('json-parse', async (inputs) => {
  try { return { json: JSON.parse(inputs.text ?? '{}') }; }
  catch (e) { throw new Error(`JSON parse failed: ${e.message}`); }
});

BlockRegistry.registerExecutor('template', async (inputs, block, context) => {
  const vars     = inputs.vars ?? {};
  const template = block.settings.template || '';
  const ctx      = context._ctx ?? {};
  const allVars  = {
    ...(typeof vars === 'object' ? vars : {}),
    _ctx: { ...ctx, indexSummary: _indexSummary(ctx) },
  };
  try {
    return { text: _interpolate(template, allVars) };
  } catch (e) {
    return { text: '', error: `Template error: ${e.message}` };
  }
});

BlockRegistry.registerExecutor('transform', async (inputs, block) => {
  const data = inputs.data;
  const expr = block.settings.expression || 'data';
  const mode = block.settings.mode || 'single';
  try {
    let result;
    switch (mode) {
      case 'map': {
        const arr = Array.isArray(data) ? data : [data];
        result    = arr.map(item => new Function('data', `return (${expr})`)(item));
        break;
      }
      case 'filter': {
        const arr = Array.isArray(data) ? data : [data];
        result    = arr.filter(item => new Function('data', `return !!(${expr})`)(item));
        break;
      }
      case 'reduce': {
        const arr  = Array.isArray(data) ? data : [data];
        let   init;
        try { init = JSON.parse(block.settings.reduceInit || 'null'); } catch { init = null; }
        result = arr.reduce((acc, item) => new Function('acc', 'data', `return (${expr})`)(acc, item), init);
        break;
      }
      default:
        result = new Function('data', `return (${expr})`)(data);
    }
    return { result };
  } catch (e) {
    return { error: `Transform error: ${e.message}` };
  }
});

BlockRegistry.registerExecutor('compare', async (inputs, block, context) => {
  const a         = inputs.a;
  const b         = inputs.b;
  const portStrat = inputs.strategy;
  const goal      = (context._ctx?.goal || '').toLowerCase();
  const fallback  = block.settings.mode || 'auto';

  let strategy = portStrat || fallback;
  if (strategy === 'auto') {
    if (/diff|difference|changed|delta/.test(goal))       strategy = 'diff';
    else if (/similar|agreement|match|overlap/.test(goal)) strategy = 'similarity';
    else if (/subset|contains|includes/.test(goal))        strategy = 'subset';
    else if (/numeric|number|amount/.test(goal))           strategy = 'delta';
    else if (/equal|exact|identical/.test(goal))           strategy = 'equality';
    else if (typeof a === 'number' && typeof b === 'number') strategy = 'delta';
    else if (Array.isArray(a) && Array.isArray(b))          strategy = 'subset';
    else                                                     strategy = 'similarity';
  }

  let score = 0, detail = {};
  switch (strategy) {
    case 'equality':
      score  = JSON.stringify(a) === JSON.stringify(b) ? 1 : 0;
      detail = { equal: score === 1 };
      break;
    case 'similarity': {
      const wa = new Set(String(a).toLowerCase().split(/\W+/).filter(Boolean));
      const wb = new Set(String(b).toLowerCase().split(/\W+/).filter(Boolean));
      const inter = [...wa].filter(w => wb.has(w)).length;
      const union = new Set([...wa, ...wb]).size;
      score  = union > 0 ? inter / union : 1;
      detail = { wordsA: wa.size, wordsB: wb.size, overlap: inter, method: 'jaccard' };
      break;
    }
    case 'diff': {
      const la = String(JSON.stringify(a, null, 2)).split('\n');
      const lb = String(JSON.stringify(b, null, 2)).split('\n');
      const lines   = _lineDiff(la, lb);
      const changed = lines.filter(l => l.type !== 'same').length;
      score  = 1 - (changed / Math.max(lines.length, 1));
      detail = { lines, changed, same: lines.length - changed };
      break;
    }
    case 'subset': {
      const setA  = new Set((Array.isArray(a) ? a : [a]).map(x => JSON.stringify(x)));
      const arrB  = Array.isArray(b) ? b : [b];
      const inter = arrB.filter(x => setA.has(JSON.stringify(x))).length;
      score  = arrB.length > 0 ? inter / arrB.length : 1;
      detail = { aContainsB: score === 1, coverage: score };
      break;
    }
    case 'delta': {
      const na = Number(a), nb = Number(b);
      const delta = nb - na;
      score  = na !== 0 ? 1 - Math.min(1, Math.abs(delta) / Math.abs(na)) : (delta === 0 ? 1 : 0);
      detail = { delta, percentChange: na !== 0 ? (delta / na * 100).toFixed(2) + '%' : 'N/A' };
      break;
    }
    default:
      detail = { error: `Unknown strategy: ${strategy}` };
  }

  const threshold = block.settings.threshold ?? 0.8;
  const isSimilar = score >= threshold;
  return {
    result: { strategy, score, threshold, similar: isSimilar, detail },
    score,
    [isSimilar ? 'similar' : 'different']: true,
  };
});

BlockRegistry.registerExecutor('accumulator', async (inputs, block) => {
  if (!block._accumBuffer) block._accumBuffer = [];
  const item    = inputs.item;
  const trigger = inputs.trigger;
  const mode    = block.settings.mode || 'append';
  const max     = block.settings.maxItems || 0;

  if (item !== undefined) {
    switch (mode) {
      case 'prepend': block._accumBuffer.unshift(item); break;
      case 'unique':
        if (!block._accumBuffer.some(x => JSON.stringify(x) === JSON.stringify(item)))
          block._accumBuffer.push(item);
        break;
      case 'sum':
        block._accumBuffer = [(block._accumBuffer[0] ?? 0) + Number(item)]; break;
      case 'max':
        block._accumBuffer = [block._accumBuffer.length ? Math.max(block._accumBuffer[0], Number(item)) : Number(item)]; break;
      case 'min':
        block._accumBuffer = [block._accumBuffer.length ? Math.min(block._accumBuffer[0], Number(item)) : Number(item)]; break;
      case 'avg': {
        const prev = block._accumBuffer[1] ?? { sum: 0, count: 0 };
        const sum  = prev.sum + Number(item);
        const cnt  = prev.count + 1;
        block._accumBuffer = [sum / cnt, { sum, count: cnt }];
        break;
      }
      default:
        block._accumBuffer.push(item);
    }
    if (max > 0 && block._accumBuffer.length > max)
      block._accumBuffer = block._accumBuffer.slice(-max);
  }

  const list  = mode === 'avg' ? [block._accumBuffer[0]] : block._accumBuffer;
  const last  = list[list.length - 1];
  if (trigger !== undefined && block.settings.resetOnFlush) block._accumBuffer = [];
  return { list, count: list.length, last };
});

// ── Flow Control ────────────────────────────────────────────────────

BlockRegistry.registerExecutor('clarification', async (inputs) => {
  const required = inputs.required ?? {};
  const chatOut  = inputs['chat-out'] ?? '';
  const fields   = Array.isArray(required) ? required : Object.keys(required);
  const info     = {};
  fields.forEach(f => { info[f] = chatOut; });
  return { info, stop: chatOut.length > 0 || undefined };
});

BlockRegistry.registerExecutor('annotator', async (inputs, block) => {
  const s    = block.settings;
  const tags = s.tags ? s.tags.split(',').map(t => t.trim()).filter(Boolean) : [];
  const constraints = {};
  if (s.maxTokens) constraints.maxTokens = parseInt(s.maxTokens, 10);
  if (s.language)  constraints.language  = s.language;
  if (s.format)    constraints.format    = s.format;

  return {
    data: inputs.data,
    _ctxPatch: {
      ...(s.goal                          ? { goal: s.goal }       : {}),
      ...(tags.length                     ? { tags }               : {}),
      ...(Object.keys(constraints).length ? { constraints }        : {}),
    }
  };
});

BlockRegistry.registerExecutor('router', async (inputs, block) => {
  const value = inputs.value;
  let route   = 'else';
  try {
    const raw = new Function('value', `return (${block.settings.expression || '"else"'})`)(value);
    route = ['a', 'b', 'c', 'else'].includes(raw) ? raw : 'else';
  } catch { route = 'else'; }
  return { [route]: value };
});

BlockRegistry.registerExecutor('validator', async (inputs, block) => {
  const data  = inputs.data;
  const mode  = block.settings.mode || 'all';
  try {
    const lines = (block.settings.rules || '')
      .split('\n').map(l => l.trim()).filter(Boolean);

    const results = lines.map(line => {
      const sep    = line.indexOf(' || ');
      const expr   = sep >= 0 ? line.slice(0, sep) : line;
      const msg    = sep >= 0 ? line.slice(sep + 4).replace(/^"|"$/g, '') : 'Rule failed';
      let   passed = false;
      try { passed = Boolean(new Function('data', `return !!(${expr})`)(data)); }
      catch { passed = false; }
      return { rule: expr, passed, error: passed ? null : msg };
    });

    const overallPassed = mode === 'any'
      ? results.some(r => r.passed)
      : results.every(r => r.passed);

    return {
      [overallPassed ? 'valid' : 'invalid']: data,
      report: { passed: overallPassed, mode, rules: results,
                errors: results.filter(r => !r.passed).map(r => r.error) },
    };
  } catch (e) {
    return {
      invalid: data,
      report: { passed: false, mode, rules: [],
                errors: [`Validator error: ${e.message}`] },
    };
  }
});

BlockRegistry.registerExecutor('gate', async (inputs, block) => {
  const mode      = block.settings.mode || 'and';
  const shouldOpen = mode === 'trigger-only'
    ? inputs.trigger !== undefined
    : (inputs.data !== undefined && inputs.trigger !== undefined);
  return shouldOpen ? { data: inputs.data, open: true } : {};
});

// ── Media (MOCK) ────────────────────────────────────────────────────

BlockRegistry.registerExecutor('image-generator', async (inputs, block) => {
  const prompt = String(inputs.prompt ?? block.settings.prompt ?? '').trim();
  if (!prompt) throw new Error('Image Generator: Prompt input is empty.');

  await _sleep(500 + Math.random() * 700);

  const model  = block.settings.model  || 'flux';
  const width  = parseInt(block.settings.width,  10) || 1024;
  const height = parseInt(block.settings.height, 10) || 1024;
  const seed   = Math.floor(Math.random() * 1e9);

  // Use a placeholder image URL for mock mode
  const imageUrl = `https://placehold.co/${width}x${height}/1a1a2e/4a7aff?text=AI+Image+(mock)`;

  return { image_url: imageUrl, image: imageUrl, done: true };
});

BlockRegistry.registerExecutor('image-interpreter', async (inputs, block) => {
  const imageUrl = String(inputs.image_url ?? '').trim();
  if (!imageUrl) throw new Error('Image Interpreter: No image URL received.');

  await _sleep(400 + Math.random() * 600);

  const question = String(
    inputs.question ?? block.settings.question ?? 'Describe this image in detail.'
  ).trim();

  const description = `[Mock Vision Response]\n\n`
    + `Question: "${question}"\n`
    + `Image URL: ${imageUrl.slice(0, 80)}${imageUrl.length > 80 ? '...' : ''}\n\n`
    + `This is a simulated image description for the portfolio demo. `
    + `In the full application, this block uses Claude or Groq vision models `
    + `to analyse and describe the contents of the image.`;

  return { description, done: true };
});

// ── Utilities (MOCK) ────────────────────────────────────────────────

BlockRegistry.registerExecutor('web-search', async (inputs, block) => {
  const query = String(inputs.query || '').trim();
  if (!query) throw new Error('Web Search: No query provided.');

  await _sleep(400 + Math.random() * 500);

  const numResults = Math.max(1, Math.min(5, parseInt(block.settings.numResults) || 3));
  const results = [];
  for (let i = 0; i < numResults; i++) {
    results.push({
      title:   `Mock Result ${i + 1} for "${query.slice(0, 30)}"`,
      url:     `https://example.com/result-${i + 1}`,
      snippet: `This is a simulated search result snippet for the query "${query}". In the full app, DuckDuckGo API provides real results.`,
      source:  'Mock Search',
    });
  }

  const summary = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n${r.url}`)
    .join('\n\n');

  const urls = results.map(r => r.url);

  return { summary, results, urls };
});

BlockRegistry.registerExecutor('http-request', async (inputs, block) => {
  const url = String(inputs.url || '').trim();

  await _sleep(300 + Math.random() * 400);

  return {
    body:   `[Mock HTTP ${block.settings.method || 'GET'} response from: ${url || '(no URL)'}]`,
    json:   { mock: true, url: url, method: block.settings.method || 'GET' },
    status: 200,
  };
});

BlockRegistry.registerExecutor('text-splitter', async (inputs, block) => {
  const text    = String(inputs.text ?? '');
  const splitBy = block.settings.splitBy || 'paragraph';

  let chunks;
  switch (splitBy) {
    case 'line':
      chunks = text.split('\n').filter(Boolean);
      break;
    case 'sentence':
      chunks = text.split(/(?<=[.!?])\s+/).filter(Boolean);
      break;
    case 'paragraph':
    default:
      chunks = text.split(/\n\s*\n/).filter(Boolean);
      break;
  }

  return { chunks, count: chunks.length };
});

BlockRegistry.registerExecutor('prompt-builder', async (inputs, block) => {
  const template = block.settings.template || '';
  const system   = inputs.system  || '';
  const context  = inputs.context || '';
  const query    = inputs.query   || '';

  const text = _interpolate(template, { system, context, query });
  return { prompt: text };
});


// ═══════════════════════════════════════════════════════════════════════════
//  Singleton instances
// ═══════════════════════════════════════════════════════════════════════════

const FactoryController = new Factory();

Bus.on('chat:completed', ({ blockId, messages }) =>
  FactoryController.chatCompleted(blockId, messages)
);


// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  AI Factory Builder — UI Section                                          ║
// ║  Adapted for portfolio embedding. No ES6 imports/exports.                 ║
// ║  All classes share closure scope with core: Bus, Port, Block, Pipeline,   ║
// ║  Workspace, Reg (BlockRegistry), Factory (FactoryController).             ║
// ║  DOM IDs prefixed with 'af-' to avoid conflicts.                          ║
// ╚══════════════════════════════════════════════════════════════════════════════╝


// ═══════════════════════════════════════════════════════════════════════════════
// ║  SelectionManager                                                         ║
// ═══════════════════════════════════════════════════════════════════════════════

class SelectionManager {
  constructor(workspace) {
    this._ws      = workspace;
    this.selected = new Set(); // set of block IDs
  }

  selectOnly(blockId) {
    this.selected.clear();
    if (blockId) this.selected.add(blockId);
    this._emit();
  }

  toggle(blockId) {
    if (this.selected.has(blockId)) this.selected.delete(blockId);
    else this.selected.add(blockId);
    this._emit();
  }

  add(blockId) {
    this.selected.add(blockId);
    this._emit();
  }

  clear() {
    if (this.selected.size === 0) return;
    this.selected.clear();
    this._emit();
  }

  selectRect(worldX, worldY, worldW, worldH) {
    const blocks = this._ws.getBlocksInRect(worldX, worldY, worldW, worldH);
    this.selected = new Set(blocks.map(b => b.id));
    this._emit();
  }

  isSelected(blockId) { return this.selected.has(blockId); }

  getSelectedBlocks() {
    return Array.from(this.selected)
      .map(id => this._ws.blocks.get(id))
      .filter(Boolean);
  }

  deleteSelected() {
    this.selected.forEach(id => this._ws.removeBlock(id, false));
    this._ws._saveSnapshot();
    this.selected.clear();
    this._emit();
  }

  copySelected() {
    return this.getSelectedBlocks().map(b => b.toJSON());
  }

  pasteBlocks(blockDataArray) {
    const newBlocks = blockDataArray.map(data => {
      const block = Block.fromJSON(data);
      block.id = Block._uid();
      block.x += this._ws.gridSize * 3;
      block.y += this._ws.gridSize * 3;
      this._ws.addBlock(block, false);
      return block;
    });
    this._ws._saveSnapshot();
    this.selected = new Set(newBlocks.map(b => b.id));
    this._emit();
  }

  _emit() {
    // Update block model selected flags
    this._ws.blocks.forEach(b => { b.selected = this.selected.has(b.id); });
    Bus.emit('selection:changed', { selected: new Set(this.selected) });
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ║  PipelineUI                                                               ║
// ═══════════════════════════════════════════════════════════════════════════════

class PipelineUI {
  constructor(workspace, selectionMgr) {
    this._ws    = workspace;
    this._sel   = selectionMgr;
    this._svg   = null;
    this._drawPath = null;
    this._fromPort = null;
    this._firstClick = null;
    this._mode  = null;
  }

  init() {
    this._svg = document.getElementById('af-pipeline-layer');

    Bus.on('workspace:pipeline-added',   () => this.renderAll());
    Bus.on('workspace:pipeline-removed', () => this.renderAll());
    Bus.on('workspace:rebuilt',          () => this.renderAll());
    Bus.on('block:moved',                () => this.renderAll());
    Bus.on('block:ports-changed',        () => this.renderAll());
    Bus.on('selection:changed',          () => this._updateSelectionStyles());

    document.addEventListener('mousemove', e => this._onMouseMove(e));
    document.addEventListener('mouseup',   e => this._onMouseUp(e));
  }

  // ── Render all pipelines ──────────────────────────
  renderAll() {
    Array.from(this._svg.querySelectorAll('.pipeline-path, .pipeline-label')).forEach(el => el.remove());
    this._ws.pipelines.forEach(p => this._renderPipeline(p));
  }

  _renderPipeline(pipeline) {
    const { fromPos, toPos } = this._getPortPositions(pipeline);
    if (!fromPos || !toPos) return;

    const type = pipeline.resolveType(this._ws);
    const isBackflow = pipeline.backflow;
    const d = isBackflow ? this._backflowBezierD(fromPos, toPos) : this._bezierD(fromPos, toPos);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.classList.add('pipeline-path', `type-${type}`);
    if (isBackflow) path.classList.add('backflow');
    path.dataset.pipelineId = pipeline.id;
    if (pipeline.selected) path.classList.add('selected');

    path.addEventListener('click', e => {
      e.stopPropagation();
      pipeline.selected = !pipeline.selected;
      this._updateSelectionStyles();
    });

    path.addEventListener('contextmenu', e => {
      e.preventDefault();
      this._ws.removePipeline(pipeline.id);
    });

    this._svg.appendChild(path);

    // Label at bezier midpoint
    const labelText = isBackflow ? '\u267B loop' : (type !== 'any' ? type : null);
    if (labelText) {
      const mid = isBackflow ? this._backflowMidpoint(fromPos, toPos) : this._forwardMidpoint(fromPos, toPos);
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.classList.add('pipeline-label');
      if (isBackflow) label.classList.add('backflow-label');
      label.setAttribute('x', mid.x);
      label.setAttribute('y', mid.y - 5);
      label.setAttribute('text-anchor', 'middle');
      label.textContent = labelText;
      label.style.cssText = `
        font-family: var(--font-mono);
        font-size: 9px;
        fill: ${isBackflow ? 'var(--backflow-color, #00e5ff)' : `var(--port-${type}, var(--port-any))`};
        opacity: ${isBackflow ? '0.8' : '0.55'};
        pointer-events: none;
        user-select: none;
      `;
      this._svg.appendChild(label);
    }
  }

  _forwardMidpoint(from, to) {
    const dx = Math.abs(to.x - from.x);
    const cx = Math.max(dx * 0.5, 60);
    return {
      x: 0.125*from.x + 0.375*(from.x+cx) + 0.375*(to.x-cx) + 0.125*to.x,
      y: 0.125*from.y + 0.375*from.y       + 0.375*to.y       + 0.125*to.y,
    };
  }

  _backflowMidpoint(from, to) {
    const mx = (from.x + to.x) / 2;
    const dy = Math.abs(to.y - from.y);
    const dx = Math.abs(to.x - from.x);
    const arcDrop = Math.max(80, dy * 0.4, dx * 0.2);
    const my = Math.max(from.y, to.y) + arcDrop;
    return { x: mx, y: my };
  }

  _getPortPositions(pipeline) {
    const fromEl = this._getPortEl(pipeline.fromBlockId, pipeline.fromPortId);
    const toEl   = this._getPortEl(pipeline.toBlockId,   pipeline.toPortId);
    if (!fromEl || !toEl) return {};

    const svgRect = this._svg.getBoundingClientRect();
    const fromR   = fromEl.getBoundingClientRect();
    const toR     = toEl.getBoundingClientRect();

    return {
      fromPos: {
        x: fromR.left + fromR.width  / 2 - svgRect.left,
        y: fromR.top  + fromR.height / 2 - svgRect.top,
      },
      toPos: {
        x: toR.left + toR.width  / 2 - svgRect.left,
        y: toR.top  + toR.height / 2 - svgRect.top,
      },
    };
  }

  _getPortEl(blockId, portId) {
    return document.querySelector(
      `.factory-block[data-block-id="${blockId}"] .port-dot[data-port-id="${portId}"]`
    );
  }

  _makePath(from, to, type = 'any') {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    el.setAttribute('d', this._bezierD(from, to));
    return el;
  }

  _bezierD(from, to) {
    const dx = Math.abs(to.x - from.x);
    const cx = Math.max(dx * 0.5, 60);
    return `M ${from.x} ${from.y} C ${from.x + cx} ${from.y}, ${to.x - cx} ${to.y}, ${to.x} ${to.y}`;
  }

  _backflowBezierD(from, to) {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const arcDrop = Math.max(80, dy * 0.4, dx * 0.2);
    const bottom  = Math.max(from.y, to.y) + arcDrop;
    return `M ${from.x} ${from.y} C ${from.x} ${bottom}, ${to.x} ${bottom}, ${to.x} ${to.y}`;
  }

  _updateSelectionStyles() {
    this._svg.querySelectorAll('.pipeline-path').forEach(el => {
      const p = this._ws.pipelines.get(el.dataset.pipelineId);
      el.classList.toggle('selected', p?.selected ?? false);
    });
  }

  // ── Port connection start ─────────────────────────
  startConnection(blockId, portId, portEl, e) {
    e.stopPropagation();
    e.preventDefault();

    const rect = portEl.getBoundingClientRect();
    const svgRect = this._svg.getBoundingClientRect();
    this._fromPort = {
      blockId, portId, portEl,
      x: rect.left + rect.width / 2 - svgRect.left,
      y: rect.top + rect.height / 2 - svgRect.top,
    };

    this._mode = 'drag';
    this._initDrawPath();
  }

  _initDrawPath() {
    if (this._drawPath) this._drawPath.remove();
    this._drawPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this._drawPath.id = 'af-pipeline-drawing';
    this._svg.appendChild(this._drawPath);
  }

  _onMouseMove(e) {
    if (!this._fromPort || !this._drawPath) return;
    const svgRect = this._svg.getBoundingClientRect();
    const mx = e.clientX - svgRect.left;
    const my = e.clientY - svgRect.top;

    const isBackflow = e.shiftKey;
    const from = { x: this._fromPort.x, y: this._fromPort.y };
    const to   = { x: mx, y: my };
    this._drawPath.setAttribute('d', isBackflow ? this._backflowBezierD(from, to) : this._bezierD(from, to));
    this._drawPath.classList.toggle('backflow-preview', isBackflow);

    this._highlightCompatible(e.target);
  }

  _onMouseUp(e) {
    if (!this._fromPort) return;

    const targetDot = e.target.closest?.('.port-dot');
    if (targetDot) {
      const toBlockId = targetDot.closest('.factory-block')?.dataset.blockId;
      const toPortId  = targetDot.dataset.portId;
      if (toBlockId && toPortId) {
        this._tryConnect(this._fromPort.blockId, this._fromPort.portId, toBlockId, toPortId, e.shiftKey);
      }
    }

    this._cancelDrawing();
  }

  _tryConnect(fromBlockId, fromPortId, toBlockId, toPortId, forceBackflow = false) {
    if (fromBlockId === toBlockId) return;

    const fromBlock = this._ws.blocks.get(fromBlockId);
    const toBlock   = this._ws.blocks.get(toBlockId);
    if (!fromBlock || !toBlock) return;

    const fromPort = fromBlock.getPort(fromPortId);
    const toPort   = toBlock.getPort(toPortId);
    if (!fromPort || !toPort) return;

    let actualFrom = fromPort, actualTo = toPort;
    let actualFromBlock = fromBlockId, actualToBlock = toBlockId;
    let actualFromPort = fromPortId, actualToPort = toPortId;

    if (fromPort.direction === 'in' && toPort.direction === 'out') {
      [actualFromBlock, actualToBlock]  = [toBlockId, fromBlockId];
      [actualFromPort, actualToPort]    = [toPortId, fromPortId];
      [actualFrom, actualTo]            = [toPort, fromPort];
    } else if (fromPort.direction !== 'out' || toPort.direction !== 'in') {
      return;
    }

    if (!actualFrom.isCompatible(actualTo)) {
      console.warn(`Port type mismatch: ${actualFrom.type} \u2192 ${actualTo.type}`);
      Bus.emit('ui:flash', { message: `\u26A0 Type mismatch: ${actualFrom.type} \u2192 ${actualTo.type} (connected anyway)`, type: 'warning' });
    }

    let backflow = forceBackflow;
    if (!backflow) {
      backflow = this._wouldCreateCycle(actualFromBlock, actualToBlock);
    }

    const pipeline = new Pipeline({
      fromBlockId: actualFromBlock, fromPortId: actualFromPort,
      toBlockId:   actualToBlock,   toPortId:   actualToPort,
      backflow,
    });
    this._ws.addPipeline(pipeline);

    if (backflow) {
      Bus.emit('ui:flash', { message: '\u267B Backflow connection created (loop)', type: 'info' });
    }
  }

  _wouldCreateCycle(fromBlockId, toBlockId) {
    const forwardPipes = Array.from(this._ws.pipelines.values()).filter(p => !p.backflow);
    const adj = new Map();
    forwardPipes.forEach(p => {
      if (!adj.has(p.fromBlockId)) adj.set(p.fromBlockId, []);
      adj.get(p.fromBlockId).push(p.toBlockId);
    });

    const visited = new Set();
    const queue   = [toBlockId];
    while (queue.length) {
      const id = queue.shift();
      if (id === fromBlockId) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      (adj.get(id) || []).forEach(next => queue.push(next));
    }
    return false;
  }

  _cancelDrawing() {
    this._drawPath?.remove();
    this._drawPath = null;
    this._fromPort = null;
    this._mode     = null;
    document.querySelectorAll('.port-dot.highlighted').forEach(el => el.classList.remove('highlighted'));
  }

  _highlightCompatible(target) {
    document.querySelectorAll('.port-dot').forEach(el => el.classList.remove('highlighted'));
    if (!this._fromPort) return;

    const fromBlock = this._ws.blocks.get(this._fromPort.blockId);
    const fromPort  = fromBlock?.getPort(this._fromPort.portId);
    if (!fromPort) return;

    document.querySelectorAll('.port-dot').forEach(el => {
      const blockId = el.closest('.factory-block')?.dataset.blockId;
      const portId  = el.dataset.portId;
      if (!blockId || blockId === this._fromPort.blockId) return;
      const block = this._ws.blocks.get(blockId);
      const port  = block?.getPort(portId);
      if (port && fromPort.isCompatible(port)) el.classList.add('highlighted');
    });
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ║  WindowManager                                                            ║
// ═══════════════════════════════════════════════════════════════════════════════

class WindowManager {
  constructor() {
    this._windows    = new Map();
    this._topZ       = 600;
    this._layer      = null;
    this._dock       = null;
    this._docked     = new Map();
    this._fullscreens = new Set();
  }

  init() {
    this._layer = document.getElementById('af-window-layer');
    this._dock  = document.getElementById('af-bottom-dock');

    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      const focused = this._layer?.querySelector('.float-window.focused');
      if (!focused) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      this.close(focused.dataset.windowId);
    });
  }

  // ── Create / focus window ──────────────────────────
  open(opts) {
    if (this._windows.has(opts.id)) {
      this.focus(opts.id);
      return this._windows.get(opts.id).el;
    }

    const win = this._buildWindow(opts);
    this._layer.appendChild(win);
    this._windows.set(opts.id, { el: win, opts, docked: false, fullscreen: false });
    this.focus(opts.id);

    const body = win.querySelector('.window-body');
    opts.onBuild(body);

    return win;
  }

  close(id) {
    const entry = this._windows.get(id);
    if (!entry) return;
    if (entry.fullscreen) this._exitFullscreen(id);
    if (entry.docked)     this._removeDockItem(id);
    else entry.el.remove();
    this._windows.delete(id);
    entry.opts.onClose?.();
    Bus.emit('win:closed', { id });
  }

  focus(id) {
    const entry = this._windows.get(id);
    if (!entry) return;
    this._topZ++;
    entry.el.style.zIndex = entry.fullscreen ? 750 : this._topZ;
    this._windows.forEach((e, eid) => e.el.classList.toggle('focused', eid === id));
  }

  isOpen(id) { return this._windows.has(id); }

  // ── Window DOM builder ─────────────────────────────
  _buildWindow({ id, title, icon, x = 200, y = 100, width = 360, height = 280, resizable = false }) {
    const win = document.createElement('div');
    win.className = 'float-window';
    win.dataset.windowId = id;
    win.style.cssText = `left:${x}px;top:${y}px;width:${width}px;height:${height}px;`;

    win.innerHTML = `
      <div class="window-titlebar">
        <span class="window-titlebar-icon">${icon || '\u25A3'}</span>
        <span class="window-titlebar-title">${title}</span>
        <div class="window-titlebar-actions">
          <button class="window-titlebar-btn fill"    title="Fill workspace">\u26F6</button>
          <button class="window-titlebar-btn dock"    title="Dock to bottom panel">\u21A7</button>
          <button class="window-titlebar-btn restore" title="Restore to floating window" style="display:none">\u2199</button>
          <button class="window-titlebar-btn close"   title="Close">\u2715</button>
        </div>
      </div>
      <div class="window-body"></div>
      ${resizable ? '<div class="window-resize-handle" title="Resize"></div>' : ''}
    `;

    win.querySelector('.window-titlebar-btn.close')
       .addEventListener('click', e => { e.stopPropagation(); this.close(id); });

    win.querySelector('.window-titlebar-btn.dock')
       .addEventListener('click', e => { e.stopPropagation(); this._dockWindow(id); });

    win.querySelector('.window-titlebar-btn.fill')
       .addEventListener('click', e => {
         e.stopPropagation();
         const entry = this._windows.get(id);
         if (!entry?.fullscreen) this._enterFullscreen(id);
       });

    win.querySelector('.window-titlebar-btn.restore')
       .addEventListener('click', e => {
         e.stopPropagation();
         const entry = this._windows.get(id);
         if (entry?.fullscreen) this._exitFullscreen(id);
         else if (entry?.docked) this._undockWindow(id);
       });

    const resizeHandle = win.querySelector('.window-resize-handle');
    if (resizeHandle) {
      this._makeResizable(win, resizeHandle, id);
    }

    win.addEventListener('mousedown', () => this.focus(id), true);

    this._makeDraggable(win, win.querySelector('.window-titlebar'));

    return win;
  }

  // ── Drag ──────────────────────────────────────────
  _makeDraggable(win, handle) {
    let dragging = false, startX, startY, originX, originY;

    handle.addEventListener('mousedown', e => {
      if (e.target.closest('.window-titlebar-btn')) return;
      const id = win.dataset.windowId;
      if (this._windows.get(id)?.fullscreen) return;

      dragging = true;
      startX   = e.clientX;
      startY   = e.clientY;
      originX  = win.offsetLeft;
      originY  = win.offsetTop;
      e.preventDefault();
      e.stopPropagation();

      const onMove = e => {
        if (!dragging) return;
        const nx = originX + (e.clientX - startX);
        const ny = originY + (e.clientY - startY);
        const container = document.getElementById('af-workspace-container');
        if (container && ny + 40 > container.clientHeight * 0.82) {
          this._dockWindow(id);
          dragging = false;
          return;
        }
        win.style.left = Math.max(0, nx) + 'px';
        win.style.top  = Math.max(0, ny) + 'px';
      };

      const onUp = () => {
        dragging = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ── Resize ─────────────────────────────────────────
  _makeResizable(win, handle, id) {
    handle.addEventListener('mousedown', e => {
      e.stopPropagation();
      e.preventDefault();
      if (this._windows.get(id)?.fullscreen) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startW = win.offsetWidth;
      const startH = win.offsetHeight;
      const MIN_W  = 300;
      const MIN_H  = 180;

      const onMove = ev => {
        const w = Math.max(MIN_W, startW + (ev.clientX - startX));
        const h = Math.max(MIN_H, startH + (ev.clientY - startY));
        win.style.width  = w + 'px';
        win.style.height = h + 'px';
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ── Fullscreen ─────────────────────────────────────
  _enterFullscreen(id) {
    const entry = this._windows.get(id);
    if (!entry || entry.docked || entry.fullscreen) return;

    entry._savedLeft   = entry.el.style.left;
    entry._savedTop    = entry.el.style.top;
    entry._savedWidth  = entry.el.style.width;
    entry._savedHeight = entry.el.style.height;

    const container = document.getElementById('af-workspace-container');
    container.appendChild(entry.el);

    entry.el.style.cssText = 'position:absolute;left:0;top:0;right:0;bottom:0;width:auto;height:auto;z-index:750;border-radius:0;';
    entry.el.classList.add('window-fullscreen');
    entry.fullscreen = true;
    this._fullscreens.add(id);

    const fillBtn    = entry.el.querySelector('.window-titlebar-btn.fill');
    const restoreBtn = entry.el.querySelector('.window-titlebar-btn.restore');
    if (fillBtn)    { fillBtn.style.display = 'none'; }
    if (restoreBtn) { restoreBtn.style.display = ''; restoreBtn.title = 'Restore to floating window'; restoreBtn.textContent = '\u2199'; }
  }

  _exitFullscreen(id) {
    const entry = this._windows.get(id);
    if (!entry || !entry.fullscreen) return;

    this._layer.appendChild(entry.el);

    entry.el.style.cssText = `left:${entry._savedLeft};top:${entry._savedTop};width:${entry._savedWidth};height:${entry._savedHeight};`;
    entry.el.classList.remove('window-fullscreen');
    entry.fullscreen = false;
    this._fullscreens.delete(id);
    this.focus(id);

    const fillBtn2    = entry.el.querySelector('.window-titlebar-btn.fill');
    const restoreBtn2 = entry.el.querySelector('.window-titlebar-btn.restore');
    const dockBtn2    = entry.el.querySelector('.window-titlebar-btn.dock');
    if (fillBtn2)    { fillBtn2.style.display = ''; }
    if (restoreBtn2) { restoreBtn2.style.display = 'none'; }
    if (dockBtn2)    { dockBtn2.style.display = ''; }
  }

  // ── Docking ───────────────────────────────────────
  _dockWindow(id) {
    const entry = this._windows.get(id);
    if (!entry || entry.docked) return;
    if (entry.fullscreen) this._exitFullscreen(id);

    entry.el.remove();
    entry.docked = true;

    const item = document.createElement('div');
    item.className = 'dock-item';
    item.dataset.windowId = id;
    item.style.height = '200px';
    item.style.resize = 'vertical';
    item.style.overflow = 'auto';

    const titlebarClone = entry.el.querySelector('.window-titlebar').cloneNode(true);
    titlebarClone.style.cursor = 'default';

    const dockBtn2 = titlebarClone.querySelector('.window-titlebar-btn.dock');
    if (dockBtn2) dockBtn2.style.display = 'none';

    const restoreBtn = titlebarClone.querySelector('.window-titlebar-btn.restore');
    if (restoreBtn) {
      restoreBtn.style.display = '';
      restoreBtn.textContent = '\u2199';
      restoreBtn.title = 'Restore to floating window';
      restoreBtn.addEventListener('click', e => { e.stopPropagation(); this._undockWindow(id); });
    }

    const fillBtnDock = titlebarClone.querySelector('.window-titlebar-btn.fill');
    if (fillBtnDock) {
      fillBtnDock.style.display = '';
      fillBtnDock.addEventListener('click', e => {
        e.stopPropagation();
        this._undockWindow(id);
        setTimeout(() => this._enterFullscreen(id), 30);
      });
    }

    titlebarClone.querySelector('.window-titlebar-btn.close')
      ?.addEventListener('click', e => { e.stopPropagation(); this.close(id); });

    const body = document.createElement('div');
    body.className = 'window-body';
    body.style.height = 'calc(100% - 36px)';
    entry.opts.onBuild(body);

    item.appendChild(titlebarClone);
    item.appendChild(body);
    this._dock.appendChild(item);
    this._docked.set(id, item);
  }

  _undockWindow(id) {
    const entry = this._windows.get(id);
    const item  = this._docked.get(id);
    if (!entry || !item) return;

    item.remove();
    this._docked.delete(id);
    entry.docked = false;

    const container = document.getElementById('af-workspace-container');
    const cx = (container?.clientWidth  || 800) / 2 - 180;
    const cy = (container?.clientHeight || 600) / 2 - 140;
    entry.el.style.left = cx + 'px';
    entry.el.style.top  = cy + 'px';

    const body = entry.el.querySelector('.window-body');
    body.innerHTML = '';
    entry.opts.onBuild(body);

    this._layer.appendChild(entry.el);
    this.focus(id);
  }

  _removeDockItem(id) {
    const item = this._docked.get(id);
    item?.remove();
    this._docked.delete(id);
  }
}

var WinManager = new WindowManager();


// ═══════════════════════════════════════════════════════════════════════════════
// ║  BlockUI                                                                  ║
// ═══════════════════════════════════════════════════════════════════════════════

class BlockUI {
  constructor(workspace, selectionMgr, pipelineUI) {
    this._ws         = workspace;
    this._sel        = selectionMgr;
    this._pipeUI     = pipelineUI;
    this._layer      = null;
    this._blockEls   = new Map();
    this._copyBuffer = [];
  }

  init() {
    this._layer = document.getElementById('af-block-layer');

    Bus.on('workspace:block-added',   ({ block }) => this._createBlockEl(block));
    Bus.on('workspace:block-removed', ({ blockId }) => this._removeBlockEl(blockId));
    Bus.on('workspace:rebuilt',       () => this._rebuildAll());
    Bus.on('workspace:view-changed',  () => this._applyTransform());
    Bus.on('selection:changed',       () => this._syncSelectionStyles());
    Bus.on('block:status-changed',    ({ blockId, status }) => this._updateStatus(blockId, status));
    Bus.on('block:result',            ({ blockId }) => this._updateResultBadge(blockId));
    Bus.on('block:ports-changed',     ({ blockId }) => this._refreshPorts(blockId));
    Bus.on('block:open-settings',     ({ blockId }) => {
      const b = this._ws.blocks.get(blockId);
      if (b) this._openSettings(b);
    });
    Bus.on('block:open-results',      ({ blockId }) => {
      const b = this._ws.blocks.get(blockId);
      if (b) this._openResults(b);
    });

    document.addEventListener('keydown', e => this._onKey(e));

    setTimeout(() => this._updateGrid(), 0);
  }

  // ── Build / remove block elements ─────────────────
  _createBlockEl(block) {
    const el = document.createElement('div');
    el.className = 'factory-block';
    el.dataset.blockId = block.id;

    const w = block.width ? `${block.width}px` : '';

    el.style.cssText = `
      left: ${block.x}px;
      top:  ${block.y}px;
      --block-color: ${block.color};
      ${w ? `width: ${w};` : ''}
    `;

    el.innerHTML = this._blockHTML(block);
    this._bindBlockEvents(el, block);
    this._layer.appendChild(el);
    this._blockEls.set(block.id, el);

    el.animate([
      { opacity: 0, transform: 'scale(0.92)' },
      { opacity: 1, transform: 'scale(1)' }
    ], { duration: 140, easing: 'ease-out', fill: 'forwards' });
  }

  _removeBlockEl(blockId) {
    const el = this._blockEls.get(blockId);
    if (!el) return;
    el.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(0.85)' }],
      { duration: 120, fill: 'forwards' }).onfinish = () => el.remove();
    this._blockEls.delete(blockId);
  }

  _rebuildAll() {
    this._layer.innerHTML = '';
    this._blockEls.clear();
    this._ws.blocks.forEach(b => this._createBlockEl(b));
  }

  // ── HTML template ────────────────────────────────
  _blockHTML(block) {
    const portsIn  = block.ports.inputs.map(p => this._portHTML(p)).join('');
    const portsOut = block.ports.outputs.map(p => this._portHTML(p)).join('');

    const isDisplay = block.type === 'output-display';
    const bodyExtra  = isDisplay
      ? `<div class="block-display-preview" data-display-preview>No output yet</div>`
      : '';

    return `
      <div class="block-header" data-drag-handle>
        <span class="block-icon">${block.icon}</span>
        <span class="block-title">${block.name}</span>
        <div class="block-actions">
          <button class="block-action-btn results-btn" data-action="results" data-tooltip="Results">\u25CE</button>
          <button class="block-action-btn settings-btn" data-action="settings" data-tooltip="Settings">\u2699</button>
          <button class="block-action-btn delete-btn" data-action="delete" data-tooltip="Delete block">\u2715</button>
        </div>
      </div>
      <div class="block-body">
        <div class="block-ports-in">${portsIn}</div>
        ${bodyExtra}
        <div class="block-ports-out">${portsOut}</div>
      </div>
      <div class="block-status" data-status></div>
      <div class="block-resize-handle" data-resize title="Resize"></div>
    `;
  }

  _portHTML(port) {
    const rowClass = port.direction === 'out' ? 'block-port-row out' : 'block-port-row in';
    return `
      <div class="${rowClass}">
        <div class="port-dot"
             data-port-id="${port.id}"
             data-type="${port.type}"
             data-direction="${port.direction}">
        </div>
        <span class="port-label">${port.label}</span>
      </div>
    `;
  }

  // ── Event binding ─────────────────────────────────
  _bindBlockEvents(el, block) {
    const header = el.querySelector('[data-drag-handle]');

    // PRIORITY 1: Port mousedown -> connection
    el.querySelectorAll('.port-dot').forEach(dot => {
      dot.addEventListener('mousedown', e => {
        e.stopPropagation();
        this._pipeUI.startConnection(block.id, dot.dataset.portId, dot, e);
      });
    });

    // PRIORITY 2: Action buttons
    el.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === 'settings') this._openSettings(block);
        if (action === 'results')  this._openResults(block);
        if (action === 'delete') {
          WinManager.close(`settings-${block.id}`);
          WinManager.close(`results-${block.id}`);
          this._ws.removeBlock(block.id);
        }
      });
      btn.addEventListener('mousedown', e => e.stopPropagation());
    });

    // PRIORITY 3: Header drag
    header.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      this._startBlockDrag(el, block, e);
    });

    // PRIORITY 4: Click to select
    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      if (!e.shiftKey) {
        if (!this._sel.isSelected(block.id)) this._sel.selectOnly(block.id);
      } else {
        this._sel.toggle(block.id);
      }
    });

    // PRIORITY 5: Double-click -> quick-edit primary value
    el.addEventListener('dblclick', e => {
      if (e.target.closest('[data-action]') || e.target.closest('.port-dot') || e.target.closest('[data-resize]')) return;
      e.stopPropagation();
      this._openQuickEdit(el, block);
    });

    // PRIORITY 6: Resize handle
    const resizeHandle = el.querySelector('[data-resize]');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', e => {
        e.stopPropagation();
        e.preventDefault();
        this._startBlockResize(el, block, e);
      });
    }
  }

  // ── Dragging blocks ───────────────────────────────
  _startBlockDrag(el, block, e) {
    e.preventDefault();

    if (!this._sel.isSelected(block.id)) {
      this._sel.selectOnly(block.id);
    }

    const selected = this._sel.getSelectedBlocks();
    const startPositions = selected.map(b => ({ id: b.id, startX: b.x, startY: b.y }));
    const mouseStartX = e.clientX;
    const mouseStartY = e.clientY;
    const z = this._ws.zoom;

    selected.forEach(b => this._blockEls.get(b.id)?.classList.add('dragging'));

    const onMove = ev => {
      const dx = (ev.clientX - mouseStartX) / z;
      const dy = (ev.clientY - mouseStartY) / z;
      startPositions.forEach(({ id, startX, startY }) => {
        const b  = this._ws.blocks.get(id);
        const el = this._blockEls.get(id);
        if (!b || !el) return;
        b.x  = startX + dx;
        b.y  = startY + dy;
        el.style.left = b.x + 'px';
        el.style.top  = b.y + 'px';
      });
      this._pipeUI.renderAll();
    };

    const onUp = () => {
      selected.forEach(b => {
        const snapped = this._ws.snapPoint(b.x, b.y);
        b.moveTo(snapped.x, snapped.y);
        const el = this._blockEls.get(b.id);
        if (el) { el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; }
        el?.classList.remove('dragging');
      });
      this._ws._saveSnapshot();
      this._pipeUI.renderAll();

      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Resize block width ────────────────────────────
  _startBlockResize(el, block, e) {
    const startX    = e.clientX;
    const startW    = el.offsetWidth;
    const z         = this._ws.zoom;
    const gridSize  = this._ws.gridSize;
    const MIN_W     = gridSize * 6;
    const MAX_W     = gridSize * 20;

    el.classList.add('dragging');

    const onMove = ev => {
      const dxScreen  = ev.clientX - startX;
      const dxWorld   = dxScreen / z;
      const startWWorld = startW / z;
      const newW      = Math.min(MAX_W, Math.max(MIN_W, startWWorld + dxWorld));
      const snapped   = Math.round(newW / gridSize) * gridSize;
      el.style.width  = snapped + 'px';
      block.width     = snapped;
      this._pipeUI.renderAll();
    };

    const onUp = () => {
      el.classList.remove('dragging');
      this._ws._saveSnapshot();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  // ── Apply viewport transform ───────────────────────
  _applyTransform() {
    const { viewX, viewY, zoom } = this._ws;
    const transform = `translate(${viewX}px, ${viewY}px) scale(${zoom})`;
    this._layer.style.transform = transform;
    this._layer.style.transformOrigin = '0 0';
    this._updateGrid();
    this._pipeUI.renderAll();
  }

  // ── Update grid background to track viewport ───────
  _updateGrid() {
    const gridEl = document.getElementById('af-workspace-grid');
    if (!gridEl) return;
    const { viewX, viewY, zoom } = this._ws;
    const g   = this._ws.gridSize;
    const gs  = g * zoom;
    const G5  = gs * 5;

    const ox = ((viewX % gs) + gs) % gs;
    const oy = ((viewY % gs) + gs) % gs;
    const Ox = ((viewX % G5) + G5) % G5;
    const Oy = ((viewY % G5) + G5) % G5;

    const minorAlpha = Math.max(0, Math.min(1, (zoom - 0.22) / 0.38));
    const majorAlpha = 0.18 + 0.10 * Math.min(1, zoom);

    gridEl.style.backgroundImage = [
      `radial-gradient(circle, rgba(255,255,255,${(0.13 * minorAlpha).toFixed(3)}) 1px, transparent 1px)`,
      `radial-gradient(circle, rgba(74,122,255,${majorAlpha.toFixed(3)}) 1.5px, transparent 1.5px)`,
    ].join(',');

    gridEl.style.backgroundSize     = `${gs}px ${gs}px, ${G5}px ${G5}px`;
    gridEl.style.backgroundPosition = `${ox}px ${oy}px, ${Ox}px ${Oy}px`;
  }

  // ── Sync visual selection ──────────────────────────
  _syncSelectionStyles() {
    this._blockEls.forEach((el, id) => {
      el.classList.toggle('selected', this._sel.isSelected(id));
    });
  }

  _updateStatus(blockId, status) {
    const el = this._blockEls.get(blockId);
    if (!el) return;
    const statusEl = el.querySelector('[data-status]');
    if (!statusEl) return;
    statusEl.className = `block-status status-${status}`;
    const labels = { idle: '', waiting: 'waiting...', preparing: '\uD83D\uDD0D preparing', running: '\u26A1 running', done: '\u2713 done', error: '\u2717 error' };
    statusEl.textContent = labels[status] || status;
  }

  _updateResultBadge(blockId) {
    const el = this._blockEls.get(blockId);
    if (!el) return;
    el.querySelector('.results-btn')?.classList.add('has-results');
  }

  _refreshPorts(blockId) {
    const el    = this._blockEls.get(blockId);
    const block = this._ws.blocks.get(blockId);
    if (!el || !block) return;
    const body = el.querySelector('.block-body');
    if (body) {
      const portsIn  = block.ports.inputs.map(p => this._portHTML(p)).join('');
      const portsOut = block.ports.outputs.map(p => this._portHTML(p)).join('');
      body.innerHTML = `
        <div class="block-ports-in">${portsIn}</div>
        <div class="block-ports-out">${portsOut}</div>
      `;
      body.querySelectorAll('.port-dot').forEach(dot => {
        dot.addEventListener('mousedown', e => {
          e.stopPropagation();
          this._pipeUI.startConnection(block.id, dot.dataset.portId, dot, e);
        });
      });
    }
    this._pipeUI.renderAll();
  }

  // ── Quick-edit overlay (double-click) ─────────────
  _openQuickEdit(el, block) {
    const editableKeys = {
      'input-text':       'value',
      'llm-agent':        'systemPrompt',
      'reasoning-agent':  'model',
      'code-agent':       'language',
      'template':         'template',
      'condition':        'expression',
      'router':           'expression',
      'validator':        'rules',
      'annotator':        'goal',
      'transform':        'expression',
      'note':             'text',
      'prompt-builder':   'template',
      'http-request':     'method',
      'image-generator':  'model',
      'chat-block':       'systemPrompt',
      'text-splitter':    'splitBy',
      'web-search':       'numResults',
    };

    const key = editableKeys[block.type];
    if (!key || block.settings[key] === undefined) {
      this._openSettings(block);
      return;
    }

    document.querySelectorAll('.quick-edit-overlay').forEach(o => o.remove());

    const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
    const currentVal = block.settings[key];
    const isLong = typeof currentVal === 'string' && ['value','systemPrompt','template','expression','rules','text'].includes(key);

    const overlay = document.createElement('div');
    overlay.className = 'quick-edit-overlay';
    overlay.innerHTML = `
      <div class="quick-edit-label">${label}</div>
      ${isLong
        ? `<textarea class="quick-edit-input" rows="4">${String(currentVal).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>`
        : `<input class="quick-edit-input" value="${String(currentVal).replace(/"/g,'&quot;')}" />`
      }
      <div class="quick-edit-hint">Enter to save \u00B7 Esc to cancel</div>
    `;

    el.appendChild(overlay);
    const input = overlay.querySelector('.quick-edit-input');
    input.focus();
    if (input.select) input.select();

    const save = () => {
      if (!overlay.parentNode) return;
      const newVal = input.value;
      block.updateSettings({ [key]: typeof currentVal === 'number' ? parseFloat(newVal) : newVal });
      overlay.remove();
      document.removeEventListener('mousedown', onClickOutside, true);
    };

    const cancel = () => {
      overlay.remove();
      document.removeEventListener('mousedown', onClickOutside, true);
    };

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
    });

    const onClickOutside = (e) => {
      if (!overlay.contains(e.target)) save();
    };
    setTimeout(() => document.addEventListener('mousedown', onClickOutside, true), 0);
  }

  // ── Settings window ───────────────────────────────
  _openSettings(block) {
    const id = `settings-${block.id}`;
    WinManager.open({
      id, title: `${block.name} \u2014 Settings`, icon: '\u2699',
      x: 180, y: 80, width: 340, height: 420,
      onBuild: (body) => {
        body.innerHTML = `
          <div class="window-tabs">
            <button class="window-tab active" data-tab="general">General</button>
            <button class="window-tab" data-tab="ports">Ports</button>
            <button class="window-tab" data-tab="notes">Notes</button>
          </div>
          <div class="window-tab-content active" data-content="general">
            ${this._buildGeneralSettings(block)}
          </div>
          <div class="window-tab-content" data-content="ports">
            ${this._buildPortSettings(block)}
          </div>
          <div class="window-tab-content" data-content="notes">
            <div class="settings-field" style="flex:1;display:flex;flex-direction:column;">
              <span class="settings-label">Block notes</span>
              <textarea class="settings-textarea" data-notes style="flex:1;min-height:160px;resize:none;">${block.notes || ''}</textarea>
            </div>
          </div>
        `;
        this._bindTabSwitching(body);
        this._bindSettingsEvents(body, block);
      }
    });
  }

  _buildGeneralSettings(block) {
    let html = `<div class="settings-field">
      <span class="settings-label">Block name</span>
      <input class="settings-input" data-setting="name" value="${block.name}" />
    </div>`;

    Object.entries(block.settings).forEach(([key, val]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());

      if (key === 'model') {
        // Dynamic dropdown -- reads models from the currently active provider
        const cfg    = (typeof ApiSettings !== 'undefined') ? ApiSettings.getProviderConfig() : { models: [] };
        const models = cfg.models || [];
        const inList = models.some(m => m.value === val);
        html += `<div class="settings-field">
          <span class="settings-label">Model</span>
          <select class="settings-select" data-setting="model" style="font-family:var(--font-mono);font-size:11px;">
            ${!inList ? `<option value="${val}" selected>${val} (current)</option>` : ''}
            ${models.map(m => `
              <option value="${m.value}" ${val === m.value ? 'selected' : ''}>${m.label}</option>
            `).join('')}
          </select>
        </div>`;

      } else if (typeof val === 'boolean') {
        html += `
          <div class="settings-field">
            <label class="settings-toggle">
              <div class="toggle-switch ${val ? 'on' : ''}" data-setting="${key}"></div>
              <span class="settings-label">${label}</span>
            </label>
          </div>`;
      } else if (typeof val === 'number') {
        html += `<div class="settings-field">
          <span class="settings-label">${label}</span>
          <input class="settings-input" type="number" data-setting="${key}" value="${val}" />
        </div>`;
      } else if (key === 'systemPrompt' || key === 'template' || key === 'expression' || key === 'rules') {
        html += `<div class="settings-field">
          <span class="settings-label">${label}</span>
          <textarea class="settings-textarea" data-setting="${key}">${val}</textarea>
        </div>`;
      } else if (key === 'value') {
        html += `<div class="settings-field">
          <span class="settings-label">${label}</span>
          <textarea class="settings-textarea settings-value-textarea" data-setting="${key}" style="min-height:60px;">${val}</textarea>
        </div>`;
      } else {
        const escaped = String(val).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        html += `<div class="settings-field">
          <span class="settings-label">${label}</span>
          <textarea class="settings-input settings-autogrow" data-setting="${key}" rows="1">${escaped}</textarea>
        </div>`;
      }
    });
    return html;
  }

  _buildPortSettings(block) {
    const renderList = (ports, dir) => ports.map(p => `
      <div class="port-config-item">
        <div class="port-dot" data-type="${p.type}" style="pointer-events:none;border-color:var(--port-${p.type},var(--port-any))"></div>
        <input class="port-label-input" data-port-id="${p.id}" value="${p.label}" style="flex:1;min-width:0;" />
        <select class="port-type-select" data-port-id="${p.id}" data-dir="${dir}">
          ${['any','text','number','bool','json','image','trigger'].map(t =>
            `<option value="${t}" ${p.type===t?'selected':''}>${t}</option>`
          ).join('')}
        </select>
        <button class="port-config-remove" data-remove-port="${p.id}" title="Remove">\u2715</button>
      </div>`).join('');

    return `
      <div class="port-config-list">
        <div class="settings-label" style="padding:0 0 4px">Inputs</div>
        ${renderList(block.ports.inputs, 'in')}
        <button class="add-port-btn" data-add-port="in">+ Add input</button>
        <div class="settings-label" style="padding:8px 0 4px">Outputs</div>
        ${renderList(block.ports.outputs, 'out')}
        <button class="add-port-btn" data-add-port="out">+ Add output</button>
      </div>`;
  }

  _bindTabSwitching(body) {
    body.querySelectorAll('.window-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        body.querySelectorAll('.window-tab').forEach(t => t.classList.remove('active'));
        body.querySelectorAll('.window-tab-content').forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        body.querySelector(`[data-content="${tab.dataset.tab}"]`)?.classList.add('active');
      });
    });
  }

  _bindSettingsEvents(body, block) {
    // Auto-grow textareas that act as single-line inputs
    body.querySelectorAll('textarea.settings-autogrow').forEach(el => {
      const autoGrow = () => {
        el.style.height = 'auto';
        el.style.height = el.scrollHeight + 'px';
      };
      el.addEventListener('input', autoGrow);
      setTimeout(autoGrow, 0);
    });

    // Live update settings
    body.querySelectorAll('[data-setting]').forEach(el => {
      el.addEventListener('input', () => {
        const key = el.dataset.setting;
        const val = el.type === 'number' ? parseFloat(el.value) : el.value;
        if (key === 'name') {
          block.name = val;
          const titleEl = this._blockEls.get(block.id)?.querySelector('.block-title');
          if (titleEl) titleEl.textContent = val;
          const winEl = document.querySelector(`[data-window-id="settings-${block.id}"] .window-titlebar-title`);
          if (winEl) winEl.textContent = `${val} \u2014 Settings`;
        } else {
          block.updateSettings({ [key]: val });
        }
      });
    });

    // Notes textarea
    body.querySelectorAll('[data-notes]').forEach(el => {
      el.addEventListener('input', () => { block.notes = el.value; });
    });

    // Toggle switches
    body.querySelectorAll('.toggle-switch[data-setting]').forEach(sw => {
      sw.addEventListener('click', () => {
        sw.classList.toggle('on');
        block.updateSettings({ [sw.dataset.setting]: sw.classList.contains('on') });
      });
    });

    // Port type change
    body.querySelectorAll('.port-type-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const port = block.getPort(sel.dataset.portId);
        if (port) { port.type = sel.value; Bus.emit('block:ports-changed', { blockId: block.id }); }
      });
    });

    // Port label rename
    body.querySelectorAll('.port-label-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const port = block.getPort(inp.dataset.portId);
        if (port) { port.label = inp.value; Bus.emit('block:ports-changed', { blockId: block.id }); }
      });
    });

    // Remove port
    body.querySelectorAll('[data-remove-port]').forEach(btn => {
      btn.addEventListener('click', () => {
        block.removePort(btn.dataset.removePort);
        WinManager.close(`settings-${block.id}`);
        this._openSettings(block);
      });
    });

    // Add port
    body.querySelectorAll('[data-add-port]').forEach(btn => {
      btn.addEventListener('click', () => {
        const dir = btn.dataset.addPort;
        block.addPort(dir, { id: `port_${Date.now()}`, label: 'New', type: 'any' });
        WinManager.close(`settings-${block.id}`);
        this._openSettings(block);
      });
    });
  }

  // ── Results window ────────────────────────────────
  _openResults(block) {
    const id = `results-${block.id}`;
    WinManager.open({
      id, title: `${block.name} \u2014 Results`, icon: '\u25CE',
      x: 220, y: 110, width: 460, height: 360,
      resizable: true,
      onBuild: (body) => this._buildResultsBody(body, block),
    });
  }

  _buildResultsBody(body, block) {
    if (block.results.length === 0) {
      body.innerHTML = `
        <div style="padding:32px 20px;text-align:center;color:var(--text-muted);font-family:var(--font-mono);font-size:11px;">
          <div style="font-size:28px;margin-bottom:12px;opacity:0.3">\u25CE</div>
          No results yet.<br>
          <span style="font-size:9px;color:var(--text-dim)">Run the factory to see output.</span>
        </div>`;
      return;
    }

    const hasPrepData = block.results.some(r => r.data?._prep);

    const showResult = (result, contentEl, prepEl) => {
      contentEl.innerHTML = '';
      const d = result.data;

      // ── Prep panel ──────────────────────────────────────
      if (prepEl) {
        const prep = d?._prep;
        if (prep) {
          const retrieved = prep.retrieved || [];
          const skipped   = prep.skipped   || false;
          prepEl.innerHTML = `
            <div class="prep-panel">
              <div class="prep-header">
                <span class="prep-icon">${skipped ? '\u23ED' : '\uD83D\uDD0D'}</span>
                <span class="prep-label">Preparation</span>
                <span class="prep-status ${skipped ? 'skipped' : 'ran'}">${skipped ? 'skipped' : `${retrieved.length} retrieved`}</span>
                ${prep.duration_ms ? `<span class="prep-duration">${prep.duration_ms}ms</span>` : ''}
              </div>
              ${prep.reasoning ? `<div class="prep-reasoning">${this._esc(prep.reasoning)}</div>` : ''}
              ${retrieved.length > 0 ? `
                <div class="prep-retrieved">
                  ${retrieved.map(addr => `
                    <div class="prep-addr" data-address="${addr}" title="Open in Index">
                      <span class="prep-addr-dot">\u25CE</span>
                      <span class="prep-addr-text">${addr}</span>
                    </div>`).join('')}
                </div>` : ''}
              ${prep.skipReason ? `<div class="prep-skipreason">${this._esc(prep.skipReason)}</div>` : ''}
            </div>`;

          prepEl.querySelectorAll('.prep-addr').forEach(el => {
            el.addEventListener('click', () =>
              Bus.emit('ctx:inspect', { address: el.dataset.address })
            );
          });
        } else {
          prepEl.innerHTML = `<div class="prep-panel prep-none">No preparation data for this result.</div>`;
        }
      }

      // ── Main output ─────────────────────────────────────
      const displayD = d && typeof d === 'object'
        ? Object.fromEntries(Object.entries(d).filter(([k]) => k !== '_prep'))
        : d;

      if (displayD?.type === 'chat' || Array.isArray(displayD?.messages)) {
        const msgs = displayD.messages || [];
        contentEl.innerHTML = `<div class="result-chat">${
          msgs.map(m => `
            <div class="result-chat-msg ${m.role}">
              <span class="result-chat-role">${m.role === 'user' ? '\uD83D\uDC64' : '\uD83E\uDD16'}</span>
              <span class="result-chat-text">${this._esc(m.text)}</span>
            </div>`).join('')
        }</div>`;
        return;
      }

      if (typeof displayD === 'object' && displayD?.['code-out']) {
        contentEl.innerHTML = `<pre class="result-code">${this._esc(displayD['code-out'])}</pre>`;
        return;
      }

      if (displayD?.error) {
        contentEl.innerHTML = `<div class="result-error">\u26A0 ${this._esc(String(displayD.error))}</div>`;
        return;
      }

      const imgVal = displayD?.image_url ?? displayD?.image;
      if (typeof imgVal === 'string' && imgVal.startsWith('http')) {
        this._renderImageWithRetry(contentEl, imgVal);
        return;
      }

      const textVal = displayD?.response ?? displayD?.answer ?? displayD?.text ?? displayD?.result ?? displayD?._display ?? displayD?.description;
      if (typeof textVal === 'string') {
        const isDataImage = textVal.startsWith('data:image/');
        const isImgUrl    = /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(textVal)
                          || textVal.includes('image.pollinations.ai')
                          || textVal.includes('/generate/image');
        if (isDataImage || isImgUrl) {
          this._renderImageWithRetry(contentEl, textVal);
        } else {
          contentEl.innerHTML = `<div class="result-text">${this._esc(textVal)}</div>`;
        }
        return;
      }

      contentEl.innerHTML = `<pre class="result-json">${this._esc(JSON.stringify(displayD, null, 2))}</pre>`;
    };

    body.innerHTML = `
      <div class="results-layout">
        <div class="results-list" id="rlist-${block.id}">
          ${block.results.map((r, i) => `
            <div class="result-item ${i === block.results.length - 1 ? 'active' : ''}" data-result-id="${r.id}">
              <div class="result-item-id">${r.id}${r.data?._prep && !r.data._prep.skipped ? ' <span class="result-prep-badge">prep</span>' : ''}</div>
              <div class="result-item-ts">${new Date(r.timestamp).toLocaleTimeString()}</div>
            </div>`).join('')}
        </div>
        <div class="results-content-wrap">
          ${hasPrepData ? `
            <div class="results-prep-area" id="rprep-${block.id}"></div>` : ''}
          <div class="results-content" id="rcontent-${block.id}"></div>
          <div class="results-actions">
            <button class="results-clear-btn">\uD83D\uDDD1 Clear</button>
            <button class="results-copy-btn">\u29C9 Copy</button>
          </div>
        </div>
      </div>`;

    const contentEl = body.querySelector(`#rcontent-${block.id}`);
    const prepEl    = body.querySelector(`#rprep-${block.id}`);

    showResult(block.results[block.results.length - 1], contentEl, prepEl);

    body.querySelectorAll('.result-item').forEach(item => {
      item.addEventListener('click', () => {
        body.querySelectorAll('.result-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const result = block.results.find(r => r.id === item.dataset.resultId);
        if (result) showResult(result, contentEl, prepEl);
      });
    });

    body.querySelector('.results-clear-btn')?.addEventListener('click', () => {
      block.clearResults();
      WinManager.close(`results-${block.id}`);
      this._openResults(block);
    });

    body.querySelector('.results-copy-btn')?.addEventListener('click', () => {
      const text = contentEl.innerText || contentEl.textContent;
      navigator.clipboard.writeText(text).then(() =>
        Bus.emit('ui:flash', { message: '\u29C9 Copied to clipboard', type: 'success' })
      );
    });
  }

  _renderImageWithRetry(container, url, maxAttempts = 20, intervalMs = 3000) {
    const uid = `img-${Math.random().toString(36).slice(2,8)}`;
    container.innerHTML = `
      <div class="result-img-wrap">
        <div class="result-img-spinner" id="${uid}-spin">
          <div class="spinner-ring"></div>
          <div class="spinner-label" id="${uid}-label">Generating image\u2026</div>
        </div>
        <img class="result-img-preview" id="${uid}-img"
             style="display:none;" alt="Generated image" />
        <div class="result-img-error" id="${uid}-err" style="display:none;">
          \u26A0 Image failed to load
        </div>
      </div>`;

    const spinner = container.querySelector(`#${uid}-spin`);
    const label   = container.querySelector(`#${uid}-label`);
    const preview = container.querySelector(`#${uid}-img`);
    const errDiv  = container.querySelector(`#${uid}-err`);

    let attempt = 0;

    const tryLoad = () => {
      attempt++;
      if (label) label.textContent = attempt > 1
        ? `Generating image\u2026 (${attempt}/${maxAttempts})`
        : 'Generating image\u2026';

      const probe = new Image();
      const bustUrl = url + (url.includes('?') ? '&' : '?') + `_t=${Date.now()}`;

      probe.onload = () => {
        spinner.style.display = 'none';
        preview.src = bustUrl;
        preview.style.display = 'block';
      };

      probe.onerror = () => {
        if (attempt >= maxAttempts) {
          spinner.style.display = 'none';
          errDiv.style.display  = 'block';
          return;
        }
        setTimeout(tryLoad, intervalMs);
      };

      probe.src = bustUrl;
    };

    tryLoad();
  }

  _esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  _formatResult(result) {
    if (!result) return '';
    const d = result.data;
    if (typeof d === 'string') return d;
    return JSON.stringify(d, null, 2);
  }

  // ── Keyboard shortcuts ────────────────────────────
  _onKey(e) {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;

    const ctrl = e.ctrlKey || e.metaKey;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      this._sel.deleteSelected();
      return;
    }
    if (ctrl && e.key === 'c') { this._copyBuffer = this._sel.copySelected(); return; }
    if (ctrl && e.key === 'v') { if (this._copyBuffer.length) this._sel.pasteBlocks(this._copyBuffer); return; }
    if (ctrl && e.key === 'z') { e.preventDefault(); this._ws.undo(); return; }
    if (ctrl && e.key === 'y') { e.preventDefault(); this._ws.redo(); return; }
    if (ctrl && e.key === 'a') {
      e.preventDefault();
      this._ws.blocks.forEach(b => this._sel.add(b.id));
    }
    if (e.key === 'Escape') { this._sel.clear(); }
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ║  Controls                                                                 ║
// ═══════════════════════════════════════════════════════════════════════════════

class Controls {
  constructor(workspace, factory) {
    this._ws      = workspace;
    this._factory = factory;
    this._el      = null;
    this._settingsOpen = false;
  }

  init() {
    this._el = document.getElementById('af-controls-bar');
    this._render();

    Bus.on('factory:state',          ({ state }) => this._onFactoryState(state));
    Bus.on('workspace:view-changed', ()          => this._updateZoomLabel());

    document.addEventListener('mousedown', e => {
      if (this._settingsOpen && !e.target.closest('#af-ctrl-settings-wrap')) {
        this._closeSettings();
      }
    });
  }

  _render() {
    this._el.innerHTML = `
      <!-- Run / Pause toggle -->
      <button class="ctrl-btn run-pause" id="af-ctrl-run-pause" title="Run factory (Ctrl+R)">
        <span class="btn-icon" id="af-run-pause-icon">\u25B6</span>
        <span id="af-run-pause-label">Run</span>
      </button>

      <!-- Stop -->
      <button class="ctrl-btn stop" id="af-ctrl-stop" title="Stop factory (Ctrl+Q)">
        <span class="btn-icon">\u25A0</span> Stop
      </button>

      <div class="ctrl-divider"></div>

      <!-- State badge -->
      <div class="ctrl-status" id="af-ctrl-status">
        <span class="status-dot" id="af-ctrl-status-dot"></span>
        <span id="af-status-label">Idle</span>
      </div>

      <div class="ctrl-divider"></div>

      <!-- Zoom -->
      <div class="ctrl-zoom">
        <button class="zoom-btn" id="af-zoom-out" title="Zoom out (scroll wheel)">\u2212</button>
        <span class="zoom-level" id="af-zoom-label">100%</span>
        <button class="zoom-btn" id="af-zoom-in"  title="Zoom in (scroll wheel)">+</button>
        <button class="zoom-btn" id="af-zoom-fit" title="Fit all blocks to screen (Ctrl+Shift+F)">\u2291</button>
      </div>

      <div class="ctrl-divider"></div>

      <!-- Settings button + dropdown -->
      <div id="af-ctrl-settings-wrap" style="position:relative;">
        <button class="ctrl-btn settings-btn" id="af-ctrl-settings" title="Settings">
          <span class="btn-icon">\u2699</span> Settings
        </button>
        <div id="af-ctrl-settings-panel" class="ctrl-settings-panel" style="display:none;"></div>
      </div>

      <div class="ctrl-divider"></div>

      <!-- Outputs (Context Inspector) -->
      <button class="ctrl-btn outputs-btn" id="af-ctrl-outputs" title="Outputs \u2014 browse all block results from this run">
        <span class="btn-icon">\u25C8</span> Outputs
      </button>

      <!-- Log -->
      <button class="ctrl-btn log-btn" id="af-ctrl-log" title="Run Log \u2014 detailed execution trace">
        <span class="btn-icon">\u2261</span> Log
      </button>
    `;

    // ── Wiring ─────────────────────────────────────────────────────
    const runPauseBtn = document.getElementById('af-ctrl-run-pause');
    runPauseBtn.addEventListener('click', () => {
      if (this._factory.isRunning)  this._factory.pause();
      else if (this._factory.isPaused) this._factory.resume();
      else                           this._factory.run(this._ws);
    });

    document.getElementById('af-ctrl-stop').addEventListener('click',    () => this._factory.stop());
    document.getElementById('af-zoom-in').addEventListener('click',      () => this._zoom(1.2));
    document.getElementById('af-zoom-out').addEventListener('click',     () => this._zoom(1 / 1.2));
    document.getElementById('af-zoom-fit').addEventListener('click',     () => this._fitToScreen());
    document.getElementById('af-ctrl-settings').addEventListener('click', e => { e.stopPropagation(); this._toggleSettings(); });
    document.getElementById('af-ctrl-outputs').addEventListener('click',  () => Bus.emit('ctx:inspect', {}));
    document.getElementById('af-ctrl-log').addEventListener('click',      () => FactoryRunLog.open());

    // Keyboard shortcuts (factory)
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'r') {
        e.preventDefault();
        if (this._factory.isRunning)   this._factory.pause();
        else if (this._factory.isPaused) this._factory.resume();
        else                            this._factory.run(this._ws);
      }
      if (ctrl && e.key === 'q') { e.preventDefault(); this._factory.stop(); }
    });

    // Allow context menu + other systems to trigger fit
    Bus.on('controls:fit', () => this._fitToScreen());

    // Mouse-wheel zoom (not over floating windows)
    document.getElementById('af-workspace')?.addEventListener('wheel', e => {
      if (e.target.closest?.('.float-window')) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const rect = document.getElementById('af-workspace').getBoundingClientRect();
      this._ws.zoomAt(factor, e.clientX, e.clientY, rect);
    }, { passive: false });

    this._initPan();
    this._buildSettingsPanel();
  }

  // ── Settings dropdown ──────────────────────────────────────────
  _buildSettingsPanel() {
    const panel = document.getElementById('af-ctrl-settings-panel');
    if (!panel) return;

    // Portfolio version: no file save/load, no API key button
    panel.innerHTML = `
      <div class="settings-panel-section">
        <div class="settings-panel-label">Factory</div>
        <button class="settings-panel-btn" id="af-sp-fit">
          <span class="sp-icon">\u2291</span> Fit to screen
        </button>
      </div>
    `;

    document.getElementById('af-sp-fit')?.addEventListener('click', () => { this._closeSettings(); this._fitToScreen(); });
  }

  _toggleSettings() {
    const panel = document.getElementById('af-ctrl-settings-panel');
    if (!panel) return;
    this._settingsOpen = !this._settingsOpen;
    panel.style.display = this._settingsOpen ? 'block' : 'none';
    document.getElementById('af-ctrl-settings')?.classList.toggle('active', this._settingsOpen);
  }

  _closeSettings() {
    this._settingsOpen = false;
    const panel = document.getElementById('af-ctrl-settings-panel');
    if (panel) panel.style.display = 'none';
    document.getElementById('af-ctrl-settings')?.classList.remove('active');
  }

  // ── Zoom ───────────────────────────────────────────────────────
  _zoom(factor) {
    const ws   = document.getElementById('af-workspace');
    const rect = ws.getBoundingClientRect();
    this._ws.zoomAt(factor, rect.left + rect.width / 2, rect.top + rect.height / 2, rect);
  }

  _fitToScreen() {
    const blocks = Array.from(this._ws.blocks.values());
    if (blocks.length === 0) { this._ws.setView(100, 100, 1); return; }

    const minX = Math.min(...blocks.map(b => b.x));
    const minY = Math.min(...blocks.map(b => b.y));
    const maxX = Math.max(...blocks.map(b => b.x + (b.width ?? 200)));
    const maxY = Math.max(...blocks.map(b => b.y + 100));

    const ws   = document.getElementById('af-workspace');
    const rect = ws.getBoundingClientRect();
    const pad  = 80;
    const zoom = Math.min(Math.min(
      (rect.width  - pad * 2) / (maxX - minX || 1),
      (rect.height - pad * 2) / (maxY - minY || 1)
    ), 1.5);

    this._ws.setView(pad - minX * zoom, pad - minY * zoom, zoom);
  }

  _updateZoomLabel() {
    const el = document.getElementById('af-zoom-label');
    if (el) el.textContent = Math.round(this._ws.zoom * 100) + '%';
  }

  // ── Factory state -> button appearance ──────────────────────────
  _onFactoryState(state) {
    const btn   = document.getElementById('af-ctrl-run-pause');
    const icon  = document.getElementById('af-run-pause-icon');
    const label = document.getElementById('af-run-pause-label');
    const badge = document.getElementById('af-ctrl-status');
    const bLabel = document.getElementById('af-status-label');

    if (state === 'running') {
      btn.classList.remove('run-pause', 'paused-state');
      btn.classList.add('running-state');
      btn.title = 'Pause factory (Ctrl+R)';
      if (icon)  icon.textContent  = '\u23F8';
      if (label) label.textContent = 'Pause';
      badge?.classList.add('running');
      if (bLabel) bLabel.textContent = 'Running';
    } else if (state === 'paused') {
      btn.classList.remove('running-state');
      btn.classList.add('paused-state');
      btn.title = 'Resume factory (Ctrl+R)';
      if (icon)  icon.textContent  = '\u25B6';
      if (label) label.textContent = 'Resume';
      badge?.classList.remove('running');
      if (bLabel) bLabel.textContent = 'Paused';
    } else {
      btn.classList.remove('running-state', 'paused-state');
      btn.title = 'Run factory (Ctrl+R)';
      if (icon)  icon.textContent  = '\u25B6';
      if (label) label.textContent = 'Run';
      badge?.classList.remove('running');
      if (bLabel) bLabel.textContent = 'Idle';
    }
  }

  // ── Pan (space + drag, or plain drag on void) ───────────────────
  _initPan() {
    const workspace = document.getElementById('af-workspace');
    let panning = false, startX, startY, startVX, startVY;
    let spaceDown = false;

    document.addEventListener('keydown', e => {
      if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        spaceDown = true;
        workspace.classList.add('panning');
      }
    });
    document.addEventListener('keyup', e => {
      if (e.code === 'Space') {
        spaceDown = false;
        workspace.classList.remove('panning', 'panning-active');
      }
    });

    workspace.addEventListener('mousedown', e => {
      const onVoid = e.target === workspace
                  || e.target.id === 'af-workspace-grid'
                  || e.target.id === 'af-pipeline-layer';

      const shouldPan = (e.button === 0 && spaceDown)
                     || (e.button === 0 && onVoid && !e.shiftKey);

      if (shouldPan) {
        panning = true;
        startX  = e.clientX;
        startY  = e.clientY;
        startVX = this._ws.viewX;
        startVY = this._ws.viewY;
        workspace.classList.add('panning-active');
        e.preventDefault();
        e.stopPropagation();
      }
    });

    document.addEventListener('mousemove', e => {
      if (!panning) return;
      this._ws.setView(startVX + (e.clientX - startX), startVY + (e.clientY - startY), this._ws.zoom);
    });

    document.addEventListener('mouseup', () => {
      if (panning) { panning = false; workspace.classList.remove('panning-active'); }
    });
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ║  Sidebar                                                                  ║
// ═══════════════════════════════════════════════════════════════════════════════

class Sidebar {
  constructor(workspace) {
    this._ws         = workspace;
    this._activeTab  = null;
    this._tabsEl     = null;
    this._libraryEl  = null;
    this._ghost      = null;
    this._dragData   = null;
  }

  init() {
    this._tabsEl    = document.getElementById('af-sidebar-tabs');
    this._libraryEl = document.getElementById('af-sidebar-library');

    const categories = Reg.getCategories();
    if (categories.length > 0) this._renderTabs(categories);

    this._activateTab(categories[0]);
  }

  _renderTabs(categories) {
    const icons = {
      'AI Agents':       '\uD83E\uDD16',
      'Input / Output':  '\uD83D\uDCE1',
      'Logic':           '\u26A1',
      'Data':            '\uD83D\uDCBE',
      'Flow Control':    '\uD83D\uDD00',
      'Utilities':       '\uD83D\uDD27',
    };

    this._tabsEl.innerHTML = '';

    const allBtn = document.createElement('button');
    allBtn.className = 'sidebar-tab';
    allBtn.dataset.cat = '__all__';
    allBtn.title = 'All blocks';
    allBtn.textContent = '\u2726';
    allBtn.addEventListener('click', () => this._activateTab('__all__'));
    this._tabsEl.appendChild(allBtn);

    const div0 = document.createElement('div');
    div0.className = 'sidebar-tab-divider';
    this._tabsEl.appendChild(div0);

    categories.forEach((cat, i) => {
      const btn = document.createElement('button');
      btn.className = 'sidebar-tab';
      btn.dataset.cat = cat;
      btn.title = cat;
      btn.textContent = icons[cat] || '\uD83D\uDCE6';
      btn.addEventListener('click', () => this._activateTab(cat));
      this._tabsEl.appendChild(btn);

      if (i === 1) {
        const div = document.createElement('div');
        div.className = 'sidebar-tab-divider';
        this._tabsEl.appendChild(div);
      }
    });
  }

  _activateTab(cat) {
    this._activeTab = cat;
    this._tabsEl.querySelectorAll('.sidebar-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.cat === cat);
    });
    this._renderLibrary(cat);
  }

  _renderLibrary(cat) {
    const isAll = cat === '__all__';
    const categories = Reg.getCategories();

    const title = isAll ? 'All Blocks' : cat;

    let blocksHTML = '';
    if (isAll) {
      blocksHTML = categories.map(c => {
        const blocks = Reg.getByCategory(c);
        return `
          <div class="library-category" data-cat="${c}">
            <div class="library-category-header">
              <span>${c}</span>
              <span class="chevron">\u25BE</span>
            </div>
            <div class="library-blocks">
              ${blocks.map(b => this._blockItemHTML(b)).join('')}
            </div>
          </div>`;
      }).join('');
    } else {
      const blocks = Reg.getByCategory(cat);
      blocksHTML = `
        <div class="library-category">
          <div class="library-blocks">
            ${blocks.map(b => this._blockItemHTML(b)).join('')}
          </div>
        </div>`;
    }

    this._libraryEl.innerHTML = `
      <div class="library-header">
        <div class="library-title">${title}</div>
        <div class="library-search">
          <span class="library-search-icon">\u2315</span>
          <input type="text" placeholder="search all blocks..." id="af-lib-search" autocomplete="off" />
        </div>
      </div>
      <div class="library-scroll" id="af-lib-scroll">
        ${blocksHTML}
      </div>
    `;

    // Search: always searches ALL blocks across ALL categories
    document.getElementById('af-lib-search')?.addEventListener('input', e => {
      const q = e.target.value.trim().toLowerCase();

      if (q === '') {
        this._renderLibrary(this._activeTab);
        setTimeout(() => {
          const input = document.getElementById('af-lib-search');
          if (input) { input.focus(); input.value = q; }
        }, 0);
        return;
      }

      const allBlocks = Reg.getAll();
      const matches = allBlocks.filter(b =>
        b.name.toLowerCase().includes(q) ||
        b.type.toLowerCase().includes(q) ||
        (b.description || '').toLowerCase().includes(q) ||
        (b.category || '').toLowerCase().includes(q)
      );

      const scroll = document.getElementById('af-lib-scroll');
      if (!scroll) return;

      if (matches.length === 0) {
        scroll.innerHTML = `<div style="padding:16px;color:var(--text-muted);font-family:var(--font-mono);font-size:10px;text-align:center;">No blocks found</div>`;
        return;
      }

      scroll.innerHTML = `
        <div class="library-category">
          <div class="library-blocks">
            ${matches.map(b => this._blockItemHTML(b)).join('')}
          </div>
        </div>`;

      scroll.querySelectorAll('.library-block-item').forEach(el => this._bindDrag(el));
    });

    // Category collapse toggle (for All view)
    this._libraryEl.querySelectorAll('.library-category-header').forEach(header => {
      header.addEventListener('click', () => {
        header.closest('.library-category').classList.toggle('collapsed');
      });
    });

    // Bind drag on all rendered items
    this._libraryEl.querySelectorAll('.library-block-item').forEach(el => {
      this._bindDrag(el);
    });
  }

  _blockItemHTML(def) {
    return `
      <div class="library-block-item" data-block-type="${def.type}" style="--block-color:${def.color}">
        <span class="library-block-icon">${def.icon}</span>
        <div class="library-block-info">
          <div class="library-block-name">${def.name}</div>
          <div class="library-block-desc">${def.description}</div>
        </div>
      </div>
    `;
  }

  _bindDrag(el) {
    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault();

      const type = el.dataset.blockType;
      const def  = Reg.get(type);
      const rect = el.getBoundingClientRect();
      const offX = e.clientX - rect.left;
      const offY = e.clientY - rect.top;

      this._dragData = { type, offX, offY, started: false };

      const onMove = ev => {
        if (!this._dragData.started) {
          const dx = Math.abs(ev.clientX - e.clientX);
          const dy = Math.abs(ev.clientY - e.clientY);
          if (dx < 4 && dy < 4) return;
          this._dragData.started = true;
          this._createGhost(def, ev);
        }
        if (this._ghost) {
          this._ghost.style.left = (ev.clientX - this._dragData.offX) + 'px';
          this._ghost.style.top  = (ev.clientY - this._dragData.offY) + 'px';
        }
      };

      const onUp = ev => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        if (this._dragData?.started) this._dropBlock(type, ev);
        this._removeGhost();
        this._dragData = null;
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  _createGhost(def, e) {
    if (this._ghost) this._ghost.remove();
    const ghost = document.createElement('div');
    ghost.className = 'library-block-item library-drag-ghost';
    ghost.style.cssText = `
      position: fixed;
      left: ${e.clientX - (this._dragData?.offX||0)}px;
      top:  ${e.clientY - (this._dragData?.offY||0)}px;
      width: 160px;
      pointer-events: none;
      --block-color: ${def.color};
    `;
    ghost.innerHTML = `
      <span class="library-block-icon">${def.icon}</span>
      <div class="library-block-info">
        <div class="library-block-name">${def.name}</div>
      </div>
    `;
    document.body.appendChild(ghost);
    this._ghost = ghost;
  }

  _removeGhost() {
    this._ghost?.remove();
    this._ghost = null;
  }

  _dropBlock(type, e) {
    const ws = document.getElementById('af-workspace');
    if (!ws) return;
    const rect = ws.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom) return;

    const worldPos = this._ws.screenToWorld(e.clientX, e.clientY, rect);
    const snapped  = this._ws.snapPoint(worldPos.x, worldPos.y);

    const block = new Block({ type, x: snapped.x, y: snapped.y });
    this._ws.addBlock(block);
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ║  StatusBar                                                                ║
// ═══════════════════════════════════════════════════════════════════════════════

class StatusBar {
  constructor(workspace, selectionMgr) {
    this._ws      = workspace;
    this._sel     = selectionMgr;
    this._el      = null;
    this._timer   = null;
    this._startTs = null;
    this._elapsed = 0;
  }

  init() {
    this._el = document.getElementById('af-status-bar');
    if (!this._el) return;

    this._render();
    this._update();

    Bus.on('workspace:block-added',   () => this._update());
    Bus.on('workspace:block-removed', () => this._update());
    Bus.on('workspace:pipeline-added',   () => this._update());
    Bus.on('workspace:pipeline-removed', () => this._update());
    Bus.on('workspace:rebuilt',       () => this._update());
    Bus.on('workspace:view-changed',  () => this._updateZoom());
    Bus.on('selection:changed',       () => this._updateSel());
    Bus.on('factory:state',           ({ state }) => this._onFactoryState(state));
    Bus.on('factory:completed',       () => this._stopTimer());
    Bus.on('factory:stopped',         () => this._stopTimer());
  }

  _render() {
    this._el.innerHTML = `
      <div class="status-left">
        <span class="status-item" id="af-sb-blocks">0 blocks</span>
        <span class="status-sep">\u00B7</span>
        <span class="status-item" id="af-sb-pipes">0 pipelines</span>
        <span class="status-sep">\u00B7</span>
        <span class="status-item" id="af-sb-sel">nothing selected</span>
      </div>
      <div class="status-center">
        <span class="status-item state" id="af-sb-state">Idle</span>
        <span class="status-item timer hidden" id="af-sb-timer">00:00</span>
      </div>
      <div class="status-right">
        <span class="status-item zoom" id="af-sb-zoom">100%</span>
        <span class="status-sep">\u00B7</span>
        <button class="status-btn" id="af-sb-shortcuts" data-tooltip="Keyboard shortcuts (?)">\u2328</button>
      </div>
    `;

    document.getElementById('af-sb-shortcuts')?.addEventListener('click', () => this._showShortcuts());

    document.addEventListener('keydown', e => {
      if (e.key === '?' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
        this._showShortcuts();
      }
    });
  }

  _update() {
    const blocks = this._ws.blocks.size;
    const pipes  = this._ws.pipelines.size;
    const sbB = document.getElementById('af-sb-blocks');
    const sbP = document.getElementById('af-sb-pipes');
    if (sbB) sbB.textContent = `${blocks} block${blocks !== 1 ? 's' : ''}`;
    if (sbP) sbP.textContent = `${pipes} pipeline${pipes !== 1 ? 's' : ''}`;
    this._updateZoom();
    this._updateSel();
  }

  _updateZoom() {
    const el = document.getElementById('af-sb-zoom');
    if (el) el.textContent = Math.round(this._ws.zoom * 100) + '%';
  }

  _updateSel() {
    const el = document.getElementById('af-sb-sel');
    if (!el) return;
    const n = this._sel.selected.size;
    el.textContent = n === 0 ? 'nothing selected' : `${n} block${n > 1 ? 's' : ''} selected`;
    el.classList.toggle('active', n > 0);
  }

  _onFactoryState(state) {
    const stateEl = document.getElementById('af-sb-state');
    const timerEl = document.getElementById('af-sb-timer');
    if (!stateEl) return;

    if (state === 'running') {
      stateEl.textContent  = '\u26A1 Running';
      stateEl.className    = 'status-item state running';
      this._startTs = Date.now() - this._elapsed;
      this._timer = setInterval(() => {
        this._elapsed = Date.now() - this._startTs;
        if (timerEl) {
          timerEl.classList.remove('hidden');
          timerEl.textContent = this._formatTime(this._elapsed);
        }
      }, 100);
    } else if (state === 'paused') {
      stateEl.textContent = '\u23F8 Paused';
      stateEl.className   = 'status-item state paused';
      clearInterval(this._timer);
    } else {
      stateEl.textContent = 'Idle';
      stateEl.className   = 'status-item state';
    }
  }

  _stopTimer() {
    clearInterval(this._timer);
    this._timer   = null;
    this._elapsed = 0;
    const timerEl = document.getElementById('af-sb-timer');
    if (timerEl) timerEl.classList.add('hidden');
  }

  _formatTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  }

  // ── Keyboard shortcut panel ───────────────────────
  _showShortcuts() {
    WinManager.open({
      id:    'shortcuts',
      title: 'Keyboard Shortcuts',
      icon:  '\u2328',
      x: 300, y: 80, width: 480, height: 520,
      onBuild: (body) => {
        const groups = [
          {
            title: 'Selection',
            items: [
              ['Click block',           'Select block'],
              ['Shift + Click block',   'Add / remove from selection'],
              ['Shift + Drag canvas',   'Rectangle select'],
              ['Ctrl + A',              'Select all'],
              ['Escape',                'Deselect all'],
            ]
          },
          {
            title: 'Editing',
            items: [
              ['Delete / Backspace',    'Delete selected'],
              ['Ctrl + C',              'Copy selection'],
              ['Ctrl + V',              'Paste'],
              ['Ctrl + Z',              'Undo'],
              ['Ctrl + Y',              'Redo'],
            ]
          },
          {
            title: 'View',
            items: [
              ['Scroll wheel',          'Zoom in / out'],
              ['Drag canvas',           'Pan workspace'],
              ['Ctrl + Shift + F',      'Fit all blocks to screen'],
            ]
          },
          {
            title: 'Factory',
            items: [
              ['Ctrl + R',              'Run \u00B7 Pause \u00B7 Resume (toggle)'],
              ['Ctrl + Q',              'Stop factory'],
            ]
          },
          {
            title: 'Interface',
            items: [
              ['Right-click canvas',    'Context menu'],
              ['Right-click block',     'Block context menu'],
              ['Right-click pipeline',  'Delete pipeline'],
              ['Escape',                'Close focused window'],
              ['?',                     'Show this panel'],
            ]
          },
        ];

        body.style.overflowY = 'auto';
        body.innerHTML = groups.map(g => `
          <div class="shortcut-group">
            <div class="shortcut-group-title">${g.title}</div>
            ${g.items.map(([key, desc]) => `
              <div class="shortcut-row">
                <kbd class="shortcut-key">${key}</kbd>
                <span class="shortcut-desc">${desc}</span>
              </div>`).join('')}
          </div>`).join('');
      }
    });
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ║  Minimap                                                                  ║
// ═══════════════════════════════════════════════════════════════════════════════

class Minimap {
  constructor(workspace) {
    this._ws     = workspace;
    this._canvas = null;
    this._ctx    = null;
    this._scale  = 1;
    this._BASE   = 0.06;
    this._size   = 200;
  }

  init() {
    this._canvas = document.getElementById('af-minimap-canvas');
    if (!this._canvas) return;
    this._ctx    = this._canvas.getContext('2d');
    this._canvas.width  = this._size;
    this._canvas.height = this._size;

    Bus.on('workspace:block-added',    () => this.render());
    Bus.on('workspace:block-removed',  () => this.render());
    Bus.on('workspace:rebuilt',        () => this.render());
    Bus.on('block:moved',              () => this.render());
    Bus.on('workspace:view-changed',   () => this.render());
    Bus.on('workspace:pipeline-added', () => this.render());
    Bus.on('workspace:pipeline-removed', () => this.render());

    document.getElementById('af-minimap-zoom-in') ?.addEventListener('click', () => { this._scale = Math.min(4, this._scale * 1.3); this.render(); });
    document.getElementById('af-minimap-zoom-out')?.addEventListener('click', () => { this._scale = Math.max(0.2, this._scale / 1.3); this.render(); });

    // Click to navigate
    this._canvas.addEventListener('click', e => {
      const rect  = this._canvas.getBoundingClientRect();
      const mx    = (e.clientX - rect.left) / rect.width  * this._size;
      const my    = (e.clientY - rect.top)  / rect.height * this._size;
      const scale = this._BASE * this._scale;

      const ws  = document.getElementById('af-workspace');
      const wsr = ws?.getBoundingClientRect();
      if (!wsr) return;

      const { viewX, viewY, zoom } = this._ws;
      const worldCX = (-viewX + wsr.width  / 2) / zoom;
      const worldCY = (-viewY + wsr.height / 2) / zoom;
      const ox = this._size / 2 - worldCX * scale;
      const oy = this._size / 2 - worldCY * scale;

      const clickWorldX = (mx - ox) / scale;
      const clickWorldY = (my - oy) / scale;

      this._ws.setView(
        wsr.width  / 2 - clickWorldX * zoom,
        wsr.height / 2 - clickWorldY * zoom,
        zoom
      );
    });

    this.render();
  }

  render() {
    if (!this._ctx) return;
    const ctx   = this._ctx;
    const size  = this._size;
    const scale = this._BASE * this._scale;

    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#0a0c0f';
    ctx.fillRect(0, 0, size, size);

    const wsEl  = document.getElementById('af-workspace');
    const rect  = wsEl?.getBoundingClientRect();
    const { viewX, viewY, zoom } = this._ws;

    const worldCX = rect ? (-viewX + rect.width  / 2) / zoom : 0;
    const worldCY = rect ? (-viewY + rect.height / 2) / zoom : 0;

    const ox = size / 2 - worldCX * scale;
    const oy = size / 2 - worldCY * scale;

    const mx = wx => wx * scale + ox;
    const my = wy => wy * scale + oy;

    // ── Grid dots ─────────────────────────────────────────────
    ctx.fillStyle = '#1e2538';
    const gridStep = 24 * scale;
    const startX = ((ox % gridStep) + gridStep) % gridStep;
    const startY = ((oy % gridStep) + gridStep) % gridStep;
    for (let x = startX; x < size; x += gridStep) {
      for (let y = startY; y < size; y += gridStep) {
        ctx.fillRect(x, y, 1, 1);
      }
    }

    // ── Pipelines ─────────────────────────────────────────────
    ctx.strokeStyle = '#2a3450';
    ctx.lineWidth   = 1;
    this._ws.pipelines.forEach(pipeline => {
      const fb = this._ws.blocks.get(pipeline.fromBlockId);
      const tb = this._ws.blocks.get(pipeline.toBlockId);
      if (!fb || !tb) return;
      ctx.beginPath();
      ctx.moveTo(mx(fb.x), my(fb.y));
      ctx.lineTo(mx(tb.x), my(tb.y));
      ctx.stroke();
    });

    // ── Blocks ────────────────────────────────────────────────
    this._ws.blocks.forEach(block => {
      const bx = mx(block.x);
      const by = my(block.y);
      const bw = 16 * scale * 10;
      const bh = 8  * scale * 10;

      ctx.fillStyle   = '#141820';
      ctx.strokeStyle = block.selected ? '#4a7aff' : '#2a3450';
      ctx.lineWidth   = block.selected ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 1);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = block.color || '#4a7aff';
      ctx.fillRect(bx, by, 2, bh);
    });

    // ── Viewport rect ────────────────────────────────────────
    if (rect) {
      const vw = (rect.width  / zoom) * scale;
      const vh = (rect.height / zoom) * scale;
      const vx = size / 2 - vw / 2;
      const vy = size / 2 - vh / 2;

      ctx.strokeStyle = 'rgba(74,122,255,0.7)';
      ctx.fillStyle   = 'rgba(74,122,255,0.05)';
      ctx.lineWidth   = 1;
      ctx.beginPath();
      ctx.rect(vx, vy, vw, vh);
      ctx.fill();
      ctx.stroke();
    }
  }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ║  ContextInspector                                                         ║
// ═══════════════════════════════════════════════════════════════════════════════

// ── Helpers (shared with RunLog) ────────────────────────────────
function _esc(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _formatSize(bytes) {
  if (!bytes) return '0B';
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function _formatValue(value, portType) {
  if (value === undefined || value === null)
    return `<span class="inbox-val-null">null / undefined</span>`;

  if (portType === 'trigger' || typeof value === 'boolean')
    return `<span class="inbox-val-bool">${value}</span>`;

  if (portType === 'number' || typeof value === 'number')
    return `<span class="inbox-val-number">${value}</span>`;

  const isImageUrl = typeof value === 'string' && (
    value.startsWith('data:image/') ||
    /\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(value) ||
    value.includes('image.pollinations.ai') ||
    value.includes('/generate/image')
  );
  if (portType === 'image' || isImageUrl)
    return `<div class="inbox-val-image-wrap" data-img-url="${_esc(String(value))}">
      <div class="result-img-spinner">
        <div class="spinner-ring"></div>
        <div class="spinner-label">Generating image\u2026</div>
      </div>
      <img class="inbox-val-image" style="display:none" src="" alt="Image output" />
      <div class="result-img-error" style="display:none;">\u26A0 Image failed to load</div>
    </div>`;

  if (portType === 'text' || typeof value === 'string')
    return `<div class="inbox-val-text">${_esc(String(value))}</div>`;

  try {
    return `<pre class="inbox-val-json">${_esc(JSON.stringify(value, null, 2))}</pre>`;
  } catch {
    return `<div class="inbox-val-text">${_esc(String(value))}</div>`;
  }
}

function _startInboxImageRetry(container, maxAttempts = 20, intervalMs = 3000) {
  const wraps = container.querySelectorAll('.inbox-val-image-wrap');
  wraps.forEach(wrap => {
    const url     = wrap.dataset.imgUrl;
    const spinner = wrap.querySelector('.result-img-spinner');
    const preview = wrap.querySelector('.inbox-val-image');
    const errDiv  = wrap.querySelector('.result-img-error');
    if (!url || !spinner || !preview) return;

    let attempt = 0;
    const tryLoad = () => {
      attempt++;
      const label = spinner.querySelector('.spinner-label');
      if (label) label.textContent = attempt > 1
        ? `Generating image\u2026 (${attempt}/${maxAttempts})`
        : 'Generating image\u2026';

      const probe = new Image();
      const bustUrl = url + (url.includes('?') ? '&' : '?') + `_t=${Date.now()}`;

      probe.onload = () => {
        spinner.style.display = 'none';
        preview.src = bustUrl;
        preview.style.display = 'block';
      };
      probe.onerror = () => {
        if (attempt >= maxAttempts) {
          spinner.style.display = 'none';
          if (errDiv) errDiv.style.display = 'block';
          return;
        }
        setTimeout(tryLoad, intervalMs);
      };
      probe.src = bustUrl;
    };
    tryLoad();
  });
}

class ContextInspector {
  constructor() {
    this._index    = {};
    this._selected = null;
    this._bodyEl   = null;
  }

  init() {
    Bus.on('factory:index-updated', ({ index }) => {
      this._index = index;
      if (WinManager.isOpen('ctx-inspector')) this._rebuild();
    });

    Bus.on('factory:completed', ({ index }) => {
      this._index = index || {};
      if (Object.keys(this._index).length > 0) this.open();
    });

    Bus.on('factory:stopped', () => {
      this._index = {};
      if (WinManager.isOpen('ctx-inspector')) WinManager.close('ctx-inspector');
    });

    Bus.on('ctx:inspect', ({ address } = {}) => {
      this.open(address);
    });
  }

  open(preSelectAddress = null) {
    if (WinManager.isOpen('ctx-inspector')) {
      WinManager.focus('ctx-inspector');
      this._rebuild();
      if (preSelectAddress) requestAnimationFrame(() => this._selectEntry(preSelectAddress));
      return;
    }

    WinManager.open({
      id:    'ctx-inspector',
      title: 'Result Index',
      icon:  '\uD83D\uDCEC',
      x: 50, y: 60, width: 720, height: 480,
      resizable: true,
      onBuild: (body) => {
        this._bodyEl = body;
        this._rebuild();
        if (preSelectAddress) requestAnimationFrame(() => this._selectEntry(preSelectAddress));
      },
    });
  }

  _rebuild() {
    const body = this._bodyEl;
    if (!body) return;

    const entries = Object.values(this._index)
      .filter(e => e.portType !== 'trigger');

    if (entries.length === 0) {
      body.innerHTML = `
        <div class="inbox-empty">
          <div class="inbox-empty-icon">\uD83D\uDCEC</div>
          No results yet.<br>
          <span>Run the factory to populate the index.</span>
        </div>`;
      return;
    }

    const prevSelected = this._selected;

    const groups = new Map();
    entries.forEach(e => {
      if (!groups.has(e.blockId)) groups.set(e.blockId, { name: e.blockName, entries: [] });
      groups.get(e.blockId).entries.push(e);
    });

    body.style.display       = 'flex';
    body.style.flexDirection = 'row';
    body.style.overflow      = 'hidden';

    body.innerHTML = `
      <div class="inbox-list" id="af-inbox-list">
        <div class="inbox-toolbar">
          <span class="inbox-count">${entries.length} result${entries.length !== 1 ? 's' : ''}</span>
          <input class="inbox-search" id="af-inbox-search" placeholder="Search\u2026" />
        </div>
        <div class="inbox-scroll" id="af-inbox-scroll">
          ${[...groups.values()].map(g => `
            <div class="inbox-group" data-first-address="${g.entries[0].address}">
              <div class="inbox-group-label">${_esc(g.name)}</div>
              ${g.entries.map(e => `
                <div class="inbox-row" data-address="${e.address}">
                  <div class="inbox-row-header">
                    <span class="inbox-dot" data-type="${e.portType}"></span>
                    <span class="inbox-subject">${_esc(e.portLabel)}</span>
                    ${e.iteration > 0 ? `<span class="inbox-iter">iter${e.iteration}</span>` : ''}
                    <span class="inbox-meta">${_esc(e.portType)} \u00B7 ${_formatSize(e.size)}</span>
                  </div>
                  <div class="inbox-preview">${_esc(e.summary)}</div>
                </div>`).join('')}
            </div>`).join('')}
        </div>
      </div>
      <div class="inbox-reader" id="af-inbox-reader">
        <div class="inbox-reader-empty">\u2190 Select a result to read</div>
      </div>`;

    const readerEl = body.querySelector('#af-inbox-reader');

    body.querySelectorAll('.inbox-group').forEach(group => {
      group.addEventListener('click', () => {
        body.querySelectorAll('.inbox-group').forEach(g => g.classList.remove('active'));
        group.classList.add('active');
        group.scrollIntoView({ block: 'nearest' });
        this._showContent(group.dataset.firstAddress, readerEl);
      });
    });

    const search = body.querySelector('#af-inbox-search');
    search?.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      body.querySelectorAll('.inbox-group').forEach(group => {
        const name    = (group.querySelector('.inbox-group-label')?.textContent || '').toLowerCase();
        const preview = group.querySelector('.inbox-preview')?.textContent.toLowerCase() || '';
        const subject = group.querySelector('.inbox-subject')?.textContent.toLowerCase() || '';
        group.style.display = (!q || name.includes(q) || preview.includes(q) || subject.includes(q)) ? '' : 'none';
      });
    });

    const restoreAddr = (prevSelected && this._index[prevSelected]) ? prevSelected : entries[0]?.address;
    if (restoreAddr) {
      const row = body.querySelector(`[data-address="${restoreAddr}"]`);
      const group = row?.closest('.inbox-group');
      if (group) {
        group.classList.add('active');
        group.scrollIntoView({ block: 'nearest' });
      }
      this._showContent(restoreAddr, readerEl);
    }
  }

  _showContent(address, readerEl) {
    if (!readerEl) return;
    this._selected = address;
    const entry = this._index[address];
    if (!entry) return;

    const value   = FactoryController.getByAddress(address);
    const display = _formatValue(value, entry.portType);
    const rawStr  = (value === null || value === undefined) ? '' :
                    (typeof value === 'string') ? value : JSON.stringify(value, null, 2);

    readerEl.innerHTML = `
      <div class="inbox-reader-header">
        <div class="inbox-reader-from">
          <span class="inbox-dot" data-type="${entry.portType}"></span>
          <strong>${_esc(entry.blockName)}</strong>
          <span class="inbox-reader-sep">/</span>
          <span class="inbox-reader-port">${_esc(entry.portLabel)}</span>
          ${entry.iteration > 0 ? `<span class="inbox-iter">iter${entry.iteration}</span>` : ''}
        </div>
        <div class="inbox-reader-actions">
          <button class="inbox-action-btn" id="af-btn-copy-content" title="Copy content">\u29C9 Content</button>
          <button class="inbox-action-btn muted" id="af-btn-copy-addr" title="Copy address">\u29C9 Address</button>
        </div>
      </div>
      <div class="inbox-reader-meta">
        <div class="inbox-meta-chip"><span>Type</span><em>${entry.portType}</em></div>
        <div class="inbox-meta-chip"><span>Size</span><em>${_formatSize(entry.size)}</em></div>
        <div class="inbox-meta-chip"><span>Block</span><em>${entry.blockType}</em></div>
        <div class="inbox-meta-chip"><span>Time</span><em>${new Date(entry.timestamp).toLocaleTimeString()}</em></div>
      </div>
      <div class="inbox-reader-body">${display}</div>`;

    readerEl.querySelector('#af-btn-copy-content')?.addEventListener('click', () => {
      navigator.clipboard.writeText(rawStr).then(() =>
        Bus.emit('ui:flash', { message: '\u29C9 Content copied', type: 'success' })
      );
    });
    readerEl.querySelector('#af-btn-copy-addr')?.addEventListener('click', () => {
      navigator.clipboard.writeText(address).then(() =>
        Bus.emit('ui:flash', { message: '\u29C9 Address copied', type: 'success' })
      );
    });

    _startInboxImageRetry(readerEl);
  }

  _selectEntry(address) {
    const body = this._bodyEl;
    if (!body) return;
    const row   = body.querySelector(`[data-address="${address}"]`);
    const group = row?.closest('.inbox-group');
    if (group) {
      body.querySelectorAll('.inbox-group').forEach(g => g.classList.remove('active'));
      group.classList.add('active');
      group.scrollIntoView({ block: 'nearest' });
      this._showContent(address, body.querySelector('#af-inbox-reader'));
    }
  }
}

var CtxInspector = new ContextInspector();


// ═══════════════════════════════════════════════════════════════════════════════
// ║  ContextMenu                                                              ║
// ═══════════════════════════════════════════════════════════════════════════════

class ContextMenu {
  constructor(workspace, selectionMgr, blockUI) {
    this._ws    = workspace;
    this._sel   = selectionMgr;
    this._bui   = blockUI;
    this._el    = null;
    this._copyBuffer = [];
  }

  init() {
    const style = document.createElement('style');
    style.textContent = `
      #af-context-menu {
        position: fixed;
        z-index: 601;
        background: var(--bg-elevated);
        border: 1px solid var(--border-bright);
        border-radius: 6px;
        padding: 4px;
        min-width: 180px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        font-family: var(--font-ui);
        font-size: 13px;
        animation: af-ctx-in 0.08s ease-out;
      }
      @keyframes af-ctx-in {
        from { opacity: 0; transform: scale(0.96) translateY(-4px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      #af-context-menu .ctx-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        color: var(--text-bright);
        transition: background var(--anim-fast);
        white-space: nowrap;
      }
      #af-context-menu .ctx-item:hover { background: var(--bg-active); }
      #af-context-menu .ctx-item.danger:hover { background: rgba(255,61,90,0.15); color: var(--accent-red); }
      #af-context-menu .ctx-item.disabled { opacity: 0.35; pointer-events: none; }
      #af-context-menu .ctx-item .ctx-icon { width: 16px; text-align: center; font-size: 13px; flex-shrink:0; }
      #af-context-menu .ctx-item .ctx-label { flex: 1; }
      #af-context-menu .ctx-item .ctx-shortcut { font-family: var(--font-mono); font-size: 9px; color: var(--text-dim); }
      #af-context-menu .ctx-sep {
        height: 1px;
        background: var(--border-dim);
        margin: 3px 0;
      }
      #af-context-menu .ctx-section {
        padding: 4px 10px 2px;
        font-family: var(--font-mono);
        font-size: 9px;
        color: var(--text-dim);
        text-transform: uppercase;
        letter-spacing: 1px;
      }
    `;
    document.head.appendChild(style);

    const ws = document.getElementById('af-workspace');
    ws?.addEventListener('contextmenu', e => this._onWorkspaceContext(e));

    document.addEventListener('click',   () => this._hide());
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this._hide(); });
  }

  // ── Workspace right-click ─────────────────────────
  _onWorkspaceContext(e) {
    if (e.target.closest('#af-window-layer')) return;

    e.preventDefault();

    const blockEl = e.target.closest('.factory-block');
    const pipeEl  = e.target.closest('.pipeline-path') || e.target.tagName === 'path' && e.target;

    if (blockEl) {
      const blockId = blockEl.dataset.blockId;
      const block   = this._ws.blocks.get(blockId);
      if (block) { this._showBlockMenu(e, block); return; }
    }

    if (pipeEl && pipeEl.dataset?.pipelineId) {
      const pipe = this._ws.pipelines.get(pipeEl.dataset.pipelineId);
      if (pipe) { this._showPipelineMenu(e, pipe); return; }
    }

    this._showWorkspaceMenu(e);
  }

  // ── Workspace background menu ─────────────────────
  _showWorkspaceMenu(e) {
    const ws   = document.getElementById('af-workspace');
    const rect = ws.getBoundingClientRect();
    const worldPos = this._ws.screenToWorld(e.clientX, e.clientY, rect);
    const snapped  = this._ws.snapPoint(worldPos.x, worldPos.y);

    const hasSelection = this._sel.selected.size > 0;
    const hasCopy      = this._copyBuffer.length > 0;

    this._show(e.clientX, e.clientY, [
      { label: 'Paste', icon: '\uD83D\uDCCB', shortcut: 'Ctrl+V', disabled: !hasCopy, action: () => {
        if (this._copyBuffer.length) this._sel.pasteBlocks(this._copyBuffer);
      }},
      { sep: true },
      { label: 'Select All', icon: '\u2B1B', shortcut: 'Ctrl+A', action: () => {
        this._ws.blocks.forEach(b => this._sel.add(b.id));
      }},
      { label: 'Deselect', icon: '\u2B1C', shortcut: 'Esc', disabled: !hasSelection, action: () => {
        this._sel.clear();
      }},
      { sep: true },
      { section: 'Add block at cursor' },
      { label: 'LLM Agent', icon: '\uD83E\uDD16', action: () => this._addBlock('llm-agent', snapped) },
      { label: 'Code Agent', icon: '\uD83D\uDCBB', action: () => this._addBlock('code-agent', snapped) },
      { label: 'Text Input',  icon: '\uD83D\uDCDD', action: () => this._addBlock('input-text', snapped) },
      { label: 'Display',     icon: '\uD83D\uDCFA', action: () => this._addBlock('output-display', snapped) },
      { sep: true },
      { label: 'Fit to screen', icon: '\u2291', action: () => Bus.emit('controls:fit', {}) },
    ]);
  }

  // ── Block right-click menu ────────────────────────
  _showBlockMenu(e, block) {
    if (!this._sel.isSelected(block.id)) this._sel.selectOnly(block.id);
    const multiSelected = this._sel.selected.size > 1;

    this._show(e.clientX, e.clientY, [
      { section: multiSelected ? `${this._sel.selected.size} blocks selected` : block.name },
      { label: 'Settings',    icon: '\u2699', action: () => Bus.emit('block:open-settings', { blockId: block.id }) },
      { label: 'Results',     icon: '\u25CE', action: () => Bus.emit('block:open-results',  { blockId: block.id }) },
      { sep: true },
      { label: 'Copy',        icon: '\uD83D\uDCCB', shortcut: 'Ctrl+C', action: () => {
        this._copyBuffer = this._sel.copySelected();
        Bus.emit('ui:flash', { message: `Copied ${this._sel.selected.size} block(s)`, type: 'info' });
      }},
      { label: 'Duplicate',   icon: '\u29C9', action: () => {
        const copy = this._sel.copySelected();
        this._sel.pasteBlocks(copy);
      }},
      { sep: true },
      { label: multiSelected ? 'Delete selected' : 'Delete block',
        icon: '\uD83D\uDDD1', danger: true, action: () => this._sel.deleteSelected() },
    ]);
  }

  // ── Pipeline right-click menu ─────────────────────
  _showPipelineMenu(e, pipeline) {
    this._show(e.clientX, e.clientY, [
      { section: 'Pipeline' },
      { label: 'Delete connection', icon: '\uD83D\uDDD1', danger: true, action: () => {
        this._ws.removePipeline(pipeline.id);
      }},
    ]);
  }

  _addBlock(type, snapped) {
    const block = new Block({ type, x: snapped.x, y: snapped.y });
    this._ws.addBlock(block);
  }

  // ── Render ────────────────────────────────────────
  _show(x, y, items) {
    this._hide();

    const el = document.createElement('div');
    el.id = 'af-context-menu';

    items.forEach(item => {
      if (item.sep) {
        el.insertAdjacentHTML('beforeend', '<div class="ctx-sep"></div>');
        return;
      }
      if (item.section) {
        el.insertAdjacentHTML('beforeend', `<div class="ctx-section">${item.section}</div>`);
        return;
      }

      const row = document.createElement('div');
      row.className = 'ctx-item' + (item.danger ? ' danger' : '') + (item.disabled ? ' disabled' : '');
      row.innerHTML = `
        <span class="ctx-icon">${item.icon || ''}</span>
        <span class="ctx-label">${item.label}</span>
        ${item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : ''}
      `;
      row.addEventListener('click', e => {
        e.stopPropagation();
        this._hide();
        if (!item.disabled) item.action?.();
      });
      el.appendChild(row);
    });

    document.body.appendChild(el);
    this._el = el;

    const vw = window.innerWidth, vh = window.innerHeight;
    const mw = el.offsetWidth,    mh = el.offsetHeight;
    el.style.left = (x + mw > vw ? x - mw : x) + 'px';
    el.style.top  = (y + mh > vh ? y - mh : y) + 'px';
  }

  _hide() {
    this._el?.remove();
    this._el = null;
  }

  setCopyBuffer(buf) { this._copyBuffer = buf; }
  getCopyBuffer()    { return this._copyBuffer; }
}


// ═══════════════════════════════════════════════════════════════════════════════
// ║  Tooltip                                                                  ║
// ═══════════════════════════════════════════════════════════════════════════════

class TooltipSystem {
  constructor() {
    this._el      = null;
    this._timer   = null;
    this._visible = false;
  }

  init() {
    this._el = document.createElement('div');
    this._el.id = 'af-tooltip';
    this._el.style.cssText = `
      position: fixed;
      z-index: 601;
      background: var(--bg-elevated);
      border: 1px solid var(--border-bright);
      border-radius: 5px;
      padding: 6px 10px;
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-bright);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.1s;
      max-width: 220px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
      white-space: nowrap;
    `;
    document.body.appendChild(this._el);

    document.addEventListener('mouseover', e => {
      const port = e.target.closest('.port-dot');
      if (port) { this._schedulePort(port, e); return; }

      const tip = e.target.closest('[data-tooltip]');
      if (tip) { this._scheduleText(tip.dataset.tooltip, e); return; }

      this._cancel();
    });

    document.addEventListener('mousemove', e => {
      if (this._visible) this._move(e);
    });

    document.addEventListener('mouseout', e => {
      const port = e.target.closest('.port-dot');
      const tip  = e.target.closest('[data-tooltip]');
      if (port || tip) this._cancel();
    });
  }

  _schedulePort(portEl, e) {
    this._cancel();
    this._timer = setTimeout(() => {
      const portId    = portEl.dataset.portId;
      const direction = portEl.dataset.direction;
      const type      = portEl.dataset.type || 'any';
      const connected = portEl.classList.contains('connected');
      const blockEl   = portEl.closest('.factory-block');
      const blockName = blockEl?.querySelector('.block-title')?.textContent || '';

      const label = portEl.closest('.block-port-row')?.querySelector('.port-label')?.textContent || portId;

      const typeColor = this._typeColor(type);
      this._el.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${typeColor};flex-shrink:0;box-shadow:0 0 6px ${typeColor}"></span>
          <strong style="color:var(--text-white)">${label}</strong>
          <span style="color:var(--text-dim);font-size:9px">${direction === 'in' ? '\u2190' : '\u2192'}</span>
        </div>
        <div style="color:${typeColor};margin-bottom:1px">type: ${type}</div>
        <div style="color:${connected ? 'var(--accent-green)' : 'var(--text-dim)'}">${connected ? '\u25CF connected' : '\u25CB not connected'}</div>
        ${blockName ? `<div style="color:var(--text-dim);font-size:9px;margin-top:2px">${blockName}</div>` : ''}
      `;
      this._show(e);
    }, 280);
  }

  _scheduleText(text, e) {
    this._cancel();
    this._timer = setTimeout(() => {
      this._el.textContent = text;
      this._show(e);
    }, 200);
  }

  _show(e) {
    this._visible = true;
    this._el.style.opacity = '1';
    this._move(e);
  }

  _move(e) {
    const x = e.clientX + 14;
    const y = e.clientY + 14;
    const w = this._el.offsetWidth;
    const h = this._el.offsetHeight;
    this._el.style.left = (x + w > window.innerWidth  ? x - w - 20 : x) + 'px';
    this._el.style.top  = (y + h > window.innerHeight ? y - h - 20 : y) + 'px';
  }

  _cancel() {
    clearTimeout(this._timer);
    this._timer   = null;
    this._visible = false;
    this._el.style.opacity = '0';
  }

  _typeColor(type) {
    const map = {
      text:    'var(--port-text)',
      number:  'var(--port-number)',
      bool:    'var(--port-bool)',
      json:    'var(--port-json)',
      image:   'var(--port-image)',
      trigger: 'var(--port-trigger)',
      any:     'var(--port-any)',
    };
    return map[type] || 'var(--port-any)';
  }
}

var Tooltip = new TooltipSystem();


// ═══════════════════════════════════════════════════════════════════════════════
// ║  RunLog                                                                   ║
// ═══════════════════════════════════════════════════════════════════════════════

// ── HTML helpers for RunLog ──────────────────────────────────────

function _renderKV(obj, maxLen = 200) {
  const entries = Object.entries(obj || {});
  if (entries.length === 0) return '<div class="runlog-none">(none)</div>';
  return entries.map(([k, v]) => `
    <div class="runlog-kv">
      <span class="runlog-kv-key">${_esc(k)}</span>
      <span class="runlog-kv-val">${_esc(String(v ?? '').slice(0, maxLen))}</span>
    </div>`).join('');
}

function _renderSection(title, content, startCollapsed = false) {
  if (!content && content !== '') return '';
  return `
    <div class="runlog-section">
      <div class="runlog-section-head">
        <span class="runlog-chevron">${startCollapsed ? '\u25B6' : '\u25BC'}</span>
        <span>${_esc(title)}</span>
      </div>
      <div class="runlog-section-body" style="display:${startCollapsed ? 'none' : 'block'}">
        ${content}
      </div>
    </div>`;
}

function _subSection(title, content) {
  return `
    <div class="runlog-sub">
      <div class="runlog-sub-label">${_esc(title)}</div>
      ${content}
    </div>`;
}

class RunLog {
  constructor() {
    this._entries     = [];
    this._runId       = null;
    this._isOpen      = false;
    this._bodyEl      = null;
    this._selectedIdx = 0;
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  init() {
    Bus.on('factory:state', ({ state }) => {
      if (state === 'running') {
        this._entries     = [];
        this._selectedIdx = 0;
        this._runId       = 'run_' + Date.now().toString(36);
      }
    });

    Bus.on('factory:block-log', entry => {
      this._entries.push(entry);
      if (this._isOpen) this._refresh();
    });

    Bus.on('factory:completed', () => {
      if (this._entries.length > 0) this.open();
    });

    Bus.on('factory:stopped', () => {
      this._entries = [];
      if (this._isOpen) this._refresh();
    });
  }

  // ── Window ───────────────────────────────────────────────────

  open() {
    if (WinManager.isOpen('run-log')) {
      WinManager.focus('run-log');
      this._refresh();
      return;
    }
    WinManager.open({
      id:    'run-log',
      title: 'Run Log',
      icon:  '\uD83D\uDCCB',
      x: 80, y: 60, width: 720, height: 520,
      resizable: true,
      onBuild: (body) => {
        this._bodyEl = body;
        this._isOpen = true;
        this._refresh();
      },
    });
    Bus.on('win:closed', ({ id }) => {
      if (id === 'run-log') this._isOpen = false;
    });
  }

  _refresh() {
    if (!this._bodyEl) return;

    if (this._entries.length === 0) {
      this._bodyEl.innerHTML = `
        <div style="padding:40px;text-align:center;color:var(--text-muted);
                    font-family:var(--font-mono);font-size:11px;">
          <div style="font-size:28px;margin-bottom:12px;opacity:0.3">\uD83D\uDCCB</div>
          No log entries yet.<br>
          <span style="font-size:9px;color:var(--text-dim)">Run the factory to generate a log.</span>
        </div>`;
      return;
    }

    const prevIdx = Math.min(this._selectedIdx ?? 0, this._entries.length - 1);

    this._bodyEl.style.display       = 'flex';
    this._bodyEl.style.flexDirection = 'column';
    this._bodyEl.style.overflow      = 'hidden';

    this._bodyEl.innerHTML = `
      <div class="runlog-toolbar">
        <span class="runlog-count">${this._entries.length} block${this._entries.length !== 1 ? 's' : ''} logged</span>
        <button class="runlog-export-btn" id="af-runlog-export">\u2B07 Export JSON</button>
        <button class="runlog-copy-btn"   id="af-runlog-copy">\u29C9 Copy text</button>
      </div>
      <div class="runlog-layout">
        <div class="runlog-sidebar">
          <div class="runlog-sidebar-scroll" id="af-runlog-sidebar-scroll">
            ${this._entries.map((e, i) => this._renderListItem(e, i)).join('')}
          </div>
        </div>
        <div class="runlog-detail" id="af-runlog-detail">
          <div class="runlog-detail-empty">\u2190 Select a block to inspect</div>
        </div>
      </div>`;

    const detailEl = this._bodyEl.querySelector('#af-runlog-detail');

    this._bodyEl.querySelectorAll('.runlog-list-item').forEach(item => {
      item.addEventListener('click', () => {
        this._bodyEl.querySelectorAll('.runlog-list-item').forEach(r => r.classList.remove('active'));
        item.classList.add('active');
        const idx = parseInt(item.dataset.idx, 10);
        this._selectedIdx = idx;
        this._showDetail(this._entries[idx], detailEl);
      });
    });

    const itemEls = this._bodyEl.querySelectorAll('.runlog-list-item');
    if (itemEls[prevIdx]) {
      itemEls[prevIdx].classList.add('active');
      itemEls[prevIdx].scrollIntoView({ block: 'nearest' });
    }
    this._selectedIdx = prevIdx;
    this._showDetail(this._entries[prevIdx], detailEl);

    this._bodyEl.querySelector('#af-runlog-export')?.addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(this._entries, null, 2)], { type: 'application/json' });
      const a    = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob), download: `factory-log-${Date.now()}.json`,
      });
      a.click();
    });

    this._bodyEl.querySelector('#af-runlog-copy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(this._toText()).then(() =>
        Bus.emit('ui:flash', { message: '\u29C9 Log copied', type: 'success' })
      );
    });
  }

  // ── Left panel: compact block list item ─────────────────────

  _renderListItem(e, idx) {
    const statusColor = e.status === 'error' ? 'var(--accent-red)'
                      : e.status === 'done'  ? 'var(--accent-green)'
                      : 'var(--text-muted)';
    const prepBadge = !e.prep ? ''
      : e.prep.skipped
        ? `<span class="runlog-badge skipped">skip</span>`
        : (() => {
            const ok  = e.prep.retrieved?.length || 0;
            const bad = e.prep.invalidAddresses?.length || 0;
            const cls = bad > 0 ? 'runlog-badge prep-warn' : 'runlog-badge prep-ok';
            return `<span class="${cls}">${ok}\u2193${bad > 0 ? ` ${bad}\u2717` : ''}</span>`;
          })();

    return `
      <div class="runlog-list-item" data-idx="${idx}">
        <div class="runlog-item-head">
          <span class="runlog-item-name">${_esc(e.blockName)}</span>
        </div>
        <div class="runlog-item-body">
          <div class="runlog-item-row">
            <span style="color:${statusColor};font-size:14px;flex-shrink:0">\u25CF</span>
            <span class="runlog-item-id">${e.blockId}</span>
            <span class="runlog-item-dur">${e.duration_ms}ms</span>
            ${e.iteration > 0 ? `<span class="runlog-badge iter">iter${e.iteration}</span>` : ''}
            ${prepBadge}
          </div>
        </div>
      </div>`;
  }

  // ── Right panel: full detail for selected entry ──────────────

  _showDetail(e, detailEl) {
    if (!detailEl || !e) return;

    const statusColor = e.status === 'error' ? 'var(--accent-red)'
                      : e.status === 'done'  ? 'var(--accent-green)'
                      : 'var(--text-muted)';

    const prepBadge = !e.prep ? ''
      : e.prep.skipped
        ? `<span class="runlog-badge skipped">prep skipped: ${_esc(e.prep.skipReason)}</span>`
        : (() => {
            const ok  = e.prep.retrieved?.length || 0;
            const bad = e.prep.invalidAddresses?.length || 0;
            const label = ok > 0
              ? `prep: ${ok} retrieved${bad > 0 ? `, ${bad} invalid` : ''}`
              : bad > 0 ? `prep: ${bad} invalid addr` : 'prep: nothing retrieved';
            const cls = bad > 0 ? 'runlog-badge prep-warn' : 'runlog-badge prep-ok';
            return `<span class="${cls}">${label}</span>`;
          })();

    detailEl.innerHTML = `
      <div class="runlog-detail-head">
        <span style="color:${statusColor};font-size:13px;flex-shrink:0">\u25CF</span>
        <span class="runlog-detail-name">${_esc(e.blockName)}</span>
        <span class="runlog-detail-id">${e.blockId}</span>
        ${e.iteration > 0 ? `<span class="runlog-badge iter">iter${e.iteration}</span>` : ''}
        ${prepBadge}
        <span class="runlog-detail-dur">${e.duration_ms}ms</span>
      </div>
      <div class="runlog-detail-scroll">
        ${e.goal ? `
          <div class="runlog-field">
            <span class="runlog-field-label">Goal</span>
            <span class="runlog-field-value goal">${_esc(e.goal)}</span>
          </div>` : ''}

        ${_renderSection('Direct inputs (wired via pipeline)',
          _renderKV(e.directInputs, 300))}

        ${e.prep ? _renderSection(
            e.prep.skipped
              ? `\u23ED Preparation \u2014 skipped (${e.prep.skipReason})`
              : `\uD83D\uDD0D Preparation \u2014 ${e.prep.indexSize} index entr${e.prep.indexSize === 1 ? 'y' : 'ies'} available, ${e.prep.parsedRetrieve.length} retrieved (${e.prep.duration_ms}ms)`,
            e.prep.skipped ? '' : `
              ${_subSection('Prompt sent to prep AI', `<pre class="runlog-pre">${_esc(e.prep.promptSent)}</pre>`)}
              ${_subSection('Raw response from prep AI', `<pre class="runlog-pre resp">${_esc(e.prep.rawResponse)}</pre>`)}
              ${_subSection('Reasoning', `<div class="runlog-reasoning">${_esc(e.prep.reasoning)}</div>`)}
              ${e.prep.retrieved.length > 0
                ? _subSection(`Retrieved context (${e.prep.retrieved.length} items)`,
                    e.prep.retrieved.map(r => `
                      <div class="runlog-retrieved-item">
                        <div class="runlog-retrieved-addr">${_esc(r.address)}</div>
                        <div class="runlog-retrieved-meta">${_esc(r.blockName)} / ${_esc(r.portLabel)} (${r.portType})</div>
                        <pre class="runlog-pre">${_esc(String(r.value).slice(0, 500))}</pre>
                      </div>`).join('')
                  )
                : '<div class="runlog-none">No context retrieved \u2014 direct inputs were sufficient.</div>'
              }
              ${e.prep.invalidAddresses?.length > 0
                ? _subSection(`\u26A0 Invalid addresses (${e.prep.invalidAddresses.length} \u2014 model hallucinated)`,
                    `<div class="runlog-exec-error">${e.prep.invalidAddresses.map(a => _esc(a)).join('<br>')}</div>`)
                : ''
              }`,
            true
          ) : ''}

        ${e.execution ? _renderSection(
            `\u26A1 AI call \u2014 ${_esc(e.execution.model)} (${e.execution.duration_ms}ms)${e.execution.error ? ' \u2717 ERROR' : ''}`,
            `
              ${_subSection('System prompt', `<pre class="runlog-pre">${_esc(e.execution.systemPrompt || '(none)')}</pre>`)}
              ${_subSection('User message sent to AI (includes prep context if any)',
                `<pre class="runlog-pre highlight">${_esc(e.execution.userMessage || '(not captured)')}</pre>`)}
              ${e.execution.error
                ? `<div class="runlog-exec-error">\u2717 ${_esc(e.execution.error)}</div>`
                : _subSection('Response', `<pre class="runlog-pre resp">${_esc(e.execution.response || '(empty)')}</pre>`)
              }`,
            true
          ) : ''}

        ${e.error && !e.execution?.error
          ? `<div class="runlog-exec-error" style="margin:6px 12px;">\u2717 ${_esc(e.error)}</div>`
          : ''}
      </div>`;

    detailEl.querySelectorAll('.runlog-section-head').forEach(head => {
      head.addEventListener('click', () => {
        const body = head.nextElementSibling;
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        head.querySelector('.runlog-chevron').textContent = open ? '\u25B6' : '\u25BC';
      });
    });
  }

  // ── Text export ───────────────────────────────────────────────

  _toText() {
    return this._entries.map(e => {
      const lines = [
        `\u2550\u2550\u2550 ${e.blockName} [${e.blockId}] \u2014 ${e.status} (${e.duration_ms}ms) \u2550\u2550\u2550`,
        e.goal ? `Goal: ${e.goal}` : '',
        '',
        '\u2500\u2500 Direct inputs \u2500\u2500',
        ...Object.entries(e.directInputs || {}).map(([k, v]) => `  ${k}: ${String(v).slice(0, 200)}`),
        '',
      ];

      if (e.prep && !e.prep.skipped) {
        lines.push(
          '\u2500\u2500 Preparation \u2500\u2500',
          `  Index entries available: ${e.prep.indexSize}`,
          `  Prep prompt:\n${e.prep.promptSent.split('\n').map(l => '    ' + l).join('\n')}`,
          `  Raw response: ${e.prep.rawResponse}`,
          `  Reasoning: ${e.prep.reasoning}`,
          `  Retrieved: ${e.prep.parsedRetrieve.join(', ') || '(none)'}`,
          ...e.prep.retrieved.map(r =>
            `    [${r.address}] ${r.blockName}/${r.portLabel}:\n      ${String(r.value).slice(0, 300)}`
          ),
          '',
        );
      } else if (e.prep?.skipped) {
        lines.push(`\u2500\u2500 Preparation skipped: ${e.prep.skipReason} \u2500\u2500`, '');
      }

      if (e.execution) {
        lines.push(
          '\u2500\u2500 AI Call \u2500\u2500',
          `  Model: ${e.execution.model}`,
          `  System: ${(e.execution.systemPrompt || '').slice(0, 200)}`,
          `  User message:\n${(e.execution.userMessage || '').split('\n').map(l => '    ' + l).join('\n')}`,
          e.execution.error ? `  ERROR: ${e.execution.error}` : `  Response: ${(e.execution.response || '').slice(0, 500)}`,
          '',
        );
      }

      return lines.filter(l => l !== undefined).join('\n');
    }).join('\n\n');
  }
}

var FactoryRunLog = new RunLog();


// ═══════════════════════════════════════════════════════════════════════════
// AI FACTORY BUILDER — PORTFOLIO INTEGRATION LAYER
// Handles: render (small mode), expand (full mode), collapse, cleanup,
// topbar integration, and demo pipeline setup.
// ═══════════════════════════════════════════════════════════════════════════

let _afExpanded = false;
let _afOverlay = null;
let _afSmallContainer = null;
let _afWorkspace = null;
let _afFactory = null;
let _afModules = {};          // holds all UI module instances
let _afCleanupFns = [];       // cleanup functions for event listeners
let _afNavBackup = null;      // backup of nav state before expand

// ── Demo Pipeline ────────────────────────────────────────────────────────
function _afLoadDemo(ws) {
  // Clear existing
  ws.blocks.forEach((_, id) => ws.removeBlock(id, false));
  ws.pipelines.forEach((_, id) => ws.removePipeline(id, false));

  // Helper to create a block
  function mkBlock(type, x, y) {
    try {
      const b = new Block({ type, x, y });
      return ws.addBlock(b, false);
    } catch(e) { console.warn('Demo block failed:', type, e); return null; }
  }
  // Helper to create a pipeline
  function mkPipe(fromId, fromPort, toId, toPort) {
    try {
      const p = new Pipeline({ fromBlockId: fromId, fromPortId: fromPort, toBlockId: toId, toPortId: toPort });
      return ws.addPipeline(p, false);
    } catch(e) { console.warn('Demo pipeline failed:', e); return null; }
  }

  // Create demo blocks
  const b1 = mkBlock('input-text', 60, 80);
  if (b1) b1.settings.value = 'Artificial intelligence is transforming how we design and build modern software systems. The future belongs to those who build with intention.';

  const b2 = mkBlock('llm-agent', 360, 30);
  if (b2) b2.settings.systemPrompt = 'Analyze the given text and provide key insights.';

  const b3 = mkBlock('transform', 360, 240);
  if (b3) b3.settings.expression = '`${data.split(" ").length} words, ${data.length} chars`';

  const b4 = mkBlock('template', 660, 200);
  if (b4) b4.settings.template = 'Stats: {{vars}}';

  const b5 = mkBlock('output-display', 660, 30);
  const b6 = mkBlock('output-display', 940, 200);

  // Connect (port IDs must match registry definitions)
  if (b1 && b2) mkPipe(b1.id, 'text', b2.id, 'prompt');
  if (b1 && b3) mkPipe(b1.id, 'text', b3.id, 'data');
  if (b2 && b5) mkPipe(b2.id, 'response', b5.id, 'value');
  if (b3 && b4) mkPipe(b3.id, 'result', b4.id, 'vars');
  if (b4 && b6) mkPipe(b4.id, 'text', b6.id, 'value');

  // Clear undo history after demo setup
  if (ws._history) { ws._history = []; ws._historyIdx = -1; }
}

// ── Build the full factory DOM ───────────────────────────────────────────
function _afBuildDOM(container, isExpanded) {
  container.innerHTML = `
    <div id="af-sidebar" class="${isExpanded ? '' : 'hidden'}">
      <div id="af-sidebar-tabs"></div>
      <div id="af-sidebar-library">
        <div class="library-header">
          <div class="library-title">AI Factory</div>
          <div class="library-search">
            <span class="library-search-icon">&#x1F50D;</span>
            <input type="text" placeholder="Search blocks..." />
          </div>
        </div>
        <div class="library-scroll"></div>
      </div>
    </div>
    <div id="af-workspace-container">
      <div id="af-controls-bar"></div>
      <div id="af-workspace">
        <div id="af-workspace-grid"></div>
        <div id="af-workspace-world">
          <svg id="af-pipeline-layer"></svg>
          <div id="af-block-layer"></div>
        </div>
        <svg id="af-pipeline-drawing" style="position:absolute;inset:0;pointer-events:none;z-index:50;overflow:visible"></svg>
        <div id="af-window-layer"></div>
        <div id="af-minimap-container" class="${isExpanded ? '' : 'hidden'}">
          <canvas id="af-minimap-canvas"></canvas>
          <div id="af-minimap-controls">
            <button id="af-minimap-zoom-in" class="mini-btn">+</button>
            <button id="af-minimap-zoom-out" class="mini-btn">−</button>
          </div>
        </div>
      </div>
      <div id="af-bottom-dock"></div>
      <div id="af-status-bar"></div>
    </div>
  `;
}

// ── Initialize all UI modules ────────────────────────────────────────────
function _afInitModules(ws, factory) {
  const selMgr = new SelectionManager(ws);
  const pipeUI = new PipelineUI(ws, selMgr);
  const blockUI = new BlockUI(ws, selMgr, pipeUI);
  const sidebar = new Sidebar(ws);
  const controls = new Controls(ws, factory);
  const statusBar = new StatusBar(ws, selMgr);
  const minimap = new Minimap(ws);
  const ctxMenu = new ContextMenu(ws, selMgr, blockUI);

  // Use existing singletons for WindowManager, ContextInspector, Tooltip, RunLog
  const winMgr = WinManager;
  const ctxInspector = CtxInspector;
  const tooltip = Tooltip;
  const runLog = FactoryRunLog;

  // Init all
  if (typeof selMgr.init === 'function') selMgr.init();
  pipeUI.init();
  blockUI.init();
  winMgr.init();
  sidebar.init();
  controls.init();
  statusBar.init();
  minimap.init();
  if (typeof ctxInspector.init === 'function') ctxInspector.init();
  ctxMenu.init();
  if (typeof tooltip.init === 'function') tooltip.init();
  if (typeof runLog.init === 'function') runLog.init();

  // Listen for ui:flash events and show temporary notifications
  Bus.on('ui:flash', ({ message, type }) => {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:10000;padding:8px 20px;border-radius:6px;font-family:'Share Tech Mono',monospace;font-size:13px;pointer-events:none;transition:opacity .3s;backdrop-filter:blur(8px);`;
    if (type === 'error') {
      el.style.background = 'rgba(255,61,90,0.15)'; el.style.color = '#ff3d5a'; el.style.border = '1px solid rgba(255,61,90,0.3)';
    } else if (type === 'success') {
      el.style.background = 'rgba(0,255,157,0.1)'; el.style.color = '#00ff9d'; el.style.border = '1px solid rgba(0,255,157,0.2)';
    } else {
      el.style.background = 'rgba(74,122,255,0.12)'; el.style.color = '#4a7aff'; el.style.border = '1px solid rgba(74,122,255,0.25)';
    }
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; }, 2000);
    setTimeout(() => { el.remove(); }, 2400);
  });

  return {
    selMgr, pipeUI, blockUI, winMgr, sidebar,
    controls, statusBar, minimap, ctxInspector,
    ctxMenu, tooltip, runLog
  };
}

// ── Small Mode Render (embedded in project page) ─────────────────────────
function _afRenderSmall(container) {
  _afSmallContainer = container;

  // Create a compact preview of the factory
  const wrap = document.createElement('div');
  wrap.className = 'sim-wrap';
  wrap.innerHTML = `
    <div class="sim-bar">
      <h3 style="display:flex;align-items:center;gap:6px">
        <span style="color:var(--cat-software)">&#x25C6;</span> AI Factory Builder
      </h3>
      <div style="display:flex;gap:4px">
        <button class="btn btn-sm btn-p" id="af-small-run">&#x25B6; Run</button>
        <button class="btn btn-sm" id="af-small-stop">&#x25A0; Stop</button>
        <button class="btn btn-sm" id="af-small-reset">&#x21BA; Reset</button>
        <button class="btn btn-sm" id="af-small-expand" style="font-weight:600;">&#x2922; Expand</button>
      </div>
    </div>
    <div id="af-small-preview" style="width:100%;height:400px;overflow:hidden;position:relative;cursor:grab;"></div>
    <div class="sim-foot" style="justify-content:space-between">
      <span id="af-small-status" style="font-size:11px;color:var(--text-3)">Click &#x2922; Expand to open the full AI Factory Builder</span>
      <span id="af-small-count" style="font-size:10px;color:var(--text-3)"></span>
    </div>
  `;
  container.appendChild(wrap);

  // Build a mini workspace inside the preview
  const preview = wrap.querySelector('#af-small-preview');
  if (!preview) return;
  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  const dk = isDark();

  // Grid background
  preview.style.backgroundColor = dk ? '#141414' : '#f8f8f5';
  preview.style.backgroundImage = `radial-gradient(${dk ? '#252525' : '#e0e0da'} 1px, transparent 1px)`;
  preview.style.backgroundSize = '20px 20px';

  // Initialize workspace and factory
  _afWorkspace = new Workspace();
  _afFactory = FactoryController;

  // Load demo
  _afLoadDemo(_afWorkspace);

  // For small mode, we render a simplified static view of the blocks
  _afRenderSmallBlocks(preview, _afWorkspace, dk);

  // Update count
  const countEl = wrap.querySelector('#af-small-count');
  const updateCount = () => {
    if (countEl) countEl.textContent = `${_afWorkspace.blocks.size} blocks · ${_afWorkspace.pipelines.size} connections`;
  };
  updateCount();

  // Button handlers
  wrap.querySelector('#af-small-expand').addEventListener('click', () => _afExpandToFull());

  wrap.querySelector('#af-small-run').addEventListener('click', () => {
    if (_afFactory.state !== 'running') {
      _afFactory.run(_afWorkspace);
      const statusEl = wrap.querySelector('#af-small-status');
      if (statusEl) statusEl.textContent = 'Running pipeline...';

      Bus.once('factory:completed', () => {
        if (statusEl) statusEl.textContent = 'Pipeline complete';
        _afRenderSmallBlocks(preview, _afWorkspace, isDark());
      });
    }
  });

  wrap.querySelector('#af-small-stop').addEventListener('click', () => {
    _afFactory.stop();
    const statusEl = wrap.querySelector('#af-small-status');
    if (statusEl) statusEl.textContent = 'Stopped';
  });

  wrap.querySelector('#af-small-reset').addEventListener('click', () => {
    _afFactory.stop();
    _afWorkspace.blocks.forEach(b => { b.status = 'idle'; b.results = []; });
    _afRenderSmallBlocks(preview, _afWorkspace, isDark());
    const statusEl = wrap.querySelector('#af-small-status');
    if (statusEl) statusEl.textContent = 'Reset — click ▶ Run or ⤢ Expand';
  });

  // Description section below
  const desc = document.createElement('div');
  desc.className = 'step';
  desc.style.marginTop = '12px';
  desc.innerHTML = `
    <div class="step-num">How it works</div>
    <h4>Directed Acyclic Graph Execution</h4>
    <p>Blocks are nodes in a DAG. Each block executes only when all upstream inputs are resolved. The engine performs a <strong>topological sort</strong> (Kahn's algorithm) to determine execution order, then processes blocks sequentially with async support for AI blocks.</p>
    <div class="math-block">order = topoSort(V, E)    // Kahn's BFS — O(V+E)
for block in order:
  inputs &#8592; gather(upstream connections)
  result &#8592; await block.exec(config, inputs)
  propagate(result &#8594; downstream)</div>
    <p style="margin-top:8px;font-size:12px;color:var(--text-3)">Click <strong>&#x2922; Expand</strong> to open the full factory layout with the industrial interface, floating windows, minimap, and all 30+ block types.</p>
  `;
  container.appendChild(desc);
}

// ── Render simplified blocks in small preview ────────────────────────────
function _afRenderSmallBlocks(preview, ws, dk) {
  // Clear existing
  preview.querySelectorAll('.af-small-block, .af-small-svg').forEach(el => el.remove());

  const CAT_COLORS = {
    'AI Agents': '#f472b6', 'Input / Output': '#4ade80', 'Logic': '#fb923c',
    'Data': '#818cf8', 'Flow Control': '#34d399', 'Utilities': '#fbbf24'
  };

  // Render connections (SVG)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('af-small-svg');
  svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;';
  preview.appendChild(svg);

  // Render blocks
  ws.blocks.forEach(b => {
    const typeDef = BlockRegistry.get(b.type);
    if (!typeDef) return;
    const cat = typeDef.category || 'Input / Output';
    const col = CAT_COLORS[cat] || '#888';

    const el = document.createElement('div');
    el.classList.add('af-small-block');
    el.style.cssText = `position:absolute;left:${b.x}px;top:${b.y}px;width:176px;border-radius:8px;font-size:11px;user-select:none;border:1.5px solid ${dk ? '#292524' : '#d6d3d1'};background:${dk ? '#1a1a1a' : '#fff'};box-shadow:${dk ? '0 2px 8px rgba(0,0,0,.3)' : '0 1px 4px rgba(0,0,0,.06)'};`;

    // Status-based styling
    if (b.status === 'done') {
      el.style.borderColor = dk ? '#4ade80' : '#16a34a';
      el.style.boxShadow = `0 0 8px ${dk ? '#4ade8020' : '#16a34a20'}`;
    } else if (b.status === 'running') {
      el.style.borderColor = dk ? '#fbbf24' : '#d97706';
      el.style.boxShadow = `0 0 14px ${dk ? '#fbbf2430' : '#d9770630'}`;
    } else if (b.status === 'error') {
      el.style.borderColor = dk ? '#f87171' : '#dc2626';
    }

    // Header
    const hd = document.createElement('div');
    hd.style.cssText = `display:flex;align-items:center;gap:5px;padding:5px 8px;border-bottom:1px solid ${dk ? '#292524' : '#e7e5e4'};`;
    const icon = document.createElement('span');
    icon.style.cssText = `width:18px;height:18px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff;background:${col};flex-shrink:0;font-weight:700;`;
    icon.textContent = typeDef.icon || '?';
    const name = document.createElement('span');
    name.style.cssText = `flex:1;font-weight:600;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:${dk ? '#e7e5e4' : '#1c1917'};`;
    name.textContent = b.name || typeDef.name;
    hd.append(icon, name);
    el.appendChild(hd);

    // Ports
    const bd = document.createElement('div');
    bd.style.cssText = 'padding:4px 0;';

    const allPorts = [...(b.ports?.inputs || []), ...(b.ports?.outputs || [])];
    allPorts.forEach(p => {
      const isOut = p.direction === 'out';
      const row = document.createElement('div');
      row.style.cssText = `display:flex;align-items:center;gap:4px;padding:1px 8px;font-size:9px;color:${dk ? '#a8a29e' : '#78716c'};${isOut ? 'flex-direction:row-reverse;' : ''}`;
      const dot = document.createElement('div');
      dot.style.cssText = `width:9px;height:9px;border-radius:50%;border:2px solid ${dk ? '#525252' : '#a8a29e'};background:${dk ? '#262626' : '#fff'};flex-shrink:0;${isOut ? 'margin-right:-13px' : 'margin-left:-13px'};`;
      dot.dataset.blockId = b.id;
      dot.dataset.portId = p.id;
      dot.dataset.isOut = isOut ? '1' : '0';
      const lbl = document.createElement('span');
      lbl.textContent = p.label;
      row.append(dot, lbl);
      bd.appendChild(row);
    });

    // Result preview
    if (b.results && b.results.length > 0) {
      const lastResult = b.results[b.results.length - 1];
      const firstVal = lastResult ? Object.values(lastResult)[0] : null;
      if (firstVal !== undefined && firstVal !== null) {
        const res = document.createElement('div');
        res.style.cssText = `margin:3px 8px 2px;padding:4px 5px;border-radius:4px;font-size:9px;font-family:'JetBrains Mono',monospace;word-break:break-word;max-height:56px;overflow-y:auto;line-height:1.4;background:${dk ? '#052e16' : '#f0fdf4'};color:${dk ? '#4ade80' : '#16a34a'};`;
        res.textContent = String(firstVal).slice(0, 200);
        bd.appendChild(res);
      }
    }

    el.appendChild(bd);
    preview.appendChild(el);
  });

  // Render connection lines
  ws.pipelines.forEach(pipe => {
    const fromBlock = ws.blocks.get(pipe.fromBlockId);
    const toBlock = ws.blocks.get(pipe.toBlockId);
    if (!fromBlock || !toBlock) return;

    // Approximate port positions
    const fromX = fromBlock.x + 176;
    const fromY = fromBlock.y + 30;
    const toX = toBlock.x;
    const toY = toBlock.y + 30;
    const dx = Math.max(Math.abs(toX - fromX) * 0.5, 40);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${fromX},${fromY} C${fromX + dx},${fromY} ${toX - dx},${toY} ${toX},${toY}`);
    path.setAttribute('stroke', dk ? '#525252' : '#b8b8b8');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');

    // Color based on source block status
    if (fromBlock.status === 'done') {
      path.setAttribute('stroke', dk ? '#4ade80' : '#16a34a');
      path.setAttribute('stroke-width', '2');
    }

    svg.appendChild(path);
  });
}

// ── Expand to Full Mode ──────────────────────────────────────────────────
function _afExpandToFull() {
  if (_afExpanded) return;
  _afExpanded = true;

  // Backup nav state
  const nav = document.getElementById('nav');
  const navLinks = nav.querySelector('.nav-links');
  const themeToggle = document.getElementById('theme-toggle');
  _afNavBackup = {
    linksDisplay: navLinks.style.display,
    navBg: nav.style.background
  };

  // Modify nav for expanded mode
  navLinks.style.display = 'none';
  nav.style.background = '#0d1016';
  nav.style.borderBottomColor = '#1c2436';
  nav.querySelector('.nav-logo').style.color = '#c0ccE0';
  if (themeToggle) themeToggle.style.display = 'none';

  // Add back button to nav
  const backBtn = document.createElement('button');
  backBtn.id = 'af-nav-back';
  backBtn.style.cssText = `background:none;border:1px solid #273248;border-radius:4px;color:#8090b0;cursor:pointer;padding:4px 12px;font-family:'Share Tech Mono','Courier New',monospace;font-size:13px;transition:all .15s;margin-left:12px;`;
  backBtn.textContent = '\u2199 Collapse';
  backBtn.addEventListener('click', _afCollapseToSmall);
  backBtn.addEventListener('mouseenter', () => { backBtn.style.borderColor = '#4a7aff'; backBtn.style.color = '#e4eeff'; });
  backBtn.addEventListener('mouseleave', () => { backBtn.style.borderColor = '#273248'; backBtn.style.color = '#8090b0'; });
  nav.querySelector('.nav-logo').after(backBtn);

  // Hide main content and footer
  document.getElementById('app').style.display = 'none';
  const footer = document.getElementById('footer');
  if (footer) footer.style.display = 'none';

  // Create full-page overlay
  const overlay = document.createElement('div');
  overlay.id = 'af-overlay';
  overlay.className = 'af-root';
  overlay.style.cssText = 'position:fixed;top:54px;left:0;right:0;bottom:0;z-index:999;display:flex;overflow:hidden;';
  _afOverlay = overlay;

  // Build the full factory DOM inside the overlay
  _afBuildDOM(overlay, true);
  document.body.appendChild(overlay);

  // Initialize workspace if not already
  if (!_afWorkspace) {
    _afWorkspace = new Workspace();
    _afFactory = FactoryController;
    _afLoadDemo(_afWorkspace);
  }

  // Initialize all UI modules
  _afModules = _afInitModules(_afWorkspace, _afFactory);

  // Trigger initial render
  Bus.emit('workspace:rebuilt', {});

  // Prevent body scroll
  document.body.style.overflow = 'hidden';

  // Keyboard handler for Escape
  const escHandler = (e) => {
    if (e.key === 'Escape' && _afExpanded) _afCollapseToSmall();
  };
  document.addEventListener('keydown', escHandler);
  _afCleanupFns.push(() => document.removeEventListener('keydown', escHandler));
}

// ── Collapse to Small Mode ───────────────────────────────────────────────
function _afCollapseToSmall() {
  if (!_afExpanded) return;
  _afExpanded = false;

  // Destroy UI modules
  if (_afModules) {
    Object.values(_afModules).forEach(m => { if (m && typeof m.destroy === 'function') m.destroy(); });
    _afModules = {};
  }

  // Clear all Bus listeners to prevent leaks from UI modules
  Bus._listeners = {};

  // Re-register the chat:completed handler since we cleared all listeners
  Bus.on('chat:completed', ({ blockId, messages }) =>
    FactoryController.chatCompleted(blockId, messages)
  );

  // Remove overlay (this removes all DOM elements and their listeners)
  if (_afOverlay) {
    _afOverlay.remove();
    _afOverlay = null;
  }

  // Restore nav
  const nav = document.getElementById('nav');
  const navLinks = nav.querySelector('.nav-links');
  const themeToggle = document.getElementById('theme-toggle');
  const backBtn = document.getElementById('af-nav-back');
  if (backBtn) backBtn.remove();
  if (_afNavBackup) {
    navLinks.style.display = _afNavBackup.linksDisplay || '';
    nav.style.background = '';
    nav.style.borderBottomColor = '';
    nav.querySelector('.nav-logo').style.color = '';
    if (themeToggle) themeToggle.style.display = '';
    _afNavBackup = null;
  }

  // Show main content and footer
  document.getElementById('app').style.display = '';
  const footer = document.getElementById('footer');
  if (footer) footer.style.display = '';

  // Restore body scroll
  document.body.style.overflow = '';

  // Re-render small preview if container still exists
  if (_afSmallContainer) {
    const preview = _afSmallContainer.querySelector('#af-small-preview');
    if (preview) {
      const dk = document.documentElement.getAttribute('data-theme') === 'dark';
      _afRenderSmallBlocks(preview, _afWorkspace, dk);
    }
    const statusEl = _afSmallContainer.querySelector('#af-small-status');
    if (statusEl) statusEl.textContent = 'Collapsed — click ⤢ Expand to reopen';
    const countEl = _afSmallContainer.querySelector('#af-small-count');
    if (countEl) countEl.textContent = `${_afWorkspace.blocks.size} blocks · ${_afWorkspace.pipelines.size} connections`;
  }

  // Run cleanup functions
  _afCleanupFns.forEach(fn => fn());
  _afCleanupFns = [];
}

// ── Render entry point (called by ProjectRegistry) ───────────────────────
function _afRender(container) {
  _afRenderSmall(container);
}

// ── Cleanup (called on route change) ─────────────────────────────────────
function _afCleanup() {
  // Collapse if expanded
  if (_afExpanded) _afCollapseToSmall();

  // Destroy workspace and factory
  if (_afFactory) { _afFactory.stop(); }
  if (_afModules) {
    Object.values(_afModules).forEach(m => { if (m && typeof m.destroy === 'function') m.destroy(); });
    _afModules = {};
  }

  // Reset all state
  _afWorkspace = null;
  _afFactory = null;
  _afSmallContainer = null;
  _afOverlay = null;
  _afExpanded = false;

  // Run cleanup functions
  _afCleanupFns.forEach(fn => fn());
  _afCleanupFns = [];

  // Ensure body state is clean
  document.body.style.overflow = '';

  // Clear bus listeners
  Bus._listeners = {};
}

// ── Register with portfolio ──────────────────────────────────────────────
ProjectRegistry.register('ai-factory', _afRender, _afCleanup);

})();
