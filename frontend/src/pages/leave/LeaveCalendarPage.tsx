/**
 * Leave Calendar Page
 * Visual calendar showing who is on leave when
 */
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline'
import {
  getLeaveCalendar,
  CalendarLeaveEntry,
} from '@/api/leave'

// Color palette for different users
const USER_COLORS = [
  { bg: 'bg-blue-200', text: 'text-blue-800', border: 'border-blue-300' },
  { bg: 'bg-green-200', text: 'text-green-800', border: 'border-green-300' },
  { bg: 'bg-purple-200', text: 'text-purple-800', border: 'border-purple-300' },
  { bg: 'bg-orange-200', text: 'text-orange-800', border: 'border-orange-300' },
  { bg: 'bg-pink-200', text: 'text-pink-800', border: 'border-pink-300' },
  { bg: 'bg-teal-200', text: 'text-teal-800', border: 'border-teal-300' },
  { bg: 'bg-indigo-200', text: 'text-indigo-800', border: 'border-indigo-300' },
  { bg: 'bg-yellow-200', text: 'text-yellow-800', border: 'border-yellow-300' },
  { bg: 'bg-red-200', text: 'text-red-800', border: 'border-red-300' },
  { bg: 'bg-cyan-200', text: 'text-cyan-800', border: 'border-cyan-300' },
]

function getColorForUser(userId: string, userColorMap: Map<string, number>): typeof USER_COLORS[0] {
  if (!userColorMap.has(userId)) {
    userColorMap.set(userId, userColorMap.size % USER_COLORS.length)
  }
  return USER_COLORS[userColorMap.get(userId)!]
}

export default function LeaveCalendarPage() {
  const [entries, setEntries] = useState<CalendarLeaveEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  
  // Map user IDs to colors
  const userColorMap = useMemo(() => new Map<string, number>(), [])

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    const fetchCalendar = async () => {
      setIsLoading(true)
      const startDate = new Date(year, month, 1).toISOString().split('T')[0]
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0]
      
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
  }, [year, month])

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
  }

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
  }

  const goToCurrentMonth = () => {
    setCurrentDate(new Date())
  }

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    const daysInMonth = lastDayOfMonth.getDate()
    
    // Get the day of week (0 = Sunday, 1 = Monday, etc.)
    // We want Monday as first day, so adjust
    let startDay = firstDayOfMonth.getDay() - 1
    if (startDay < 0) startDay = 6
    
    const days: { date: Date | null; isCurrentMonth: boolean }[] = []
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startDay; i++) {
      days.push({ date: null, isCurrentMonth: false })
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }
    
    return days
  }, [year, month])

  // Get leave entries for a specific date
  const getEntriesForDate = (date: Date): CalendarLeaveEntry[] => {
    const dateStr = date.toISOString().split('T')[0]
    return entries.filter(entry => {
      return dateStr >= entry.start_date && dateStr <= entry.end_date
    })
  }

  const monthNames = [
    'Januari', 'Februari', 'Maart', 'April', 'Mei', 'Juni',
    'Juli', 'Augustus', 'September', 'Oktober', 'November', 'December'
  ]

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

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
          <p className="text-gray-500">Overzicht van goedgekeurd verlof</p>
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
          </div>
          <button
            onClick={goToNextMonth}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
        
        <button
          onClick={goToCurrentMonth}
          className="text-sm text-primary-600 hover:text-primary-700 mb-4"
        >
          Huidige maand
        </button>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <>
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
              {/* Day headers */}
              {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day) => (
                <div
                  key={day}
                  className="bg-gray-100 px-2 py-3 text-center text-sm font-medium text-gray-700"
                >
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarDays.map((day, idx) => {
                if (!day.date) {
                  return <div key={idx} className="bg-gray-50 min-h-[100px]" />
                }
                
                const dateStr = day.date.toISOString().split('T')[0]
                const dayEntries = getEntriesForDate(day.date)
                const isToday = dateStr === todayStr
                const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6
                
                return (
                  <div
                    key={idx}
                    className={`bg-white min-h-[100px] p-1 ${isWeekend ? 'bg-gray-50' : ''}`}
                  >
                    <div
                      className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                        isToday ? 'bg-primary-600 text-white' : 'text-gray-700'
                      }`}
                    >
                      {day.date.getDate()}
                    </div>
                    <div className="space-y-1">
                      {dayEntries.slice(0, 3).map((entry) => {
                        const colors = getColorForUser(entry.user_id, userColorMap)
                        return (
                          <div
                            key={entry.id}
                            className={`text-xs px-1 py-0.5 rounded truncate ${colors.bg} ${colors.text}`}
                            title={`${entry.user_naam} - ${entry.leave_type_display}`}
                          >
                            {entry.user_naam.split(' ')[0]}
                          </div>
                        )
                      })}
                      {dayEntries.length > 3 && (
                        <div className="text-xs text-gray-500 px-1">
                          +{dayEntries.length - 3} meer
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            {entries.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Legenda</h3>
                <div className="flex flex-wrap gap-2">
                  {Array.from(new Set(entries.map(e => e.user_id))).map((userId) => {
                    const entry = entries.find(e => e.user_id === userId)!
                    const colors = getColorForUser(userId, userColorMap)
                    return (
                      <div
                        key={userId}
                        className={`text-xs px-2 py-1 rounded ${colors.bg} ${colors.text}`}
                      >
                        {entry.user_naam}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* List View */}
      {entries.length > 0 && (
        <div className="card">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Verlof deze maand ({entries.length})
            </h2>
          </div>
          <div className="divide-y">
            {entries.map((entry) => {
              const colors = getColorForUser(entry.user_id, userColorMap)
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
