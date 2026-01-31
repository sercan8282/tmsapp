/**
 * Document detail pagina
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  DocumentIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import {
  getDocument,
  deleteDocument,
  downloadSignedDocument,
  downloadOriginalDocument,
  SignedDocument,
} from '../../api/documents';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<SignedDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (id) {
      loadDocument();
    }
  }, [id]);

  const loadDocument = async () => {
    try {
      setLoading(true);
      const data = await getDocument(id!);
      setDocument(data);
      setError(null);
    } catch (err) {
      setError('Kon document niet laden');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Weet je zeker dat je dit document wilt verwijderen?')) {
      return;
    }

    try {
      await deleteDocument(id!);
      navigate('/documents');
    } catch (err) {
      console.error('Fout bij verwijderen:', err);
      alert('Kon document niet verwijderen');
    }
  };

  const handleDownload = async (signed: boolean) => {
    if (!document) return;
    
    try {
      setDownloading(true);
      const blob = signed 
        ? await downloadSignedDocument(id!)
        : await downloadOriginalDocument(id!);
      
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = signed 
        ? `ondertekend_${document.original_filename}`
        : document.original_filename;
      window.document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      window.document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert('Kon bestand niet downloaden');
    } finally {
      setDownloading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error || 'Document niet gevonden'}</p>
        <Link to="/documents" className="mt-4 text-blue-600 hover:text-blue-800">
          Terug naar documenten
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Link
        to="/documents"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeftIcon className="h-4 w-4 mr-1" />
        Terug naar documenten
      </Link>

      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start">
            <DocumentIcon className="h-12 w-12 text-gray-400" />
            <div className="ml-4">
              <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
              <p className="text-sm text-gray-500">{document.original_filename}</p>
              {document.description && (
                <p className="mt-2 text-gray-600">{document.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {document.status === 'pending' ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                <ClockIcon className="h-4 w-4 mr-1" />
                Wacht op handtekening
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <CheckCircleIcon className="h-4 w-4 mr-1" />
                Ondertekend
              </span>
            )}
          </div>
        </div>

        {/* Info grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Geüpload door</dt>
            <dd className="mt-1 text-sm text-gray-900">{document.uploaded_by_name}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Geüpload op</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDate(document.created_at)}</dd>
          </div>
          {document.signed_by_name && (
            <>
              <div>
                <dt className="text-sm font-medium text-gray-500">Ondertekend door</dt>
                <dd className="mt-1 text-sm text-gray-900">{document.signed_by_name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Ondertekend op</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDate(document.signed_at)}</dd>
              </div>
            </>
          )}
        </div>

        {/* Signature details */}
        {document.signature_data && (
          <div className="mt-4 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Handtekening details</h3>
            <div className="text-sm text-gray-600">
              Pagina {document.signature_data.page}, positie ({document.signature_data.x.toFixed(1)}%, {document.signature_data.y.toFixed(1)}%)
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Acties</h2>
        <div className="flex flex-wrap gap-3">
          {document.status === 'pending' && (
            <Link
              to={`/documents/${document.id}/sign`}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <PencilSquareIcon className="h-5 w-5 mr-2" />
              Ondertekenen
            </Link>
          )}
          
          {document.status === 'signed' && document.signed_file_url && (
            <button
              onClick={() => handleDownload(true)}
              disabled={downloading}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50"
            >
              <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
              Download ondertekend
            </button>
          )}
          
          <button
            onClick={() => handleDownload(false)}
            disabled={downloading}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-5 w-5 mr-2" />
            Download origineel
          </button>
          
          <button
            onClick={handleDelete}
            className="inline-flex items-center px-4 py-2 border border-red-300 rounded-md shadow-sm text-sm font-medium text-red-700 bg-white hover:bg-red-50"
          >
            <TrashIcon className="h-5 w-5 mr-2" />
            Verwijderen
          </button>
        </div>
      </div>

      {/* Preview section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Preview</h2>
        <div className="border rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center min-h-96">
          <iframe
            src={document.status === 'signed' && document.signed_file_url 
              ? document.signed_file_url 
              : document.original_file_url}
            className="w-full h-[600px]"
            title="PDF Preview"
          />
        </div>
      </div>
    </div>
  );
}
