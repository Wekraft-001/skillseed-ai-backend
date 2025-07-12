import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Transaction,
  TransactionDocument,
  TransactionSchema,
} from 'src/modules/schemas/transaction.schema';
import { ClientSession, Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { LoggerService } from 'src/common/logger/logger.service';
import {
  CreateTransactionDto,
  PaymentStatus,
  transactionType,
} from 'src/common/interfaces';
import { School, User } from 'src/modules/schemas';
import { EmailService } from 'src/common/utils/mailing/email.service';
import { RedisService } from 'src/Redis/redis.service';

@Injectable()
export class TransactionService {
  constructor(
    private logger: LoggerService,
    @InjectModel(School.name) private schoolModel: Model<School>,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    private readonly redisService: RedisService,
    private emailService: EmailService,
  ) {}

  async createTransaction(
    createTransactionDto: CreateTransactionDto,
    superAdminUser: User,
  ): Promise<{ transaction: Transaction; school: School }> {
    const session: ClientSession = await this.schoolModel.db.startSession();

    try {
      session.startTransaction();

      const school = await this.schoolModel
        .findOne({
          schoolName: createTransactionDto.schoolName,
          status: PaymentStatus.PENDING,
        })
        .session(session);

      if (!school) {
        throw new NotFoundException(
          'School not found or already completed payment',
        );
      }

      //creating actual transaction

      const newTransaction = new this.transactionModel({
        schoolName: createTransactionDto.schoolName,
        amount: createTransactionDto.amount,
        paymentMethod: createTransactionDto.paymentMethod,
        numberOfKids: createTransactionDto.numberOfKids,
        transactionType: createTransactionDto.transactionType,
        transactionDate: new Date(),
        Notes: createTransactionDto.notes,
        school: school._id,
      });

      await newTransaction.save({ session });

      school.status = PaymentStatus.COMPLETED;
      school.transactions.push(newTransaction._id);
      await school.save({ session });

      await session.commitTransaction();

      const tempPassword = await this.getTemporaryPassword(
        school._id.toString(),
      );

      if (!tempPassword) {
        this.logger.error(
          `Temporary password not found for school: ${school._id}`,
        );
        throw new Error('Temporary password not found');
      }

      await this.emailService.sendSchoolOnboardingEmail(
        school.email,
        tempPassword,
      );

      await this.cleanupTemporaryPassword(school._id.toString());

      this.logger.log(
        `Transaction created and school activated: ${school.schoolName} - Amount: ${newTransaction.amount}`,
      );

      const populatedSchool = await this.schoolModel
        .findById(school._id)
        .populate('createdBy students transactions')
        .exec();

      return {
        transaction: newTransaction,
        school: populatedSchool,
      };
    } catch (error) {
      await session.abortTransaction();
      this.logger.error('Error creating transaction', error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getAllTransaction() {
    try {
      return await this.transactionModel.find().populate('school').exec();
    } catch (error) {
      this.logger.error('Failed to fetch all transactions');
      throw error;
    }
  }

  private async getTemporaryPassword(schoolId: string): Promise<string> {
    try {
      const key = `temp_password_${schoolId}`;
      const password = await this.redisService.get(key);

      if (!password) {
        this.logger.warn(
          `Temporary password not found or expired for school ${schoolId}`,
        );
        return null;
      }

      this.logger.log(`Temporary password retrieved for school ${schoolId}`);
      return password;
    } catch (error) {
      this.logger.error(
        `Failed to retrieve temporary password for school ${schoolId}:`,
        error,
      );
      throw new Error('Failed to retrieve temporary password');
    }
  }

  private async cleanupTemporaryPassword(schoolId: string): Promise<void> {
    try {
      const key = `temp_password_${schoolId}`;
      const deleted = await this.redisService.del(key);

      if (deleted > 0) {
        this.logger.log(`Temporary password cleaned up for school ${schoolId}`);
      } else {
        this.logger.warn(
          `No temporary password found to cleanup for school ${schoolId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to cleanup temporary password for school ${schoolId}:`,
        error,
      );
    }
  }

  async getPendingSchools(): Promise<School[]> {
    return await this.schoolModel
      .find({ status: PaymentStatus.PENDING })
      .populate('createdBy superAdmin')
      .exec();
  }
}
