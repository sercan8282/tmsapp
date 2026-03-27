/**
 * Ritnummer Hours Overview Tab
 * Shows worked hours per ritnummer per user in 4-week periods.
 * Only for drivers with minimum_uren_per_week set.
 * Uses imported time entries (uren_factuur) as data source.
 */
import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  MagnifyingGlassIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import {
  RitnummerHoursOverview,
  getRitnummerHoursOverview,
  getCurrentYear,
} from '@/api/timetracking'
import toast from 'react-hot-toast'

export default function RitnummerHoursTab() {
  const { t } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<RitnummerHoursOverview[]>([])
  const [filteredData, setFilteredData] = useState<RitnummerHoursOverview[]>([])

  const [searchTerm, setSearchTerm] = useState('')
  const [selectedYear, setSelectedYear] = useState(getCurrentYear())
  const [showOnlyMissed, setShowOnlyMissed] = useState(false)

  const [expandedPeriods, setExpandedPeriods] = useState<Set<number>>(new Set())

  const years = Array.from({ length: 5 }, (_, i) => getCurrentYear() - i).filter(y => y >= 2026)

  useEffect(() => {
    loadData()
  }, [selectedYear])

  useEffect(() => {
    let filtered = [...data]

    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      filtered = filtered.filter(row =>
        row.user_naam.toLowerCase().includes(lower) ||
        row.ritnummer.toLowerCase().includes(lower) ||
        row.user_email.toLowerCase().includes(lower) ||
        row.periode.toString().includes(lower) ||
        `${row.week_start}-${row.week_eind}`.includes(lower)
      )
    }

    if (showOnlyMissed) {
      filtered = filtered.filter(row => row.gemiste_uren !== null && row.gemiste_uren > 0)
    }

    setFilteredData(filtered)
  }, [searchTerm, data, showOnlyMissed])

  const loadData = async () => {
    try {
      setLoading(true)
      const result = await getRitnummerHoursOverview(selectedYear)
      setData(result)
      setFilteredData(result)
    } catch (err) {
      console.error('Failed to load ritnummer hours overview:', err)
      toast.error(t('ritnummerHours.loadError'))
    } finally {
      setLoading(false)
    }
  }

  // Group data by period
  const groupedData = useMemo(() => {
    const groups = new Map<number, { periode: number; week_start: number; week_eind: number; rows: RitnummerHoursOverview[] }>()
    filteredData.forEach(row => {
      if (!groups.has(row.periode)) {
        groups.set(row.periode, { periode: row.periode, week_start: row.week_start, week_eind: row.week_eind, rows: [] })
      }
      groups.get(row.periode)!.rows.push(row)
    })
    return Array.from(groups.values()).sort((a, b) => b.periode - a.periode)
  }, [filteredData])

  const togglePeriod = (periode: number) => {
    setExpandedPeriods(prev => {
      const next = new Set(prev)
      if (next.has(periode)) next.delete(periode)
      else next.add(periode)
      return next
    })
  }

  const formatHours = (hours: number) => {
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    return `${h}:${m.toString().padStart(2, '0')}`
  }

  return (
    <div>
      {/* Filters */}
      <div className="card mb-6">
        <div className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={t('ritnummerHours.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input pl-10 w-full"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${selectedYear === y ? 'bg-primary-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                >
                  {y}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyMissed}
                onChange={(e) => setShowOnlyMissed(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              {t('ritnummerHours.showOnlyMissed')}
            </label>
          </div>
        </div>
      </div>

      {/* Data */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-8 text-center">
            <ChartBarIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">{t('ritnummerHours.noData')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {groupedData.map(group => {
              const isExpanded = expandedPeriods.has(group.periode)
              const totalWorked = group.rows.reduce((sum, r) => sum + r.gewerkte_uren, 0)
              const totalMinimum = group.rows.reduce((sum, r) => sum + (r.minimum_uren || 0), 0)
              const totalMissed = group.rows.reduce((sum, r) => sum + (r.gemiste_uren || 0), 0)

              return (
                <div key={group.periode}>
                  {/* Period header */}
                  <button
                    onClick={() => togglePeriod(group.periode)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded
                        ? <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                        : <ChevronRightIcon className="h-4 w-4 text-gray-500" />
                      }
                      <span className="text-sm font-semibold text-gray-900">
                        {t('weeklyHours.period')} {group.periode}
                      </span>
                      <span className="text-xs text-gray-500">
                        ({t('weeklyHours.weekRange', { start: group.week_start, end: group.week_eind })})
                      </span>
                      <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                        {group.rows.length} {t('ritnummerHours.entries')}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>{t('weeklyHours.workedShort')}: <strong className="text-gray-700">{formatHours(totalWorked)}</strong></span>
                      <span>{t('weeklyHours.minimumShort')}: <strong className="text-gray-700">{formatHours(totalMinimum)}</strong></span>
                      {totalMissed > 0 && (
                        <span className="text-red-600">{t('weeklyHours.missedShort')}: <strong>{formatHours(totalMissed)}</strong></span>
                      )}
                    </div>
                  </button>

                  {/* Period rows */}
                  {isExpanded && (
                    <>
                      {/* Desktop table */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-white">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('ritnummerHours.driverName')}</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">{t('ritnummerHours.ritnummer')}</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('weeklyHours.minimumShort')}</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('weeklyHours.workedShort')}</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('weeklyHours.avgShort')}</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('weeklyHours.missedShort')}</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">KM</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">{t('ritnummerHours.trips')}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {group.rows.map((row, idx) => {
                              const hasMissed = row.gemiste_uren !== null && row.gemiste_uren > 0
                              const avgPerWeek = row.weken_met_uren > 0 ? row.gewerkte_uren / row.weken_met_uren : 0

                              return (
                                <tr key={idx} className={`hover:bg-gray-50 ${hasMissed ? 'bg-red-50/30' : ''}`}>
                                  <td className="px-4 py-2.5">
                                    <div className="text-sm font-medium text-gray-900">{row.user_naam}</div>
                                    <div className="text-xs text-gray-500">{row.user_bedrijf}</div>
                                  </td>
                                  <td className="px-4 py-2.5">
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 font-mono text-sm font-bold text-blue-800">
                                      {row.ritnummer}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-sm text-right text-gray-700">
                                    {row.minimum_uren !== null ? formatHours(row.minimum_uren) : '-'}
                                  </td>
                                  <td className="px-4 py-2.5 text-sm text-right">
                                    <span className={`font-semibold ${hasMissed ? 'text-red-600' : 'text-green-600'}`}>
                                      {formatHours(row.gewerkte_uren)}
                                    </span>
                                  </td>
                                  <td className="px-4 py-2.5 text-sm text-right text-gray-600">
                                    {formatHours(avgPerWeek)}
                                    <span className="text-xs text-gray-400 ml-0.5">/wk</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-sm text-right">
                                    {hasMissed ? (
                                      <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                                        <ExclamationTriangleIcon className="h-4 w-4" />
                                        {formatHours(row.gemiste_uren!)}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-green-600">
                                        <CheckCircleIcon className="h-4 w-4" />
                                        0:00
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 text-sm text-right text-gray-700">
                                    {Math.round(row.totaal_km)}
                                  </td>
                                  <td className="px-4 py-2.5 text-sm text-right text-gray-600">
                                    {row.entries_count}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Mobile card view */}
                      <div className="md:hidden divide-y divide-gray-100">
                        {group.rows.map((row, idx) => {
                          const hasMissed = row.gemiste_uren !== null && row.gemiste_uren > 0
                          const avgPerWeek = row.weken_met_uren > 0 ? row.gewerkte_uren / row.weken_met_uren : 0

                          return (
                            <div key={idx} className={`p-3 ${hasMissed ? 'bg-red-50/30' : ''}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium text-gray-900 truncate">{row.user_naam}</div>
                                  <div className="text-xs text-gray-500">{row.user_bedrijf}</div>
                                </div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 font-mono text-xs font-bold text-blue-800 shrink-0 ml-2">
                                  {row.ritnummer}
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-2 text-xs">
                                <div>
                                  <span className="text-gray-500 block">{t('weeklyHours.minimumShort')}</span>
                                  <span className="font-medium">{row.minimum_uren !== null ? formatHours(row.minimum_uren) : '-'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block">{t('weeklyHours.workedShort')}</span>
                                  <span className={`font-semibold ${hasMissed ? 'text-red-600' : 'text-green-600'}`}>
                                    {formatHours(row.gewerkte_uren)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block">{t('weeklyHours.avgShort')}</span>
                                  <span className="font-medium">{formatHours(avgPerWeek)}</span>
                                </div>
                                <div>
                                  <span className="text-gray-500 block">{t('weeklyHours.missedShort')}</span>
                                  <span className={hasMissed ? 'text-red-600 font-semibold' : 'text-gray-400'}>
                                    {hasMissed ? formatHours(row.gemiste_uren!) : '0:00'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
