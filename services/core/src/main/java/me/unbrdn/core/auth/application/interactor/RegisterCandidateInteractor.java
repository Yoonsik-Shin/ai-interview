package me.unbrdn.core.auth.application.interactor;

import java.util.UUID;
import lombok.RequiredArgsConstructor;
import me.unbrdn.core.auth.adapter.out.grpc.UserGrpcClient;
import me.unbrdn.core.auth.application.exception.UserAlreadyExistsException;
import me.unbrdn.core.auth.application.interactor.dto.command.RegisterCandidateCommand;
import me.unbrdn.core.auth.application.port.in.RegisterCandidateUseCase;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 면접자 회원가입 */
@Service("authRegisterCandidateInteractor")
@RequiredArgsConstructor
public class RegisterCandidateInteractor implements RegisterCandidateUseCase {

    private final UserGrpcClient userGrpcClient;

    @Override
    @Transactional
    public UUID execute(RegisterCandidateCommand command) {
        if (userGrpcClient.loadByEmail(command.getEmail()).isPresent()) {
            throw new UserAlreadyExistsException("이미 존재하는 이메일입니다: " + command.getEmail());
        }

        return userGrpcClient.createCandidate(command.getEmail(), command.getPassword(), command.getNickname(),
                command.getPhoneNumber());
    }
}
