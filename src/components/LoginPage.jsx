import { useState } from 'react'
import { useI18n } from '../i18n/i18nContext.js'

export function LoginPage({ error, isLoading, onLogin }) {
  const { t } = useI18n()
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  })
  const [showPassword, setShowPassword] = useState(false)

  function updateField(field, value) {
    setCredentials((currentCredentials) => ({
      ...currentCredentials,
      [field]: value,
    }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    onLogin(credentials)
  }

  return (
    <section className="login-page" aria-labelledby="login-title">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="form-heading">
          <p className="eyebrow">{t('directusAccess')}</p>
          <h2 id="login-title">{t('signIn')}</h2>
        </div>

        <label className="form-field">
          <span>{t('username')}</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            disabled={isLoading}
            value={credentials.username}
            onChange={(event) => updateField('username', event.target.value)}
          />
        </label>

        <label className="form-field">
          <span>{t('password')}</span>
          <div className="password-input">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              disabled={isLoading}
              value={credentials.password}
              onChange={(event) => updateField('password', event.target.value)}
            />
            <button
              type="button"
              aria-pressed={showPassword}
              disabled={isLoading}
              onClick={() => setShowPassword((isVisible) => !isVisible)}
            >
              {showPassword ? t('hidePassword') : t('showPassword')}
            </button>
          </div>
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button className="primary-action" type="submit" disabled={isLoading}>
          {isLoading ? t('loggingIn') : t('logIn')}
        </button>
      </form>
    </section>
  )
}
