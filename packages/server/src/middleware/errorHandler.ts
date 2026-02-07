import { Request, Response, NextFunction } from 'express';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
    });
  }

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Custom error class
export class HttpError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Common errors
export const errors = {
  badRequest: (message = 'Bad request') => new HttpError(message, 400),
  unauthorized: (message = 'Unauthorized') => new HttpError(message, 401),
  forbidden: (message = 'Forbidden') => new HttpError(message, 403),
  notFound: (message = 'Not found') => new HttpError(message, 404),
  conflict: (message = 'Conflict') => new HttpError(message, 409),
  tooLarge: (message = 'File too large') => new HttpError(message, 413),
  unprocessable: (message = 'Unprocessable entity') => new HttpError(message, 422),
  tooMany: (message = 'Too many requests') => new HttpError(message, 429),
  internal: (message = 'Internal server error') => new HttpError(message, 500),
};
