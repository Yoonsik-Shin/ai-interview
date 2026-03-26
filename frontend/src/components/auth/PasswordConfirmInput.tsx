import { useState } from "react";
import styles from "@/pages/Auth.module.css";

const EyeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

interface Props {
  value: string;
  onChange: (v: string) => void;
  password: string;
  error?: string;
  onBlur?: () => void;
}

export function PasswordConfirmInput({ value, onChange, password, error, onBlur }: Props) {
  const [show, setShow] = useState(false);
  const matches = value === password;

  return (
    <>
      <div className={styles.passwordWrapper}>
        <input
          type={show ? "text" : "password"}
          placeholder="비밀번호 확인"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete="new-password"
          className={`${styles.input} ${error ? styles.inputError : ""}`}
        />
        <button type="button" className={styles.eyeBtn} onClick={() => setShow((v) => !v)}>
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {value.length > 0 && (
        <span className={matches ? styles.ruleOk : styles.ruleFail}>
          {matches ? "✓ 비밀번호가 일치합니다" : "✗ 비밀번호가 일치하지 않습니다"}
        </span>
      )}
    </>
  );
}
