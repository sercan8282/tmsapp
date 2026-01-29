import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  AlertCircle,
  Edit2,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
} from 'lucide-react';
import {
  getInvoiceImport,
  submitCorrections,
  extractFromRegion,
  convertToInvoice,
  InvoiceImport,
  BoundingBox,
} from '../../api/ocr';

// Field type labels in Dutch
const fieldLabels: Record<string, string> = {
  invoice_number: 'Factuurnummer',
  invoice_date: 'Factuurdatum',
  due_date: 'Vervaldatum',
  supplier_name: 'Leverancier',
  supplier_address: 'Adres',
  supplier_vat: 'BTW Nummer',
  supplier_kvk: 'KVK',
  subtotal: 'Subtotaal',
  vat_amount: 'BTW Bedrag',
  vat_percentage: 'BTW %',
  total: 'Totaal',
  iban: 'IBAN',
  reference: 'Referentie',
  description: 'Omschrijving',
};

interface Selection {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

const InvoiceImportDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // State
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [corrections, setCorrections] = useState<Record<string, { value: unknown; region?: BoundingBox }>>({});
  const [extractedValues, setExtractedValues] = useState<Record<string, unknown>>({});

  // Fetch import data
  const { data: importData, isLoading, error } = useQuery({
    queryKey: ['invoiceImport', id],
    queryFn: () => getInvoiceImport(id!),
    enabled: !!id,
    refetchInterval: (data) => {
      // Auto refresh while processing
      if (data?.status === 'processing') return 2000;
      return false;
    },
  });

  // Initialize extracted values from import data
  useEffect(() => {
    if (importData?.extracted_data?.fields) {
      setExtractedValues(importData.extracted_data.fields);
    }
  }, [importData]);

  // Mutations
  const correctionMutation = useMutation({
    mutationFn: (data: { corrections: Record<string, { value: unknown; region?: BoundingBox }> }) =>
      submitCorrections(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoiceImport', id] });
    },
  });

  const regionMutation = useMutation({
    mutationFn: (region: { page: number; x: number; y: number; width: number; height: number }) =>
      extractFromRegion(id!, region),
  });

  const convertMutation = useMutation({
    mutationFn: () => {
      const data = { ...extractedValues, ...Object.fromEntries(
        Object.entries(corrections).map(([k, v]) => [k, v.value])
      )};
      return convertToInvoice(id!, {
        invoice_type: 'expense',
        factuurnummer: data.invoice_number as string,
        factuurdatum: data.invoice_date as string,
        omschrijving: data.description as string || importData?.file_name,
        totaal: parseFloat(data.total as string) || 0,
        btw_bedrag: parseFloat(data.vat_amount as string) || 0,
        subtotaal: parseFloat(data.subtotal as string) || 0,
      });
    },
    onSuccess: () => {
      navigate('/expenses');
    },
  });

  // Draw image on canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    const image = imageRef.current;

    if (!canvas || !ctx || !image) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    // Draw OCR lines if available
    const page = importData?.extracted_data?.ocr_pages?.[currentPage];
    if (page?.lines) {
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
      ctx.lineWidth = 1;
      
      for (const line of page.lines) {
        const scaleX = canvas.width / page.width;
        const scaleY = canvas.height / page.height;
        
        ctx.strokeRect(
          line.bbox.x * scaleX * zoom,
          line.bbox.y * scaleY * zoom,
          line.bbox.width * scaleX * zoom,
          line.bbox.height * scaleY * zoom
        );
      }
    }

    // Draw current selection
    if (selection) {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
      ctx.lineWidth = 2;
      
      const x = Math.min(selection.startX, selection.endX);
      const y = Math.min(selection.startY, selection.endY);
      const width = Math.abs(selection.endX - selection.startX);
      const height = Math.abs(selection.endY - selection.startY);
      
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
    }
  }, [importData, currentPage, zoom, selection]);

  // Load page image
  useEffect(() => {
    const page = importData?.extracted_data?.ocr_pages?.[currentPage];
    if (page?.image_path) {
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = img.width * zoom;
          canvas.height = img.height * zoom;
          drawCanvas();
        }
      };
      // Construct URL from path
      img.src = `/api/media/${page.image_path}`;
    }
  }, [importData, currentPage, zoom, drawCanvas]);

  // Canvas event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!editingField) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsSelecting(true);
    setSelection({
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      endX: e.clientX - rect.left,
      endY: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !selection) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setSelection({
      ...selection,
      endX: e.clientX - rect.left,
      endY: e.clientY - rect.top,
    });
    
    drawCanvas();
  };

  const handleMouseUp = async () => {
    if (!isSelecting || !selection || !editingField) return;
    
    setIsSelecting(false);
    
    const page = importData?.extracted_data?.ocr_pages?.[currentPage];
    if (!page) return;
    
    // Convert canvas coordinates to image coordinates
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const scaleX = page.width / canvas.width;
    const scaleY = page.height / canvas.height;
    
    const region: BoundingBox = {
      page: currentPage,
      x: Math.min(selection.startX, selection.endX) * scaleX,
      y: Math.min(selection.startY, selection.endY) * scaleY,
      width: Math.abs(selection.endX - selection.startX) * scaleX,
      height: Math.abs(selection.endY - selection.startY) * scaleY,
    };
    
    // Extract text from region
    try {
      const result = await regionMutation.mutateAsync({
        page: region.page,
        x: region.x,
        y: region.y,
        width: region.width,
        height: region.height,
      });
      
      // Update corrections with the extracted text and region
      setCorrections(prev => ({
        ...prev,
        [editingField]: { value: result.text, region },
      }));
      setExtractedValues(prev => ({
        ...prev,
        [editingField]: result.text,
      }));
      
      setEditingField(null);
      setSelection(null);
    } catch (err) {
      console.error('Failed to extract text from region:', err);
    }
  };

  const handleSaveCorrections = () => {
    if (Object.keys(corrections).length > 0) {
      correctionMutation.mutate({ corrections });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error || !importData) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-6 bg-red-50 rounded-lg text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h2 className="mt-4 text-lg font-medium text-red-800">Import niet gevonden</h2>
        <button
          onClick={() => navigate('/imports')}
          className="mt-4 text-sm text-red-600 hover:text-red-800"
        >
          Terug naar overzicht
        </button>
      </div>
    );
  }

  const totalPages = importData.extracted_data?.ocr_pages?.length || 1;

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/imports')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{importData.file_name}</h1>
            <p className="text-sm text-gray-500">
              {importData.pattern_name ? `Patroon: ${importData.pattern_name}` : 'Geen patroon herkend'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {Object.keys(corrections).length > 0 && (
            <button
              onClick={handleSaveCorrections}
              disabled={correctionMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {correctionMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Correcties Opslaan
            </button>
          )}
          
          <button
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {convertMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4" />
            )}
            Opslaan als Uitgave
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Document Viewer */}
        <div className="flex-1 flex flex-col bg-gray-800">
          {/* Viewer Toolbar */}
          <div className="bg-gray-900 px-4 py-2 flex items-center justify-between text-white">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="p-1.5 hover:bg-gray-700 rounded disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm">
                Pagina {currentPage + 1} van {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="p-1.5 hover:bg-gray-700 rounded disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
                className="p-1.5 hover:bg-gray-700 rounded"
              >
                <ZoomOut className="w-5 h-5" />
              </button>
              <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom(Math.min(2, zoom + 0.25))}
                className="p-1.5 hover:bg-gray-700 rounded"
              >
                <ZoomIn className="w-5 h-5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-1.5 hover:bg-gray-700 rounded ml-2"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Canvas Container */}
          <div className="flex-1 overflow-auto p-4 flex items-start justify-center">
            {importData.status === 'processing' ? (
              <div className="flex flex-col items-center justify-center text-white">
                <Loader2 className="w-12 h-12 animate-spin mb-4" />
                <p>Document wordt verwerkt...</p>
              </div>
            ) : (
              <canvas
                ref={canvasRef}
                className={`bg-white shadow-2xl ${editingField ? 'cursor-crosshair' : 'cursor-default'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
            )}
          </div>

          {/* Selection Mode Indicator */}
          {editingField && (
            <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm">
              <MousePointer2 className="w-4 h-4 inline mr-2" />
              Selecteer het veld "{fieldLabels[editingField] || editingField}" op het document
              <button
                onClick={() => {
                  setEditingField(null);
                  setSelection(null);
                }}
                className="ml-4 underline hover:no-underline"
              >
                Annuleren
              </button>
            </div>
          )}
        </div>

        {/* Sidebar - Extracted Data */}
        <div className="w-96 bg-white border-l overflow-y-auto">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Geëxtraheerde Gegevens</h2>
            <p className="text-sm text-gray-500 mt-1">
              Klik op het potlood icoon om een veld te corrigeren door een regio te selecteren
            </p>
          </div>

          {/* OCR Confidence */}
          {importData.ocr_confidence !== undefined && (
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">OCR Nauwkeurigheid</span>
                <span className="text-sm text-gray-600">
                  {(importData.ocr_confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    importData.ocr_confidence >= 0.8 ? 'bg-green-500' :
                    importData.ocr_confidence >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${importData.ocr_confidence * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Extracted Fields */}
          <div className="divide-y">
            {Object.entries(fieldLabels).map(([key, label]) => {
              const value = extractedValues[key];
              const hasCorrection = key in corrections;
              
              return (
                <div
                  key={key}
                  className={`p-4 ${hasCorrection ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-sm font-medium text-gray-700">{label}</label>
                    <button
                      onClick={() => setEditingField(editingField === key ? null : key)}
                      className={`p-1 rounded hover:bg-gray-100 ${
                        editingField === key ? 'bg-blue-100 text-blue-600' : 'text-gray-400'
                      }`}
                      title="Selecteer regio op document"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={(value as string) || ''}
                    onChange={(e) => {
                      setExtractedValues(prev => ({ ...prev, [key]: e.target.value }));
                      setCorrections(prev => ({ ...prev, [key]: { value: e.target.value } }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={`Voer ${label.toLowerCase()} in...`}
                  />
                  {hasCorrection && (
                    <p className="mt-1 text-xs text-blue-600">
                      ✓ Gecorrigeerd
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Line Items */}
          {importData.lines && importData.lines.length > 0 && (
            <div className="border-t">
              <div className="p-4 border-b bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">Factuurregels</h3>
                <p className="text-xs text-gray-500 mt-1">{importData.lines.length} regels gevonden</p>
              </div>
              <div className="divide-y">
                {importData.lines.map((line, index) => (
                  <div key={line.id} className="p-4">
                    <div className="text-sm font-medium text-gray-900">Regel {index + 1}</div>
                    <p className="text-sm text-gray-600 mt-1">{line.raw_text || line.omschrijving}</p>
                    {line.totaal && (
                      <p className="text-sm text-gray-500 mt-1">€ {line.totaal.toFixed(2)}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw OCR Text (collapsible) */}
          <details className="border-t">
            <summary className="p-4 cursor-pointer hover:bg-gray-50 font-medium text-gray-700">
              Ruwe OCR Tekst
            </summary>
            <div className="p-4 pt-0">
              <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-4 rounded-lg max-h-96 overflow-auto">
                {importData.ocr_text || 'Geen tekst beschikbaar'}
              </pre>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
};

export default InvoiceImportDetailPage;
