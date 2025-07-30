import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['verif-hash'];
    const expectedSignature = process.env.FLW_SECRET_HASH;

    return signature === expectedSignature;
  }
}
