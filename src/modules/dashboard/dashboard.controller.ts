import { Controller, Get, UseGuards, Post, Request, HttpStatus, HttpCode, Query, ParseIntPipe} from "@nestjs/common";
import ApiTags
import { EducationalContent } from "../entities";

@Controller('dashboard')
export class DashboardController {
    constructor(private readonly educationalContentRepo: EducationalContent) {}
}
