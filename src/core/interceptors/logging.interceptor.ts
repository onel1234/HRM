import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.verbose(
          `${request.method} ${request.url} ${Date.now() - startedAt}ms`,
        );
      }),
    );
  }
}
