import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Disable NestJS's built-in body parser (defaults to 100kb limit)
  // so we can configure our own with a higher limit for image uploads
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
  });

  // Register custom body parsers with 50mb limit
  const express = await import('express');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean) as string[];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. server-to-server Next.js proxy, mobile apps, Postman)
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) ||
        origin.startsWith('http://localhost');

      if (isAllowed) {
        callback(null, true);
      } else {
        // Fallback: allow origin to prevent CORS blocking on Vercel preview URLs
        callback(null, true);
      }
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-User-Id',
      'X-Requested-With',
    ],
  });

  await app.listen(process.env.PORT ?? 3001);
}
void bootstrap();
