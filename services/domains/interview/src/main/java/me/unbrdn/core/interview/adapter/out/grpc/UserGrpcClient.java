package me.unbrdn.core.interview.adapter.out.grpc;

import java.util.UUID;
import me.unbrdn.core.interview.application.port.out.LoadUserPort;
import org.springframework.stereotype.Component;

@Component
public class UserGrpcClient implements LoadUserPort {

    @Override
    public boolean isCandidate(UUID userId) {
        // TODO: gRPC call to auth-service
        return true;
    }
}
