export default function TimeEntriesPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Urenregistratie</h1>
        <div className="flex gap-2">
          <button className="btn-primary">
            + Dag toevoegen
          </button>
          <button className="btn-secondary">
            Uren indienen
          </button>
        </div>
      </div>
      
      <div className="card">
        <div className="p-6">
          <p className="text-gray-500 text-center py-8">
            Urenregistratie wordt geïmplementeerd in Fase 3.
          </p>
        </div>
      </div>
    </div>
  )
}
