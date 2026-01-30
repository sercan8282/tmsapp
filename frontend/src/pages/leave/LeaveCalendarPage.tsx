/**
 * Leave Calendar Page
 * Gantt-style timeline view showing who is on leave when
 * - Employees listed vertically on the left
 * - Horizontal timeline with colored bars for leave periods
 */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import {
  getLeaveCalendar,
  CalendarLeaveEntry,
} from '@/api/leave'

// Color palette for different leave types
const LEAVE_TYPE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  vakantie: { bg: 'bg-blue-400', border: 'border-blue-500', text: 'text-blue-900' },
  overuren: { bg: 'bg-green-400', border: 'border-green-500', text: 'text-green-900' },
  bijzonder_tandarts: { bg: 'bg-purple-400', border: 'border-purple-500', text: 'text-purple-900' },
  bijzonder_huisarts: { bg: 'bg-orange-400', border: 'border-orange-500', text: 'text-orange-900' },
}

function getLeaveTypeColor(type: string) {
  return LEAVE_TYPE_COLORS[type] || { bg: 'bg-gray-400', border: 'border-gray-500', text: 'text-gray-900' }
}

export default function LeaveCalendarPage() {
  const [entries, setEntries] = useState<CalendarLeaveEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  // Get first and last day of month
  const firstDayOfMonth = useMemo(() => new Date(year, month, 1), [year, month])
  const lastDayOfMonth = useMemo(() => new Date(year, month + 1, 0), [year, month])
  const daysInMonth = lastDayOfMonth.getDate()

  // Generate array of dates for the month
  const monthDates = useMemo(() => {
    const dates: Date[] = []
    for (let i = 1; i <= daysInMonth; i++) {
      dates.push(new Date(year, month, i))
    }
    return dates
  }, [year, month, daysInMonth])

  useEffect(() => {
    const fetchCalendar = async () => {
      setIsLoading(true)
      const startDate = firstDayOfMonth.toISOString().split('T')[0]
      const endDate = lastDayOfMonth.toISOString().split('T')[0]
      
      try {
        const data = await getLeaveCalendar(startDate, endDate)
        setEntries(data)
      } catch (err) {
        console.error('Error fetching calendar:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchCalendar()
  }, [firstDayOfMonth, lastDayOfMonth])

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToCurrentMonth = () => {
    setCurrentDate(new Date())
  }

  // Group entries by user
  const userEntries = useMemo(() => {
    const grouped = new Map<string, { naam: string; entries: CalendarLeaveEntry[] }>()
    
    entries.forEach(entry => {
      if (!grouped.has(entry.user_id)) {
        grouped.set(entry.user_id, { naam: entry.user_naam, entries: [] })
      }
      grouped.get(entry.user_id)!.entries.push(entry)
    })
    
    // Sort by name
    return Array.from(grouped.entries()).sort((a, b) => 
      a[1].naam.localeCompare(b[1].naam)
    )
  }, [entries])

  const monthNames = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ]

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // Calculate bar position and width for a leave entry
  const getBarStyle = (entry: CalendarLeaveEntry) => {
    const startDate = new Date(entry.start_date)
    const endDate = new Date(entry.end_date)
    
    // Clamp to current month
    const effectiveStart = startDate < firstDayOfMonth ? firstDayOfMonth : startDate
    const effectiveEnd = endDate > lastDayOfMonth ? lastDayOfMonth : endDate
    
    const startDay = effectiveStart.getDate()
    const endDay = effectiveEnd.getDate()
    
    // Calculate left position (0-100%)
    const left = ((startDay - 1) / daysInMonth) * 100
    // Calculate width (span of days)
    const width = ((endDay - startDay + 1) / daysInMonth) * 100
    
    return { left: `${left}%`, width: `${width}%` }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <Link
            to="/leave"
            className="flex items-center text-gray-600 hover:text-gray-900 mb-2"
          >
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            Terug naar overzicht
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Verlofkalender</h1>
          <p className="text-gray-500">Overzicht van goedgekeurd verlof per medewerker</p>
        </div>
      </div>

      {/* Calendar Navigation */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousMonth}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900">
              {monthNames[month]} {year}
            </h2>
            <button
              onClick={goToCurrentMonth}
              className="text-sm text-primary-600 hover:text-primary-700 mt-1"
            >
              Huidige maand
            </button>
          </div>
          <button
            onClick={goToNextMonth}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b">
          {Object.entries(LEAVE_TYPE_COLORS).map(([type, colors]) => (
            <div key={type} className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded ${colors.bg}`} />
              <span className="text-sm text-gray-600 capitalize">
                {type === 'vakantie' ? 'Vakantie' : 
                 type === 'overuren' ? 'Overuren' :
                 type === 'bijzonder_tandarts' ? 'Tandarts' : 'Huisarts'}
              </span>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : userEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <CalendarDaysIcon className="w-12 h-12 text-gray-300 mb-4" />
            <p>Geen verlof gepland deze maand</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Timeline Grid */}
            <div className="min-w-[800px]">
              {/* Day Headers */}
              <div className="flex border-b border-gray-200">
                {/* Employee name column */}
                <div className="w-40 flex-shrink-0 px-3 py-2 bg-gray-50 font-medium text-sm text-gray-700 sticky left-0 z-10">
                  Medewerker
                </div>
                {/* Day columns */}
                <div className="flex-1 flex">
                  {monthDates.map((date, idx) => {
                    const dateStr = date.toISOString().split('T')[0]
                    const isToday = dateStr === todayStr
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6
                    const dayNames = ['Zo', 'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za']
                    
                    return (
                      <div
                        key={idx}
                        className={`flex-1 min-w-[28px] px-0.5 py-1 text-center text-xs border-l border-gray-100 ${
                          isWeekend ? 'bg-gray-50' : ''
                        } ${isToday ? 'bg-primary-50' : ''}`}
                      >
                        <div className={`font-medium ${isToday ? 'text-primary-600' : 'text-gray-400'}`}>
                          {dayNames[date.getDay()]}
                        </div>
                        <div className={`${isToday ? 'text-primary-700 font-bold' : 'text-gray-600'}`}>
                          {date.getDate()}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Employee Rows */}
              {userEntries.map(([userId, { naam, entries: userLeaveEntries }]) => (
                <div key={userId} className="flex border-b border-gray-100 hover:bg-gray-50">
                  {/* Employee name */}
                  <div className="w-40 flex-shrink-0 px-3 py-3 font-medium text-sm text-gray-900 truncate sticky left-0 bg-white z-10">
                    {naam}
                  </div>
                  {/* Timeline bar area */}
                  <div className="flex-1 relative h-12">
                    {/* Background grid lines */}
                    <div className="absolute inset-0 flex">
                      {monthDates.map((date, idx) => {
                        const isWeekend = date.getDay() === 0 || date.getDay() === 6
                        const dateStr = date.toISOString().split('T')[0]
                        const isToday = dateStr === todayStr
                        return (
                          <div
                            key={idx}
                            className={`flex-1 min-w-[28px] border-l border-gray-100 ${
                              isWeekend ? 'bg-gray-50/50' : ''
                            } ${isToday ? 'bg-primary-50/50' : ''}`}
                          />
                        )
                      })}
                    </div>
                    
                    {/* Leave bars */}
                    <div className="absolute inset-0 py-2 px-0.5">
                      {userLeaveEntries.map((entry) => {
                        const style = getBarStyle(entry)
                        const colors = getLeaveTypeColor(entry.leave_type)
                        
                        return (
                          <div
                            key={entry.id}
                            className={`absolute top-2 h-8 ${colors.bg} ${colors.border} border rounded-md shadow-sm cursor-pointer hover:opacity-90 transition-opacity flex items-center justify-center overflow-hidden`}
                            style={{ left: style.left, width: style.width, minWidth: '24px' }}
                            title={`${entry.user_naam}: ${entry.leave_type_display}\n${new Date(entry.start_date).toLocaleDateString('nl-NL')} - ${new Date(entry.end_date).toLocaleDateString('nl-NL')}\n${entry.hours} uur`}
                          >
                            <span className={`text-xs font-medium ${colors.text} truncate px-1`}>
                              {entry.hours}u
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary List */}
      {entries.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Verlof deze maand ({entries.length})
            </h2>
          </div>
          <div className="divide-y">
            {entries.map((entry) => {
              const colors = getLeaveTypeColor(entry.leave_type)
              return (
                <div key={entry.id} className="px-6 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
                    <div>
                      <p className="font-medium text-gray-900">{entry.user_naam}</p>
                      <p className="text-sm text-gray-500">{entry.leave_type_display}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-900">
                      {new Date(entry.start_date).toLocaleDateString('nl-NL')}
                      {entry.start_date !== entry.end_date && (
                        <> - {new Date(entry.end_date).toLocaleDateString('nl-NL')}</>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{entry.hours} uur</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
