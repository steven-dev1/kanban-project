import { ObjectsList } from "@/components/knowledge/objects-list";

export default function PackagesPage() {
  return (
    <ObjectsList
      objectTypes={["PACKAGE"]}
      defaultType="PACKAGE"
      title="Packages"
      description="Packages con Specification y Body versionados por separado."
    />
  );
}
