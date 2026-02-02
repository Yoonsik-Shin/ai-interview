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

@Injectable()
export class GrpcToHttpInterceptor implements NestInterceptor {
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        return next.handle().pipe(
            catchError((err) => {
                // gRPC 에러인지 확인 (code와 details 속성 존재 여부)
                if (err && typeof err.code === "number" && typeof err.details === "string") {
                    return throwError(() => this.mapGrpcHelper(err));
                }
                // gRPC 에러가 아니면 그대로 전파
                return throwError(() => err);
            }),
        );
    }

    private mapGrpcHelper(err: any): HttpException {
        const message = err.details || err.message;

        switch (err.code) {
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
