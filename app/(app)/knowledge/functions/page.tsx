import { ObjectsList } from "@/components/knowledge/objects-list";

export default function FunctionsPage() {
  return (
    <ObjectsList
      objectTypes={["FUNCTION"]}
      defaultType="FUNCTION"
      title="Functions"
      description="Funciones almacenadas con sus argumentos y versiones."
    />
  );
}
