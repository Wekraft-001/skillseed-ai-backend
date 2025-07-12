import { Module } from '@nestjs/common';
import { TransactionService } from '../services/transaction.service';
import { TransactionController } from '../controllers/transaction.controller';
import { School, SchoolSchema } from 'src/modules/schemas';
import { MongooseModule } from '@nestjs/mongoose';
import { PasswordService } from '../services';
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
