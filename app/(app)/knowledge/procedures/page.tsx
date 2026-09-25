import { ObjectsList } from "@/components/knowledge/objects-list";

export default function ProceduresPage() {
  return (
    <ObjectsList
      objectTypes={["PROCEDURE"]}
      defaultType="PROCEDURE"
      title="Procedures"
      description="Procedimientos almacenados, con código versionado por ambiente."
    />
  );
}
