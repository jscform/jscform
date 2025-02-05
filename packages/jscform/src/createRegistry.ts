import React from "react";

export let globalRegistry: Registry = {};

export interface Registry {
    [key: string]: React.ElementType;
}
export function createRegistry(registry: Registry) {
    globalRegistry = registry
}
