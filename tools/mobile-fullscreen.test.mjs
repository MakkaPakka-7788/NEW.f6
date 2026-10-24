import test from 'node:test';
import assert from 'node:assert/strict';
import {installMobileFullscreen, MOBILE_FULLSCREEN_CSS, MOBILE_FULLSCREEN_BUTTON_SELECTOR} from './mobile-fullscreen.mjs';

class Events {
  listeners = new Map();
  addEventListener(type, fn, options) {
    const capture = options === true || options?.capture === true;
    const rows = this.listeners.get(type) || [];
    if (!rows.some(row => row.fn === fn && row.capture === capture)) rows.push({fn, capture, once: options?.once});
    this.listeners.set(type, rows);
  }
  removeEventListener(type, fn, options) {
    const capture = options === true || options?.capture === true;
    this.listeners.set(type, (this.listeners.get(type) || []).filter(row => row.fn !== fn || row.capture !== capture));
  }
  emit(type, values = {}) {
    const event = {type, target: this, button: 0, defaultPrevented: false, stopped: false,
      preventDefault() {this.defaultPrevented = true;}, stopPropagation() {this.stopped = true;},
      stopImmediatePropagation() {this.stopped = true;}, ...values};
    for (const row of [...(this.listeners.get(type) || [])].sort((a, b) => Number(b.capture) - Number(a.capture))) {
      row.fn(event); if (row.once) this.removeEventListener(type, row.fn, row.capture);
      if (event.stopped) break;
    }
    return event;
  }
  listenerCount() {return [...this.listeners.values()].reduce((sum, rows) => sum + rows.length, 0);}
}
class Style {
  values = new Map();
  setProperty(name, value, priority = '') {this.values.set(name, [value, priority]);}
  getPropertyValue(name) {return this.values.get(name)?.[0] || '';}
  getPropertyPriority(name) {return this.values.get(name)?.[1] || '';}
  removeProperty(name) {this.values.delete(name);}
}
class Element extends Events {
  constructor(tag, ownerDocument) {
    super(); this.tagName = tag.toUpperCase(); this.ownerDocument = ownerDocument;
    this.attributes = new Map(); this.childNodes = []; this.parentNode = null; this.style = new Style();
    this.classes = new Set();
    this.classList = {add: value => this.classes.add(value), remove: value => this.classes.delete(value), contains: value => this.classes.has(value)};
  }
  get className() {return [...this.classes].join(' ');}
  set className(value) {this.classes = new Set(value.split(/\s+/).filter(Boolean));}
  get isConnected() {return this === this.ownerDocument.documentElement || Boolean(this.parentNode?.isConnected);}
  setAttribute(name, value) {this.attributes.set(name, String(value));}
  getAttribute(name) {return this.attributes.has(name) ? this.attributes.get(name) : null;}
  hasAttribute(name) {return this.attributes.has(name);}
  removeAttribute(name) {this.attributes.delete(name);}
  append(...nodes) {for (const node of nodes) {node.remove?.(); node.parentNode = this; this.childNodes.push(node);}}
  replaceChildren(...nodes) {for (const node of this.childNodes) node.parentNode = null; this.childNodes = []; this.append(...nodes);}
  remove() {if (this.parentNode) {this.parentNode.childNodes = this.parentNode.childNodes.filter(node => node !== this); this.parentNode = null;}}
  get textContent() {return this.childNodes.map(node => node.textContent).join('');}
  set textContent(text) {this.replaceChildren({textContent: text, parentNode: null});}
  matches(selector) {
    if (selector.includes(',')) return selector.split(',').some(value => this.matches(value));
    if (selector === 'button.button') return this.tagName === 'BUTTON' && this.classList.contains('button');
    if (selector === 'button[data-sq-fullscreen-control]') return this.tagName === 'BUTTON' && this.hasAttribute('data-sq-fullscreen-control');
    if (selector.startsWith('[')) return this.hasAttribute(selector.slice(1, -1));
    if (selector.startsWith('#')) return this.getAttribute('id') === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    return this.tagName === selector.toUpperCase();
  }
  closest(selector) {return this.matches(selector) ? this : this.parentNode?.closest?.(selector) || null;}
  querySelectorAll(selector) {
    return this.childNodes.flatMap(node => node instanceof Element ? [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)] : []);
  }
  querySelector(selector) {return this.querySelectorAll(selector)[0] || null;}
  focus(options) {this.ownerDocument.activeElement = this; this.focusOptions = options;}
}
function fixture({mobile = false, ios = false, supported = false, permitted = true, loading = false, embedded = false, electron = false, fillsViewport = false} = {}) {
  const document = new Events();
  document.createElement = tag => new Element(tag, document);
  document.documentElement = document.createElement('html'); document.head = document.createElement('head');
  const body = document.createElement('body'); document.documentElement.append(document.head, body);
  document.body = loading ? null : body; document.readyState = loading ? 'loading' : 'complete';
  document.querySelectorAll = selector => document.documentElement.querySelectorAll(selector);
  document.querySelector = selector => document.documentElement.querySelector(selector);
  document.activeElement = body; document.fullscreenEnabled = permitted;
  const window = new Events(), frames = new Map(), timers = new Map(), observers = [];
  let id = 0, requests = 0, exits = 0;
  Object.assign(window, {navigator: {userAgent: ios ? 'iPhone Safari' : 'Mock browser', maxTouchPoints: mobile ? 5 : 0},
    innerWidth: 430, innerHeight: 932, scrollX: 12, scrollY: 345,
    matchMedia: query => ({matches: query === '(pointer: coarse)' && mobile}),
    requestAnimationFrame: fn => {frames.set(++id, fn); return id;}, cancelAnimationFrame: key => frames.delete(key),
    setTimeout: fn => {timers.set(++id, fn); return id;}, clearTimeout: key => timers.delete(key),
    scrollTo: value => {window.restoredScroll = value;},
    MutationObserver: class {constructor(callback) {this.callback = callback; observers.push(this);} observe() {} disconnect() {this.disconnected = true;}}});
  window.self = window; window.top = embedded ? {} : window; if (electron) window.electron = {};
  window.visualViewport = Object.assign(new Events(), {width: 430, height: 860, offsetTop: 0, offsetLeft: 0});
  if (fillsViewport) body.getBoundingClientRect = () => ({left: 0, top: 0, right: 430, bottom: 932});
  if (supported) body.requestFullscreen = async () => {requests++; document.fullscreenElement = body; document.emit('fullscreenchange');};
  document.exitFullscreen = async () => {exits++; document.fullscreenElement = null; document.emit('fullscreenchange');};
  const button = document.createElement('button'); button.className = 'button';
  const icon = document.createElement('img'); icon.setAttribute('src', 'images/fullscreen.svg');
  button.append(icon, {textContent: ' Fullscreen', parentNode: null}); body.append(button); button.focus();
  const install = () => installMobileFullscreen({window, document});
  return {window, document, body, button, icon, install, observers, timers,
    requests: () => requests, exits: () => exits,
    click: target => document.emit('click', {target: target || button}),
    flush: () => {for (const [key, fn] of [...frames]) {frames.delete(key); fn();}},
    mutate: () => observers.filter(value => !value.disconnected).forEach(value => value.callback([{target: body, addedNodes: [...body.childNodes], removedNodes: []}])),
    ready: () => {document.body = body; document.readyState = 'complete'; document.emit('DOMContentLoaded');},
    controls: () => document.querySelector('[data-sq-expanded-controls]')};
}
const settle = async () => {await Promise.resolve(); await Promise.resolve();};

test('unsupported iPhone labels Expand game, captures the icon click, and offers honest accessible presentation controls', async () => {
  const f = fixture({mobile: true, ios: true, embedded: true}), api = f.install();
  assert.equal(f.button.textContent, 'Expand game (viewport only)'); assert.equal(f.button.getAttribute('aria-label'), 'Expand game (viewport only)');
  let nativeClicks = 0; f.document.addEventListener('click', () => nativeClicks++);
  const click = f.click(f.button); await settle();
  assert.equal(click.defaultPrevented, true); assert.equal(nativeClicks, 0); assert.equal(api.mode, 'expanded');
  assert.ok(f.document.documentElement.classList.contains('sq-game-expanded')); assert.ok(f.body.classList.contains('sq-game-expanded'));
  assert.equal(f.controls().getAttribute('role'), 'region'); assert.equal(f.controls().querySelector('p').getAttribute('role'), 'status');
  assert.match(f.controls().textContent, /Viewport-only presentation, not OS fullscreen/);
  assert.match(f.controls().textContent, /stays inside the embedded frame/);
  assert.equal(f.controls().querySelector('summary').textContent, 'Safari tip (optional)');
  assert.equal(f.controls().querySelector('details').hasAttribute('open'), false);
  assert.equal(f.document.activeElement, f.controls().querySelector('button')); assert.equal(f.button.getAttribute('aria-pressed'), 'true');
  api.destroy();
});

test('native-capable mobile uses the browser API and handles native exit without presentation classes', async () => {
  const f = fixture({mobile: true, supported: true}), api = f.install();
  const event = f.click(f.icon); await settle();
  assert.equal(event.defaultPrevented, true); assert.equal(f.requests(), 1); assert.equal(api.mode, 'native'); assert.equal(f.controls(), null);
  assert.equal(f.body.classList.contains('sq-game-expanded'), false);
  assert.equal(await api.exit(), true); assert.equal(f.exits(), 1); assert.equal(api.mode, 'windowed'); api.destroy();
});

test('iPhone Safari with a working native API attempts native fullscreen even when the game already fills its viewport', async () => {
  const f = fixture({mobile: true, ios: true, supported: true, fillsViewport: true}), api = f.install();
  assert.equal(f.button.textContent, ' Fullscreen');
  f.click(f.icon); await settle(); assert.equal(f.requests(), 1); assert.equal(api.mode, 'native');
  assert.equal(f.controls(), null); assert.equal(f.body.classList.contains('sq-game-expanded'), false); api.destroy();
});

test('already-full viewport gets short fullscreen help, never an enlargement claim or body presentation classes', async () => {
  for (const rejected of [false, true]) {
    const f = fixture({mobile: true, ios: true, fillsViewport: true, supported: rejected});
    if (rejected) f.body.requestFullscreen = async () => {throw Error('declined');};
    const api = f.install();
    if (!rejected) assert.equal(f.button.textContent, 'Fullscreen help');
    assert.equal(await api.toggle(f.button), true); assert.equal(api.mode, 'help');
    assert.equal(f.document.documentElement.classList.contains('sq-game-expanded'), false);
    assert.equal(f.body.classList.contains('sq-game-expanded'), false);
    assert.equal(f.controls().querySelector('button').textContent, 'Close fullscreen help');
    assert.match(f.controls().querySelector('p').textContent, /already fills this viewport/);
    assert.match(f.controls().querySelector('p').textContent, /cannot hide browser controls/);
    assert.doesNotMatch(f.controls().textContent, /Expand game|fills this page only/);
    assert.match(f.controls().querySelector('details').textContent, /may use separate storage/);
    assert.match(f.controls().querySelector('details').textContent, /Profiles and local saves may not transfer automatically/);
    const escape = f.document.emit('keydown', {key: 'Escape'});
    assert.equal(escape.defaultPrevented, true); assert.equal(f.controls(), null); assert.equal(f.document.activeElement, f.button);
    assert.equal(f.button.textContent, 'Fullscreen help'); api.destroy();
    assert.equal(f.document.documentElement.style.getPropertyValue('--sq-expanded-height'), '');
  }
});

test('the real game canvas bounds determine whether expansion is useful, including embedded viewport-only help', async () => {
  const f = fixture({embedded: true}), canvas = f.document.createElement('canvas'); canvas.setAttribute('id', 'screen');
  canvas.getBoundingClientRect = () => ({left: 0, top: 0, right: 430, bottom: 932}); f.body.append(canvas);
  const api = f.install(); assert.equal(f.button.textContent, 'Fullscreen help'); await api.toggle();
  assert.equal(api.mode, 'help'); assert.match(f.controls().textContent, /stays inside the embedded frame/);
  assert.equal(f.body.classList.contains('sq-game-expanded'), false); api.destroy();
});

test('working desktop native click is not prevented, stopped, relabeled, or requested a second time', async () => {
  const f = fixture({supported: true}), api = f.install(); let nativeClicks = 0;
  f.document.addEventListener('click', () => {nativeClicks++; void f.body.requestFullscreen();});
  const event = f.click(f.icon); await settle();
  assert.equal(event.defaultPrevented, false); assert.equal(event.stopped, false); assert.equal(nativeClicks, 1);
  assert.equal(f.requests(), 1); assert.equal(api.mode, 'native'); assert.equal(f.button.textContent, ' Fullscreen'); assert.equal(f.controls(), null);
  api.destroy(); assert.equal(f.document.fullscreenElement, f.body, 'cleanup must not exit unrelated native fullscreen');
});

test('rejected promise and synchronous native errors become fallback without an unhandled rejection', async () => {
  for (const request of [() => Promise.reject(new TypeError('not permitted')), () => {throw new Error('unavailable');}]) {
    const f = fixture({mobile: true, supported: true}); f.body.requestFullscreen = request; const api = f.install();
    assert.equal(await api.toggle(f.button), true); assert.equal(api.mode, 'expanded'); assert.equal(f.controls().querySelector('button').textContent, 'Exit expanded view');
    api.destroy();
  }
});

test('rejected capture-hook request settles safely without reaching the existing native listener', async () => {
  const f = fixture({mobile: true, supported: true}); let calls = 0, nativeClicks = 0;
  f.body.requestFullscreen = async () => {calls++; throw Error('NotAllowedError');};
  const api = f.install(); f.document.addEventListener('click', () => nativeClicks++);
  assert.equal(f.click(f.icon).defaultPrevented, true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls, 1); assert.equal(nativeClicks, 0); assert.equal(api.mode, 'expanded'); api.destroy();
});

test('a native error event followed by promise rejection mounts fallback once and duplicate clicks do not repeat a pending request', async () => {
  const f = fixture({mobile: true, supported: true}); let reject, calls = 0;
  f.body.requestFullscreen = () => {calls++; return new Promise((resolve, fail) => {reject = fail;});};
  const api = f.install(), work = api.toggle(f.button); f.click(); assert.equal(calls, 1);
  f.document.emit('fullscreenerror', {target: f.body}); reject(Error('denied'));
  await work; assert.equal(api.mode, 'expanded'); assert.equal(f.document.querySelectorAll('[data-sq-expanded-controls]').length, 1); api.destroy();
});

test('desktop fullscreenerror triggers fallback only for a recent matching native button request', async () => {
  const f = fixture({supported: true}), api = f.install();
  f.document.emit('fullscreenerror', {target: f.body}); assert.equal(api.mode, 'windowed');
  assert.equal(f.click().defaultPrevented, false);
  f.document.emit('fullscreenerror', {target: f.button}); assert.equal(f.controls(), null);
  f.document.emit('fullscreenerror', {target: f.body}); assert.equal(api.mode, 'expanded');
  await api.exit(); assert.equal(f.button.textContent, 'Expand game (viewport only)');
  assert.equal(f.click().defaultPrevented, true); assert.equal(api.mode, 'expanded'); api.destroy();
});

test('explicit policy denial avoids native request; Electron and unrelated buttons remain game-owned', async () => {
  const f = fixture({supported: true, permitted: false}), api = f.install(); f.click(); await settle();
  assert.equal(f.requests(), 0); assert.equal(api.mode, 'expanded'); api.destroy();
  const electron = fixture({electron: true, mobile: true}), native = electron.install();
  assert.equal(electron.click().defaultPrevented, false); assert.equal(await native.toggle(), false); assert.equal(electron.controls(), null); native.destroy();
  const other = fixture(), otherAPI = other.install(), button = other.document.createElement('button'); button.className = 'button'; other.body.append(button);
  assert.equal(other.click(button).defaultPrevented, false); assert.equal(otherAPI.mode, 'windowed'); otherAPI.destroy();
});

test('exit button and Escape restore focus, scroll, existing classes and exact custom-property priorities', async () => {
  for (const exit of ['button', 'escape', 'destroy']) {
    const f = fixture(), html = f.document.documentElement;
    html.classList.add('existing-html'); f.body.classList.add('existing-body');
    html.style.setProperty('--sq-expanded-height', '123px', 'important');
    f.button.setAttribute('aria-label', 'Original action'); f.button.setAttribute('title', 'Original title');
    const api = f.install(); await api.toggle(f.button);
    if (exit === 'button') f.controls().querySelector('button').emit('click');
    if (exit === 'escape') assert.equal(f.document.emit('keydown', {key: 'Escape'}).defaultPrevented, true);
    if (exit === 'destroy') api.destroy();
    assert.equal(f.controls(), null); assert.equal(html.classList.contains('sq-game-expanded'), false); assert.equal(f.body.classList.contains('sq-game-expanded'), false);
    assert.ok(html.classList.contains('existing-html')); assert.ok(f.body.classList.contains('existing-body'));
    assert.equal(html.style.getPropertyValue('--sq-expanded-height'), '123px'); assert.equal(html.style.getPropertyPriority('--sq-expanded-height'), 'important');
    assert.equal(html.style.getPropertyValue('--sq-expanded-width'), ''); assert.equal(f.document.activeElement, f.button);
    assert.deepEqual(f.window.restoredScroll, {left: 12, top: 345, behavior: 'instant'});
    api.destroy(); assert.equal(f.button.textContent, ' Fullscreen'); assert.equal(f.button.querySelector('img'), f.icon);
    assert.equal(f.button.getAttribute('aria-label'), 'Original action'); assert.equal(f.button.getAttribute('title'), 'Original title');
    assert.equal(f.button.hasAttribute('aria-pressed'), false);
  }
});

test('portrait/landscape visualViewport changes update only scoped CSS variables and cleanup cancels work', async () => {
  const f = fixture(), api = f.install(); await api.toggle();
  assert.equal(f.document.documentElement.style.getPropertyValue('--sq-expanded-height'), '860px');
  Object.assign(f.window.visualViewport, {width: 932, height: 380, offsetTop: 7, offsetLeft: 4});
  f.window.emit('orientationchange'); f.window.visualViewport.emit('resize'); f.flush();
  assert.equal(f.document.documentElement.style.getPropertyValue('--sq-expanded-width'), '932px');
  assert.equal(f.document.documentElement.style.getPropertyValue('--sq-expanded-height'), '380px');
  assert.equal(f.document.documentElement.style.getPropertyValue('--sq-expanded-top'), '7px');
  f.window.visualViewport.emit('scroll'); api.destroy(); f.flush();
  assert.equal(f.document.documentElement.style.getPropertyValue('--sq-expanded-width'), '');
  assert.equal(f.window.listenerCount(), 0); assert.equal(f.window.visualViewport.listenerCount(), 0); assert.equal(f.document.listenerCount(), 0);
});

test('install before body, repeated install, dynamic button mount, destroy and reinstall are safe', async () => {
  const f = fixture({loading: true}), api = f.install();
  assert.equal(f.install(), api); assert.equal(f.document.querySelectorAll('style').length, 0); assert.equal(await api.toggle(), false);
  f.ready(); assert.equal(f.document.querySelectorAll('style').length, 1);
  const dynamic = f.document.createElement('button'); dynamic.setAttribute('data-sq-fullscreen-control', ''); dynamic.textContent = 'Fullscreen'; f.body.append(dynamic); f.mutate();
  assert.equal(dynamic.textContent, 'Expand game (viewport only)'); f.click(dynamic); await settle(); assert.equal(api.mode, 'expanded');
  api.destroy(); api.destroy(); assert.equal(f.document.querySelectorAll('style').length, 0); assert.equal(dynamic.textContent, 'Fullscreen');
  assert.ok(f.observers.every(observer => observer.disconnected));
  const replacement = f.install(); assert.notEqual(replacement, api); replacement.destroy();
  assert.equal(await api.toggle(), false); assert.equal(api.mode, 'destroyed');
});

test('pending requests and prefixed void APIs cannot reopen fallback after destroy', async () => {
  const f = fixture({mobile: true, supported: true}); let reject;
  f.body.requestFullscreen = () => new Promise((resolve, rejectRequest) => {reject = rejectRequest;});
  const api = f.install(), pending = api.toggle(); api.destroy(); reject(Error('late denial'));
  assert.equal(await pending, false); assert.equal(f.controls(), null); assert.equal(f.document.listenerCount(), 0);
  const prefixed = fixture({mobile: true}); prefixed.body.webkitRequestFullscreen = () => {};
  const vendor = prefixed.install(); await vendor.toggle(); assert.equal(vendor.mode, 'native-pending');
  assert.equal(prefixed.timers.size, 1); vendor.destroy(); assert.equal(prefixed.timers.size, 0);
});

test('prefixed native API can succeed asynchronously or fall back after a bounded silent failure', async () => {
  for (const succeeds of [true, false]) {
    const f = fixture({mobile: true}); f.body.webkitRequestFullscreen = () => {};
    const api = f.install(); await api.toggle();
    if (succeeds) {f.document.webkitFullscreenElement = f.body; f.document.emit('webkitfullscreenchange');}
    else for (const fn of [...f.timers.values()]) fn();
    assert.equal(api.mode, succeeds ? 'native' : 'expanded'); assert.equal(f.timers.size, 0); api.destroy();
  }
});

test('destroy before DOM ready leaves no handlers or later mount; HUD-only mutations do not scan controls', async () => {
  const early = fixture({loading: true}), destroyed = early.install(); destroyed.destroy(); early.ready();
  assert.equal(early.document.querySelectorAll('style').length, 0); assert.equal(early.document.listenerCount(), 0);
  const f = fixture(), api = f.install(); let scans = 0;
  const query = f.document.querySelectorAll; f.document.querySelectorAll = selector => {scans++; return query(selector);};
  const hud = f.document.createElement('div'); f.body.append(hud);
  f.observers[0].callback([{target: hud, addedNodes: [{textContent: '00:01'}], removedNodes: []}]);
  assert.equal(scans, 0); api.destroy();
});

test('pagehide cleans presentation; Escape outside presentation does not swallow native game input', async () => {
  const f = fixture(), api = f.install(); assert.equal(f.document.emit('keydown', {key: 'Escape'}).defaultPrevented, false);
  await api.toggle(); f.window.emit('pagehide'); assert.equal(f.controls(), null); assert.equal(api.mode, 'windowed'); api.destroy();
});

test('standalone Safari does not show the optional install tip and CSS guarantees a 44px exit target', async () => {
  const f = fixture({ios: true, mobile: true}); f.window.navigator.standalone = true;
  const api = f.install(); await api.toggle(); assert.equal(f.controls().querySelector('details'), null); api.destroy();
  assert.match(MOBILE_FULLSCREEN_CSS, /\.sq-expanded-exit[\s\S]*min-width: 44px; min-height: 44px/);
  assert.match(MOBILE_FULLSCREEN_CSS, /position: fixed !important/); assert.match(MOBILE_FULLSCREEN_CSS, /safe-area-inset-top/);
  assert.doesNotMatch(MOBILE_FULLSCREEN_CSS, /canvas|touch-action: none|user-scalable/);
  assert.equal(MOBILE_FULLSCREEN_BUTTON_SELECTOR, 'button.button,button[data-sq-fullscreen-control]');
});
