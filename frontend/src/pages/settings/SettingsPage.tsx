/**
 * Settings Page
 * Admin interface for managing application settings:
 * - Branding (app name, logo, favicon, colors)
 * - Theme selection
 * - Company info (for invoices)
 * - Email settings (SMTP/OAuth)
 */
import { useState, useEffect, useRef } from 'react'
import {
  Cog6ToothIcon,
  PhotoIcon,
  BuildingOfficeIcon,
  EnvelopeIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  EyeIcon,
  EyeSlashIcon,
  DocumentTextIcon,
  TrashIcon,
  SwatchIcon,
  ServerIcon,
  LanguageIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import { settingsApi } from '@/api/settings'
import { useAppStore } from '@/stores/appStore'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import ThemeSelector from '@/components/settings/ThemeSelector'
import type { AppSettingsAdmin } from '@/types'

// Tab configuration
const tabs = [
  { id: 'branding', name: 'Branding', icon: PhotoIcon },
  { id: 'theme', name: 'Thema', icon: SwatchIcon },
  { id: 'fonts', name: 'Fonts', icon: LanguageIcon, link: '/settings/fonts' },
  { id: 'company', name: 'Bedrijfsgegevens', icon: BuildingOfficeIcon },
  { id: 'invoice', name: 'Factuur', icon: DocumentTextIcon },
  { id: 'email', name: 'E-mail', icon: EnvelopeIcon },
  { id: 'ai', name: 'AI Extractie', icon: SparklesIcon },
  { id: 'server', name: 'Server', icon: ServerIcon },
]

export default function SettingsPage() {
  const { fetchSettings } = useAppStore()
  const serverConfig = useServerConfigStore()
  
  // State
  const [activeTab, setActiveTab] = useState('branding')
  const [settings, setSettings] = useState<AppSettingsAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form state
  const [formData, setFormData] = useState<Partial<AppSettingsAdmin>>({})
  const [hasChanges, setHasChanges] = useState(false)
  
  // File refs
  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)
  
  // Password visibility
  const [showSmtpPassword, setShowSmtpPassword] = useState(false)
  const [showOAuthSecret, setShowOAuthSecret] = useState(false)
  
  // Email test
  const [testEmail, setTestEmail] = useState('')
  const [testingEmail, setTestingEmail] = useState(false)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const data = await settingsApi.getAdmin()
      setSettings(data)
      setFormData({
        app_name: data.app_name,
        primary_color: data.primary_color,
        company_name: data.company_name,
        company_address: data.company_address,
        company_phone: data.company_phone,
        company_email: data.company_email,
        company_kvk: data.company_kvk,
        company_btw: data.company_btw,
        company_iban: data.company_iban,
        smtp_host: data.smtp_host,
        smtp_port: data.smtp_port,
        smtp_username: data.smtp_username,
        smtp_use_tls: data.smtp_use_tls,
        smtp_from_email: data.smtp_from_email,
        oauth_enabled: data.oauth_enabled,
        oauth_client_id: data.oauth_client_id,
        oauth_tenant_id: data.oauth_tenant_id,
        invoice_payment_text: data.invoice_payment_text,
        email_signature: data.email_signature,
        // AI settings
        ai_provider: data.ai_provider || 'none',
        ai_azure_endpoint: data.ai_azure_endpoint,
        ai_azure_deployment: data.ai_azure_deployment,
        ai_model: data.ai_model || 'gpt-4o-mini',
      })
    } catch (err: any) {
      setError('Kon instellingen niet laden')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: keyof AppSettingsAdmin, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      
      const updated = await settingsApi.update(formData)
      setSettings(updated)
      setHasChanges(false)
      setSuccess('Instellingen opgeslagen')
      
      // Refresh global settings
      fetchSettings()
      
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Kon instellingen niet opslaan')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      setSaving(true)
      const updated = await settingsApi.uploadLogo(file)
      setSettings(updated)
      setSuccess('Logo geüpload')
      fetchSettings()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError('Kon logo niet uploaden')
    } finally {
      setSaving(false)
    }
  }

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    try {
      setSaving(true)
      const updated = await settingsApi.uploadFavicon(file)
      setSettings(updated)
      setSuccess('Favicon geüpload')
      fetchSettings()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError('Kon favicon niet uploaden')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteLogo = async () => {
    if (!confirm('Weet je zeker dat je het logo wilt verwijderen?')) return
    
    try {
      setSaving(true)
      const updated = await settingsApi.deleteLogo()
      setSettings(updated)
      setSuccess('Logo verwijderd')
      fetchSettings()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError('Kon logo niet verwijderen')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFavicon = async () => {
    if (!confirm('Weet je zeker dat je de favicon wilt verwijderen?')) return
    
    try {
      setSaving(true)
      const updated = await settingsApi.deleteFavicon()
      setSettings(updated)
      setSuccess('Favicon verwijderd')
      fetchSettings()
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError('Kon favicon niet verwijderen')
    } finally {
      setSaving(false)
    }
  }

  const handleTestEmail = async () => {
    if (!testEmail) {
      setError('Vul een e-mailadres in')
      return
    }
    
    try {
      setTestingEmail(true)
      setError(null)
      
      // First save any pending email settings
      if (hasChanges) {
        await settingsApi.update(formData)
      }
      
      const result = await settingsApi.testEmail(testEmail)
      setSuccess(result.message || 'Test e-mail verzonden!')
      setTimeout(() => setSuccess(null), 5000)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kon test e-mail niet versturen')
    } finally {
      setTestingEmail(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <ArrowPathIcon className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Cog6ToothIcon className="h-8 w-8 text-gray-400" />
          <h1 className="page-title">Instellingen</h1>
        </div>
        
        {hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <CheckCircleIcon className="h-5 w-5 mr-2" />
            )}
            Opslaan
          </button>
        )}
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess(null)}>
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            tab.link ? (
              <Link
                key={tab.id}
                to={tab.link}
                className="flex items-center gap-2 py-4 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 transition-colors"
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
              </Link>
            ) : (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
                `}
              >
                <tab.icon className="h-5 w-5" />
                {tab.name}
              </button>
            )
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="card">
        <div className="p-6">
          {/* Branding Tab */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Branding</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Pas het uiterlijk van de applicatie aan met uw eigen branding.
                </p>
              </div>

              {/* App Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Applicatie Naam
                </label>
                <input
                  type="text"
                  value={formData.app_name || ''}
                  onChange={(e) => handleInputChange('app_name', e.target.value)}
                  className="input-field max-w-md"
                  placeholder="TMS"
                />
              </div>

              {/* Primary Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primaire Kleur
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={formData.primary_color || '#3B82F6'}
                    onChange={(e) => handleInputChange('primary_color', e.target.value)}
                    className="h-10 w-20 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={formData.primary_color || '#3B82F6'}
                    onChange={(e) => handleInputChange('primary_color', e.target.value)}
                    className="input-field w-32"
                    placeholder="#3B82F6"
                  />
                </div>
              </div>

              {/* Logo */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Logo
                </label>
                <div className="flex items-start gap-4">
                  {settings?.logo_url ? (
                    <img
                      src={settings.logo_url}
                      alt="Logo"
                      className="h-16 w-auto object-contain bg-gray-100 rounded p-2"
                    />
                  ) : (
                    <div className="h-16 w-32 bg-gray-100 rounded flex items-center justify-center">
                      <PhotoIcon className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={logoInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => logoInputRef.current?.click()}
                        disabled={saving}
                        className="btn-secondary text-sm"
                      >
                        Logo uploaden
                      </button>
                      {settings?.logo_url && (
                        <button
                          onClick={handleDeleteLogo}
                          disabled={saving}
                          className="btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      PNG, JPG of SVG. Max 2MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Favicon */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Favicon
                </label>
                <div className="flex items-start gap-4">
                  {settings?.favicon_url ? (
                    <img
                      src={settings.favicon_url}
                      alt="Favicon"
                      className="h-10 w-10 object-contain bg-gray-100 rounded p-1"
                    />
                  ) : (
                    <div className="h-10 w-10 bg-gray-100 rounded flex items-center justify-center">
                      <PhotoIcon className="h-5 w-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input
                      ref={faviconInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFaviconUpload}
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => faviconInputRef.current?.click()}
                        disabled={saving}
                        className="btn-secondary text-sm"
                      >
                        Favicon uploaden
                      </button>
                      {settings?.favicon_url && (
                        <button
                          onClick={handleDeleteFavicon}
                          disabled={saving}
                          className="btn-secondary text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      PNG of ICO. 32x32 of 64x64 pixels.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Theme Tab */}
          {activeTab === 'theme' && (
            <ThemeSelector />
          )}

          {/* Company Tab */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Bedrijfsgegevens</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Deze gegevens worden gebruikt op facturen en andere documenten.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Company Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bedrijfsnaam
                  </label>
                  <input
                    type="text"
                    value={formData.company_name || ''}
                    onChange={(e) => handleInputChange('company_name', e.target.value)}
                    className="input-field"
                    placeholder="Uw Bedrijf B.V."
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Telefoon
                  </label>
                  <input
                    type="tel"
                    value={formData.company_phone || ''}
                    onChange={(e) => handleInputChange('company_phone', e.target.value)}
                    className="input-field"
                    placeholder="+31 6 12345678"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={formData.company_email || ''}
                    onChange={(e) => handleInputChange('company_email', e.target.value)}
                    className="input-field"
                    placeholder="info@uwbedrijf.nl"
                  />
                </div>

                {/* KvK */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    KvK Nummer
                  </label>
                  <input
                    type="text"
                    value={formData.company_kvk || ''}
                    onChange={(e) => handleInputChange('company_kvk', e.target.value)}
                    className="input-field"
                    placeholder="12345678"
                  />
                </div>

                {/* BTW */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    BTW Nummer
                  </label>
                  <input
                    type="text"
                    value={formData.company_btw || ''}
                    onChange={(e) => handleInputChange('company_btw', e.target.value)}
                    className="input-field"
                    placeholder="NL123456789B01"
                  />
                </div>

                {/* IBAN */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    IBAN
                  </label>
                  <input
                    type="text"
                    value={formData.company_iban || ''}
                    onChange={(e) => handleInputChange('company_iban', e.target.value)}
                    className="input-field"
                    placeholder="NL00BANK0123456789"
                  />
                </div>
              </div>

              {/* Address (full width) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adres
                </label>
                <textarea
                  value={formData.company_address || ''}
                  onChange={(e) => handleInputChange('company_address', e.target.value)}
                  rows={3}
                  className="input-field"
                  placeholder="Straatnaam 123&#10;1234 AB Plaats"
                />
              </div>
            </div>
          )}

          {/* Invoice Tab */}
          {activeTab === 'invoice' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Factuur Instellingen</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Pas de tekst op facturen aan.
                </p>
              </div>

              {/* Payment Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Betalingstekst
                </label>
                <textarea
                  value={formData.invoice_payment_text || ''}
                  onChange={(e) => handleInputChange('invoice_payment_text', e.target.value)}
                  rows={4}
                  className="input-field"
                  placeholder="Wij verzoeken u vriendelijk het totaalbedrag vóór de vervaldatum over te maken op bovenstaand IBAN onder vermelding van het factuurnummer."
                />
                <p className="text-xs text-gray-500 mt-2">
                  Beschikbare variabelen: <code className="bg-gray-100 px-1 rounded">{'{bedrag}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{vervaldatum}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{factuurnummer}'}</code>
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  Voorbeeld: "Wij verzoeken u vriendelijk het totaalbedrag van {'{bedrag}'} vóór {'{vervaldatum}'} over te maken onder vermelding van {'{factuurnummer}'}."
                </p>
              </div>
            </div>
          )}

          {/* Email Tab */}
          {activeTab === 'email' && (
            <div className="space-y-8">
              {/* SMTP Settings */}
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">SMTP Instellingen</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Configureer de e-mailserver voor het versturen van facturen en notificaties.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* SMTP Host */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Host
                    </label>
                    <input
                      type="text"
                      value={formData.smtp_host || ''}
                      onChange={(e) => handleInputChange('smtp_host', e.target.value)}
                      className="input-field"
                      placeholder="smtp.example.com"
                    />
                  </div>

                  {/* SMTP Port */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      SMTP Poort
                    </label>
                    <input
                      type="number"
                      value={formData.smtp_port || 587}
                      onChange={(e) => handleInputChange('smtp_port', parseInt(e.target.value) || 587)}
                      className="input-field"
                      placeholder="587"
                    />
                  </div>

                  {/* SMTP Username */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Gebruikersnaam
                    </label>
                    <input
                      type="text"
                      value={formData.smtp_username || ''}
                      onChange={(e) => handleInputChange('smtp_username', e.target.value)}
                      className="input-field"
                      placeholder="user@example.com"
                    />
                  </div>

                  {/* SMTP Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Wachtwoord
                    </label>
                    <div className="relative">
                      <input
                        type={showSmtpPassword ? 'text' : 'password'}
                        value={formData.smtp_password || ''}
                        onChange={(e) => handleInputChange('smtp_password', e.target.value)}
                        className="input-field pr-10"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSmtpPassword(!showSmtpPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showSmtpPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* From Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Afzender E-mail
                    </label>
                    <input
                      type="email"
                      value={formData.smtp_from_email || ''}
                      onChange={(e) => handleInputChange('smtp_from_email', e.target.value)}
                      className="input-field"
                      placeholder="noreply@example.com"
                    />
                  </div>

                  {/* Use TLS */}
                  <div className="flex items-center">
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.smtp_use_tls ?? true}
                        onChange={(e) => handleInputChange('smtp_use_tls', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">Gebruik TLS</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* OAuth Settings (Exchange Online) */}
              <div className="border-t pt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">OAuth / Microsoft 365</h2>
                <p className="text-sm text-gray-500 mb-6">
                  Optioneel: Gebruik OAuth voor Microsoft Exchange Online.
                </p>

                <div className="space-y-6">
                  {/* Enable OAuth */}
                  <div>
                    <label className="flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.oauth_enabled ?? false}
                        onChange={(e) => handleInputChange('oauth_enabled', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="ml-2 text-sm text-gray-700">OAuth inschakelen</span>
                    </label>
                  </div>

                  {formData.oauth_enabled && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pl-6 border-l-2 border-primary-200">
                      {/* Client ID */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Client ID
                        </label>
                        <input
                          type="text"
                          value={formData.oauth_client_id || ''}
                          onChange={(e) => handleInputChange('oauth_client_id', e.target.value)}
                          className="input-field"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                      </div>

                      {/* Tenant ID */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Tenant ID
                        </label>
                        <input
                          type="text"
                          value={formData.oauth_tenant_id || ''}
                          onChange={(e) => handleInputChange('oauth_tenant_id', e.target.value)}
                          className="input-field"
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        />
                      </div>

                      {/* Client Secret */}
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Client Secret
                        </label>
                        <div className="relative">
                          <input
                            type={showOAuthSecret ? 'text' : 'password'}
                            value={formData.oauth_client_secret || ''}
                            onChange={(e) => handleInputChange('oauth_client_secret', e.target.value)}
                            className="input-field pr-10"
                            placeholder="••••••••••••••••••••"
                          />
                          <button
                            type="button"
                            onClick={() => setShowOAuthSecret(!showOAuthSecret)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showOAuthSecret ? (
                              <EyeSlashIcon className="h-5 w-5" />
                            ) : (
                              <EyeIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Email Signature */}
              <div className="border-t pt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">E-mail Handtekening</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Deze handtekening wordt onderaan alle uitgaande e-mails (bijv. facturen) toegevoegd.
                </p>
                
                <div>
                  <textarea
                    value={formData.email_signature || ''}
                    onChange={(e) => handleInputChange('email_signature', e.target.value)}
                    rows={6}
                    className="input-field"
                    placeholder="Met vriendelijke groet,&#10;&#10;Jan Jansen&#10;Functie&#10;Bedrijfsnaam&#10;Tel: 012-3456789"
                  />
                </div>
              </div>

              {/* Test Email */}
              <div className="border-t pt-8">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">E-mail Testen</h2>
                <p className="text-sm text-gray-500 mb-4">
                  Verstuur een test e-mail om de configuratie te controleren.
                </p>
                
                <div className="flex gap-3">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="input-field max-w-md"
                    placeholder="test@example.com"
                  />
                  <button
                    onClick={handleTestEmail}
                    disabled={testingEmail || !testEmail}
                    className="btn-secondary"
                  >
                    {testingEmail ? (
                      <ArrowPathIcon className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                    )}
                    Test versturen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* AI Tab */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">AI Factuur Extractie</h2>
                <p className="text-sm text-gray-500">
                  Configureer AI-powered extractie voor het automatisch herkennen van factuurgegevens.
                </p>
              </div>

              {/* Status indicator */}
              {settings?.ai_status && (
                <div className={`p-4 rounded-lg ${settings.ai_status.configured ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${settings.ai_status.configured ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                    <span className={`text-sm font-medium ${settings.ai_status.configured ? 'text-green-800' : 'text-yellow-800'}`}>
                      {settings.ai_status.message}
                    </span>
                  </div>
                </div>
              )}

              {/* Provider selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI Provider
                </label>
                <select
                  value={formData.ai_provider || 'none'}
                  onChange={(e) => handleInputChange('ai_provider', e.target.value)}
                  className="input w-full"
                >
                  <option value="none">Uitgeschakeld</option>
                  <option value="github">GitHub Models (Gratis)</option>
                  <option value="openai">OpenAI (Betaald)</option>
                  <option value="azure">Azure OpenAI</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  GitHub Models is gratis en aanbevolen voor de meeste gebruikers.
                </p>
              </div>

              {/* GitHub Models settings */}
              {formData.ai_provider === 'github' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900">GitHub Models (Gratis)</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GitHub Personal Access Token
                    </label>
                    <input
                      type="password"
                      placeholder="ghp_... of github_pat_..."
                      onChange={(e) => handleInputChange('ai_github_token', e.target.value)}
                      className="input w-full font-mono"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Maak een token op{' '}
                      <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        github.com/settings/tokens
                      </a>
                      {' '}met "models" permissie.
                    </p>
                  </div>
                </div>
              )}

              {/* OpenAI settings */}
              {formData.ai_provider === 'openai' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900">OpenAI</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      placeholder="sk-..."
                      onChange={(e) => handleInputChange('ai_openai_api_key', e.target.value)}
                      className="input w-full font-mono"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Verkrijgbaar op{' '}
                      <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        platform.openai.com
                      </a>
                    </p>
                  </div>
                </div>
              )}

              {/* Azure OpenAI settings */}
              {formData.ai_provider === 'azure' && (
                <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium text-gray-900">Azure OpenAI</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Endpoint URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://your-resource.openai.azure.com/"
                      value={formData.ai_azure_endpoint || ''}
                      onChange={(e) => handleInputChange('ai_azure_endpoint', e.target.value)}
                      className="input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      placeholder="Azure API key"
                      onChange={(e) => handleInputChange('ai_azure_api_key', e.target.value)}
                      className="input w-full font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Deployment Name
                    </label>
                    <input
                      type="text"
                      placeholder="gpt-4o-mini"
                      value={formData.ai_azure_deployment || ''}
                      onChange={(e) => handleInputChange('ai_azure_deployment', e.target.value)}
                      className="input w-full"
                    />
                  </div>
                </div>
              )}

              {/* Model selection (for all providers except none) */}
              {formData.ai_provider && formData.ai_provider !== 'none' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model
                  </label>
                  <select
                    value={formData.ai_model || 'gpt-4o-mini'}
                    onChange={(e) => handleInputChange('ai_model', e.target.value)}
                    className="input w-full"
                  >
                    <option value="gpt-4o-mini">GPT-4o Mini (Snel, goedkoop)</option>
                    <option value="gpt-4o">GPT-4o (Beste kwaliteit)</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Server Tab */}
          {activeTab === 'server' && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Server Configuratie</h2>
              <p className="text-sm text-gray-500">
                Bekijk of wijzig de huidige server verbinding.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">Server URL</label>
                  <p className="mt-1 text-lg font-mono text-gray-900">
                    {serverConfig.serverUrl || '(Lokale ontwikkeling)'}
                  </p>
                </div>
                
                {serverConfig.serverName && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Server Naam</label>
                    <p className="mt-1 text-lg text-gray-900">{serverConfig.serverName}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-500">Status</label>
                  <p className="mt-1 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <span className="text-sm text-green-700">Verbonden</span>
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-md font-medium text-gray-900 mb-2">Andere server gebruiken</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Om een andere server te gebruiken moet je uitloggen en de app opnieuw configureren.
                </p>
                <button
                  onClick={() => {
                    if (confirm('Weet je zeker dat je de server configuratie wilt wissen? Je wordt uitgelogd.')) {
                      serverConfig.clearServerUrl()
                      window.location.href = '/setup'
                    }
                  }}
                  className="btn-danger"
                >
                  <ServerIcon className="h-5 w-5 mr-2" />
                  Server configuratie wissen
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Save Button (sticky at bottom for mobile) */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 md:hidden">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary shadow-lg"
          >
            {saving ? (
              <ArrowPathIcon className="h-5 w-5 animate-spin" />
            ) : (
              <CheckCircleIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      )}
    </div>
  )
}
