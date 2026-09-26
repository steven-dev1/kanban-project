"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true solo tras hidratar en el cliente (seguro para datos del navegador). */
export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
