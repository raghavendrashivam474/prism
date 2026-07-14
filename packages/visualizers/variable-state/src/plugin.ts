/**
 * Visualiser plugin contract.
 *
 * Visualisers consume VisualStateSnapshot and produce render models.
 * They must not know about C++, Learning IR internals, or HTTP.
 * They must not contain React components.
 *
 * React components receive render models from visualisers.
 */

import type { VisualStateSnapshot } from "@prism/visual-state-engine";

export interface VisualizerPlugin<TRenderModel = unknown> {
  readonly id: string;
  supports(snapshot: VisualStateSnapshot): boolean;
  buildRenderModel(snapshot: VisualStateSnapshot): TRenderModel;
}

export class VisualizerRegistry {
  private readonly _plugins: Map<string, VisualizerPlugin<unknown>> = new Map();

  register<T>(plugin: VisualizerPlugin<T>): void {
    this._plugins.set(plugin.id, plugin as VisualizerPlugin<unknown>);
  }

  resolve<T>(id: string): VisualizerPlugin<T> | null {
    return (this._plugins.get(id) as VisualizerPlugin<T>) ?? null;
  }

  supportingPlugins(snapshot: VisualStateSnapshot): VisualizerPlugin<unknown>[] {
    return [...this._plugins.values()].filter((p) => p.supports(snapshot));
  }

  registeredIds(): string[] {
    return [...this._plugins.keys()];
  }
}