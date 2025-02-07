export let globalRegistry: Registry = {};

export interface Registry {
    [key: string]: any;
}
export function createRegistry(registry: Registry) {
    globalRegistry = registry
}
