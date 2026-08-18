import { Context, Service } from "@cordisjs/core";
import { Menu } from "electron";

/**
 * host/services/menu.ts
 *
 * MenuService - collects menu items/submenus registered by plugins and rebuilds
 * the application menu (File / Plugins / Help). Plugin commands are listed under
 * "Plugins" via a provider callback installed by the host (main.ts).
 */
export interface MenuEntry {
  label: string;
  click?: () => void;
  submenu?: MenuEntry[];
  type?: string;
  _plugin?: string;
}

declare module "@cordisjs/core" {
  interface Context {
    menu: MenuService;
  }
}

export class MenuService extends Service {
  private items: MenuEntry[] = [];
  private pluginMenuProvider: (() => any[]) | null = null;

  constructor(ctx: Context) {
    super(ctx, "menu");
  }

  /** Called by the host to fill the "Plugins" submenu (plugin commands). */
  setPluginMenuProvider(fn: () => any[]): void {
    this.pluginMenuProvider = fn;
  }

  registerItem(item: MenuEntry, plugin: string): void {
    const tagged = { ...item, _plugin: plugin };
    this.items.push(tagged);
  }

  /** Remove every menu item registered by a plugin (used by the hot-reload loader). */
  clearByPlugin(plugin: string): void {
    this.items = this.items.filter((i) => i._plugin !== plugin);
  }

  registerMenu(label: string, submenu: MenuEntry[], plugin: string): void {
    this.registerItem({ label, submenu }, plugin);
  }

  /** All manually registered menu entries. */
  manualItems(): MenuEntry[] {
    return this.items.slice();
  }

  /** Rebuild the whole application menu. */
  rebuild(): void {
    const template: any[] = [{ label: "File", submenu: [{ role: "quit", label: "Quit" }] }];

    const pluginMenu: any[] = [];
    if (this.pluginMenuProvider) pluginMenu.push(...this.pluginMenuProvider());
    if (this.items.length) {
      if (pluginMenu.length) pluginMenu.push({ type: "separator" });
      pluginMenu.push(...this.items);
    }
    if (pluginMenu.length) template.push({ label: "Plugins", submenu: pluginMenu });

    template.push({
      label: "Help",
      submenu: [
        { role: "reload", label: "Reload" },
        { role: "toggleDevTools", label: "Developer Tools" },
      ],
    });

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }
}
