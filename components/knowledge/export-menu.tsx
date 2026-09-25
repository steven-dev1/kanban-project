"use client";

import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { buildExportName, copyText, downloadTextFile } from "@/lib/knowledge/export";
import { Check, ChevronDown, Download } from "lucide-react";

export interface ExportVariant {
  /** Etiqueta dentro del menú; se omite cuando hay una sola variante. */
  label?: string;
  /** Partes del nombre: NOMBRE_OBJETO_AMBIENTE_FECHA.sql */
  nameParts: (string | null | undefined)[];
  content: string;
}

export function ExportMenu({
  variants,
  copyContent,
  size = "sm",
}: {
  variants: ExportVariant[];
  copyContent?: string;
  size?: "sm" | "md";
}) {
  const { toast } = useToast();
  const single = variants.length === 1;

  async function handleCopy() {
    const text = copyContent ?? variants[0]?.content ?? "";
    const ok = await copyText(text);
    toast(ok ? "Código copiado al portapapeles" : "No se pudo copiar", ok ? "success" : "error");
  }

  function handleDownload(variant: ExportVariant, ext: "sql" | "txt") {
    downloadTextFile(buildExportName(variant.nameParts, ext), variant.content);
    toast(`Exportado ${buildExportName(variant.nameParts, ext)}`);
  }

  return (
    <Dropdown
      trigger={
        <Button variant="outline" size={size}>
          <Download className="h-4 w-4" /> Exportar
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      }
    >
      {(close) => (
        <div className="w-56">
          <DropdownItem
            onClick={() => {
              close();
              handleCopy();
            }}
          >
            <Check className="h-4 w-4" /> Copiar
          </DropdownItem>
          <div className="my-1 h-px bg-border" />
          {variants.map((variant, index) => (
            <div key={`${variant.label ?? "v"}-${index}`}>
              <DropdownItem
                onClick={() => {
                  close();
                  handleDownload(variant, "sql");
                }}
              >
                <Download className="h-4 w-4" />
                {single ? "Exportar .sql" : `${variant.label ?? ""} (.sql)`}
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  close();
                  handleDownload(variant, "txt");
                }}
              >
                <Download className="h-4 w-4" />
                {single ? "Exportar .txt" : `${variant.label ?? ""} (.txt)`}
              </DropdownItem>
            </div>
          ))}
        </div>
      )}
    </Dropdown>
  );
}
