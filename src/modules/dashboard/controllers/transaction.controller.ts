import { Controller, Post, Param, Body, Get } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UseGuards } from '@nestjs/common';
import { CreateTransactionDto, UserRole } from 'src/common/interfaces';
import { School, User } from 'src/modules/schemas';
import { JwtAuthGuard } from 'src/modules/auth/guards';
import { RolesGuard } from 'src/modules/auth/guards/roles.guard';
import { CurrentUser } from 'src/common/decorators';
import { SchoolOnboardingService } from '../services';
import { TransactionService } from '../services/transaction.service';
import { Transaction } from 'src/modules/schemas/transaction.schema';
import { LoggerService } from 'src/common/logger/logger.service';

@Controller('transactions')
export class TransactionController {
  constructor(
    private transactionService: TransactionService,
    private logger: LoggerService,
  ) {}

  @Post('add-transaction')
  @Roles(UserRole.SUPER_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async createTransaction(
    @Body() createTransactionDto: CreateTransactionDto,
    @CurrentUser() user: User,
  ): Promise<{
    success: boolean;
    message: string;
    data: { transaction: Transaction; school: School };
  }> {
    try {
      const result = await this.transactionService.createTransaction(
        createTransactionDto,
        user,
      );

      return {
        success: true,
        message: 'Transaction created successfully and school activated',
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to create transaction');
      throw error;
    }
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  async getAllTransactions() {
    try {
      return await this.transactionService.getAllTransaction();
      
    } catch (error) {
      this.logger.error('Failed to fetch all transactions');
      throw error;
    }
  }

  @Get('pending-schools')
  @Roles(UserRole.SUPER_ADMIN)
  @UseGuards(JwtAuthGuard, RolesGuard)
  async getPendingSchools(): Promise<{
    success: boolean;
    message: string;
    data: School[];
  }> {
    try {
      const pendingSchools = await this.transactionService.getPendingSchools();

      return {
        success: true,
        message: 'Pending Schools retrieved successfully',
        data: pendingSchools,
      };
    } catch (error) {
      this.logger.error('Failed retrieving pending schools');
      throw error;
    }
  }
}
