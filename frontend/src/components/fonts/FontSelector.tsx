/**
 * Font Selector Component
 * Dropdown component for selecting fonts in settings and templates
 */
import { useState, useEffect, useRef } from 'react'
import { ChevronDownIcon, CheckIcon } from '@heroicons/react/24/outline'
import { useFontFamilies } from './FontLoader'

interface FontSelectorProps {
  value: string | null
  onChange: (family: string | null) => void
  label?: string
  placeholder?: string
  includeDefault?: boolean
  defaultLabel?: string
  error?: string
  disabled?: boolean
  className?: string
}

export default function FontSelector({
  value,
  onChange,
  label,
  placeholder = 'Selecteer een font...',
  includeDefault = true,
  defaultLabel = 'Standaard (Inter)',
  error,
  disabled = false,
  className = '',
}: FontSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { families, loading } = useFontFamilies()
  const containerRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const displayValue = value || placeholder

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2 border rounded-lg
          bg-white text-left transition-colors
          ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'cursor-pointer hover:border-primary-400'}
          ${error ? 'border-red-500' : 'border-gray-300'}
          ${isOpen ? 'ring-2 ring-primary-500 border-primary-500' : ''}
        `}
      >
        <span
          className={`block truncate ${!value ? 'text-gray-400' : 'text-gray-900'}`}
          style={value ? { fontFamily: value } : undefined}
        >
          {value === null && includeDefault ? defaultLabel : displayValue}
        </span>
        <ChevronDownIcon 
          className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {loading ? (
            <div className="p-3 text-sm text-gray-500 text-center">
              Laden...
            </div>
          ) : (
            <>
              {/* Default option */}
              {includeDefault && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null)
                    setIsOpen(false)
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 text-left
                    hover:bg-gray-50 transition-colors
                    ${value === null ? 'bg-primary-50 text-primary-700' : ''}
                  `}
                >
                  <span>{defaultLabel}</span>
                  {value === null && <CheckIcon className="h-5 w-5 text-primary-600" />}
                </button>
              )}

              {/* Divider */}
              {includeDefault && families.length > 0 && (
                <div className="border-t border-gray-100" />
              )}

              {/* Font families */}
              {families.map((family) => (
                <button
                  key={family}
                  type="button"
                  onClick={() => {
                    onChange(family)
                    setIsOpen(false)
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2 text-left
                    hover:bg-gray-50 transition-colors
                    ${value === family ? 'bg-primary-50 text-primary-700' : ''}
                  `}
                >
                  <span style={{ fontFamily: family }}>
                    {family}
                  </span>
                  {value === family && <CheckIcon className="h-5 w-5 text-primary-600" />}
                </button>
              ))}

              {/* Empty state */}
              {!loading && families.length === 0 && !includeDefault && (
                <div className="p-3 text-sm text-gray-500 text-center">
                  Geen fonts beschikbaar
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Font Family Preview Component
 * Shows a preview of the font with sample text
 */
interface FontPreviewProps {
  family: string | null
  className?: string
}

export function FontPreview({ family, className = '' }: FontPreviewProps) {
  return (
    <div 
      className={`p-4 border border-gray-200 rounded-lg bg-gray-50 ${className}`}
      style={family ? { fontFamily: family } : undefined}
    >
      <p className="text-2xl mb-2">Aa Bb Cc Dd Ee</p>
      <p className="text-base text-gray-600">
        The quick brown fox jumps over the lazy dog
      </p>
      <p className="text-sm text-gray-500 mt-2">
        0123456789 • €£¥ • ÀÁÂÃÄÅ
      </p>
    </div>
  )
}

/**
 * Hook to get currently selected site fonts from settings
 */
export function useSiteFonts() {
  // This would typically come from your app settings store
  // For now, return defaults
  return {
    primaryFont: 'Inter',
    secondaryFont: null,
  }
}
