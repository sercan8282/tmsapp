/**
 * Document onderteken pagina - PDF viewer met handtekening plaatsing
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  XMarkIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from '@heroicons/react/24/outline';
import {
  getDocument,
  getPdfInfo,
  getPdfPageImage,
  signDocument,
  SignedDocument,
  PdfInfo,
} from '../../api/documents';
import SignaturePad from '../../components/documents/SignaturePad';

interface SignaturePosition {
  page: number;
  x: number;
  y: number;
  width: number;
}

export default function DocumentSignPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  // Document state
  const [document, setDocument] = useState<SignedDocument | null>(null);
  const [pdfInfo, setPdfInfo] = useState<PdfInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Page state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [loadingPage, setLoadingPage] = useState(false);
  const [zoom, setZoom] = useState(100);
  
  // Signature state
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signaturePosition, setSignaturePosition] = useState<SignaturePosition | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_showSignaturePad, _setShowSignaturePad] = useState(false);
  
  // Signing state
  const [signing, setSigning] = useState(false);
  const [saveSignature, setSaveSignature] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Load document and PDF info
  useEffect(() => {
    if (id) {
      loadDocumentAndInfo();
    }
  }, [id]);

  // Load page image when page changes
  useEffect(() => {
    if (pdfInfo && currentPage) {
      loadPageImage();
    }
  }, [pdfInfo, currentPage, zoom]);

  const loadDocumentAndInfo = async () => {
    try {
      setLoading(true);
      const [docData, infoData] = await Promise.all([
        getDocument(id!),
        getPdfInfo(id!),
      ]);
      
      // Verwijder de redirect - sta toe om documenten opnieuw te ondertekenen
      // if (docData.status === 'signed') {
      //   navigate(`/documents/${id}`);
      //   return;
      // }
      
      setDocument(docData);
      setPdfInfo(infoData);
      setError(null);
    } catch (err) {
      setError('Kon document niet laden');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadPageImage = async () => {
    try {
      setLoadingPage(true);
      const dpi = Math.round(150 * (zoom / 100));
      const blob = await getPdfPageImage(id!, currentPage, dpi);
      const url = URL.createObjectURL(blob);
      
      // Clean up old URL
      if (pageImage) {
        URL.revokeObjectURL(pageImage);
      }
      
      setPageImage(url);
    } catch (err) {
      console.error('Error loading page:', err);
    } finally {
      setLoadingPage(false);
    }
  };

  const handlePageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!signatureDataUrl || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setSignaturePosition({
      page: currentPage,
      x: Math.max(0, Math.min(80, x)),
      y: Math.max(0, Math.min(85, y)),
      width: 20,
    });
  }, [signatureDataUrl, currentPage]);

  const handleSignatureMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleSignatureMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !signaturePosition || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setSignaturePosition({
      ...signaturePosition,
      x: Math.max(0, Math.min(100 - signaturePosition.width, x)),
      y: Math.max(0, Math.min(90, y)),
    });
  }, [isDragging, signaturePosition]);

  const handleSignatureMouseUp = () => {
    setIsDragging(false);
  };

  const handleSign = async () => {
    if (!signatureDataUrl || !signaturePosition) {
      setError('Plaats eerst een handtekening op het document');
      return;
    }

    if (saveSignature && !signatureName.trim()) {
      setError('Voer een naam in voor de opgeslagen handtekening');
      return;
    }

    try {
      setSigning(true);
      setError(null);
      
      await signDocument(id!, {
        signature_image: signatureDataUrl,
        page: signaturePosition.page,
        x: signaturePosition.x,
        y: signaturePosition.y,
        width: signaturePosition.width,
        save_signature: saveSignature,
        signature_name: saveSignature ? signatureName : undefined,
      });
      
      navigate(`/documents/${id}`);
    } catch (err: any) {
      console.error('Sign error:', err);
      setError(err.response?.data?.error || 'Kon document niet ondertekenen');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">{error}</p>
        <Link to="/documents" className="mt-4 text-blue-600 hover:text-blue-800">
          Terug naar documenten
        </Link>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            to={`/documents/${id}`}
            className="text-gray-500 hover:text-gray-700"
          >
            <XMarkIcon className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-lg font-medium text-gray-900">
              {document?.title}
            </h1>
            <p className="text-sm text-gray-500">
              Pagina {currentPage} van {pdfInfo?.page_count || 1}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Zoom controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setZoom(Math.max(50, zoom - 25))}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <MagnifyingGlassMinusIcon className="h-5 w-5" />
            </button>
            <span className="text-sm text-gray-600 w-12 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom(Math.min(200, zoom + 25))}
              className="p-1 text-gray-500 hover:text-gray-700"
            >
              <MagnifyingGlassPlusIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Page navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage <= 1}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <button
              onClick={() => setCurrentPage(Math.min(pdfInfo?.page_count || 1, currentPage + 1))}
              disabled={currentPage >= (pdfInfo?.page_count || 1)}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              <ArrowRightIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Sign button */}
          <button
            onClick={handleSign}
            disabled={!signaturePosition || signing}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {signing ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Ondertekenen...
              </>
            ) : (
              <>
                <CheckIcon className="h-5 w-5 mr-2" />
                Ondertekenen
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF viewer */}
        <div 
          ref={containerRef}
          className="flex-1 overflow-auto p-4"
          onMouseMove={handleSignatureMouseMove}
          onMouseUp={handleSignatureMouseUp}
          onMouseLeave={handleSignatureMouseUp}
        >
          <div className="flex justify-center">
            <div 
              className="relative bg-white shadow-lg"
              onClick={handlePageClick}
              style={{ cursor: signatureDataUrl ? 'crosshair' : 'default' }}
            >
              {loadingPage && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              )}
              
              {pageImage && (
                <img
                  ref={imageRef}
                  src={pageImage}
                  alt={`Pagina ${currentPage}`}
                  className="max-w-full"
                  draggable={false}
                />
              )}
              
              {/* Signature overlay */}
              {signaturePosition && signaturePosition.page === currentPage && signatureDataUrl && (
                <div
                  className={`absolute border-2 ${isDragging ? 'border-blue-600' : 'border-blue-400'} cursor-move`}
                  style={{
                    left: `${signaturePosition.x}%`,
                    top: `${signaturePosition.y}%`,
                    width: `${signaturePosition.width}%`,
                  }}
                  onMouseDown={handleSignatureMouseDown}
                >
                  <img
                    src={signatureDataUrl}
                    alt="Handtekening"
                    className="w-full h-auto"
                    draggable={false}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSignaturePosition(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-white border-l overflow-y-auto p-4 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Handtekening</h2>
            
            {!signatureDataUrl ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Teken eerst uw handtekening hieronder, klik daarna op het document om deze te plaatsen.
                </p>
                <SignaturePad
                  onSignatureChange={setSignatureDataUrl}
                  width={280}
                  height={140}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg p-2 bg-gray-50">
                  <img
                    src={signatureDataUrl}
                    alt="Uw handtekening"
                    className="max-w-full h-auto"
                  />
                </div>
                <button
                  onClick={() => {
                    setSignatureDataUrl(null);
                    setSignaturePosition(null);
                  }}
                  className="w-full px-3 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Andere handtekening
                </button>
                
                {!signaturePosition && (
                  <p className="text-sm text-blue-600 bg-blue-50 p-3 rounded">
                    Klik op het document om de handtekening te plaatsen.
                  </p>
                )}
              </div>
            )}
          </div>

          {signaturePosition && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Positie</h3>
              <div className="text-sm text-gray-500 space-y-1">
                <p>Pagina: {signaturePosition.page}</p>
                <p>X: {signaturePosition.x.toFixed(1)}%</p>
                <p>Y: {signaturePosition.y.toFixed(1)}%</p>
              </div>
              
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-700">
                  Breedte: {signaturePosition.width}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="50"
                  value={signaturePosition.width}
                  onChange={(e) => setSignaturePosition({
                    ...signaturePosition,
                    width: parseInt(e.target.value),
                  })}
                  className="w-full mt-1"
                />
              </div>
            </div>
          )}

          {signatureDataUrl && (
            <div className="border-t pt-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={saveSignature}
                  onChange={(e) => setSaveSignature(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Handtekening opslaan</span>
              </label>
              
              {saveSignature && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={signatureName}
                    onChange={(e) => setSignatureName(e.target.value)}
                    placeholder="Naam voor handtekening"
                    className="w-full border-gray-300 rounded-md shadow-sm text-sm focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Instructies</h3>
            <ol className="text-sm text-gray-500 space-y-2 list-decimal list-inside">
              <li>Teken uw handtekening in het vak hierboven</li>
              <li>Klik op de gewenste positie in het document</li>
              <li>Pas eventueel de grootte aan</li>
              <li>Klik op "Ondertekenen" om te voltooien</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
