import { SearchPanel } from "@/components/knowledge/search-panel";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return <SearchPanel initialQuery={q ?? ""} />;
}
