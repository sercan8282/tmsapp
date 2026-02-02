import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
  const navigate = useNavigate()
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
        toast.success(t('auth.enterCode'))
      } else if (result.requires2FASetup) {
        // Redirect to MFA setup page
        toast.success(t('auth.setupMfaDescription'))
        navigate('/setup-mfa')
      } else {
        toast.success(t('auth.successfullyLoggedIn'))
        navigate('/')
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { detail?: string } } }
      toast.error(err.response?.data?.detail || t('auth.invalidCredentials'))
    } finally {
      setIsLoading(false)
    }
  }
  
  const on2FASubmit = async (data: TwoFactorForm) => {
    if (!userId) return
    
    setIsLoading(true)
    try {
      await verify2FA(userId, data.code)
      toast.success(t('auth.successfullyLoggedIn'))
      navigate('/')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } }
      toast.error(err.response?.data?.error || t('auth.verificationFailed'))
    } finally {
      setIsLoading(false)
    }
  }
  
  if (requires2FA) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          {t('auth.twoFactor')}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          {t('auth.twoFactorDescription')}
        </p>
        
        <form onSubmit={twoFactorForm.handleSubmit(on2FASubmit)} className="space-y-6">
          <div>
            <label htmlFor="code" className="label">
              {t('auth.twoFactorCode')}
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
                required: t('auth.codeRequired'),
                pattern: {
                  value: /^\d{6}$/,
                  message: t('auth.codeMustBe6Digits')
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
            {isLoading ? t('common.loading') : t('common.confirm')}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setRequires2FA(false)
              setUserId(null)
            }}
            className="btn-secondary w-full"
          >
            {t('common.back')}
          </button>
        </form>
      </div>
    )
  }
  
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">
        {t('auth.login')}
      </h2>
      
      <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-6">
        <div>
          <label htmlFor="email" className="label">
            {t('auth.email')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input"
            {...loginForm.register('email', { 
              required: t('errors.required'),
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: t('errors.invalidEmail')
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
            {t('auth.password')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="input"
            {...loginForm.register('password', { 
              required: t('errors.required')
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
          {isLoading ? t('auth.loggingIn') : t('auth.loginButton')}
        </button>
      </form>
    </div>
  )
}
