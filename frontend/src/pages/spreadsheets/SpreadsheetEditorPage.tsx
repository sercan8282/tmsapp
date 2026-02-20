import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  DocumentArrowDownIcon,
  ArrowDownTrayIcon,
  EnvelopeIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  XMarkIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { Company, SpreadsheetRij } from '@/types'
import {
  getSpreadsheet,
  createSpreadsheet,
  updateSpreadsheet,
  duplicateSpreadsheet,
  sendSpreadsheetEmail,
  importTimeEntries,
  getAvailableWeeks,
} from '@/api/spreadsheets'
import type { AvailableWeek } from '@/api/spreadsheets'
import { getCompanies, getMailingContacts } from '@/api/companies'
import type { MailingListContact } from '@/types'

// ── Helpers ──

const emptyRij = (): SpreadsheetRij => ({
  ritnr: '',
  volgnummer: '',
  chauffeur: '',
  datum: '',
  begin_tijd: null,
  eind_tijd: null,
  pauze: null,
  correctie: null,
  begin_km: null,
  eind_km: null,
  overnachting: null,
  overige_kosten: null,
})

function num(v: number | null | undefined): number {
  return v != null && !isNaN(Number(v)) ? Number(v) : 0
}

function fmt(v: number, decimals = 2): string {
  return v.toFixed(decimals)
}

function fmtCurrency(v: number): string {
  return v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Convert decimal hours (e.g. 8.5) to HH:MM string (e.g. "08:30") */
function decimalToTime(v: number | null | undefined): string {
  if (v == null || isNaN(Number(v))) return ''
  const n = Number(v)
  const negative = n < 0
  const abs = Math.abs(n)
  const h = Math.floor(abs)
  const m = Math.round((abs - h) * 60)
  return `${negative ? '-' : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Convert HH:MM string (e.g. "08:30") to decimal hours (e.g. 8.5) */
function timeToDecimal(v: string): number | null {
  if (!v || !v.includes(':')) return null
  const [hStr, mStr] = v.split(':')
  const h = parseInt(hStr, 10)
  const m = parseInt(mStr || '0', 10)
  if (isNaN(h)) return null
  return h + m / 60
}

function calcRow(rij: SpreadsheetRij, tariefUur: number, tariefKm: number, tariefDot: number) {
  const beginTijd = num(rij.begin_tijd)
  const eindTijd = num(rij.eind_tijd)
  const pauze = num(rij.pauze)
  const correctie = num(rij.correctie)
  const beginKm = num(rij.begin_km)
  const eindKm = num(rij.eind_km)
  const overnachting = num(rij.overnachting)
  const overigeKosten = num(rij.overige_kosten)

  const totaalTijd = eindTijd - beginTijd
  const totaalUren = totaalTijd - pauze - correctie
  const totaalKm = eindKm - beginKm
  const bedragUur = totaalUren * tariefUur
  const bedragKm = totaalKm * tariefKm
  const subtotaal = bedragUur + bedragKm
  const dot = totaalKm * tariefDot
  const rijTotaal = subtotaal + dot + overnachting + overigeKosten

  return { totaalTijd, totaalUren, totaalKm, bedragUur, bedragKm, subtotaal, dot, rijTotaal }
}

// ── Component ──

export default function SpreadsheetEditorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id

  // ── State ──
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [companies, setCompanies] = useState<Company[]>([])
  const [showSettings, setShowSettings] = useState(isNew)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importPreview, setImportPreview] = useState<SpreadsheetRij[]>([])
  const [importMode, setImportMode] = useState<'replace' | 'append'>('append')
  const [availableWeeks, setAvailableWeeks] = useState<AvailableWeek[]>([])
  const [selectedImportWeek, setSelectedImportWeek] = useState<AvailableWeek | null>(null)
  const [selectedChauffeur, setSelectedChauffeur] = useState<{ id: string; naam: string } | null>(null)

  // Form
  const [naam, setNaam] = useState('')
  const [bedrijf, setBedrijf] = useState('')
  const [weekNummer, setWeekNummer] = useState<number>(getCurrentWeek())
  const [jaar, setJaar] = useState<number>(new Date().getFullYear())
  const [tariefPerUur, setTariefPerUur] = useState(38)
  const [tariefPerKm, setTariefPerKm] = useState(0.38)
  const [tariefDot, setTariefDot] = useState(0.22)
  const [rijen, setRijen] = useState<SpreadsheetRij[]>([emptyRij()])
  const [notities, setNotities] = useState('')

  // Email
  const [mailingContacts, setMailingContacts] = useState<MailingListContact[]>([])
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set())
  const [manualEmail, setManualEmail] = useState('')
  const [emailSending, setEmailSending] = useState(false)

  function getCurrentWeek(): number {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    const diff = now.getTime() - start.getTime()
    const oneWeek = 604800000
    return Math.ceil((diff / oneWeek) + start.getDay() / 7)
  }

  // ── Load data ──
  useEffect(() => {
    loadCompanies()
    if (id) loadSpreadsheet(id)
  }, [id])

  const loadCompanies = async () => {
    try {
      const res = await getCompanies({ page_size: 200 })
      setCompanies(res.results)
    } catch (err) {
      console.error('Failed to load companies:', err)
    }
  }

  const loadSpreadsheet = async (sheetId: string) => {
    try {
      setLoading(true)
      const data = await getSpreadsheet(sheetId)
      setNaam(data.naam)
      setBedrijf(data.bedrijf)
      setWeekNummer(data.week_nummer)
      setJaar(data.jaar)
      setTariefPerUur(Number(data.tarief_per_uur))
      setTariefPerKm(Number(data.tarief_per_km))
      setTariefDot(Number(data.tarief_dot))
      setRijen(data.rijen.length > 0 ? data.rijen : [emptyRij()])
      setNotities(data.notities || '')
    } catch (err) {
      setError('Kon registratie niet laden')
    } finally {
      setLoading(false)
    }
  }

  // ── Handlers ──
  const showSuccessMsg = (msg: string) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleSave = async () => {
    if (!naam.trim() || !bedrijf) {
      setError('Vul naam en bedrijf in')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const payload = {
        naam,
        bedrijf,
        week_nummer: weekNummer,
        jaar,
        tarief_per_uur: tariefPerUur,
        tarief_per_km: tariefPerKm,
        tarief_dot: tariefDot,
        rijen,
        notities,
      }

      if (isNew) {
        const created = await createSpreadsheet(payload)
        showSuccessMsg(t('spreadsheets.spreadsheetCreated'))
        navigate(`/spreadsheets/${created.id}`, { replace: true })
      } else {
        await updateSpreadsheet(id!, payload)
        showSuccessMsg(t('spreadsheets.spreadsheetUpdated'))
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  const handleDuplicate = async () => {
    if (!id) return
    try {
      setSaving(true)
      const dup = await duplicateSpreadsheet(id)
      showSuccessMsg(t('spreadsheets.spreadsheetDuplicated'))
      navigate(`/spreadsheets/${dup.id}`)
    } catch (err: any) {
      setError('Dupliceren mislukt')
    } finally {
      setSaving(false)
    }
  }

  // ── Import from time entries ──
  const handleOpenImport = async () => {
    setShowImportModal(true)
    setSelectedImportWeek(null)
    setSelectedChauffeur(null)
    setImportPreview([])
    setImportMode('append')
    try {
      setImportLoading(true)
      setError(null)
      const weeks = await getAvailableWeeks()
      setAvailableWeeks(weeks)
    } catch (err: any) {
      setError('Weken ophalen mislukt: ' + (err.response?.data?.error || err.message))
    } finally {
      setImportLoading(false)
    }
  }

  const handleSelectChauffeur = async (week: AvailableWeek, chauffeur: { id: string; naam: string }) => {
    setSelectedImportWeek(week)
    setSelectedChauffeur(chauffeur)
    try {
      setImportLoading(true)
      setError(null)
      const res = await importTimeEntries({ week_nummer: week.week_nummer, jaar: week.jaar, user: chauffeur.id })
      setImportPreview(res.rijen)
      if (res.count === 0) {
        setError(`Geen urenregistraties gevonden voor ${chauffeur.naam} in week ${week.week_nummer} / ${week.jaar}`)
      }
    } catch (err: any) {
      setError('Importeren mislukt: ' + (err.response?.data?.error || err.message))
    } finally {
      setImportLoading(false)
    }
  }

  const handleImportConfirm = () => {
    if (importMode === 'replace') {
      setRijen(importPreview.length > 0 ? importPreview : [emptyRij()])
    } else {
      const existing = rijen.filter(r => r.ritnr || r.chauffeur || r.datum || r.begin_tijd != null)
      setRijen([...existing, ...importPreview])
    }
    if (selectedImportWeek) {
      setWeekNummer(selectedImportWeek.week_nummer)
      setJaar(selectedImportWeek.jaar)
    }
    setShowImportModal(false)
    setImportPreview([])
    setSelectedImportWeek(null)
    setSelectedChauffeur(null)
    showSuccessMsg(`${importPreview.length} rijen geïmporteerd (${selectedChauffeur?.naam})`)
  }

  const updateRij = (index: number, field: keyof SpreadsheetRij, value: any) => {
    setRijen(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  const addRij = () => {
    const newRij = emptyRij()
    // Pre-fill week and chauffeur from last row
    if (rijen.length > 0) {
      const last = rijen[rijen.length - 1]
      newRij.chauffeur = last.chauffeur
    }
    setRijen(prev => [...prev, newRij])
  }

  const removeRij = (index: number) => {
    if (rijen.length <= 1) return
    setRijen(prev => prev.filter((_, i) => i !== index))
  }

  // ── XLSX Export ──
  const handleExportXlsx = useCallback(async () => {
    const ExcelJS = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    const ws = workbook.addWorksheet('Ritregistratie')

    const companyName = companies.find(c => c.id === bedrijf)?.naam || ''

    // ── Style constants ──
    const redBoldFont: any = { bold: true, color: { argb: 'FFFF0000' }, size: 10 }
    const redFont: any = { color: { argb: 'FFFF0000' } }
    const boldFont: any = { bold: true, size: 10 }
    const thinBorder: any = {
      top: { style: 'thin' },
      bottom: { style: 'thin' },
      left: { style: 'thin' },
      right: { style: 'thin' },
    }
    // Red-text columns: TOTAAL UREN=11, TOTAAL KM=14, TARIEF UUR=15, TARIEF KM=16, DOT=18
    const redCols = new Set([11, 14, 15, 16, 18])

    // ── Column widths ──
    ws.columns = [
      { width: 8 },   // A - WEEK
      { width: 12 },  // B - RITNR
      { width: 12 },  // C - volgnummer
      { width: 14 },  // D - CHAUFFEUR
      { width: 12 },  // E - DATUM
      { width: 9 },   // F - BEGIN
      { width: 9 },   // G - EIND
      { width: 9 },   // H - TOTAAL
      { width: 9 },   // I - PAUZE
      { width: 12 },  // J - CORRECTIE
      { width: 14 },  // K - TOTAAL UREN
      { width: 10 },  // L - BEGIN KM
      { width: 10 },  // M - EIND KM
      { width: 12 },  // N - TOTAAL KM
      { width: 15 },  // O - tarief uur bedrag
      { width: 15 },  // P - tarief km bedrag
      { width: 12 },  // Q - subtotaal
      { width: 10 },  // R - DOT
      { width: 16 },  // S - OVERNACHTING
      { width: 17 },  // T - OVERIGE KOSTEN
      { width: 14 },  // U - totaal factuur
    ]

    // ── Row 1–2: Company header ──
    ws.addRow([]); ws.addRow([])
    ws.mergeCells('A1:D2')
    ws.getCell('A1').value = companyName
    ws.getCell('A1').font = { bold: true, size: 16 }
    ws.getCell('A1').alignment = { vertical: 'middle' }
    ws.mergeCells('E1:G1')
    ws.getCell('E1').value = naam || ''
    ws.getCell('E1').font = { size: 14, bold: true }
    ws.getCell('E1').alignment = { vertical: 'middle' }
    ws.getCell('H1').value = 'Week:'
    ws.getCell('H1').font = { size: 12 }
    ws.getCell('H1').alignment = { vertical: 'middle', horizontal: 'right' }
    ws.getCell('I1').value = weekNummer
    ws.getCell('I1').font = { size: 14, bold: true }
    ws.getCell('I1').alignment = { vertical: 'middle' }
    ws.getRow(1).height = 30

    // ── Row 3: Empty ──
    ws.addRow([])

    // ── Row 4: Tariff sub-headers ──
    const subRow = ws.addRow([])
    subRow.getCell(15).value = 'TARIEF PER UUR'
    subRow.getCell(15).font = redBoldFont
    subRow.getCell(15).alignment = { horizontal: 'center' }
    subRow.getCell(15).border = thinBorder
    subRow.getCell(16).value = 'TARIEF PER KM'
    subRow.getCell(16).font = redBoldFont
    subRow.getCell(16).alignment = { horizontal: 'center' }
    subRow.getCell(16).border = thinBorder
    subRow.getCell(18).value = 'TARIEF DOT'
    subRow.getCell(18).font = redBoldFont
    subRow.getCell(18).alignment = { horizontal: 'center' }
    subRow.getCell(18).border = thinBorder
    subRow.getCell(21).value = 'totaal factuur'
    subRow.getCell(21).font = boldFont
    subRow.getCell(21).alignment = { horizontal: 'center' }
    subRow.getCell(21).border = thinBorder

    // ── Row 5: Main column headers ──
    const hdrRow = ws.addRow([
      'WEEK', 'RITNR', 'volgnummer', 'CHAUFFEUR', 'DATUM',
      'BEGIN', 'EIND', 'TOTAAL', 'PAUZE', 'CORRECTIE', 'TOTAAL UREN',
      'BEGIN KM', 'EIND KM', 'TOTAAL KM',
      Number(tariefPerUur.toFixed(2)),
      Number(tariefPerKm.toFixed(2)),
      'totaal',
      Number(tariefDot.toFixed(2)),
      'OVERNACHTING', 'OVERIGE KOSTEN', '',
    ])
    for (let col = 1; col <= 21; col++) {
      const cell = hdrRow.getCell(col)
      cell.border = thinBorder
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
      if (redCols.has(col)) {
        cell.font = redBoldFont
        if (col === 15 || col === 16 || col === 18) cell.numFmt = '0.00'
      } else {
        cell.font = boldFont
      }
    }

    // ── Row 6: Empty ──
    ws.addRow([])

    // ── Data rows (row 7+) with Excel formulas ──
    const dataStartRow = 7

    rijen.forEach((rij, idx) => {
      const r = dataStartRow + idx  // Excel row number

      // Convert datum to a real Date so WEEKDAY() works in Excel
      let datumValue: Date | string | null = null
      const datumStr = rij.datum || ''
      if (datumStr) {
        const d = new Date(datumStr)
        if (!isNaN(d.getTime())) {
          datumValue = d
        } else {
          datumValue = datumStr
        }
      }

      const dataRow = ws.addRow([
        weekNummer,
        rij.ritnr || '',
        rij.volgnummer || '',
        rij.chauffeur || '',
        datumValue,                               // E - datum (Date for WEEKDAY)
        num(rij.begin_tijd) || null,          // F - decimal
        num(rij.eind_tijd) || null,           // G - decimal
        null,                                  // H - TOTAAL (formula)
        num(rij.pauze) || null,               // I - decimal
        num(rij.correctie) || null,           // J - decimal
        null,                                  // K - TOTAAL UREN (formula)
        rij.begin_km != null ? Math.round(num(rij.begin_km)) : null,  // L
        rij.eind_km != null ? Math.round(num(rij.eind_km)) : null,    // M
        null,                                  // N - TOTAAL KM (formula)
        null,                                  // O - tarief uur (formula)
        null,                                  // P - tarief km (formula)
        null,                                  // Q - subtotaal (formula)
        null,                                  // R - DOT (formula)
        num(rij.overnachting) || null,         // S
        num(rij.overige_kosten) || null,      // T
        null,                                  // U - rij totaal (formula)
      ])

      // Date format for column E
      if (datumValue instanceof Date) {
        dataRow.getCell(5).numFmt = 'DD-MM-YYYY'
      }

      // Excel formulas for calculated columns
      dataRow.getCell(8).value  = { formula: `G${r}-F${r}` }                                      // H = EIND - BEGIN
      dataRow.getCell(11).value = { formula: `H${r}-I${r}-J${r}` }                                 // K = TOTAAL - PAUZE - CORRECTIE
      dataRow.getCell(14).value = { formula: `M${r}-L${r}` }                                       // N = EIND KM - BEGIN KM
      dataRow.getCell(15).value = { formula: `(IF(WEEKDAY(E${r})=7,1.3,1)*K${r})*$O$5` }           // O = weekend-toeslag * uren * tarief
      dataRow.getCell(16).value = { formula: `N${r}*$P$5` }                                        // P = TOTAAL KM * tarief per km
      dataRow.getCell(17).value = { formula: `SUM(O${r}:P${r})` }                                  // Q = subtotaal
      dataRow.getCell(18).value = { formula: `N${r}*$R$5` }                                        // R = DOT
      dataRow.getCell(21).value = { formula: `SUM(Q${r}:T${r})` }                                  // U = rij totaal

      for (let col = 1; col <= 21; col++) {
        const cell = dataRow.getCell(col)
        cell.border = thinBorder
        if (redCols.has(col)) {
          cell.font = redFont
        }
      }
      // Currency format for money columns
      for (const col of [15, 16, 17, 18, 19, 20, 21]) {
        dataRow.getCell(col).numFmt = '#,##0.00'
        dataRow.getCell(col).alignment = { horizontal: 'right' }
      }
    })

    // ── Empty row ──
    ws.addRow([])

    // ── Totals row with SUM formulas ──
    const lastDataRow = dataStartRow + rijen.length - 1
    const totalsRowNum = dataStartRow + rijen.length + 1
    const totRow = ws.addRow([
      'totaal', 'factuur', '€',
    ])

    // Grand total in column D references column U total
    totRow.getCell(4).value = { formula: `U${totalsRowNum}` }
    totRow.getCell(4).numFmt = '#,##0.00'

    // SUM formulas for total columns O–U
    for (const col of [15, 16, 17, 18, 19, 20, 21]) {
      const colLetter = String.fromCharCode(64 + col)
      totRow.getCell(col).value = { formula: `SUM(${colLetter}${dataStartRow}:${colLetter}${lastDataRow})` }
    }

    totRow.getCell(1).font = { bold: true, italic: true }
    totRow.getCell(2).font = { bold: true, italic: true }
    totRow.getCell(3).font = { bold: true, color: { argb: 'FFFF0000' } }
    totRow.getCell(4).font = { bold: true, color: { argb: 'FFFF0000' } }
    for (const col of [15, 16, 17, 18, 21]) {
      totRow.getCell(col).font = { bold: true }
      totRow.getCell(col).numFmt = '#,##0.00'
      totRow.getCell(col).border = thinBorder
    }

    // ── Download ──
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ritregistratie_week${weekNummer}_${jaar}.xlsx`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [rijen, tariefPerUur, tariefPerKm, tariefDot, weekNummer, jaar, bedrijf, companies, naam])

  // ── Email ──
  const openEmailModal = async () => {
    setShowEmailModal(true)
    setSelectedEmails(new Set())
    setManualEmail('')
    if (bedrijf) {
      try {
        const contacts = await getMailingContacts(bedrijf)
        setMailingContacts(contacts.filter(c => c.is_active))
      } catch { setMailingContacts([]) }
    }
  }

  const handleSendEmail = async () => {
    const emails: string[] = [...selectedEmails]
    if (manualEmail.trim()) emails.push(manualEmail.trim())
    if (emails.length === 0 || !id) return
    try {
      setEmailSending(true)
      await sendSpreadsheetEmail(id, emails)
      showSuccessMsg(t('spreadsheets.emailSent'))
      setShowEmailModal(false)
    } catch (err: any) {
      setError(err.response?.data?.error || 'E-mail verzenden mislukt')
    } finally {
      setEmailSending(false)
    }
  }

  // ── Totals ──
  const totals = useMemo(() => {
    let uur = 0, km = 0, sub = 0, dot = 0, over = 0, overig = 0, totaal = 0
    rijen.forEach(rij => {
      const c = calcRow(rij, tariefPerUur, tariefPerKm, tariefDot)
      uur += c.bedragUur; km += c.bedragKm; sub += c.subtotaal
      dot += c.dot; over += num(rij.overnachting); overig += num(rij.overige_kosten)
      totaal += c.rijTotaal
    })
    return { uur, km, sub, dot, over, overig, totaal }
  }, [rijen, tariefPerUur, tariefPerKm, tariefDot])

  // ── Render ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-full">
      {/* Top bar */}
      <div className="page-header flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/spreadsheets')} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg">
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="page-title truncate">
            {isNew ? t('spreadsheets.newSpreadsheet') : naam || t('spreadsheets.editSpreadsheet')}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowSettings(s => !s)} className="btn-secondary text-sm">
            <Cog6ToothIcon className="w-4 h-4 mr-1" />
            {t('spreadsheets.settings')}
          </button>
          <button onClick={handleOpenImport} className="btn-secondary text-sm">
            <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
            {t('spreadsheets.importHours')}
          </button>
          {!isNew && (
            <>
              <button onClick={handleExportXlsx} className="btn-secondary text-sm">
                <DocumentArrowDownIcon className="w-4 h-4 mr-1" />
                XLSX
              </button>
              <button onClick={openEmailModal} className="btn-secondary text-sm">
                <EnvelopeIcon className="w-4 h-4 mr-1" />
                E-mail
              </button>
              <button onClick={handleDuplicate} disabled={saving} className="btn-secondary text-sm">
                <DocumentDuplicateIcon className="w-4 h-4 mr-1" />
                {t('spreadsheets.duplicate')}
              </button>
            </>
          )}
          <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
            {saving ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1" /> {t('common.saving')}</>
            ) : (
              t('common.save')
            )}
          </button>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg flex items-center">
          <CheckCircleIcon className="w-5 h-5 mr-2" />{success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><XMarkIcon className="w-4 h-4" /></button>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="card mb-4 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('spreadsheets.name')} *</label>
              <input type="text" value={naam} onChange={e => setNaam(e.target.value)} className="input text-sm" placeholder="EU Transport Week 7" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('spreadsheets.company')} *</label>
              <select value={bedrijf} onChange={e => setBedrijf(e.target.value)} className="input text-sm">
                <option value="">{t('spreadsheets.selectCompany')}</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.naam}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('spreadsheets.week')}</label>
                <input type="number" value={weekNummer} onChange={e => setWeekNummer(Number(e.target.value))} min={1} max={53} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">{t('spreadsheets.year')}</label>
                <input type="number" value={jaar} onChange={e => setJaar(Number(e.target.value))} className="input text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">€/uur</label>
                <input type="number" value={tariefPerUur} onChange={e => setTariefPerUur(Number(e.target.value))} step="0.01" className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">€/km</label>
                <input type="number" value={tariefPerKm} onChange={e => setTariefPerKm(Number(e.target.value))} step="0.01" className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">DOT</label>
                <input type="number" value={tariefDot} onChange={e => setTariefDot(Number(e.target.value))} step="0.01" className="input text-sm" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Company header */}
      <div className="card mb-1 p-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-t-lg rounded-b-none">
        <div className="flex items-center justify-between">
          <span className="font-bold text-lg">{companies.find(c => c.id === bedrijf)?.naam || '—'}</span>
          <span className="font-medium">Week: {weekNummer} / {jaar}</span>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="card overflow-x-auto rounded-t-none border-t-0">
        {/* Rate headers */}
        <div className="hidden lg:grid bg-gray-100 border-b text-[10px] font-semibold text-gray-500 uppercase"
          style={{ gridTemplateColumns: '50px 90px 50px 90px 90px 60px 60px 55px 55px 55px 65px 80px 80px 70px 80px 80px 85px 70px 70px 75px 40px' }}>
          <div></div><div></div><div></div><div></div><div></div>
          <div></div><div></div><div></div><div></div><div></div><div></div>
          <div></div><div></div><div></div>
          <div className="px-1 py-1 text-center bg-blue-50">{t('spreadsheets.ratePerHour')}</div>
          <div className="px-1 py-1 text-center bg-blue-50">{t('spreadsheets.ratePerKm')}</div>
          <div className="px-1 py-1 text-center bg-blue-50">{t('spreadsheets.subtotal')}</div>
          <div className="px-1 py-1 text-center bg-green-50">{t('spreadsheets.dot')}</div>
          <div className="px-1 py-1 text-center bg-yellow-50">{t('spreadsheets.overnight')}</div>
          <div className="px-1 py-1 text-center bg-yellow-50">{t('spreadsheets.otherCosts')}</div>
          <div></div>
        </div>

        {/* Column headers */}
        <div className="hidden lg:grid bg-gray-50 border-b text-[10px] font-semibold text-gray-600 uppercase"
          style={{ gridTemplateColumns: '50px 90px 50px 90px 90px 60px 60px 55px 55px 55px 65px 80px 80px 70px 80px 80px 85px 70px 70px 75px 40px' }}>
          <div className="px-1 py-2">{t('spreadsheets.week')}</div>
          <div className="px-1 py-2">{t('spreadsheets.tripNumber')}</div>
          <div className="px-1 py-2">{t('spreadsheets.sequenceNumber')}</div>
          <div className="px-1 py-2">{t('spreadsheets.driver')}</div>
          <div className="px-1 py-2">{t('spreadsheets.date')}</div>
          <div className="px-1 py-2">{t('spreadsheets.startTime')}</div>
          <div className="px-1 py-2">{t('spreadsheets.endTime')}</div>
          <div className="px-1 py-2">{t('spreadsheets.totalTime')}</div>
          <div className="px-1 py-2">{t('spreadsheets.breakTime')}</div>
          <div className="px-1 py-2">{t('spreadsheets.correction')}</div>
          <div className="px-1 py-2">{t('spreadsheets.totalHours')}</div>
          <div className="px-1 py-2">{t('spreadsheets.startKm')}</div>
          <div className="px-1 py-2">{t('spreadsheets.endKm')}</div>
          <div className="px-1 py-2">{t('spreadsheets.totalKm')}</div>
          <div className="px-1 py-2 text-right bg-blue-50">€ {fmt(tariefPerUur)}</div>
          <div className="px-1 py-2 text-right bg-blue-50">€ {fmt(tariefPerKm)}</div>
          <div className="px-1 py-2 text-right bg-blue-50">{t('spreadsheets.total')}</div>
          <div className="px-1 py-2 text-right bg-green-50">€ {fmt(tariefDot)}</div>
          <div className="px-1 py-2 bg-yellow-50"></div>
          <div className="px-1 py-2 bg-yellow-50"></div>
          <div></div>
        </div>

        {/* Rows */}
        <div className="divide-y">
          {rijen.map((rij, idx) => {
            const c = calcRow(rij, tariefPerUur, tariefPerKm, tariefDot)
            return (
              <div key={idx}>
                {/* Desktop row */}
                <div className="hidden lg:grid items-center text-sm hover:bg-gray-50"
                  style={{ gridTemplateColumns: '50px 90px 50px 90px 90px 60px 60px 55px 55px 55px 65px 80px 80px 70px 80px 80px 85px 70px 70px 75px 40px' }}>
                  <div className="px-1 py-1 text-gray-400 text-xs text-center">{weekNummer}</div>
                  <CellInput value={rij.ritnr} onChange={v => updateRij(idx, 'ritnr', v)} />
                  <CellInput value={rij.volgnummer} onChange={v => updateRij(idx, 'volgnummer', v)} />
                  <CellInput value={rij.chauffeur} onChange={v => updateRij(idx, 'chauffeur', v)} />
                  <CellInput value={rij.datum} onChange={v => updateRij(idx, 'datum', v)} placeholder="dd-mm-jj" />
                  <CellTime value={rij.begin_tijd} onChange={v => updateRij(idx, 'begin_tijd', v)} />
                  <CellTime value={rij.eind_tijd} onChange={v => updateRij(idx, 'eind_tijd', v)} />
                  <CellReadonly value={decimalToTime(c.totaalTijd)} />
                  <CellTime value={rij.pauze} onChange={v => updateRij(idx, 'pauze', v)} />
                  <CellTime value={rij.correctie} onChange={v => updateRij(idx, 'correctie', v)} />
                  <CellReadonly value={decimalToTime(c.totaalUren)} className="font-medium" />
                  <CellNum value={rij.begin_km} onChange={v => updateRij(idx, 'begin_km', v)} step={1} />
                  <CellNum value={rij.eind_km} onChange={v => updateRij(idx, 'eind_km', v)} step={1} />
                  <CellReadonly value={c.totaalKm.toString()} className="font-medium" />
                  <CellReadonly value={fmtCurrency(c.bedragUur)} className="text-right bg-blue-50/50" />
                  <CellReadonly value={fmtCurrency(c.bedragKm)} className="text-right bg-blue-50/50" />
                  <CellReadonly value={fmtCurrency(c.subtotaal)} className="text-right font-medium bg-blue-50/50" />
                  <CellReadonly value={fmtCurrency(c.dot)} className="text-right bg-green-50/50" />
                  <CellNum value={rij.overnachting} onChange={v => updateRij(idx, 'overnachting', v)} step={0.01} className="bg-yellow-50/50" />
                  <CellNum value={rij.overige_kosten} onChange={v => updateRij(idx, 'overige_kosten', v)} step={0.01} className="bg-yellow-50/50" />
                  <button onClick={() => removeRij(idx)} className="p-1 text-gray-300 hover:text-red-500" title={t('spreadsheets.deleteRow')}>
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Mobile card */}
                <div className="lg:hidden p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-500">Rij {idx + 1}</span>
                    <button onClick={() => removeRij(idx)} className="p-1 text-gray-400 hover:text-red-500">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500">{t('spreadsheets.tripNumber')}</label>
                      <input type="text" value={rij.ritnr} onChange={e => updateRij(idx, 'ritnr', e.target.value)} className="input text-xs py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">{t('spreadsheets.driver')}</label>
                      <input type="text" value={rij.chauffeur} onChange={e => updateRij(idx, 'chauffeur', e.target.value)} className="input text-xs py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">{t('spreadsheets.date')}</label>
                      <input type="text" value={rij.datum} onChange={e => updateRij(idx, 'datum', e.target.value)} className="input text-xs py-1" placeholder="dd-mm-jj" />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500">{t('spreadsheets.startTime')}</label>
                      <input type="time" value={decimalToTime(rij.begin_tijd)} onChange={e => updateRij(idx, 'begin_tijd', timeToDecimal(e.target.value))} className="input text-xs py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">{t('spreadsheets.endTime')}</label>
                      <input type="time" value={decimalToTime(rij.eind_tijd)} onChange={e => updateRij(idx, 'eind_tijd', timeToDecimal(e.target.value))} className="input text-xs py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">{t('spreadsheets.breakTime')}</label>
                      <input type="time" value={decimalToTime(rij.pauze)} onChange={e => updateRij(idx, 'pauze', timeToDecimal(e.target.value))} className="input text-xs py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">{t('spreadsheets.totalHours')}</label>
                      <div className="input text-xs py-1 bg-gray-50 font-medium">{decimalToTime(c.totaalUren)}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500">{t('spreadsheets.startKm')}</label>
                      <input type="number" value={rij.begin_km ?? ''} onChange={e => updateRij(idx, 'begin_km', e.target.value ? Number(e.target.value) : null)} className="input text-xs py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">{t('spreadsheets.endKm')}</label>
                      <input type="number" value={rij.eind_km ?? ''} onChange={e => updateRij(idx, 'eind_km', e.target.value ? Number(e.target.value) : null)} className="input text-xs py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500">{t('spreadsheets.totalKm')}</label>
                      <div className="input text-xs py-1 bg-gray-50 font-medium">{c.totaalKm}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between bg-gray-50 p-2 rounded text-sm">
                    <span className="text-gray-500">{t('spreadsheets.rowTotal')}:</span>
                    <span className="font-bold">€ {fmtCurrency(c.rijTotaal)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Add row button */}
        <div className="border-t p-2">
          <button onClick={addRij} className="btn-secondary text-sm w-full justify-center">
            <PlusIcon className="w-4 h-4 mr-1" />
            {t('spreadsheets.addRow')}
          </button>
        </div>

        {/* Totals row */}
        <div className="border-t-2 border-gray-300 bg-gray-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="text-lg font-bold text-gray-900">
              {t('spreadsheets.total')} {t('spreadsheets.totalInvoice')}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="text-center">
                <div className="text-xs text-gray-500">{t('spreadsheets.rateHour')}</div>
                <div className="font-medium">€ {fmtCurrency(totals.uur)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">{t('spreadsheets.rateKm')}</div>
                <div className="font-medium">€ {fmtCurrency(totals.km)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">{t('spreadsheets.subtotal')}</div>
                <div className="font-semibold">€ {fmtCurrency(totals.sub)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">{t('spreadsheets.dot')}</div>
                <div className="font-medium">€ {fmtCurrency(totals.dot)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">{t('spreadsheets.overnight')}</div>
                <div className="font-medium">€ {fmtCurrency(totals.over)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">{t('spreadsheets.otherCosts')}</div>
                <div className="font-medium">€ {fmtCurrency(totals.overig)}</div>
              </div>
              <div className="text-center border-l-2 pl-4">
                <div className="text-xs text-gray-500 font-semibold">{t('spreadsheets.totalInvoice')}</div>
                <div className="text-xl font-bold text-primary-600">€ {fmtCurrency(totals.totaal)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="card mt-4 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('spreadsheets.notes')}</label>
        <textarea
          value={notities}
          onChange={e => setNotities(e.target.value)}
          className="input text-sm"
          rows={2}
          placeholder="Optionele notities..."
        />
      </div>

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <EnvelopeIcon className="w-5 h-5 text-primary-600" />
              {t('spreadsheets.sendEmail')}
            </h3>

            {mailingContacts.length > 0 && (
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Mailing list</label>
                <div className="max-h-40 overflow-y-auto border rounded divide-y">
                  {mailingContacts.map(contact => (
                    <label key={contact.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedEmails.has(contact.email)}
                        onChange={e => {
                          const s = new Set(selectedEmails)
                          e.target.checked ? s.add(contact.email) : s.delete(contact.email)
                          setSelectedEmails(s)
                        }}
                        className="rounded border-gray-300 text-primary-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{contact.naam}</div>
                        <div className="text-xs text-gray-500 truncate">{contact.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mailingContacts.length > 0 ? 'Of handmatig e-mailadres:' : 'E-mailadres'}
              </label>
              <input
                type="email"
                value={manualEmail}
                onChange={e => setManualEmail(e.target.value)}
                placeholder="email@bedrijf.nl"
                className="input text-sm"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowEmailModal(false)} className="btn-secondary text-sm" disabled={emailSending}>
                {t('common.cancel')}
              </button>
              <button
                onClick={handleSendEmail}
                disabled={emailSending || (selectedEmails.size === 0 && !manualEmail.trim())}
                className="btn-primary text-sm"
              >
                {emailSending ? t('common.sending') : t('common.send')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal – Two-step: chauffeur per week → entries preview */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 p-6 max-h-[80vh] flex flex-col">
            <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <ArrowDownTrayIcon className="w-5 h-5 text-primary-600" />
              {t('spreadsheets.importHours')}
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              {t('spreadsheets.importDescription')}
            </p>

            {importLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : !selectedChauffeur ? (
              /* ── Step 1: Week + chauffeur overview ── */
              availableWeeks.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>{t('spreadsheets.noWeeksAvailable')}</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto border rounded mb-3">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">{t('spreadsheets.week')}</th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">{t('spreadsheets.driver')}</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">{t('spreadsheets.entries')}</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">{t('spreadsheets.totalHours')}</th>
                        <th className="px-3 py-2 text-right font-medium text-gray-600">{t('spreadsheets.totalKm')}</th>
                        <th className="px-3 py-2 text-center font-medium text-gray-600"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {availableWeeks.map(week =>
                        week.chauffeurs.map((ch, chIdx) => (
                          <tr
                            key={`${week.jaar}-${week.week_nummer}-${ch.id}`}
                            className="hover:bg-primary-50 cursor-pointer"
                            onClick={() => handleSelectChauffeur(week, { id: ch.id, naam: ch.naam })}
                          >
                            <td className="px-3 py-2">
                              {chIdx === 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary-100 text-primary-800">
                                  W{week.week_nummer} '{String(week.jaar).slice(-2)}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 font-medium">{ch.naam}</td>
                            <td className="px-3 py-2 text-right">{ch.entries}</td>
                            <td className="px-3 py-2 text-right">{ch.totaal_uren}u</td>
                            <td className="px-3 py-2 text-right">{ch.totaal_km} km</td>
                            <td className="px-3 py-2 text-center">
                              <span className="text-primary-600 text-xs font-medium">Selecteer →</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )
            ) : importPreview.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>{t('spreadsheets.noTimeEntries')}</p>
                <button onClick={() => { setSelectedChauffeur(null); setSelectedImportWeek(null); setImportPreview([]) }} className="mt-2 text-sm text-primary-600 hover:text-primary-800">
                  ← {t('spreadsheets.backToWeeks')}
                </button>
              </div>
            ) : (
              /* ── Step 2: Entries preview for selected chauffeur + week ── */
              <>
                <div className="mb-3 flex items-center justify-between">
                  <button onClick={() => { setSelectedChauffeur(null); setSelectedImportWeek(null); setImportPreview([]) }} className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1">
                    ← {t('spreadsheets.backToWeeks')}
                  </button>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-primary-100 text-primary-800">
                      W{selectedImportWeek?.week_nummer} '{String(selectedImportWeek?.jaar || '').slice(-2)}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{selectedChauffeur.naam}</span>
                  </div>
                </div>

                <div className="mb-3 flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700">{t('spreadsheets.importMode')}:</span>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={importMode === 'append'} onChange={() => setImportMode('append')} className="text-primary-600" />
                    {t('spreadsheets.importAppend')}
                  </label>
                  <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                    <input type="radio" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} className="text-primary-600" />
                    {t('spreadsheets.importReplace')}
                  </label>
                </div>

                <div className="flex-1 overflow-auto border rounded mb-3">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">{t('spreadsheets.tripNumber')}</th>
                        <th className="px-2 py-1.5 text-left font-medium text-gray-600">{t('spreadsheets.date')}</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('spreadsheets.startTime')}</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('spreadsheets.endTime')}</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('spreadsheets.breakTime')}</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('spreadsheets.startKm')}</th>
                        <th className="px-2 py-1.5 text-right font-medium text-gray-600">{t('spreadsheets.endKm')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {importPreview.map((rij, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-2 py-1.5">{rij.ritnr}</td>
                          <td className="px-2 py-1.5">{rij.datum}</td>
                          <td className="px-2 py-1.5 text-right">{decimalToTime(rij.begin_tijd)}</td>
                          <td className="px-2 py-1.5 text-right">{decimalToTime(rij.eind_tijd)}</td>
                          <td className="px-2 py-1.5 text-right">{decimalToTime(rij.pauze)}</td>
                          <td className="px-2 py-1.5 text-right">{rij.begin_km}</td>
                          <td className="px-2 py-1.5 text-right">{rij.eind_km}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-sm text-gray-500 mb-3">{importPreview.length} {t('spreadsheets.entriesFound')}</p>
              </>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => { setShowImportModal(false); setImportPreview([]); setSelectedImportWeek(null); setSelectedChauffeur(null) }} className="btn-secondary text-sm">
                {t('common.cancel')}
              </button>
              {selectedChauffeur && importPreview.length > 0 && (
                <button onClick={handleImportConfirm} className="btn-primary text-sm">
                  <ArrowDownTrayIcon className="w-4 h-4 mr-1" />
                  {t('spreadsheets.importConfirm')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Cell components ──

function CellInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border-0 bg-transparent px-1 py-1.5 text-sm focus:ring-1 focus:ring-primary-400 rounded"
    />
  )
}

function CellNum({ value, onChange, step = 0.5, className = '' }: { value: number | null; onChange: (v: number | null) => void; step?: number; className?: string }) {
  return (
    <input
      type="number"
      value={value != null ? value : ''}
      onChange={e => onChange(e.target.value !== '' ? Number(e.target.value) : null)}
      step={step}
      className={`w-full border-0 bg-transparent px-1 py-1.5 text-sm text-right focus:ring-1 focus:ring-primary-400 rounded ${className}`}
    />
  )
}

function CellReadonly({ value, className = '' }: { value: string; className?: string }) {
  return (
    <div className={`px-1 py-1.5 text-sm text-gray-600 ${className}`}>
      {value}
    </div>
  )
}

function CellTime({ value, onChange, className = '' }: { value: number | null; onChange: (v: number | null) => void; className?: string }) {
  return (
    <input
      type="time"
      value={decimalToTime(value)}
      onChange={e => onChange(timeToDecimal(e.target.value))}
      className={`w-full border-0 bg-transparent px-1 py-1.5 text-sm focus:ring-1 focus:ring-primary-400 rounded ${className}`}
    />
  )
}
