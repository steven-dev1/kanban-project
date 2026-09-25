import { EnvironmentsOverview } from "@/components/knowledge/environments-overview";

export default function EnvironmentsPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
        <div>
          <h1 className="text-lg font-semibold">Ambientes</h1>
          <p className="text-sm text-muted-foreground">
            Estado de la documentación por ambiente. Esta información se registra manualmente;
            la aplicación no se conecta a Oracle.
          </p>
        </div>
        <EnvironmentsOverview />
      </div>
    </div>
  );
}
