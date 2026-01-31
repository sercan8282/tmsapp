/**
 * Documenten overzicht pagina - lijst van alle documenten
 */
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  DocumentIcon,
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import { getDocuments, deleteDocument, SignedDocumentList } from '../../api/documents';

const statusConfig = {
  pending: {
    label: 'Wacht op handtekening',
    icon: ClockIcon,
    className: 'bg-yellow-100 text-yellow-800',
  },
  signed: {
    label: 'Ondertekend',
    icon: CheckCircleIcon,
    className: 'bg-green-100 text-green-800',
  },
  expired: {
    label: 'Verlopen',
    icon: ExclamationCircleIcon,
    className: 'bg-red-100 text-red-800',
  },
};

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<SignedDocumentList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const data = await getDocuments();
      setDocuments(data);
      setError(null);
    } catch (err) {
      setError('Kon documenten niet laden');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Weet je zeker dat je dit document wilt verwijderen?')) {
      return;
    }

    try {
      await deleteDocument(id);
      setDocuments(documents.filter(d => d.id !== id));
    } catch (err) {
      console.error('Fout bij verwijderen:', err);
      alert('Kon document niet verwijderen');
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documenten</h1>
          <p className="mt-1 text-sm text-gray-500">
            Upload, bekijk en onderteken PDF documenten
          </p>
        </div>
        <Link
          to="/documents/upload"
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Document uploaden
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {/* Documents list */}
      {documents.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Geen documenten</h3>
          <p className="mt-1 text-sm text-gray-500">
            Upload een PDF document om te beginnen
          </p>
          <div className="mt-6">
            <Link
              to="/documents/upload"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              Document uploaden
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-gray-200">
            {documents.map((doc) => {
              const status = statusConfig[doc.status];
              const StatusIcon = status.icon;
              
              return (
                <li key={doc.id}>
                  <Link
                    to={`/documents/${doc.id}`}
                    className="block hover:bg-gray-50 transition-colors"
                  >
                    <div className="px-4 py-4 sm:px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center min-w-0 flex-1">
                          <DocumentIcon className="h-10 w-10 text-gray-400 flex-shrink-0" />
                          <div className="ml-4 min-w-0 flex-1">
                            <p className="text-sm font-medium text-blue-600 truncate">
                              {doc.title}
                            </p>
                            <p className="text-sm text-gray-500 truncate">
                              {doc.original_filename}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                            <StatusIcon className="h-4 w-4 mr-1" />
                            {status.label}
                          </span>
                          <div className="flex items-center space-x-2">
                            {doc.status === 'pending' && (
                              <button
                                onClick={(e) => {
                                  e.preventDefault();
                                  navigate(`/documents/${doc.id}/sign`);
                                }}
                                className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md"
                                title="Ondertekenen"
                              >
                                <PencilSquareIcon className="h-5 w-5" />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDelete(doc.id, e)}
                              className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md"
                              title="Verwijderen"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                        <span>Geüpload door: {doc.uploaded_by_name}</span>
                        <span>•</span>
                        <span>{formatDate(doc.created_at)}</span>
                        {doc.signed_at && (
                          <>
                            <span>•</span>
                            <span>Ondertekend: {formatDate(doc.signed_at)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
