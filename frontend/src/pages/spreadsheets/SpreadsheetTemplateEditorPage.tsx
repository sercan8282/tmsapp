import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  PlusIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckCircleIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline'
import {
  SpreadsheetTemplateKolom,
  SpreadsheetTemplateFooter,
  SpreadsheetTemplateStyling,
  SpreadsheetTemplateStandaardTarieven,
  SpreadsheetColumnType,
} from '@/types'
import {
  getSpreadsheetTemplate,
  createSpreadsheetTemplate,
  updateSpreadsheetTemplate,
} from '@/api/spreadsheetTemplates'

// ── Default values ──

const DEFAULT_FOOTER: SpreadsheetTemplateFooter = {
  toon_subtotaal: true,
  toon_btw: false,
  toon_totaal: true,
  btw_percentage: 21,
  totaal_kolommen: [],
}

const DEFAULT_STYLING: SpreadsheetTemplateStyling = {
  header_achtergrond: '#f3f4f6',
  header_tekst_kleur: '#111827',
  header_lettertype: 'bold',
  rij_even_achtergrond: '#ffffff',
  rij_oneven_achtergrond: '#f9fafb',
  rij_tekst_kleur: '#374151',
}

const DEFAULT_TARIEVEN: SpreadsheetTemplateStandaardTarieven = {
  tarief_per_uur: 38.0,
  tarief_per_km: 0.38,
  tarief_dot: 0.22,
}

const COLUMN_TYPES: { value: SpreadsheetColumnType; label: string }[] = [
  { value: 'text', label: 'Tekst' },
  { value: 'nummer', label: 'Nummer' },
  { value: 'datum', label: 'Datum' },
  { value: 'tijd', label: 'Tijd (decimaal)' },
  { value: 'valuta', label: 'Valuta (€)' },
  { value: 'berekend', label: 'Berekend (formule)' },
]

// ── Default ritregistratie columns ──
const DEFAULT_KOLOMMEN: SpreadsheetTemplateKolom[] = [
  { id: 'week', naam: 'WEEK', type: 'nummer', breedte: 60, zichtbaar: true, bewerkbaar: false },
  { id: 'ritnr', naam: 'RITNR', type: 'text', breedte: 80, zichtbaar: true, bewerkbaar: true },
  { id: 'volgnummer', naam: 'Volgnr', type: 'text', breedte: 70, zichtbaar: true, bewerkbaar: true },
  { id: 'chauffeur', naam: 'CHAUFFEUR', type: 'text', breedte: 130, zichtbaar: true, bewerkbaar: true },
  { id: 'datum', naam: 'DATUM', type: 'datum', breedte: 100, zichtbaar: true, bewerkbaar: true },
  { id: 'begin_tijd', naam: 'BEGIN', type: 'tijd', breedte: 70, zichtbaar: true, bewerkbaar: true },
  { id: 'eind_tijd', naam: 'EIND', type: 'tijd', breedte: 70, zichtbaar: true, bewerkbaar: true },
  { id: 'totaal_tijd', naam: 'TOTAAL', type: 'berekend', breedte: 80, zichtbaar: true, bewerkbaar: false, formule: '=eind_tijd-begin_tijd' },
  { id: 'pauze', naam: 'PAUZE', type: 'tijd', breedte: 70, zichtbaar: true, bewerkbaar: true },
  { id: 'correctie', naam: 'CORRECTIE', type: 'tijd', breedte: 80, zichtbaar: true, bewerkbaar: true },
  { id: 'totaal_uren', naam: 'TOTAAL UREN', type: 'berekend', breedte: 100, zichtbaar: true, bewerkbaar: false, formule: '=totaal_tijd-pauze-correctie', styling: { tekstKleur: '#dc2626', lettertype: 'bold' } },
  { id: 'begin_km', naam: 'BEGIN KM', type: 'nummer', breedte: 80, zichtbaar: true, bewerkbaar: true },
  { id: 'eind_km', naam: 'EIND KM', type: 'nummer', breedte: 80, zichtbaar: true, bewerkbaar: true },
  { id: 'totaal_km', naam: 'TOTAAL KM', type: 'berekend', breedte: 90, zichtbaar: true, bewerkbaar: false, formule: '=eind_km-begin_km', styling: { tekstKleur: '#dc2626', lettertype: 'bold' } },
  { id: 'tarief_uur', naam: 'TARIEF UUR', type: 'berekend', breedte: 100, zichtbaar: true, bewerkbaar: false, formule: '=IF(WEEKDAY(datum)=7,1.3,1)*totaal_uren*tarief_per_uur', styling: { tekstKleur: '#dc2626' } },
  { id: 'tarief_km', naam: 'TARIEF KM', type: 'berekend', breedte: 100, zichtbaar: true, bewerkbaar: false, formule: '=totaal_km*tarief_per_km', styling: { tekstKleur: '#dc2626' } },
  { id: 'subtotaal', naam: 'Subtotaal', type: 'berekend', breedte: 90, zichtbaar: true, bewerkbaar: false, formule: '=tarief_uur+tarief_km' },
  { id: 'dot', naam: 'DOT', type: 'berekend', breedte: 90, zichtbaar: true, bewerkbaar: false, formule: '=totaal_km*tarief_dot', styling: { tekstKleur: '#dc2626' } },
  { id: 'overnachting', naam: 'OVERNACHTING', type: 'valuta', breedte: 110, zichtbaar: true, bewerkbaar: true },
  { id: 'overige_kosten', naam: 'OVERIGE KOSTEN', type: 'valuta', breedte: 120, zichtbaar: true, bewerkbaar: true },
  { id: 'rij_totaal', naam: 'TOTAAL', type: 'berekend', breedte: 100, zichtbaar: true, bewerkbaar: false, formule: '=subtotaal+dot+overnachting+overige_kosten' },
]

// ── Formula autocomplete ──

const FORMULA_FUNCTIONS = [
  // ── Wiskunde & Afronden ──
  { name: 'SUM', description: 'Optellen van waarden', syntax: 'SUM(waarde1, waarde2, ...)' },
  { name: 'ABS', description: 'Absolute waarde', syntax: 'ABS(waarde)' },
  { name: 'ROUND', description: 'Afronden op decimalen', syntax: 'ROUND(waarde, decimalen)' },
  { name: 'ROUNDUP', description: 'Naar boven afronden', syntax: 'ROUNDUP(waarde, decimalen)' },
  { name: 'ROUNDDOWN', description: 'Naar beneden afronden', syntax: 'ROUNDDOWN(waarde, decimalen)' },
  { name: 'CEILING', description: 'Naar boven afronden op veelvoud', syntax: 'CEILING(waarde, veelvoud)' },
  { name: 'FLOOR', description: 'Naar beneden afronden op veelvoud', syntax: 'FLOOR(waarde, veelvoud)' },
  { name: 'INT', description: 'Naar beneden afronden naar geheel getal', syntax: 'INT(waarde)' },
  { name: 'TRUNC', description: 'Decimalen afkappen', syntax: 'TRUNC(waarde, decimalen)' },
  { name: 'MOD', description: 'Rest bij deling', syntax: 'MOD(getal, deler)' },
  { name: 'POWER', description: 'Machtsverheffen', syntax: 'POWER(grondtal, exponent)' },
  { name: 'SQRT', description: 'Vierkantswortel', syntax: 'SQRT(waarde)' },
  { name: 'SIGN', description: 'Teken van getal (-1, 0, 1)', syntax: 'SIGN(waarde)' },
  { name: 'PI', description: 'Waarde van PI', syntax: 'PI()' },
  { name: 'RAND', description: 'Willekeurig getal 0-1', syntax: 'RAND()' },
  { name: 'RANDBETWEEN', description: 'Willekeurig geheel getal', syntax: 'RANDBETWEEN(min, max)' },
  { name: 'LOG', description: 'Logaritme', syntax: 'LOG(waarde, grondtal)' },
  { name: 'LOG10', description: 'Logaritme basis 10', syntax: 'LOG10(waarde)' },
  { name: 'LN', description: 'Natuurlijke logaritme', syntax: 'LN(waarde)' },
  { name: 'EXP', description: 'e tot de macht', syntax: 'EXP(waarde)' },
  // ── Statistisch ──
  { name: 'AVG', description: 'Gemiddelde van waarden', syntax: 'AVG(waarde1, waarde2, ...)' },
  { name: 'AVERAGE', description: 'Gemiddelde (alias)', syntax: 'AVERAGE(waarde1, waarde2, ...)' },
  { name: 'AVERAGEIF', description: 'Gemiddelde met voorwaarde', syntax: 'AVERAGEIF(bereik, criterium)' },
  { name: 'MIN', description: 'Minimum van waarden', syntax: 'MIN(waarde1, waarde2, ...)' },
  { name: 'MAX', description: 'Maximum van waarden', syntax: 'MAX(waarde1, waarde2, ...)' },
  { name: 'COUNT', description: 'Aantal numerieke waarden', syntax: 'COUNT(waarde1, waarde2, ...)' },
  { name: 'COUNTA', description: 'Aantal niet-lege waarden', syntax: 'COUNTA(waarde1, waarde2, ...)' },
  { name: 'COUNTBLANK', description: 'Aantal lege waarden', syntax: 'COUNTBLANK(bereik)' },
  { name: 'COUNTIF', description: 'Aantal met voorwaarde', syntax: 'COUNTIF(bereik, criterium)' },
  { name: 'MEDIAN', description: 'Mediaan van waarden', syntax: 'MEDIAN(waarde1, waarde2, ...)' },
  { name: 'MODE', description: 'Meest voorkomende waarde', syntax: 'MODE(waarde1, waarde2, ...)' },
  { name: 'STDEV', description: 'Standaarddeviatie', syntax: 'STDEV(waarde1, waarde2, ...)' },
  { name: 'VAR', description: 'Variantie', syntax: 'VAR(waarde1, waarde2, ...)' },
  { name: 'LARGE', description: 'K-ste grootste waarde', syntax: 'LARGE(bereik, k)' },
  { name: 'SMALL', description: 'K-ste kleinste waarde', syntax: 'SMALL(bereik, k)' },
  { name: 'PERCENTILE', description: 'Percentielwaarde', syntax: 'PERCENTILE(bereik, percentage)' },
  // ── Logisch ──
  { name: 'IF', description: 'Voorwaardelijke berekening', syntax: 'IF(voorwaarde, dan, anders)' },
  { name: 'IFS', description: 'Meerdere voorwaarden', syntax: 'IFS(voorw1, res1, voorw2, res2, ...)' },
  { name: 'IFERROR', description: 'Waarde bij fout', syntax: 'IFERROR(waarde, fout_waarde)' },
  { name: 'IFBLANK', description: 'Waarde als leeg', syntax: 'IFBLANK(waarde, vervanging)' },
  { name: 'AND', description: 'Logische EN', syntax: 'AND(voorw1, voorw2, ...)' },
  { name: 'OR', description: 'Logische OF', syntax: 'OR(voorw1, voorw2, ...)' },
  { name: 'NOT', description: 'Logische NIET', syntax: 'NOT(waarde)' },
  { name: 'XOR', description: 'Exclusieve OF', syntax: 'XOR(voorw1, voorw2, ...)' },
  { name: 'TRUE', description: 'Logische WAAR', syntax: 'TRUE()' },
  { name: 'FALSE', description: 'Logische ONWAAR', syntax: 'FALSE()' },
  { name: 'SWITCH', description: 'Zoek en retourneer', syntax: 'SWITCH(waarde, match1, res1, ..., standaard)' },
  { name: 'CHOOSE', description: 'Kies op positie', syntax: 'CHOOSE(index, waarde1, waarde2, ...)' },
  // ── Vergelijking ──
  { name: 'EQUAL', description: 'Gelijk aan', syntax: 'EQUAL(waarde1, waarde2)' },
  { name: 'GT', description: 'Groter dan', syntax: 'GT(waarde1, waarde2)' },
  { name: 'GTE', description: 'Groter dan of gelijk', syntax: 'GTE(waarde1, waarde2)' },
  { name: 'LT', description: 'Kleiner dan', syntax: 'LT(waarde1, waarde2)' },
  { name: 'LTE', description: 'Kleiner dan of gelijk', syntax: 'LTE(waarde1, waarde2)' },
  { name: 'BETWEEN', description: 'Tussen twee waarden', syntax: 'BETWEEN(waarde, min, max)' },
  // ── Tekst ──
  { name: 'CONCAT', description: 'Tekst samenvoegen', syntax: 'CONCAT(tekst1, tekst2, ...)' },
  { name: 'CONCATENATE', description: 'Tekst samenvoegen (alias)', syntax: 'CONCATENATE(tekst1, tekst2, ...)' },
  { name: 'LEFT', description: 'Linker tekens', syntax: 'LEFT(tekst, aantal)' },
  { name: 'RIGHT', description: 'Rechter tekens', syntax: 'RIGHT(tekst, aantal)' },
  { name: 'MID', description: 'Middelste tekens', syntax: 'MID(tekst, start, aantal)' },
  { name: 'LEN', description: 'Lengte van tekst', syntax: 'LEN(tekst)' },
  { name: 'TRIM', description: 'Spaties verwijderen', syntax: 'TRIM(tekst)' },
  { name: 'UPPER', description: 'Hoofdletters', syntax: 'UPPER(tekst)' },
  { name: 'LOWER', description: 'Kleine letters', syntax: 'LOWER(tekst)' },
  { name: 'PROPER', description: 'Eerste letter hoofdletter', syntax: 'PROPER(tekst)' },
  { name: 'SUBSTITUTE', description: 'Tekst vervangen', syntax: 'SUBSTITUTE(tekst, oud, nieuw)' },
  { name: 'REPLACE', description: 'Tekst op positie vervangen', syntax: 'REPLACE(tekst, start, aantal, nieuw)' },
  { name: 'FIND', description: 'Zoek positie (hoofdlettergevoelig)', syntax: 'FIND(zoek, tekst, start)' },
  { name: 'SEARCH', description: 'Zoek positie (niet hoofdlettergevoelig)', syntax: 'SEARCH(zoek, tekst, start)' },
  { name: 'REPT', description: 'Tekst herhalen', syntax: 'REPT(tekst, aantal)' },
  { name: 'TEXT', description: 'Getal opmaken als tekst', syntax: 'TEXT(waarde, formaat)' },
  { name: 'VALUE', description: 'Tekst naar getal', syntax: 'VALUE(tekst)' },
  { name: 'FIXED', description: 'Getal opmaken met decimalen', syntax: 'FIXED(getal, decimalen, geen_punten)' },
  { name: 'NUMBERVALUE', description: 'Tekst naar nummer', syntax: 'NUMBERVALUE(tekst)' },
  // ── Datum & Tijd ──
  { name: 'WEEKDAY', description: 'Dagnummer van datum (1=ma, 7=zo)', syntax: 'WEEKDAY(datum)' },
  { name: 'WEEKNUM', description: 'Weeknummer van datum', syntax: 'WEEKNUM(datum)' },
  { name: 'TODAY', description: 'Datum van vandaag', syntax: 'TODAY()' },
  { name: 'NOW', description: 'Huidige datum en tijd', syntax: 'NOW()' },
  { name: 'DATE', description: 'Datum maken', syntax: 'DATE(jaar, maand, dag)' },
  { name: 'TIME', description: 'Tijd maken', syntax: 'TIME(uur, minuut, seconde)' },
  { name: 'YEAR', description: 'Jaar uit datum', syntax: 'YEAR(datum)' },
  { name: 'MONTH', description: 'Maand uit datum', syntax: 'MONTH(datum)' },
  { name: 'DAY', description: 'Dag uit datum', syntax: 'DAY(datum)' },
  { name: 'HOUR', description: 'Uur uit tijd', syntax: 'HOUR(tijd)' },
  { name: 'MINUTE', description: 'Minuut uit tijd', syntax: 'MINUTE(tijd)' },
  { name: 'SECOND', description: 'Seconde uit tijd', syntax: 'SECOND(tijd)' },
  { name: 'DAYS', description: 'Aantal dagen tussen datums', syntax: 'DAYS(eind_datum, start_datum)' },
  { name: 'DATEDIF', description: 'Verschil tussen datums', syntax: 'DATEDIF(start, eind, eenheid)' },
  { name: 'NETWORKDAYS', description: 'Werkdagen tussen datums', syntax: 'NETWORKDAYS(start, eind, feestdagen)' },
  { name: 'WORKDAY', description: 'Werkdag na/vóór datum', syntax: 'WORKDAY(start, dagen, feestdagen)' },
  { name: 'EDATE', description: 'Datum plus maanden', syntax: 'EDATE(datum, maanden)' },
  { name: 'EOMONTH', description: 'Einde van maand', syntax: 'EOMONTH(datum, maanden)' },
  { name: 'ISOWEEKNUM', description: 'ISO weeknummer', syntax: 'ISOWEEKNUM(datum)' },
  // ── Opzoeken & Referentie ──
  { name: 'VLOOKUP', description: 'Verticaal zoeken', syntax: 'VLOOKUP(zoekwaarde, bereik, kolom_index, exact)' },
  { name: 'HLOOKUP', description: 'Horizontaal zoeken', syntax: 'HLOOKUP(zoekwaarde, bereik, rij_index, exact)' },
  { name: 'INDEX', description: 'Waarde op positie', syntax: 'INDEX(bereik, rij, kolom)' },
  { name: 'MATCH', description: 'Positie van waarde', syntax: 'MATCH(zoekwaarde, bereik, type)' },
  { name: 'LOOKUP', description: 'Opzoeken in bereik', syntax: 'LOOKUP(zoekwaarde, zoek_bereik, resultaat_bereik)' },
  // ── Informatie ──
  { name: 'ISBLANK', description: 'Is waarde leeg?', syntax: 'ISBLANK(waarde)' },
  { name: 'ISNUMBER', description: 'Is waarde een getal?', syntax: 'ISNUMBER(waarde)' },
  { name: 'ISTEXT', description: 'Is waarde tekst?', syntax: 'ISTEXT(waarde)' },
  { name: 'ISERROR', description: 'Is er een fout?', syntax: 'ISERROR(waarde)' },
  { name: 'ISEVEN', description: 'Is waarde even?', syntax: 'ISEVEN(waarde)' },
  { name: 'ISODD', description: 'Is waarde oneven?', syntax: 'ISODD(waarde)' },
  { name: 'TYPE', description: 'Gegevenstype (1=getal, 2=tekst, ...)', syntax: 'TYPE(waarde)' },
  { name: 'N', description: 'Waarde naar getal', syntax: 'N(waarde)' },
  // ── Financieel ──
  { name: 'PMT', description: 'Periodieke betaling', syntax: 'PMT(rente, periodes, hoofdsom)' },
  { name: 'FV', description: 'Toekomstige waarde', syntax: 'FV(rente, periodes, betaling, huidig)' },
  { name: 'PV', description: 'Huidige waarde', syntax: 'PV(rente, periodes, betaling, toekomstig)' },
  { name: 'NPV', description: 'Netto contante waarde', syntax: 'NPV(rente, waarde1, waarde2, ...)' },
  { name: 'IRR', description: 'Intern rendement', syntax: 'IRR(waarden, schatting)' },
  { name: 'RATE', description: 'Rentepercentage', syntax: 'RATE(periodes, betaling, huidig, toekomstig)' },
  { name: 'NPER', description: 'Aantal periodes', syntax: 'NPER(rente, betaling, huidig, toekomstig)' },
  // ── Conversie & Hulp ──
  { name: 'CONVERT', description: 'Eenheden converteren', syntax: 'CONVERT(waarde, van_eenheid, naar_eenheid)' },
  { name: 'ROMAN', description: 'Naar Romeins cijfer', syntax: 'ROMAN(getal)' },
  { name: 'ARABIC', description: 'Van Romeins naar getal', syntax: 'ARABIC(tekst)' },
  { name: 'BASE', description: 'Naar ander talstelsel', syntax: 'BASE(getal, grondtal, min_lengte)' },
  { name: 'DECIMAL', description: 'Van talstelsel naar decimaal', syntax: 'DECIMAL(tekst, grondtal)' },
  // ── Aggregaat & Conditioneel optellen ──
  { name: 'SUMIF', description: 'Optellen met voorwaarde', syntax: 'SUMIF(bereik, criterium, som_bereik)' },
  { name: 'SUMIFS', description: 'Optellen met meerdere voorwaarden', syntax: 'SUMIFS(som_bereik, bereik1, criterium1, ...)' },
  { name: 'SUMPRODUCT', description: 'Som van producten', syntax: 'SUMPRODUCT(bereik1, bereik2, ...)' },
  { name: 'PRODUCT', description: 'Vermenigvuldigen van waarden', syntax: 'PRODUCT(waarde1, waarde2, ...)' },
  { name: 'SUBTOTAL', description: 'Subtotaal met functienummer', syntax: 'SUBTOTAL(functie_nr, bereik)' },
  { name: 'AGGREGATE', description: 'Aggregaat met opties', syntax: 'AGGREGATE(functie_nr, opties, bereik)' },
]

const SYSTEM_VARS = [
  { name: 'tarief_per_uur', description: 'Uurtarief' },
  { name: 'tarief_per_km', description: 'Kilometertarief' },
  { name: 'tarief_dot', description: 'DOT tarief' },
  { name: 'week_nummer', description: 'Weeknummer' },
]

// ── FormulaInput component with autocomplete ──

function FormulaInput({
  value,
  onChange,
  kolommen,
}: {
  value: string
  onChange: (v: string) => void
  kolommen: SpreadsheetTemplateKolom[]
}) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<
    { name: string; description: string; syntax?: string; type: 'function' | 'column' | 'variable' }[]
  >([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const updateSuggestions = useCallback(
    (text: string) => {
      if (!text.startsWith('=')) {
        setSuggestions([])
        setShowSuggestions(false)
        return
      }

      // Get the last token being typed
      const formula = text.slice(1)
      const tokens = formula.split(/([+\-*/(),= ])/)
      const lastToken = tokens.filter(t => t.trim()).pop() || ''

      if (!lastToken) {
        // Show all options
        const all = [
          ...FORMULA_FUNCTIONS.map(f => ({
            name: f.name,
            description: f.description,
            syntax: f.syntax,
            type: 'function' as const,
          })),
          ...kolommen
            .filter(k => k.id !== '')
            .map(k => ({
              name: k.id,
              description: k.naam,
              type: 'column' as const,
            })),
          ...SYSTEM_VARS.map(v => ({
            name: v.name,
            description: v.description,
            type: 'variable' as const,
          })),
        ]
        setSuggestions(all)
        setShowSuggestions(true)
        setSelectedIdx(0)
        return
      }

      const search = lastToken.toUpperCase()
      const matches = [
        ...FORMULA_FUNCTIONS.filter(f => f.name.includes(search) || f.description.toUpperCase().includes(search)).map(f => ({
          name: f.name,
          description: f.description,
          syntax: f.syntax,
          type: 'function' as const,
        })),
        ...kolommen
          .filter(
            k =>
              k.id.toUpperCase().includes(search) ||
              k.naam.toUpperCase().includes(search),
          )
          .map(k => ({
            name: k.id,
            description: k.naam,
            type: 'column' as const,
          })),
        ...SYSTEM_VARS.filter(
          v =>
            v.name.toUpperCase().includes(search) ||
            v.description.toUpperCase().includes(search),
        ).map(v => ({
          name: v.name,
          description: v.description,
          type: 'variable' as const,
        })),
      ]
      setSuggestions(matches)
      setShowSuggestions(matches.length > 0)
      setSelectedIdx(0)
    },
    [kolommen],
  )

  const applySuggestion = (name: string) => {
    const formula = value.slice(1)
    const tokens = formula.split(/([+\-*/(),= ])/)
    // Replace last non-empty token
    for (let i = tokens.length - 1; i >= 0; i--) {
      if (tokens[i].trim()) {
        tokens[i] = name
        break
      }
    }
    // If no tokens replaced (empty formula), just set the name
    const newFormula = tokens.join('') || name
    onChange('=' + newFormula)
    setShowSuggestions(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      applySuggestion(suggestions[selectedIdx].name)
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => {
          onChange(e.target.value)
          updateSuggestions(e.target.value)
        }}
        onFocus={() => {
          if (value.startsWith('=')) updateSuggestions(value)
        }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        onKeyDown={handleKeyDown}
        placeholder="=SUM(kolom1, kolom2) of =kolom_a*kolom_b"
        className="input text-sm font-mono"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {suggestions.map((s, idx) => (
            <button
              key={`${s.type}-${s.name}`}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm flex flex-col ${
                idx === selectedIdx
                  ? 'bg-primary-50 text-primary-700'
                  : 'hover:bg-gray-50'
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                applySuggestion(s.name)
              }}
              onMouseEnter={() => setSelectedIdx(idx)}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${
                    s.type === 'function'
                      ? 'bg-purple-100 text-purple-700'
                      : s.type === 'column'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {s.type === 'function' ? 'fx' : s.type === 'column' ? 'col' : 'var'}
                </span>
                <span className="font-mono font-medium">{s.name}</span>
                <span className="text-gray-400 text-xs truncate">{s.description}</span>
              </div>
              {s.syntax && (
                <span className="text-gray-400 text-xs font-mono ml-7 mt-0.5">{s.syntax}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Column Editor row ──

function KolomRow({
  kolom,
  index,
  total,
  allKolommen,
  onChange,
  onRemove,
  onMove,
}: {
  kolom: SpreadsheetTemplateKolom
  index: number
  total: number
  allKolommen: SpreadsheetTemplateKolom[]
  onChange: (k: SpreadsheetTemplateKolom) => void
  onRemove: () => void
  onMove: (dir: 'up' | 'down') => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div
      className={`border rounded-lg p-3 ${
        !kolom.zichtbaar ? 'opacity-60 bg-gray-50' : 'bg-white'
      }`}
    >
      {/* Compact row */}
      <div className="flex items-center gap-2">
        {/* Move buttons */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => onMove('up')}
            disabled={index === 0}
            className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <ChevronUpIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onMove('down')}
            disabled={index === total - 1}
            className="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-30"
          >
            <ChevronDownIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ID */}
        <input
          type="text"
          value={kolom.id}
          onChange={e => onChange({ ...kolom, id: e.target.value.replace(/\s/g, '_').toLowerCase() })}
          className="input text-xs font-mono w-28"
          placeholder="kolom_id"
        />

        {/* Name */}
        <input
          type="text"
          value={kolom.naam}
          onChange={e => onChange({ ...kolom, naam: e.target.value })}
          className="input text-sm w-32"
          placeholder="Kolom naam"
        />

        {/* Type */}
        <select
          value={kolom.type}
          onChange={e => {
            const newType = e.target.value as SpreadsheetColumnType
            onChange({ ...kolom, type: newType })
            if (newType === 'berekend') setExpanded(true)
          }}
          className="input text-xs w-28"
        >
          {COLUMN_TYPES.map(t => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {/* Width */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={kolom.breedte}
            onChange={e => onChange({ ...kolom, breedte: parseInt(e.target.value) || 60 })}
            className="input text-xs w-16 text-center"
            min={30}
            max={300}
          />
          <span className="text-xs text-gray-400">px</span>
        </div>

        {/* Visibility toggle */}
        <button
          type="button"
          onClick={() => onChange({ ...kolom, zichtbaar: !kolom.zichtbaar })}
          className={`p-1.5 rounded ${
            kolom.zichtbaar
              ? 'text-green-600 hover:text-green-700'
              : 'text-gray-400 hover:text-gray-500'
          }`}
          title={kolom.zichtbaar ? 'Zichtbaar' : 'Verborgen'}
        >
          {kolom.zichtbaar ? (
            <EyeIcon className="w-4 h-4" />
          ) : (
            <EyeSlashIcon className="w-4 h-4" />
          )}
        </button>

        {/* Expand for more settings */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 text-gray-400 hover:text-gray-600 rounded text-xs"
        >
          {expanded ? '▲' : '▼'}
        </button>

        {/* Remove */}
        <button
          type="button"
          onClick={onRemove}
          className="p-1.5 text-gray-400 hover:text-red-600 rounded"
        >
          <TrashIcon className="w-4 h-4" />
        </button>
      </div>

      {/* Formula quick-access when type is berekend (always visible) */}
      {kolom.type === 'berekend' && !expanded && (
        <div className="mt-2 pl-8">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-500">Formule:</span>
            {kolom.formule ? (
              <span className="text-xs font-mono text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                {kolom.formule}
              </span>
            ) : (
              <span className="text-xs text-orange-500 italic">
                Geen formule ingesteld — klik ▼ om een formule in te voeren
              </span>
            )}
          </div>
        </div>
      )}

      {/* Expanded settings */}
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {/* Formula (only for berekend type) */}
          {kolom.type === 'berekend' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Formule
              </label>
              <FormulaInput
                value={kolom.formule || ''}
                onChange={f => onChange({ ...kolom, formule: f })}
                kolommen={allKolommen}
              />
              <p className="text-xs text-gray-400 mt-1">
                Begin met = en gebruik kolomnamen. Bijv: =eind_tijd-begin_tijd of =SUM(kolom1,kolom2)
              </p>
            </div>
          )}

          {/* Editable toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={kolom.bewerkbaar}
              onChange={e => onChange({ ...kolom, bewerkbaar: e.target.checked })}
              className="rounded"
              id={`edit-${kolom.id}-${index}`}
            />
            <label
              htmlFor={`edit-${kolom.id}-${index}`}
              className="text-sm text-gray-600"
            >
              Bewerkbaar door gebruiker
            </label>
          </div>

          {/* Styling */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Kolom styling
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-xs text-gray-500">Tekstkleur</label>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={kolom.styling?.tekstKleur || '#374151'}
                    onChange={e =>
                      onChange({
                        ...kolom,
                        styling: { ...kolom.styling, tekstKleur: e.target.value },
                      })
                    }
                    className="w-7 h-7 rounded cursor-pointer border"
                  />
                  <input
                    type="text"
                    value={kolom.styling?.tekstKleur || ''}
                    onChange={e =>
                      onChange({
                        ...kolom,
                        styling: { ...kolom.styling, tekstKleur: e.target.value },
                      })
                    }
                    className="input text-xs font-mono w-20"
                    placeholder="#374151"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Achtergrond</label>
                <div className="flex items-center gap-1">
                  <input
                    type="color"
                    value={kolom.styling?.achtergrond || '#ffffff'}
                    onChange={e =>
                      onChange({
                        ...kolom,
                        styling: { ...kolom.styling, achtergrond: e.target.value },
                      })
                    }
                    className="w-7 h-7 rounded cursor-pointer border"
                  />
                  <input
                    type="text"
                    value={kolom.styling?.achtergrond || ''}
                    onChange={e =>
                      onChange({
                        ...kolom,
                        styling: { ...kolom.styling, achtergrond: e.target.value },
                      })
                    }
                    className="input text-xs font-mono w-20"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Lettertype</label>
                <select
                  value={kolom.styling?.lettertype || 'normal'}
                  onChange={e =>
                    onChange({
                      ...kolom,
                      styling: { ...kolom.styling, lettertype: e.target.value },
                    })
                  }
                  className="input text-xs"
                >
                  <option value="normal">Normaal</option>
                  <option value="bold">Vet</option>
                  <option value="italic">Cursief</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500">Uitlijning</label>
                <select
                  value={kolom.styling?.uitlijning || 'left'}
                  onChange={e =>
                    onChange({
                      ...kolom,
                      styling: { ...kolom.styling, uitlijning: e.target.value },
                    })
                  }
                  className="input text-xs"
                >
                  <option value="left">Links</option>
                  <option value="center">Midden</option>
                  <option value="right">Rechts</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Editor Component ──

export default function SpreadsheetTemplateEditorPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isNew = !id

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'kolommen' | 'styling' | 'footer' | 'tarieven' | 'preview'>('kolommen')

  // Form state
  const [naam, setNaam] = useState('')
  const [beschrijving, setBeschrijving] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [kolommen, setKolommen] = useState<SpreadsheetTemplateKolom[]>(DEFAULT_KOLOMMEN)
  const [footer, setFooter] = useState<SpreadsheetTemplateFooter>(DEFAULT_FOOTER)
  const [styling, setStyling] = useState<SpreadsheetTemplateStyling>(DEFAULT_STYLING)
  const [tarieven, setTarieven] = useState<SpreadsheetTemplateStandaardTarieven>(DEFAULT_TARIEVEN)

  // Load template
  useEffect(() => {
    if (id) loadTemplate(id)
  }, [id])

  const loadTemplate = async (templateId: string) => {
    try {
      setLoading(true)
      const data = await getSpreadsheetTemplate(templateId)
      setNaam(data.naam)
      setBeschrijving(data.beschrijving || '')
      setIsActive(data.is_active)
      if (data.kolommen && data.kolommen.length > 0) {
        setKolommen(data.kolommen)
      }
      if (data.footer && Object.keys(data.footer).length > 0) {
        setFooter({ ...DEFAULT_FOOTER, ...data.footer })
      }
      if (data.styling && Object.keys(data.styling).length > 0) {
        setStyling({ ...DEFAULT_STYLING, ...data.styling })
      }
      if (data.standaard_tarieven && Object.keys(data.standaard_tarieven).length > 0) {
        setTarieven({ ...DEFAULT_TARIEVEN, ...data.standaard_tarieven })
      }
    } catch (err) {
      setError('Template laden mislukt')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!naam.trim()) {
      setError('Vul een naam in')
      return
    }
    if (kolommen.length === 0) {
      setError('Voeg minimaal één kolom toe')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const payload = {
        naam,
        beschrijving,
        is_active: isActive,
        kolommen,
        footer,
        standaard_tarieven: tarieven,
        styling,
      }

      if (isNew) {
        const created = await createSpreadsheetTemplate(payload)
        setSuccess('Template aangemaakt!')
        setTimeout(() => setSuccess(null), 3000)
        navigate(`/spreadsheets/templates/${created.id}/edit`, { replace: true })
      } else {
        await updateSpreadsheetTemplate(id!, payload)
        setSuccess('Template opgeslagen!')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
  }

  // Column handlers
  const addKolom = () => {
    const newId = `kolom_${kolommen.length + 1}`
    setKolommen([
      ...kolommen,
      {
        id: newId,
        naam: 'Nieuwe kolom',
        type: 'text',
        breedte: 100,
        zichtbaar: true,
        bewerkbaar: true,
      },
    ])
  }

  const updateKolom = (index: number, kolom: SpreadsheetTemplateKolom) => {
    const updated = [...kolommen]
    updated[index] = kolom
    setKolommen(updated)
  }

  const removeKolom = (index: number) => {
    setKolommen(kolommen.filter((_, i) => i !== index))
  }

  const moveKolom = (index: number, dir: 'up' | 'down') => {
    const target = dir === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= kolommen.length) return
    const updated = [...kolommen]
    ;[updated[index], updated[target]] = [updated[target], updated[index]]
    setKolommen(updated)
  }

  const loadDefaults = () => {
    setKolommen(DEFAULT_KOLOMMEN)
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="page-header mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/spreadsheets/templates')}
            className="p-2 rounded hover:bg-gray-100"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <SwatchIcon className="w-6 h-6 text-primary-600" />
          <h1 className="page-title">
            {isNew ? 'Nieuw Template' : 'Template bewerken'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary text-sm"
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">&times;</button>
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Basic info */}
      <div className="card p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Template naam *
            </label>
            <input
              type="text"
              value={naam}
              onChange={e => setNaam(e.target.value)}
              className="input"
              placeholder="Bijv: Standaard Ritregistratie"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="rounded"
                id="is-active"
              />
              <label htmlFor="is-active" className="text-sm text-gray-600">
                Actief (beschikbaar bij nieuw spreadsheet)
              </label>
            </div>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Beschrijving
            </label>
            <textarea
              value={beschrijving}
              onChange={e => setBeschrijving(e.target.value)}
              className="input"
              rows={2}
              placeholder="Optionele beschrijving van dit template"
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b">
        {[
          { key: 'kolommen', label: 'Kolommen', count: kolommen.length },
          { key: 'styling', label: 'Styling' },
          { key: 'footer', label: 'Footer / Totalen' },
          { key: 'tarieven', label: 'Standaard Tarieven' },
          { key: 'preview', label: 'Preview' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {'count' in tab && tab.count !== undefined && (
              <span className="ml-1.5 text-xs bg-gray-100 px-1.5 py-0.5 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'kolommen' && (
        <div className="space-y-2">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">
              Configureer de kolommen, volgorde, formules en styling.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={loadDefaults}
                className="btn-secondary text-xs"
                title="Laad standaard ritregistratie kolommen"
              >
                Standaard laden
              </button>
              <button onClick={addKolom} className="btn-primary text-xs">
                <PlusIcon className="w-3.5 h-3.5 mr-1" />
                Kolom toevoegen
              </button>
            </div>
          </div>

          {/* Column header labels */}
          <div className="hidden sm:flex items-center gap-2 px-3 text-xs font-medium text-gray-500 mb-1">
            <div className="w-8" /> {/* move buttons */}
            <div className="w-28">ID</div>
            <div className="w-32">Naam</div>
            <div className="w-28">Type</div>
            <div className="w-20">Breedte</div>
          </div>

          {/* Columns */}
          {kolommen.map((kolom, idx) => (
            <KolomRow
              key={`${kolom.id}-${idx}`}
              kolom={kolom}
              index={idx}
              total={kolommen.length}
              allKolommen={kolommen}
              onChange={k => updateKolom(idx, k)}
              onRemove={() => removeKolom(idx)}
              onMove={d => moveKolom(idx, d)}
            />
          ))}

          {kolommen.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              <p>Geen kolommen geconfigureerd.</p>
              <button onClick={loadDefaults} className="btn-secondary text-sm mt-3">
                Standaard kolommen laden
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'styling' && (
        <div className="card p-6 space-y-6">
          <h3 className="text-sm font-semibold text-gray-700">Tabel styling</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Header background */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Header achtergrond
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styling.header_achtergrond}
                  onChange={e =>
                    setStyling({ ...styling, header_achtergrond: e.target.value })
                  }
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={styling.header_achtergrond}
                  onChange={e =>
                    setStyling({ ...styling, header_achtergrond: e.target.value })
                  }
                  className="input text-sm font-mono flex-1"
                />
              </div>
            </div>

            {/* Header text color */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Header tekstkleur
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styling.header_tekst_kleur}
                  onChange={e =>
                    setStyling({ ...styling, header_tekst_kleur: e.target.value })
                  }
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={styling.header_tekst_kleur}
                  onChange={e =>
                    setStyling({ ...styling, header_tekst_kleur: e.target.value })
                  }
                  className="input text-sm font-mono flex-1"
                />
              </div>
            </div>

            {/* Header font */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Header lettertype
              </label>
              <select
                value={styling.header_lettertype}
                onChange={e =>
                  setStyling({ ...styling, header_lettertype: e.target.value })
                }
                className="input text-sm"
              >
                <option value="normal">Normaal</option>
                <option value="bold">Vet</option>
                <option value="italic">Cursief</option>
              </select>
            </div>

            {/* Even row background */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Even rij achtergrond
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styling.rij_even_achtergrond}
                  onChange={e =>
                    setStyling({ ...styling, rij_even_achtergrond: e.target.value })
                  }
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={styling.rij_even_achtergrond}
                  onChange={e =>
                    setStyling({ ...styling, rij_even_achtergrond: e.target.value })
                  }
                  className="input text-sm font-mono flex-1"
                />
              </div>
            </div>

            {/* Odd row background */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Oneven rij achtergrond
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styling.rij_oneven_achtergrond}
                  onChange={e =>
                    setStyling({ ...styling, rij_oneven_achtergrond: e.target.value })
                  }
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={styling.rij_oneven_achtergrond}
                  onChange={e =>
                    setStyling({ ...styling, rij_oneven_achtergrond: e.target.value })
                  }
                  className="input text-sm font-mono flex-1"
                />
              </div>
            </div>

            {/* Row text color */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Rij tekstkleur
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={styling.rij_tekst_kleur}
                  onChange={e =>
                    setStyling({ ...styling, rij_tekst_kleur: e.target.value })
                  }
                  className="w-8 h-8 rounded cursor-pointer border"
                />
                <input
                  type="text"
                  value={styling.rij_tekst_kleur}
                  onChange={e =>
                    setStyling({ ...styling, rij_tekst_kleur: e.target.value })
                  }
                  className="input text-sm font-mono flex-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'footer' && (
        <div className="card p-6 space-y-6">
          <h3 className="text-sm font-semibold text-gray-700">Footer / Totalen configuratie</h3>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={footer.toon_subtotaal}
                onChange={e =>
                  setFooter({ ...footer, toon_subtotaal: e.target.checked })
                }
                className="rounded"
                id="toon-subtotaal"
              />
              <label htmlFor="toon-subtotaal" className="text-sm text-gray-600">
                Subtotaal tonen
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={footer.toon_btw}
                onChange={e =>
                  setFooter({ ...footer, toon_btw: e.target.checked })
                }
                className="rounded"
                id="toon-btw"
              />
              <label htmlFor="toon-btw" className="text-sm text-gray-600">
                BTW tonen
              </label>
            </div>
            {footer.toon_btw && (
              <div className="ml-6">
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  BTW percentage
                </label>
                <input
                  type="number"
                  value={footer.btw_percentage}
                  onChange={e =>
                    setFooter({
                      ...footer,
                      btw_percentage: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="input text-sm w-24"
                  step="0.5"
                  min={0}
                  max={100}
                />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={footer.toon_totaal}
                onChange={e =>
                  setFooter({ ...footer, toon_totaal: e.target.checked })
                }
                className="rounded"
                id="toon-totaal"
              />
              <label htmlFor="toon-totaal" className="text-sm text-gray-600">
                Totaal tonen
              </label>
            </div>
          </div>

          {/* SUM-kolommen in footer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Kolommen met SUM totaal in footer
            </label>
            <div className="flex flex-wrap gap-2">
              {kolommen
                .filter(k => ['nummer', 'valuta', 'berekend', 'tijd'].includes(k.type))
                .map(k => (
                  <label
                    key={k.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 border rounded-full text-xs cursor-pointer transition-colors ${
                      footer.totaal_kolommen?.includes(k.id)
                        ? 'bg-primary-50 border-primary-300 text-primary-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={footer.totaal_kolommen?.includes(k.id) || false}
                      onChange={e => {
                        const current = footer.totaal_kolommen || []
                        setFooter({
                          ...footer,
                          totaal_kolommen: e.target.checked
                            ? [...current, k.id]
                            : current.filter(c => c !== k.id),
                        })
                      }}
                      className="hidden"
                    />
                    {k.naam}
                  </label>
                ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tarieven' && (
        <div className="card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">
            Standaard tarieven
          </h3>
          <p className="text-xs text-gray-500">
            Deze tarieven worden automatisch ingevuld wanneer een nieuwe spreadsheet met dit template wordt aangemaakt.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarief per uur (€)
              </label>
              <input
                type="number"
                value={tarieven.tarief_per_uur}
                onChange={e =>
                  setTarieven({
                    ...tarieven,
                    tarief_per_uur: parseFloat(e.target.value) || 0,
                  })
                }
                className="input"
                step="0.01"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarief per km (€)
              </label>
              <input
                type="number"
                value={tarieven.tarief_per_km}
                onChange={e =>
                  setTarieven({
                    ...tarieven,
                    tarief_per_km: parseFloat(e.target.value) || 0,
                  })
                }
                className="input"
                step="0.01"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tarief DOT (€)
              </label>
              <input
                type="number"
                value={tarieven.tarief_dot}
                onChange={e =>
                  setTarieven({
                    ...tarieven,
                    tarief_dot: parseFloat(e.target.value) || 0,
                  })
                }
                className="input"
                step="0.01"
                min={0}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="card overflow-hidden">
          <h3 className="text-sm font-semibold text-gray-700 p-4 border-b">
            Preview
          </h3>
          <div className="overflow-x-auto">
            <table className="text-sm" style={{ minWidth: kolommen.reduce((s, k) => s + (k.zichtbaar ? k.breedte : 0), 0) }}>
              <thead>
                <tr>
                  {kolommen
                    .filter(k => k.zichtbaar)
                    .map(k => (
                      <th
                        key={k.id}
                        style={{
                          width: k.breedte,
                          minWidth: k.breedte,
                          backgroundColor: styling.header_achtergrond,
                          color: styling.header_tekst_kleur,
                          fontWeight: styling.header_lettertype === 'bold' ? 'bold' : 'normal',
                          fontStyle: styling.header_lettertype === 'italic' ? 'italic' : 'normal',
                          padding: '8px 12px',
                          textAlign: (k.styling?.uitlijning as 'left' | 'center' | 'right') || 'left',
                          borderBottom: '2px solid #e5e7eb',
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {k.naam}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2].map(rowIdx => (
                  <tr key={rowIdx}>
                    {kolommen
                      .filter(k => k.zichtbaar)
                      .map(k => (
                        <td
                          key={k.id}
                          style={{
                            width: k.breedte,
                            minWidth: k.breedte,
                            backgroundColor:
                              k.styling?.achtergrond ||
                              (rowIdx % 2 === 0
                                ? styling.rij_even_achtergrond
                                : styling.rij_oneven_achtergrond),
                            color: k.styling?.tekstKleur || styling.rij_tekst_kleur,
                            fontWeight: k.styling?.lettertype === 'bold' ? 'bold' : 'normal',
                            fontStyle: k.styling?.lettertype === 'italic' ? 'italic' : 'normal',
                            textAlign: (k.styling?.uitlijning as 'left' | 'center' | 'right') || 'left',
                            padding: '6px 12px',
                            borderBottom: '1px solid #e5e7eb',
                            fontSize: '12px',
                          }}
                        >
                          {k.type === 'berekend' ? (
                            <span className="text-gray-400 italic text-xs">
                              {k.formule || '(formule)'}
                            </span>
                          ) : k.type === 'datum' ? (
                            `${15 + rowIdx}-01-2025`
                          ) : k.type === 'valuta' ? (
                            `€ ${(10 + rowIdx * 5).toFixed(2)}`
                          ) : k.type === 'nummer' || k.type === 'tijd' ? (
                            (rowIdx + 1) * 10
                          ) : (
                            `Voorbeeld ${rowIdx + 1}`
                          )}
                        </td>
                      ))}
                  </tr>
                ))}
                {/* Footer preview */}
                {footer.toon_totaal && (
                  <tr>
                    {kolommen
                      .filter(k => k.zichtbaar)
                      .map((k, i) => (
                        <td
                          key={k.id}
                          style={{
                            padding: '8px 12px',
                            borderTop: '2px solid #374151',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            backgroundColor: styling.header_achtergrond,
                          }}
                        >
                          {i === 0
                            ? 'TOTAAL'
                            : footer.totaal_kolommen?.includes(k.id)
                            ? '=SUM(…)'
                            : ''}
                        </td>
                      ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
