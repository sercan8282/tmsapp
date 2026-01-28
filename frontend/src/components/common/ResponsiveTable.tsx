import React from 'react'

// Types for the responsive table
export interface Column<T> {
  key: string
  header: string
  // Render function for table cell
  render: (item: T) => React.ReactNode
  // Priority: columns with higher priority shown on mobile card
  mobilePriority?: 'primary' | 'secondary' | 'hidden'
  // Custom mobile label (defaults to header)
  mobileLabel?: string
  // Sortable column
  sortable?: boolean
  // Width class
  className?: string
}

interface ResponsiveTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string | number
  loading?: boolean
  emptyState?: React.ReactNode
  onRowClick?: (item: T) => void
  // Sorting
  sortField?: string
  sortDirection?: 'asc' | 'desc'
  onSort?: (field: string) => void
  // Action buttons for each row
  renderActions?: (item: T) => React.ReactNode
  // Card title extractor for mobile view
  getCardTitle?: (item: T) => string
  // Card subtitle extractor for mobile view
  getCardSubtitle?: (item: T) => string
}

export default function ResponsiveTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  emptyState,
  onRowClick,
  sortField,
  sortDirection,
  onSort,
  renderActions,
  getCardTitle,
  getCardSubtitle,
}: ResponsiveTableProps<T>) {
  // Filter columns based on mobile priority
  const primaryColumns = columns.filter(col => col.mobilePriority === 'primary')
  const secondaryColumns = columns.filter(col => col.mobilePriority === 'secondary')
  const visibleColumns = columns.filter(col => col.mobilePriority !== 'hidden')

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return null
    return (
      <svg
        className={`w-4 h-4 inline ml-1 ${sortDirection === 'desc' ? 'rotate-180' : ''}`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    )
  }

  if (loading) {
    return (
      <div className="px-4 py-12 text-center text-gray-500">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3">Laden...</span>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-gray-500">
        {emptyState || <p>Geen resultaten gevonden</p>}
      </div>
    )
  }

  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  className={`px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase ${
                    column.sortable && onSort ? 'cursor-pointer hover:bg-gray-100' : ''
                  } ${column.className || ''}`}
                  onClick={() => column.sortable && onSort?.(column.key)}
                >
                  {column.header}
                  {column.sortable && <SortIcon field={column.key} />}
                </th>
              ))}
              {renderActions && (
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">
                  Acties
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map(item => (
              <tr
                key={keyExtractor(item)}
                className={`hover:bg-gray-50 ${onRowClick ? 'cursor-pointer' : ''}`}
                onClick={() => onRowClick?.(item)}
              >
                {columns.map(column => (
                  <td key={column.key} className={`px-4 py-3 ${column.className || ''}`}>
                    {column.render(item)}
                  </td>
                ))}
                {renderActions && (
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {renderActions(item)}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y">
        {data.map(item => (
          <div
            key={keyExtractor(item)}
            className={`p-4 ${onRowClick ? 'cursor-pointer active:bg-gray-50' : ''}`}
            onClick={() => onRowClick?.(item)}
          >
            {/* Card Header with title and actions */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                {getCardTitle && (
                  <h3 className="font-medium text-gray-900 truncate">
                    {getCardTitle(item)}
                  </h3>
                )}
                {getCardSubtitle && (
                  <p className="text-sm text-gray-500 truncate">
                    {getCardSubtitle(item)}
                  </p>
                )}
              </div>
              {renderActions && (
                <div className="flex items-center gap-1 shrink-0">
                  {renderActions(item)}
                </div>
              )}
            </div>

            {/* Primary fields - always shown prominently */}
            {primaryColumns.length > 0 && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mb-2">
                {primaryColumns.map(column => (
                  <div key={column.key} className="text-sm">
                    <span className="text-gray-500">{column.mobileLabel || column.header}: </span>
                    <span className="text-gray-900">{column.render(item)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Secondary fields - shown in a grid */}
            {secondaryColumns.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {secondaryColumns.map(column => (
                  <div key={column.key}>
                    <span className="text-gray-500">{column.mobileLabel || column.header}: </span>
                    <span className="text-gray-700">{column.render(item)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
