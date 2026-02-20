/**
 * Formula Engine for Spreadsheet Templates
 * 
 * Translates template formulas (using column IDs like 'eind_tijd')
 * into:
 * 1. Excel cell references (like 'G7') for XLSX export
 * 2. Computed values for in-browser display
 */

import type { SpreadsheetTemplateKolom, SpreadsheetRij } from '@/types'

// ── Column letter helpers ──

/** Convert 1-based column index to Excel letter(s): 1→A, 26→Z, 27→AA */
export function colIndexToLetter(col: number): string {
  let result = ''
  while (col > 0) {
    col--
    result = String.fromCharCode(65 + (col % 26)) + result
    col = Math.floor(col / 26)
  }
  return result
}

// ── Known data field → SpreadsheetRij property mapping ──

const DATA_FIELD_MAP: Record<string, keyof SpreadsheetRij> = {
  ritnr: 'ritnr',
  volgnummer: 'volgnummer',
  chauffeur: 'chauffeur',
  datum: 'datum',
  begin_tijd: 'begin_tijd',
  eind_tijd: 'eind_tijd',
  pauze: 'pauze',
  correctie: 'correctie',
  begin_km: 'begin_km',
  eind_km: 'eind_km',
  overnachting: 'overnachting',
  overige_kosten: 'overige_kosten',
}

// ── Build column ID → Excel column letter map ──

export function buildColumnMap(
  kolommen: SpreadsheetTemplateKolom[]
): Map<string, number> {
  const map = new Map<string, number>()
  kolommen.forEach((k, idx) => {
    map.set(k.id, idx + 1) // 1-based
  })
  return map
}

// ── Translate a template formula to an Excel formula ──

/**
 * Translates a template formula like "=eind_tijd-begin_tijd"
 * to an Excel formula like "G7-F7"
 * 
 * @param formula - The template formula (starts with '=')
 * @param colMap - Map of column ID → 1-based column index
 * @param rowNum - Excel row number
 * @param sysVarRowRef - Row where system vars (tariffs) are, e.g. "$5" for row 5
 */
export function translateFormulaToExcel(
  formula: string,
  colMap: Map<string, number>,
  rowNum: number,
  sysVarColMap: Map<string, string>, // e.g. 'tarief_per_uur' → '$O$5'
): string {
  if (!formula || !formula.startsWith('=')) return ''
  if (formula.length > MAX_FORMULA_LENGTH) return ''  // Reject overly long formulas
  
  let excelFormula = formula.slice(1) // remove leading '='
  
  // Collect all identifiers (column IDs and system vars)
  // Sort by length descending to replace longest matches first
  const allIds = [
    ...Array.from(colMap.keys()),
    ...Array.from(sysVarColMap.keys()),
  ].sort((a, b) => b.length - a.length)
  
  for (const id of allIds) {
    // Use word boundary-aware replacement
    const regex = new RegExp(`\\b${escapeRegex(id)}\\b`, 'g')
    
    if (colMap.has(id)) {
      const colLetter = colIndexToLetter(colMap.get(id)!)
      excelFormula = excelFormula.replace(regex, `${colLetter}${rowNum}`)
    } else if (sysVarColMap.has(id)) {
      excelFormula = excelFormula.replace(regex, sysVarColMap.get(id)!)
    }
  }
  
  return excelFormula
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Safety limits ──
const MAX_FORMULA_LENGTH = 500
const MAX_TOKENS = 200

// ── In-browser formula evaluator ──

/**
 * Evaluate a template formula for in-browser display.
 * Supports basic math operations, IF, WEEKDAY, SUM, MIN, MAX, ABS, ROUND, etc.
 */
export function evaluateFormula(
  formula: string,
  kolommen: SpreadsheetTemplateKolom[],
  rij: SpreadsheetRij,
  computedValues: Map<string, number>, // already-computed column values
  sysVars: Record<string, number>,
): number {
  if (!formula || !formula.startsWith('=')) return 0
  if (formula.length > MAX_FORMULA_LENGTH) return 0  // Reject overly long formulas
  
  let expr = formula.slice(1) // remove '='
  
  // Build value map: column IDs → values
  const valueMap = new Map<string, number>()
  
  // Data fields from the row
  for (const kolom of kolommen) {
    if (kolom.type !== 'berekend') {
      const field = DATA_FIELD_MAP[kolom.id]
      if (field) {
        const v = rij[field]
        valueMap.set(kolom.id, typeof v === 'number' ? v : (parseFloat(String(v)) || 0))
      }
    }
  }
  
  // Already-computed (berekend) values
  for (const [id, val] of computedValues) {
    valueMap.set(id, val)
  }
  
  // System variables
  for (const [key, val] of Object.entries(sysVars)) {
    valueMap.set(key, val)
  }
  
  // Replace all identifiers with their numeric values (longest first)
  const allIds = Array.from(valueMap.keys()).sort((a, b) => b.length - a.length)
  
  for (const id of allIds) {
    const regex = new RegExp(`\\b${escapeRegex(id)}\\b`, 'g')
    expr = expr.replace(regex, String(valueMap.get(id) ?? 0))
  }
  
  // Now evaluate the expression with function support
  try {
    return evalExpression(expr)
  } catch {
    return 0
  }
}

// ── Safe expression evaluator ──
// Supports: +, -, *, /, (, ), numbers, and functions

function evalExpression(expr: string): number {
  // Pre-process: replace functions with their evaluated results
  expr = processFunctions(expr)
  
  // Now evaluate pure math expression
  return evalMath(expr)
}

function processFunctions(expr: string): string {
  // Process nested functions from innermost to outermost
  let maxIterations = 50
  while (maxIterations-- > 0) {
    // Find the innermost function call: FUNCNAME(args_without_parentheses)
    const funcMatch = expr.match(/\b([A-Z_]+)\(([^()]*)\)/i)
    if (!funcMatch) break
    
    const fullMatch = funcMatch[0]
    const funcName = funcMatch[1].toUpperCase()
    const argsStr = funcMatch[2]
    
    const result = evalFunction(funcName, argsStr)
    expr = expr.replace(fullMatch, String(result))
  }
  
  return expr
}

function evalFunction(name: string, argsStr: string): number {
  // Split args by comma, evaluate each
  const args = argsStr.split(',').map(a => {
    const trimmed = a.trim()
    if (trimmed === '') return 0
    try {
      return evalMath(trimmed)
    } catch {
      return 0
    }
  })
  
  switch (name) {
    case 'SUM':
    case 'SUMME':
      return args.reduce((a, b) => a + b, 0)
    
    case 'AVG':
    case 'AVERAGE':
    case 'GEMIDDELDE':
      return args.length > 0 ? args.reduce((a, b) => a + b, 0) / args.length : 0
    
    case 'MIN':
      return Math.min(...args)
    
    case 'MAX':
      return Math.max(...args)
    
    case 'ABS':
      return Math.abs(args[0] || 0)
    
    case 'ROUND':
      return Number((args[0] || 0).toFixed(args[1] ?? 0))
    
    case 'ROUNDUP':
    case 'CEILING': {
      const val = args[0] || 0
      const dec = args[1] ?? 0
      const factor = Math.pow(10, dec)
      return Math.ceil(val * factor) / factor
    }
    
    case 'ROUNDDOWN':
    case 'FLOOR': {
      const val = args[0] || 0
      const dec = args[1] ?? 0
      const factor = Math.pow(10, dec)
      return Math.floor(val * factor) / factor
    }
    
    case 'INT':
    case 'TRUNC':
      return Math.trunc(args[0] || 0)
    
    case 'MOD':
      return args[1] ? (args[0] || 0) % args[1] : 0
    
    case 'POWER':
      return Math.pow(args[0] || 0, args[1] || 0)
    
    case 'SQRT':
      return Math.sqrt(args[0] || 0)
    
    case 'SIGN':
      return Math.sign(args[0] || 0)
    
    case 'PI':
      return Math.PI
    
    case 'LOG':
      return args[1] ? Math.log(args[0] || 0) / Math.log(args[1]) : Math.log(args[0] || 0)
    
    case 'LOG10':
      return Math.log10(args[0] || 0)
    
    case 'LN':
      return Math.log(args[0] || 0)
    
    case 'EXP':
      return Math.exp(args[0] || 0)
    
    case 'IF': {
      // IF(condition, trueVal, falseVal)
      // condition is already evaluated as number: 0 = false, nonzero = true
      const condition = args[0] || 0
      return condition !== 0 ? (args[1] ?? 0) : (args[2] ?? 0)
    }
    
    case 'IFERROR':
      // In our context, args[0] is already evaluated - if NaN, use args[1]
      return isNaN(args[0]) ? (args[1] ?? 0) : args[0]
    
    case 'AND':
      return args.every(a => a !== 0) ? 1 : 0
    
    case 'OR':
      return args.some(a => a !== 0) ? 1 : 0
    
    case 'NOT':
      return args[0] === 0 ? 1 : 0
    
    case 'WEEKDAY': {
      // In our spreadsheet, datum is stored as a string like "2026-02-20" or "20-02-2026"
      // But by the time it reaches here, it's already converted to a number or 0
      // The value should be a day-of-week number. We pass the datum value pre-resolved.
      // If the value looks like a day number already (1-7), return it
      const val = args[0] || 0
      if (val >= 1 && val <= 7) return val
      // Otherwise try to parse as date
      return 0
    }
    
    case 'COUNT':
      return args.filter(a => !isNaN(a) && a !== 0).length
    
    case 'COUNTA':
      return args.filter(a => a !== 0).length
    
    case 'MEDIAN': {
      const sorted = [...args].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    }
    
    case 'PRODUCT':
      return args.reduce((a, b) => a * b, 1)
    
    case 'SUMPRODUCT':
      // With single range, just sum
      return args.reduce((a, b) => a + b, 0)
    
    // Comparison functions (return 1 or 0)
    case 'EQUAL':
      return args[0] === args[1] ? 1 : 0
    case 'GT':
      return (args[0] || 0) > (args[1] || 0) ? 1 : 0
    case 'GTE':
      return (args[0] || 0) >= (args[1] || 0) ? 1 : 0
    case 'LT':
      return (args[0] || 0) < (args[1] || 0) ? 1 : 0
    case 'LTE':
      return (args[0] || 0) <= (args[1] || 0) ? 1 : 0
    case 'BETWEEN':
      return (args[0] || 0) >= (args[1] || 0) && (args[0] || 0) <= (args[2] || 0) ? 1 : 0
    
    // Info functions
    case 'ISBLANK':
      return args[0] === 0 ? 1 : 0
    case 'ISNUMBER':
      return !isNaN(args[0]) ? 1 : 0
    case 'ISEVEN':
      return (args[0] || 0) % 2 === 0 ? 1 : 0
    case 'ISODD':
      return (args[0] || 0) % 2 !== 0 ? 1 : 0
    
    // Financial
    case 'PMT': {
      const rate = args[0] || 0
      const nper = args[1] || 0
      const pv = args[2] || 0
      if (rate === 0) return nper ? -pv / nper : 0
      return -(pv * rate * Math.pow(1 + rate, nper)) / (Math.pow(1 + rate, nper) - 1)
    }
    
    // Fallback for unknowns
    default:
      // For Excel-native functions we don't need to evaluate in-browser,
      // return 0 and let the Excel export handle them natively
      return args[0] || 0
  }
}

/** Safe math expression evaluator (no eval()) */
function evalMath(expr: string): number {
  expr = expr.trim()
  if (expr === '') return 0
  
  // Try to parse as plain number first
  const asNum = Number(expr)
  if (!isNaN(asNum) && expr !== '') return asNum
  
  // Tokenize and evaluate using shunting-yard algorithm
  const tokens = tokenize(expr)
  return shuntingYard(tokens)
}

interface Token {
  type: 'number' | 'op' | 'lparen' | 'rparen'
  value: string | number
}

function tokenize(expr: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  
  while (i < expr.length) {
    if (tokens.length >= MAX_TOKENS) break  // Safety limit
    const ch = expr[i]
    
    if (ch === ' ') {
      i++
      continue
    }
    
    // Number (including decimals and negative at start or after operator/paren)
    if (/[0-9.]/.test(ch) || (ch === '-' && (tokens.length === 0 || tokens[tokens.length - 1].type === 'op' || tokens[tokens.length - 1].type === 'lparen'))) {
      let numStr = ch
      i++
      while (i < expr.length && /[0-9.eE]/.test(expr[i])) {
        numStr += expr[i]
        i++
      }
      tokens.push({ type: 'number', value: parseFloat(numStr) })
      continue
    }
    
    if (ch === '(') {
      tokens.push({ type: 'lparen', value: '(' })
      i++
      continue
    }
    
    if (ch === ')') {
      tokens.push({ type: 'rparen', value: ')' })
      i++
      continue
    }
    
    if ('+-*/'.includes(ch)) {
      tokens.push({ type: 'op', value: ch })
      i++
      continue
    }
    
    // Comparison operators
    if (ch === '=' && expr[i + 1] === '=') {
      tokens.push({ type: 'op', value: '==' })
      i += 2
      continue
    }
    if (ch === '=') {
      // Single = is comparison in formula context
      tokens.push({ type: 'op', value: '==' })
      i++
      continue
    }
    if (ch === '<' && expr[i + 1] === '>') {
      tokens.push({ type: 'op', value: '<>' })
      i += 2
      continue
    }
    if (ch === '<' && expr[i + 1] === '=') {
      tokens.push({ type: 'op', value: '<=' })
      i += 2
      continue
    }
    if (ch === '>' && expr[i + 1] === '=') {
      tokens.push({ type: 'op', value: '>=' })
      i += 2
      continue
    }
    if (ch === '<') {
      tokens.push({ type: 'op', value: '<' })
      i++
      continue
    }
    if (ch === '>') {
      tokens.push({ type: 'op', value: '>' })
      i++
      continue
    }
    
    // Skip unknown characters
    i++
  }
  
  return tokens
}

function precedence(op: string): number {
  switch (op) {
    case '==': case '<>': case '<': case '>': case '<=': case '>=':
      return 1
    case '+': case '-':
      return 2
    case '*': case '/':
      return 3
    default:
      return 0
  }
}

function applyOp(op: string, b: number, a: number): number {
  switch (op) {
    case '+': return a + b
    case '-': return a - b
    case '*': return a * b
    case '/': return b !== 0 ? a / b : 0
    case '==': return a === b ? 1 : 0
    case '<>': return a !== b ? 1 : 0
    case '<': return a < b ? 1 : 0
    case '>': return a > b ? 1 : 0
    case '<=': return a <= b ? 1 : 0
    case '>=': return a >= b ? 1 : 0
    default: return 0
  }
}

function shuntingYard(tokens: Token[]): number {
  const output: number[] = []
  const ops: string[] = []
  
  for (const token of tokens) {
    if (token.type === 'number') {
      output.push(token.value as number)
    } else if (token.type === 'op') {
      const op = token.value as string
      while (
        ops.length > 0 &&
        ops[ops.length - 1] !== '(' &&
        precedence(ops[ops.length - 1]) >= precedence(op)
      ) {
        const o = ops.pop()!
        const b = output.pop() ?? 0
        const a = output.pop() ?? 0
        output.push(applyOp(o, b, a))
      }
      ops.push(op)
    } else if (token.type === 'lparen') {
      ops.push('(')
    } else if (token.type === 'rparen') {
      while (ops.length > 0 && ops[ops.length - 1] !== '(') {
        const o = ops.pop()!
        const b = output.pop() ?? 0
        const a = output.pop() ?? 0
        output.push(applyOp(o, b, a))
      }
      ops.pop() // remove '('
    }
  }
  
  while (ops.length > 0) {
    const o = ops.pop()!
    const b = output.pop() ?? 0
    const a = output.pop() ?? 0
    output.push(applyOp(o, b, a))
  }
  
  return output[0] ?? 0
}

// ── High-level: calculate all computed columns for a row ──

export interface TemplateCalcResult {
  [columnId: string]: number
}

/**
 * Calculate all "berekend" columns for a single spreadsheet row,
 * respecting the column order (so a later formula can reference an earlier computed column).
 */
export function calcRowWithTemplate(
  kolommen: SpreadsheetTemplateKolom[],
  rij: SpreadsheetRij,
  sysVars: Record<string, number>,
): TemplateCalcResult {
  const computed = new Map<string, number>()
  const result: TemplateCalcResult = {}
  
  // First pass: set raw data values in computed map for non-berekend columns
  for (const kolom of kolommen) {
    if (kolom.type !== 'berekend') {
      const field = DATA_FIELD_MAP[kolom.id]
      if (field) {
        const v = rij[field]
        computed.set(kolom.id, typeof v === 'number' ? v : (parseFloat(String(v)) || 0))
      }
    }
  }
  
  // Second pass: evaluate 'berekend' columns in order
  // Columns are evaluated strictly in definition order — a column can only
  // reference earlier columns, preventing circular dependencies.
  for (const kolom of kolommen) {
    if (kolom.type === 'berekend' && kolom.formule) {
      // Guard: if the formula references its own ID, skip (circular)
      if (kolom.formule.includes(kolom.id)) {
        result[kolom.id] = 0
        computed.set(kolom.id, 0)
        continue
      }
      const val = evaluateFormula(kolom.formule, kolommen, rij, computed, sysVars)
      // Guard: NaN/Infinity → 0
      const safeVal = Number.isFinite(val) ? val : 0
      computed.set(kolom.id, safeVal)
      result[kolom.id] = safeVal
    }
  }
  
  return result
}

// ── High-level: build Excel formula for a template column ──

/**
 * For a given template, build the Excel cell reference map for system variables.
 * System variables (tarieven) are placed in the header row of their corresponding column.
 * 
 * @param kolommen - Template columns
 * @param tariefRow - The Excel row where tariffs are displayed (e.g. 5)
 */
export function buildSysVarExcelMap(
  kolommen: SpreadsheetTemplateKolom[],
  tariefRow: number,
): Map<string, string> {
  const map = new Map<string, string>()
  
  // Find which columns correspond to tariff-related computed columns
  // tarief_per_uur is used in formulas - we need to find where the tariff value is placed
  // In the standard layout, tariffs are in the header row of their column
  // We look for columns whose formula references the system var
  
  const colMap = buildColumnMap(kolommen)
  
  // For system vars, we put them in fixed cells.
  // We'll place them in the tariff row (row 5) in the columns that use them.
  // Find the first berekend column that uses each tariff
  for (const sysVar of ['tarief_per_uur', 'tarief_per_km', 'tarief_dot']) {
    for (const kolom of kolommen) {
      if (kolom.formule && kolom.formule.includes(sysVar)) {
        const colIdx = colMap.get(kolom.id)
        if (colIdx) {
          const letter = colIndexToLetter(colIdx)
          map.set(sysVar, `$${letter}$${tariefRow}`)
          break
        }
      }
    }
  }
  
  // week_nummer - place in first column
  if (colMap.has('week')) {
    map.set('week_nummer', `$${colIndexToLetter(colMap.get('week')!)}$${tariefRow}`)
  }
  
  return map
}
