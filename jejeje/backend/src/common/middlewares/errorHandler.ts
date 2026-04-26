import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { AppError } from '../errors/AppError';
import { logger } from '../logger';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: { code: 'FILE_TOO_LARGE', message: 'La imagen no puede superar los 2 MB.' },
      });
    }
    return res.status(400).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'Error al subir el archivo' },
    });
  }

  if (
    err.message === 'Tipo de imagen no permitido' ||
    err.message?.includes('Formato de imagen no permitido') ||
    err.message?.includes('JPG, PNG o WebP')
  ) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_FILE_TYPE', message: 'Formato no válido. Usa JPG, PNG o WebP.' },
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Unhandled errors
  logger.error(err);

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Something went wrong',
    },
  });
};
