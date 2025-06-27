import { User } from "src/modules/schemas";

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}