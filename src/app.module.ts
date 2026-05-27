import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import mailConfig from './config/mail.config';
import redisConfig from './config/redis.config';
import recruitmentConfig from './config/recruitment.config';
import storageConfig from './config/storage.config';
import { CoreModule } from './core/core.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CompensationModule } from './modules/compensation/compensation.module';
import { EmployeeManagementModule } from './modules/employee-management/employee-management.module';
import { LeaveModule } from './modules/leave/leave.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { PerformanceModule } from './modules/performance/performance.module';
import { RecruitmentModule } from './modules/recruitment/recruitment.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UsersModule } from './modules/users/users.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        jwtConfig,
        mailConfig,
        redisConfig,
        storageConfig,
        recruitmentConfig,
      ],
      envFilePath: [`.env.${process.env.NODE_ENV || 'development'}`, '.env'],
    }),
    WinstonModule.forRoot({
      transports: [
        new winston.transports.Console({
          format:
            process.env.NODE_ENV === 'production'
              ? winston.format.json()
              : winston.format.combine(
                  winston.format.colorize(),
                  winston.format.simple(),
                ),
        }),
      ],
    }),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          password: config.get<string>('redis.password'),
        },
      }),
    }),
    CoreModule,
    QueueModule,
    AuthModule,
    AttendanceModule,
    UsersModule,
    CompaniesModule,
    CompensationModule,
    EmployeeManagementModule,
    LeaveModule,
    PayrollModule,
    PerformanceModule,
    RecruitmentModule,
    OnboardingModule,
    ReportsModule,
  ],
})
export class AppModule {}
