import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register, type RegisterReq } from '@/auth/authApi'
import { Toast } from '@/components/Toast'
import styles from './Auth.module.css'

export function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState<RegisterReq>({
    email: '',
    password: '',
    role: 'CANDIDATE',
    nickname: '',
    phoneNumber: '',
    companyCode: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(form)
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <h1 className={styles.title}>회원가입</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            placeholder="이메일"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            required
            autoComplete="email"
            className={styles.input}
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            required
            autoComplete="new-password"
            className={styles.input}
          />
          <input
            type="text"
            placeholder="닉네임"
            value={form.nickname}
            onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
            required
            className={styles.input}
          />
          <input
            type="tel"
            placeholder="전화번호"
            value={form.phoneNumber ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
            required
            className={styles.input}
          />
          {form.role === 'RECRUITER' && (
            <input
              type="text"
              placeholder="회사 코드"
              value={form.companyCode ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, companyCode: e.target.value }))}
              className={styles.input}
            />
          )}
          <select
            value={form.role}
            onChange={(e) =>
              setForm((f) => ({ ...f, role: e.target.value as 'CANDIDATE' | 'RECRUITER' }))
            }
            className={styles.input}
          >
            <option value="CANDIDATE">지원자</option>
            <option value="RECRUITER">채용담당자</option>
          </select>
          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? '가입 중…' : '가입'}
          </button>
        </form>
        <p className={styles.footer}>
          이미 계정이 있으시면 <Link to="/login">로그인</Link>
        </p>
      </div>
      {error && (
        <Toast message={error} onClose={() => setError('')} autoDismissMs={5000} />
      )}
    </div>
  )
}
