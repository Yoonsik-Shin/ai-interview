import {
    CallHandler,
    ExecutionContext,
    Injectable,
    NestInterceptor,
    HttpStatus,
    HttpException,
    BadRequestException,
    NotFoundException,
    ConflictException,
    ForbiddenException,
    UnauthorizedException,
    ServiceUnavailableException,
    GatewayTimeoutException,
    NotImplementedException,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { status as GrpcStatus } from "@grpc/grpc-js";

interface GrpcError {
    code: number;
    details: string;
    message?: string;
}

@Injectable()
export class GrpcToHttpInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        return next.handle().pipe(
            catchError((err: unknown) =>
                // gRPC 에러인지 확인 후 gRPC 에러가 아니면 그대로 전파
                throwError(() => (this.isGrpcError(err) ? this.mapGrpcHelper(err) : err)),
            ),
        );
    }

    private isGrpcError(err: unknown): err is GrpcError {
        return (
            typeof err === "object" &&
            err !== null &&
            typeof (err as GrpcError).code === "number" &&
            typeof (err as GrpcError).details === "string"
        );
    }

    private mapGrpcHelper(err: GrpcError): HttpException {
        const message = err.details || err.message || "Unknown gRPC error";

        switch (err.code as GrpcStatus) {
            case GrpcStatus.INVALID_ARGUMENT:
            case GrpcStatus.FAILED_PRECONDITION:
            case GrpcStatus.OUT_OF_RANGE:
                return new BadRequestException(message);

            case GrpcStatus.NOT_FOUND:
                return new NotFoundException(message);

            case GrpcStatus.ALREADY_EXISTS:
            case GrpcStatus.ABORTED:
                return new ConflictException(message);

            case GrpcStatus.PERMISSION_DENIED:
                return new ForbiddenException(message);

            case GrpcStatus.UNAUTHENTICATED:
                return new UnauthorizedException(message);

            case GrpcStatus.RESOURCE_EXHAUSTED:
                return new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);

            case GrpcStatus.UNIMPLEMENTED:
                return new NotImplementedException(message);

            case GrpcStatus.UNAVAILABLE:
                return new ServiceUnavailableException(message);

            case GrpcStatus.DEADLINE_EXCEEDED:
                return new GatewayTimeoutException(message);

            default:
                return new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
}
