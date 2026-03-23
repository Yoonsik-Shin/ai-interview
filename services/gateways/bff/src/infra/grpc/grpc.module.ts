import { Module } from "@nestjs/common";
import { ClientsModule } from "@nestjs/microservices";
import { AuthGrpcService } from "./services/auth-grpc.service";
import { UserGrpcService } from "./services/user-grpc.service";
import { InterviewGrpcService } from "./services/interview-grpc.service";
import { ResumeGrpcService } from "./services/resume-grpc.service";
import { GrpcConfigService } from "./services/grpc-config.service";

const GRPC_PACKAGES = [
    { name: "AUTH_PACKAGE", package: "auth.v1" },
    { name: "INTERVIEW_PACKAGE", package: "interview.v1" },
    { name: "USER_PACKAGE", package: "user.v1" },
    { name: "RESUME_PACKAGE", package: "resume.v1" },
];

@Module({
    imports: [
        ClientsModule.registerAsync(
            GRPC_PACKAGES.map((pkg) => ({
                name: pkg.name,
                useFactory: (grpcConfigService: GrpcConfigService) =>
                    grpcConfigService.getGrpcOptions(pkg.package),
                inject: [GrpcConfigService],
            })),
        ),
    ],
    providers: [
        GrpcConfigService,
        AuthGrpcService,
        UserGrpcService,
        InterviewGrpcService,
        ResumeGrpcService,
    ],
    exports: [
        ClientsModule,
        GrpcConfigService,
        AuthGrpcService,
        UserGrpcService,
        InterviewGrpcService,
        ResumeGrpcService,
    ],
})
export class GrpcModule {}
