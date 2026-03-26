package me.unbrdn.core.user.application.service;

import me.unbrdn.core.user.application.exception.InvalidInputException;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

@Component
public class UserRegistrationValidator {

    private static final Pattern EMAIL_PATTERN =
            Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private static final Pattern PASSWORD_COMPLEXITY_PATTERN =
            Pattern.compile("^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[!@#$%^&*()\\-_=+\\[\\]{};:'\",.<>/?\\\\|`~]).+$");

    private static final Pattern NICKNAME_PATTERN =
            Pattern.compile("^[가-힣a-zA-Z0-9]+$");

    private static final Pattern PHONE_NUMBER_PATTERN =
            Pattern.compile("^01[016789][0-9]{3,4}[0-9]{4}$");

    public void validateEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new InvalidInputException("이메일을 입력해주세요");
        }
        if (!EMAIL_PATTERN.matcher(email).matches()) {
            throw new InvalidInputException("올바른 이메일 형식이 아닙니다");
        }
    }

    public void validatePassword(String password) {
        if (password == null || password.isBlank()) {
            throw new InvalidInputException("비밀번호를 입력해주세요");
        }
        if (password.length() < 8) {
            throw new InvalidInputException("비밀번호는 최소 8자 이상이어야 합니다");
        }
        if (password.length() > 72) {
            throw new InvalidInputException("비밀번호는 최대 72자 이하이어야 합니다");
        }
        if (!PASSWORD_COMPLEXITY_PATTERN.matcher(password).matches()) {
            throw new InvalidInputException("비밀번호는 대문자, 소문자, 숫자, 특수문자를 각 1개 이상 포함해야 합니다");
        }
    }

    public void validateNickname(String nickname) {
        if (nickname == null || nickname.isBlank()) {
            throw new InvalidInputException("닉네임을 입력해주세요");
        }
        if (nickname.length() < 2) {
            throw new InvalidInputException("닉네임은 최소 2자 이상이어야 합니다");
        }
        if (nickname.length() > 20) {
            throw new InvalidInputException("닉네임은 최대 20자 이하이어야 합니다");
        }
        if (!NICKNAME_PATTERN.matcher(nickname).matches()) {
            throw new InvalidInputException("닉네임은 한글, 영문, 숫자만 사용 가능합니다");
        }
    }

    public void validatePhoneNumber(String phoneNumber) {
        if (phoneNumber == null || phoneNumber.isBlank()) {
            throw new InvalidInputException("전화번호를 입력해주세요");
        }
        if (!PHONE_NUMBER_PATTERN.matcher(phoneNumber).matches()) {
            throw new InvalidInputException("올바른 전화번호 형식이 아닙니다 (예: 01012345678)");
        }
    }

    public void validateRegistration(String email, String password, String nickname, String phoneNumber) {
        validateEmail(email);
        validatePassword(password);
        validateNickname(nickname);
        validatePhoneNumber(phoneNumber);
    }
}
