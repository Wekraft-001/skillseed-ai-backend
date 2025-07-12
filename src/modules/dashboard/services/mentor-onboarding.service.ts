import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { ClientSession, Model, Types } from "mongoose";
import { School } from "src/modules/schemas";
import { User } from "src/modules/schemas";
import { PasswordService } from "./password-service.service";
import { uploadToAzureStorage } from "src/common/utils/azure-upload.util";
import { EmailService } from "src/common/utils/mailing/email.service";

@Injectable()
export class MentorOnboardingService {
    
}