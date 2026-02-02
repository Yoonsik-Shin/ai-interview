import { ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { refresh } from './authApi'

export function AuthGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [ok, setOk] = useState<boolean | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      setOk(true)
      return
    }
    refresh()
      .then((r) => {
        localStorage.setItem('accessToken', r.accessToken)
        setOk(true)
      })
      .catch(() => {
        setOk(false)
        navigate('/login', { replace: true })
      })
  }, [navigate])

  if (ok === null) return <div className="auth-loading">로그인 확인 중…</div>
  if (!ok) return null
  return <>{children}</>
}
