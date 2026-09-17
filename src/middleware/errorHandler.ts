import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFoundHandler = (_req: Request, _res: Response, next: NextFunction): void => {
  next(new AppError(404, '找不到此資源'));
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  console.error('[error] 未預期的錯誤：', err);
  res.status(500).json({ error: '伺服器內部錯誤' });
};
