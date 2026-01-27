export default function SettingsPage() {
  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Instellingen</h1>
      </div>
      
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Branding */}
        <div className="card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Branding</h2>
            <p className="text-gray-500">
              App instellingen (naam, logo, favicon) worden geïmplementeerd in Fase 0.
            </p>
          </div>
        </div>
        
        {/* Company info */}
        <div className="card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bedrijfsgegevens</h2>
            <p className="text-gray-500">
              Bedrijfsgegevens voor facturen worden geïmplementeerd in Fase 0.
            </p>
          </div>
        </div>
        
        {/* Email settings */}
        <div className="card">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">E-mail instellingen</h2>
            <p className="text-gray-500">
              SMTP/OAuth instellingen worden geïmplementeerd in Fase 6.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
