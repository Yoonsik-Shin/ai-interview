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

const PASSWORD_RULES = [
  { label: "8자 이상", test: (v: string) => v.length >= 8 },
  { label: "대문자 포함", test: (v: string) => /[A-Z]/.test(v) },
  { label: "소문자 포함", test: (v: string) => /[a-z]/.test(v) },
  { label: "숫자 포함", test: (v: string) => /\d/.test(v) },
  { label: "특수문자 포함", test: (v: string) => /[^a-zA-Z\d]/.test(v) },
];

export function isPasswordValid(value: string): boolean {
  return PASSWORD_RULES.every(({ test }) => test(value));
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  onBlur?: () => void;
  autoComplete?: string;
  hideRules?: boolean;
}

export function PasswordInput({
  value,
  onChange,
  placeholder = "비밀번호 (대문자·소문자·숫자·특수문자 포함, 8자 이상)",
  error,
  onBlur,
  autoComplete,
  hideRules = false,
}: Props) {
  const [show, setShow] = useState(false);

  return (
    <>
      <div className={styles.passwordWrapper}>
        <input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          className={`${styles.input} ${error ? styles.inputError : ""}`}
        />
        <button type="button" className={styles.eyeBtn} onClick={() => setShow((v) => !v)}>
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {!hideRules && value.length > 0 && (
        <div className={styles.passwordRules}>
          {PASSWORD_RULES.map(({ label, test }) => {
            const ok = test(value);
            return (
              <span key={label} className={ok ? styles.ruleOk : styles.ruleFail}>
                {ok ? "✓" : "✗"} {label}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
