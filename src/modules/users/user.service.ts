import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../schemas';

@Injectable()
export class UserService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findAllUsers(): Promise<User[]> {
     return this.userModel
      .find()
      .populate('school')
      .populate('createdBy')
      .exec();
  }
}
