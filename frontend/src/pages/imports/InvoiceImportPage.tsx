import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { uploadInvoice, getInvoiceImports, deleteInvoiceImport, InvoiceImport } from '../../api/ocr';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800', icon: <Clock className="w-4 h-4" />, label: 'In wachtrij' },
  processing: { color: 'bg-blue-100 text-blue-800', icon: <Loader2 className="w-4 h-4 animate-spin" />, label: 'Verwerken' },
  extracted: { color: 'bg-purple-100 text-purple-800', icon: <FileText className="w-4 h-4" />, label: 'Geëxtraheerd' },
  review: { color: 'bg-orange-100 text-orange-800', icon: <AlertCircle className="w-4 h-4" />, label: 'Review nodig' },
  completed: { color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" />, label: 'Voltooid' },
  failed: { color: 'bg-red-100 text-red-800', icon: <AlertCircle className="w-4 h-4" />, label: 'Mislukt' },
};

const InvoiceImportPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [uploadProgress, setUploadProgress] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Fetch imports
  const { data: imports = [], isLoading } = useQuery({
    queryKey: ['invoiceImports'],
    queryFn: () => getInvoiceImports(),
    refetchInterval: 5000, // Auto refresh to check processing status
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: uploadInvoice,
    onMutate: () => {
      setUploadProgress(true);
      setUploadError(null);
    },
    onSuccess: (data) => {
      setUploadProgress(false);
      queryClient.invalidateQueries({ queryKey: ['invoiceImports'] });
      // Navigate to the import detail page
      navigate(`/imports/${data.id}`);
    },
    onError: (error: Error) => {
      setUploadProgress(false);
      setUploadError(error.message || 'Er ging iets mis bij het uploaden');
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteInvoiceImport,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoiceImports'] });
    },
  });

  // Dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      uploadMutation.mutate(acceptedFiles[0]);
    }
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tiff', '.tif'],
    },
    maxSize: 20 * 1024 * 1024, // 20MB
    multiple: false,
  });

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Factuur Import</h1>
        <p className="mt-1 text-sm text-gray-500">
          Upload inkoopfacturen om automatisch gegevens te extraheren met OCR
        </p>
      </div>

      {/* Upload Zone */}
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${uploadProgress ? 'pointer-events-none opacity-60' : ''}
        `}
      >
        <input {...getInputProps()} />
        
        {uploadProgress ? (
          <div className="flex flex-col items-center">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="mt-4 text-lg font-medium text-gray-900">
              Factuur wordt verwerkt...
            </p>
            <p className="mt-1 text-sm text-gray-500">
              OCR herkenning kan even duren
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className={`w-12 h-12 ${isDragActive ? 'text-blue-500' : 'text-gray-400'}`} />
            <p className="mt-4 text-lg font-medium text-gray-900">
              {isDragActive ? 'Laat los om te uploaden' : 'Sleep een factuur hierheen'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              of klik om een bestand te selecteren
            </p>
            <p className="mt-2 text-xs text-gray-400">
              PDF, JPG, PNG of TIFF (max. 20MB)
            </p>
          </div>
        )}
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Upload mislukt</p>
            <p className="text-sm text-red-600">{uploadError}</p>
          </div>
        </div>
      )}

      {/* Recent Imports */}
      <div className="mt-12">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recente Imports</h2>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : imports.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <FileText className="w-12 h-12 text-gray-300 mx-auto" />
            <p className="mt-4 text-gray-500">Nog geen facturen geïmporteerd</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bestand
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patroon
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vertrouwen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Datum
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Acties
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {imports.map((imp: InvoiceImport) => {
                  const status = statusConfig[imp.status] || statusConfig.pending;
                  
                  return (
                    <tr 
                      key={imp.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/imports/${imp.id}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <FileText className="w-5 h-5 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {imp.file_name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {formatFileSize(imp.file_size)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                          {status.icon}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {imp.pattern_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {imp.ocr_confidence !== undefined && imp.ocr_confidence !== null ? (
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  imp.ocr_confidence >= 0.8 ? 'bg-green-500' :
                                  imp.ocr_confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${imp.ocr_confidence * 100}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-600">
                              {(imp.ocr_confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(imp.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm('Weet je zeker dat je deze import wilt verwijderen?')) {
                              deleteMutation.mutate(imp.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Verwijderen
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceImportPage;
