import { SnippetDetail } from "@/components/knowledge/snippet-detail";

export default async function SnippetPage({
  params,
}: {
  params: Promise<{ snippetId: string }>;
}) {
  const { snippetId } = await params;
  return <SnippetDetail snippetId={snippetId} />;
}
