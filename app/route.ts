import { indexHtml } from './index-html';

export function GET() {
  return new Response(indexHtml, { headers: {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-cache, must-revalidate',
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff',
  }});
}
