import { env } from 'cloudflare:workers';
import { handleStudy } from '../../../lib/study-api.mjs';

export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleStudy(request, env.DB);
export const POST = (request: Request) => handleStudy(request, env.DB);
export const PUT = (request: Request) => handleStudy(request, env.DB);
export const OPTIONS = (request: Request) => handleStudy(request, env.DB);
