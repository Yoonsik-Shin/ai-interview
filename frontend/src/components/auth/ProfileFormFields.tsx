import styles from "@/pages/Auth.module.css";

export type Role = "CANDIDATE" | "RECRUITER";

export function formatPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

interface Props {
  nickname: string;
  onNicknameChange: (v: string) => void;
  phoneNumber: string;
  onPhoneNumberChange: (v: string) => void;
  role: Role | "";
  onRoleChange: (v: Role) => void;
  companyCode?: string;
  onCompanyCodeChange?: (v: string) => void;
  fieldErrors: Record<string, string | undefined>;
  touched?: Record<string, boolean>;
  onBlur?: (field: any) => void;
}

export function ProfileFormFields({
  nickname,
  onNicknameChange,
  phoneNumber,
  onPhoneNumberChange,
  role,
  onRoleChange,
  companyCode = "",
  onCompanyCodeChange,
  fieldErrors,
  touched = {},
  onBlur,
}: Props) {
  const isError = (field: string) => (touched[field] || touched === undefined) && fieldErrors[field];

  return (
    <>
      <div className={styles.inputField}>
        <div className={styles.roleGroup}>
          <button
            type="button"
            className={`${styles.roleBtn} ${role === "CANDIDATE" ? styles.roleBtnActive : ""}`}
            onClick={() => onRoleChange("CANDIDATE")}
          >
            지원자
          </button>
          <button
            type="button"
            className={`${styles.roleBtn} ${role === "RECRUITER" ? styles.roleBtnActive : ""}`}
            onClick={() => onRoleChange("RECRUITER")}
          >
            채용담당자
          </button>
        </div>
        {isError("role") && <p className={styles.errorText}>{fieldErrors.role}</p>}
      </div>

      <div className={styles.inputField}>
        <input
          type="text"
          placeholder="닉네임 (한글, 영문, 숫자 2~20자)"
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value)}
          onBlur={() => onBlur?.("nickname")}
          className={`${styles.input} ${isError("nickname") ? styles.inputError : ""}`}
        />
        {isError("nickname") && <p className={styles.errorText}>{fieldErrors.nickname}</p>}
      </div>

      <div className={styles.inputField}>
        <input
          type="tel"
          placeholder="전화번호 (예: 010-1234-5678)"
          value={phoneNumber}
          onChange={(e) => onPhoneNumberChange(formatPhoneNumber(e.target.value))}
          onBlur={() => onBlur?.("phoneNumber")}
          className={`${styles.input} ${isError("phoneNumber") ? styles.inputError : ""}`}
        />
        {isError("phoneNumber") && <p className={styles.errorText}>{fieldErrors.phoneNumber}</p>}
      </div>

      {role === "RECRUITER" && onCompanyCodeChange && (
        <div className={styles.inputField}>
          <input
            type="text"
            placeholder="회사 코드"
            value={companyCode}
            onChange={(e) => onCompanyCodeChange(e.target.value)}
            onBlur={() => onBlur?.("companyCode")}
            className={`${styles.input} ${isError("companyCode") ? styles.inputError : ""}`}
          />
          {isError("companyCode") && <p className={styles.errorText}>{fieldErrors.companyCode}</p>}
        </div>
      )}
    </>
  );
}
