import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

interface LoginForm {
  email: string
  password: string
}

interface TwoFactorForm {
  code: string
}

export default function LoginPage() {
  const [requires2FA, setRequires2FA] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  const { login, verify2FA } = useAuthStore()
  
  const loginForm = useForm<LoginForm>()
  const twoFactorForm = useForm<TwoFactorForm>()
  
  const onLoginSubmit = async (data: LoginForm) => {
    setIsLoading(true)
    try {
      const result = await login(data.email, data.password)
      
      if (result.requires2FA) {
        setRequires2FA(true)
        setUserId(result.userId || null)
        toast.success('Voer je 2FA code in')
      } else {
        toast.success('Succesvol ingelogd!')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || 'Inloggen mislukt')
    } finally {
      setIsLoading(false)
    }
  }
  
  const on2FASubmit = async (data: TwoFactorForm) => {
    if (!userId) return
    
    setIsLoading(true)
    try {
      await verify2FA(userId, data.code)
      toast.success('Succesvol ingelogd!')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || '2FA verificatie mislukt')
    } finally {
      setIsLoading(false)
    }
  }
  
  if (requires2FA) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          Twee-factor authenticatie
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Voer de 6-cijferige code van je authenticator app in.
        </p>
        
        <form onSubmit={twoFactorForm.handleSubmit(on2FASubmit)} className="space-y-6">
          <div>
            <label htmlFor="code" className="label">
              Verificatiecode
            </label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="input text-center text-2xl tracking-widest"
              placeholder="000000"
              {...twoFactorForm.register('code', { 
                required: 'Code is verplicht',
                pattern: {
                  value: /^\d{6}$/,
                  message: 'Code moet 6 cijfers zijn'
                }
              })}
            />
            {twoFactorForm.formState.errors.code && (
              <p className="mt-1 text-sm text-red-600">
                {twoFactorForm.formState.errors.code.message}
              </p>
            )}
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? 'Verifiëren...' : 'Verifiëren'}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setRequires2FA(false)
              setUserId(null)
            }}
            className="btn-secondary w-full"
          >
            Terug naar login
          </button>
        </form>
      </div>
    )
  }
  
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        Inloggen
      </h2>
      
      <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
        <div>
          <label htmlFor="email" className="label">
            E-mailadres
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            {...loginForm.register('email', { 
              required: 'E-mailadres is verplicht',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Ongeldig e-mailadres'
              }
            })}
          />
          {loginForm.formState.errors.email && (
            <p className="mt-1 text-sm text-red-600">
              {loginForm.formState.errors.email.message}
            </p>
          )}
        </div>
        
        <div>
          <label htmlFor="password" className="label">
            Wachtwoord
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            {...loginForm.register('password', { 
              required: 'Wachtwoord is verplicht' 
            })}
          />
          {loginForm.formState.errors.password && (
            <p className="mt-1 text-sm text-red-600">
              {loginForm.formState.errors.password.message}
            </p>
          )}
        </div>
        
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full"
        >
          {isLoading ? 'Inloggen...' : 'Inloggen'}
        </button>
      </form>
    </div>
  )
}
