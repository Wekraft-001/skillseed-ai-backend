import { Module } from '@nestjs/common';
import { TransactionService } from '../../super_admin/services/transaction.service';
import { TransactionController } from '../../super_admin/controllers/transaction.controller';
import { School, SchoolSchema } from 'src/modules/schemas';
import { MongooseModule } from '@nestjs/mongoose';
import { PasswordService } from '../../super_admin/services';
import { LoggerModule } from 'src/common/logger/logger.module';
import { EmailModule } from 'src/common/utils/mailing/email.module';
import {
  Transaction,
  TransactionSchema,
} from 'src/modules/schemas/transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: School.name, schema: SchoolSchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    LoggerModule,
    EmailModule,
  ],
  controllers: [TransactionController],
  providers: [TransactionService, PasswordService],
})
export class TransactionModule {}
