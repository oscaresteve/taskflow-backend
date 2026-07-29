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
      req.validated = {
        body: schemas.body?.parse(req.body),
        params: schemas.params?.parse(req.params),
        query: schemas.query?.parse(req.query),
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
