/**
 * renderer.ts - renderer process UI logic.
 * Talks to the main process through window.plugins (the bridge exposed by preload).
 *
 * NOTE: do not use `plugins` as a variable name - contextBridge already creates a
 * global window.plugins; a collision triggers a SyntaxError. We use pluginList here.
 */
interface Window {
  plugins: any;
}

interface PluginListEntry {
  name: string;
  version: string;
  loaded: boolean;
  reason: string;
  description: string;
  functions: string[];
  commands: { id: string; title: string; description: string }[];
}

const api = (window as any).plugins;

const btnGrid = document.getElementById('plugin-buttons') as HTMLElement;
const resultHead = document.getElementById('result-head') as HTMLElement;
const resultBox = document.getElementById('result-box') as HTMLElement;
const totalPluginsEl = document.getElementById('total-plugins') as HTMLElement;
const totalFunctionsEl = document.getElementById('total-functions') as HTMLElement;
const loadedFunctionsEl = document.getElementById('loaded-functions') as HTMLElement;
const customizedListEl = document.getElementById('customized-list') as HTMLElement;

let pluginList: PluginListEntry[] = [];

/** Render the statistics in the info area */
function renderInfo(): void {
  totalPluginsEl.textContent = String(pluginList.length);

  const totalFunctions = pluginList.reduce(function (sum, p) {
    return sum + (p.functions ? p.functions.length : 0);
  }, 0);
  totalFunctionsEl.textContent = String(totalFunctions);

  const loaded = pluginList.filter(function (p) { return p.loaded; });
  const loadedFunctions = loaded.reduce(function (sum, p) {
    return sum + (p.functions ? p.functions.length : 0);
  }, 0);
  loadedFunctionsEl.textContent = String(loadedFunctions);

  customizedListEl.innerHTML = '';
  if (!loaded.length) {
    customizedListEl.innerHTML = '<li class="muted">No functions are enabled.</li>';
    return;
  }
  loaded.forEach(function (p) {
    const funcs = p.functions && p.functions.length ? p.functions : [];
    const li = document.createElement('li');
    li.innerHTML =
      '<span class="plg">' + escapeHtml(p.name) + '</span>' +
      (funcs.length ? ': ' + funcs.map(escapeHtml).join(', ') : ' (no functions declared)');
    customizedListEl.appendChild(li);
  });
}

/** Build the top function buttons: iterate loaded plugins, one button per command */
function renderButtons(): void {
  btnGrid.innerHTML = '';
  const loaded = pluginList.filter(function (p) { return p.loaded; });

  if (!loaded.length) {
    btnGrid.innerHTML = '<p class="muted">No loaded plugins found.</p>';
    return;
  }

  let made = 0;
  loaded.forEach(function (p) {
    const cmds = p.commands || [];
    if (!cmds.length) return;
    cmds.forEach(function (c) {
      const btn = document.createElement('button');
      btn.className = 'func-btn';
      btn.innerHTML =
        '<span class="fb-plg">' + escapeHtml(p.name) + '</span>' +
        '<span class="fb-title">' + escapeHtml(c.title) + '</span>' +
        (c.description ? '<span class="fb-desc">' + escapeHtml(c.description) + '</span>' : '');
      btn.addEventListener('click', function () { invokeCommand(p, c); });
      btnGrid.appendChild(btn);
      made++;
    });
  });

  if (made === 0) {
    btnGrid.innerHTML =
      '<p class="muted">Loaded plugins have no commands (loaded plugins: ' + loaded.length + ').</p>';
  }
}

/** Click a function button: invoke the command and show the result */
async function invokeCommand(plugin: PluginListEntry, cmd: { id: string; title: string; description: string }): Promise<void> {
  resultHead.textContent = '[' + plugin.name + '] ' + cmd.title;
  resultBox.textContent = 'Invoking ' + cmd.id + ' ...';
  try {
    const res = await api.invoke(cmd.id, { from: 'renderer' });
    resultBox.textContent = JSON.stringify(res, null, 2);
  } catch (e: any) {
    resultBox.textContent = 'Invoke failed: ' + e.message;
  }
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Subscribe to main-process push messages (triggered by the clock-plugin menu item)
if (api && api.on) {
  api.on('clock:menu', function (data: any) {
    resultHead.textContent = 'Main-process push (channel: clock:menu)';
    resultBox.textContent = JSON.stringify(data, null, 2);
  });
}

// Refresh helper used on startup and when the host hot-reloads a plugin.
function refreshPlugins(): void {
  api
    .list()
    .then(function (list: PluginListEntry[]) {
      pluginList = list;
      renderButtons();
      renderInfo();
    })
    .catch(function (e: any) {
      btnGrid.innerHTML = '<p class="muted">Failed to fetch plugins: ' + escapeHtml(e.message) + '</p>';
    });
}

// Hot-reload: the main process pushes this event after a plugin is reloaded.
if (api && api.on) {
  api.on('plugins:reload', function () {
    console.log('[renderer] plugins changed, refreshing UI');
    refreshPlugins();
  });
}

// Startup: fetch the plugin list and render
refreshPlugins();
