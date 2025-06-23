import { User } from "src/modules/entities";

declare global {
    namespace Express {
        interface Request {
            user?: User;
        }
    }
}