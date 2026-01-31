import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, TestTube, CheckCircle, XCircle, Eye, EyeOff, FolderOpen } from 'lucide-react';
import {
  getMailboxConfig,
  createMailboxConfig,
  updateMailboxConfig,
  testMailboxConnection,
  listMailboxFolders,
  MailboxConfigInput,
  MailboxFolder,
} from '../../api/emailImport';

const MailboxConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const isNew = !id || id === 'new';

  // Form state
  const [formData, setFormData] = useState<MailboxConfigInput>({
    name: '',
    description: '',
    protocol: 'imap',
    email_address: '',
    imap_server: 'outlook.office365.com',
    imap_port: 993,
    imap_use_ssl: true,
    username: '',
    password: '',
    ms365_client_id: '',
    ms365_client_secret: '',
    ms365_tenant_id: '',
    folder_name: 'INBOX',
    mark_as_read: true,
    move_to_folder: '',
    only_unread: true,
    subject_filter: '',
    sender_filter: '',
    auto_fetch_enabled: false,
    auto_fetch_interval_minutes: 15,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [folders, setFolders] = useState<MailboxFolder[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  // Fetch existing config
  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['mailboxConfig', id],
    queryFn: () => getMailboxConfig(id!),
    enabled: !isNew && !!id,
  });

  // Update form when config loads
  useEffect(() => {
    if (existingConfig) {
      setFormData({
        name: existingConfig.name,
        description: existingConfig.description || '',
        protocol: existingConfig.protocol,
        email_address: existingConfig.email_address,
        imap_server: existingConfig.imap_server || 'outlook.office365.com',
        imap_port: existingConfig.imap_port || 993,
        imap_use_ssl: existingConfig.imap_use_ssl !== false,
        username: '', // Never pre-fill credentials
        password: '',
        ms365_client_id: existingConfig.ms365_client_id || '',
        ms365_client_secret: '',
        ms365_tenant_id: existingConfig.ms365_tenant_id || '',
        folder_name: existingConfig.folder_name || 'INBOX',
        mark_as_read: existingConfig.mark_as_read !== false,
        move_to_folder: existingConfig.move_to_folder || '',
        only_unread: existingConfig.only_unread !== false,
        subject_filter: existingConfig.subject_filter || '',
        sender_filter: existingConfig.sender_filter || '',
        auto_fetch_enabled: existingConfig.auto_fetch_enabled || false,
        auto_fetch_interval_minutes: existingConfig.auto_fetch_interval_minutes || 15,
      });
    }
  }, [existingConfig]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: MailboxConfigInput) => {
      // Clean empty strings for optional fields
      const cleanedData = { ...data };
      if (!cleanedData.username) delete cleanedData.username;
      if (!cleanedData.password) delete cleanedData.password;
      if (!cleanedData.ms365_client_secret) delete cleanedData.ms365_client_secret;

      if (isNew || !id) {
        return createMailboxConfig(cleanedData);
      } else {
        return updateMailboxConfig(id, cleanedData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mailboxConfigs'] });
      queryClient.invalidateQueries({ queryKey: ['mailboxConfig', id] });
      navigate('/imports/email');
    },
    onError: (error: Error) => {
      setErrors({ general: error.message });
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      // Need to save first for new configs, or if id is missing
      if (isNew || !id) {
        throw new Error('Sla de configuratie eerst op om te testen');
      }
      return testMailboxConnection(id);
    },
    onSuccess: (result) => {
      setTestResult(result);
      // Auto-load folders when connection test succeeds
      if (result.success) {
        loadFolders();
      }
    },
    onError: (error: Error) => {
      setTestResult({ success: false, message: error.message });
    },
  });

  // Load folders function
  const loadFolders = async () => {
    if (isNew || !id) {
      setFoldersError('Sla de configuratie eerst op om mappen te laden');
      return;
    }
    
    setFoldersLoading(true);
    setFoldersError(null);
    
    try {
      const result = await listMailboxFolders(id);
      if (result.success) {
        setFolders(result.folders);
      } else {
        setFoldersError(result.message || 'Kon mappen niet laden');
      }
    } catch (error: any) {
      setFoldersError(error.message || 'Kon mappen niet laden');
    } finally {
      setFoldersLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setTestResult(null);

    // Basic validation
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Naam is verplicht';
    }
    if (!formData.email_address.trim()) {
      newErrors.email_address = 'E-mail adres is verplicht';
    }

    if (formData.protocol === 'imap') {
      if (!formData.imap_server?.trim()) {
        newErrors.imap_server = 'IMAP server is verplicht';
      }
      if (isNew && (!formData.username?.trim() || !formData.password?.trim())) {
        newErrors.credentials = 'Gebruikersnaam en wachtwoord zijn verplicht';
      }
    } else if (formData.protocol === 'ms365') {
      if (!formData.ms365_client_id?.trim()) {
        newErrors.ms365_client_id = 'Client ID is verplicht';
      }
      if (!formData.ms365_tenant_id?.trim()) {
        newErrors.ms365_tenant_id = 'Tenant ID is verplicht';
      }
      if (isNew && !formData.ms365_client_secret?.trim()) {
        newErrors.ms365_client_secret = 'Client Secret is verplicht';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    saveMutation.mutate(formData);
  };

  const handleChange = (field: keyof MailboxConfigInput, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/imports/email')}
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Terug naar E-mail Import
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {isNew ? 'Nieuwe Mailbox Configuratie' : 'Mailbox Configuratie Bewerken'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Configureer een shared mailbox om facturen uit te lezen
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General Error */}
        {errors.general && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{errors.general}</p>
          </div>
        )}

        {/* Basic Info */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Algemene Instellingen</h2>

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Naam <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className={`mt-1 block w-full rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                  errors.name ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Factuur Mailbox"
              />
              {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Beschrijving</label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={2}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Optionele beschrijving..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                E-mail Adres (Shared Mailbox) <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email_address}
                onChange={(e) => handleChange('email_address', e.target.value)}
                className={`mt-1 block w-full rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                  errors.email_address ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="facturen@bedrijf.nl"
              />
              {errors.email_address && <p className="mt-1 text-sm text-red-600">{errors.email_address}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Protocol</label>
              <select
                value={formData.protocol}
                onChange={(e) => handleChange('protocol', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="imap">IMAP</option>
                <option value="ms365">Microsoft 365 (OAuth)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.protocol === 'imap'
                  ? 'Gebruik IMAP voor traditionele e-mail servers of Microsoft 365 met app-wachtwoord'
                  : 'Gebruik OAuth voor Microsoft 365 met client credentials flow'}
              </p>
            </div>
          </div>
        </div>

        {/* IMAP Settings */}
        {formData.protocol === 'imap' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">IMAP Instellingen</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  IMAP Server <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.imap_server}
                  onChange={(e) => handleChange('imap_server', e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    errors.imap_server ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="outlook.office365.com"
                />
                {errors.imap_server && <p className="mt-1 text-sm text-red-600">{errors.imap_server}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Poort</label>
                <input
                  type="number"
                  value={formData.imap_port}
                  onChange={(e) => handleChange('imap_port', parseInt(e.target.value))}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.imap_use_ssl}
                    onChange={(e) => handleChange('imap_use_ssl', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">SSL/TLS gebruiken</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Gebruikersnaam {isNew && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => handleChange('username', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="gebruiker@bedrijf.nl"
                />
                {!isNew && existingConfig?.has_credentials && (
                  <p className="mt-1 text-xs text-gray-500">Laat leeg om huidige waarde te behouden</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Wachtwoord {isNew && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => handleChange('password', e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500 pr-10"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {!isNew && existingConfig?.has_credentials && (
                  <p className="mt-1 text-xs text-gray-500">Laat leeg om huidige waarde te behouden</p>
                )}
              </div>
            </div>

            {errors.credentials && (
              <p className="mt-4 text-sm text-red-600">{errors.credentials}</p>
            )}
          </div>
        )}

        {/* Microsoft 365 Settings */}
        {formData.protocol === 'ms365' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Microsoft 365 OAuth Instellingen</h2>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tenant ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ms365_tenant_id}
                  onChange={(e) => handleChange('ms365_tenant_id', e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    errors.ms365_tenant_id ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                {errors.ms365_tenant_id && <p className="mt-1 text-sm text-red-600">{errors.ms365_tenant_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Client ID (Application ID) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.ms365_client_id}
                  onChange={(e) => handleChange('ms365_client_id', e.target.value)}
                  className={`mt-1 block w-full rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 ${
                    errors.ms365_client_id ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                {errors.ms365_client_id && <p className="mt-1 text-sm text-red-600">{errors.ms365_client_id}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Client Secret {isNew && <span className="text-red-500">*</span>}
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={formData.ms365_client_secret}
                    onChange={(e) => handleChange('ms365_client_secret', e.target.value)}
                    className={`mt-1 block w-full rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 pr-10 ${
                      errors.ms365_client_secret ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.ms365_client_secret && (
                  <p className="mt-1 text-sm text-red-600">{errors.ms365_client_secret}</p>
                )}
                {!isNew && existingConfig?.has_ms365_secret && (
                  <p className="mt-1 text-xs text-gray-500">Laat leeg om huidige waarde te behouden</p>
                )}
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Let op:</strong> Zorg dat de Azure App Registration de volgende API permissions heeft:
              </p>
              <ul className="mt-2 text-sm text-blue-700 list-disc list-inside">
                <li>Mail.Read (Application)</li>
                <li>Mail.ReadWrite (Application) - indien mails verplaatst moeten worden</li>
              </ul>
            </div>
          </div>
        )}

        {/* Processing Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Verwerking Instellingen</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Map om te monitoren</label>
              <div className="mt-1 flex gap-2">
                {folders.length > 0 ? (
                  <select
                    value={formData.folder_name}
                    onChange={(e) => handleChange('folder_name', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Selecteer een map...</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {'  '.repeat(folder.depth)}{folder.display_name}
                        {folder.total_items !== undefined && ` (${folder.unread_items}/${folder.total_items})`}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.folder_name}
                    onChange={(e) => handleChange('folder_name', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="INBOX"
                  />
                )}
                {!isNew && (
                  <button
                    type="button"
                    onClick={loadFolders}
                    disabled={foldersLoading}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    title="Mappen laden"
                  >
                    {foldersLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <FolderOpen className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              {foldersError && (
                <p className="mt-1 text-xs text-red-600">{foldersError}</p>
              )}
              {isNew && (
                <p className="mt-1 text-xs text-gray-500">Sla eerst op om mappen te kunnen laden</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Verplaats naar map (optioneel)</label>
              <div className="mt-1 flex gap-2">
                {folders.length > 0 ? (
                  <select
                    value={formData.move_to_folder}
                    onChange={(e) => handleChange('move_to_folder', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Niet verplaatsen</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {'  '.repeat(folder.depth)}{folder.display_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={formData.move_to_folder}
                    onChange={(e) => handleChange('move_to_folder', e.target.value)}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Verwerkt"
                  />
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">Laat leeg om mails in de oorspronkelijke map te laten</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Onderwerp filter (optioneel)</label>
              <input
                type="text"
                value={formData.subject_filter}
                onChange={(e) => handleChange('subject_filter', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="Factuur"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Afzender filter (optioneel)</label>
              <input
                type="text"
                value={formData.sender_filter}
                onChange={(e) => handleChange('sender_filter', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                placeholder="@leverancier.nl"
              />
            </div>

            <div className="md:col-span-2 space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.only_unread}
                  onChange={(e) => handleChange('only_unread', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Alleen ongelezen e-mails verwerken</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.mark_as_read}
                  onChange={(e) => handleChange('mark_as_read', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">E-mails als gelezen markeren na verwerking</span>
              </label>
            </div>
          </div>
        </div>

        {/* Auto Fetch Settings */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Automatisch Ophalen</h2>

          <div className="space-y-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.auto_fetch_enabled}
                onChange={(e) => handleChange('auto_fetch_enabled', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Automatisch e-mails ophalen</span>
            </label>

            {formData.auto_fetch_enabled && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Interval (minuten)</label>
                <input
                  type="number"
                  min={5}
                  max={1440}
                  value={formData.auto_fetch_interval_minutes}
                  onChange={(e) => handleChange('auto_fetch_interval_minutes', parseInt(e.target.value))}
                  className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">Minimaal 5 minuten, maximaal 1440 (24 uur)</p>
              </div>
            )}
          </div>
        </div>

        {/* Test Result */}
        {testResult && (
          <div
            className={`p-4 rounded-lg flex items-center gap-3 ${
              testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <p className={`text-sm ${testResult.success ? 'text-green-800' : 'text-red-800'}`}>
              {testResult.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <div>
            {!isNew && (
              <button
                type="button"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {testMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <TestTube className="w-4 h-4" />
                )}
                Test Verbinding
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/imports/email')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Annuleren
            </button>
            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {isNew ? 'Aanmaken' : 'Opslaan'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default MailboxConfigPage;
