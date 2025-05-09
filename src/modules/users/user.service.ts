import { Injectable } from '@nestjs/common';
import { User } from '../auth/entities/users';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async findAllUsers(){
    return this.userRepo.find()
  }
}
