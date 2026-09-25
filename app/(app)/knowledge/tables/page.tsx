import { ObjectsList } from "@/components/knowledge/objects-list";

export default function TablesPage() {
  return (
    <ObjectsList
      objectTypes={["TABLE", "VIEW"]}
      defaultType="TABLE"
      title="Tablas y vistas"
      description="Catálogo de tablas y vistas con su documentación."
    />
  );
}
