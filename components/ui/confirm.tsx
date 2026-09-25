"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<
    (ConfirmOptions & { resolve: (value: boolean) => void }) | null
  >(null);

  const confirm = useCallback<ConfirmFn>(
    (options) => new Promise<boolean>((resolve) => setState({ ...options, resolve })),
    [],
  );

  const close = useCallback(
    (value: boolean) => {
      setState((current) => {
        current?.resolve(value);
        return null;
      });
    },
    [],
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title ?? "Confirmar"} size="sm">
        <p className="text-sm text-muted-foreground">{state?.message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => close(false)}>
            {state?.cancelLabel ?? "Cancelar"}
          </Button>
          <Button variant={state?.danger ? "danger" : "primary"} onClick={() => close(true)}>
            {state?.confirmLabel ?? "Confirmar"}
          </Button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
