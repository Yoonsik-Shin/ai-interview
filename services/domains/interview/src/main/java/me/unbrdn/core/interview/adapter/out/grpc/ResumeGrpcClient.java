package me.unbrdn.core.interview.adapter.out.grpc;

import java.util.UUID;
import me.unbrdn.core.interview.application.port.out.LoadResumePort;
import org.springframework.stereotype.Component;

@Component
public class ResumeGrpcClient implements LoadResumePort {

    @Override
    public boolean exists(UUID resumeId) {
        // TODO: gRPC call to resume-service
        return true;
    }
}
