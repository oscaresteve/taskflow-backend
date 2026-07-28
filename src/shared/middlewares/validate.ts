import { type ZodType } from "zod";
import { type Request, type Response, type NextFunction, type RequestHandler } from "express";

interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schemas.body?.parse(req.body);
      schemas.params?.parse(req.params);
      schemas.query?.parse(req.query);

      next();
    } catch (error) {
      next(error);
    }
  };
}
