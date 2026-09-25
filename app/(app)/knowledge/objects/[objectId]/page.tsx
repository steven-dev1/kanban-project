import { ObjectDetail } from "@/components/knowledge/object-detail";

export default async function ObjectPage({
  params,
}: {
  params: Promise<{ objectId: string }>;
}) {
  const { objectId } = await params;
  return <ObjectDetail objectId={objectId} />;
}
