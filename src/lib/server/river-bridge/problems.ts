import "server-only";
// Copied from idealchop/River-Mobile-App bridge-kit (PR #3, commit aa192e8ca9e4cade7b17ab3354e2af2466e5db95).
/** RFC 7807 problem+json. Auth failures stay generic: no reason code in the body. */

export type ProblemCode =
  | 'unauthorized'
  | 'forbidden'
  | 'invalid_request'
  | 'idempotency_key_reused'
  | 'payload_too_large';

export interface Problem {
  type: string;
  title: string;
  status: number;
  code: string;
}

const TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
};

export function problem(status: number, code: string, title?: string): Problem {
  return {
    type: `https://river.app/problems/${code}`,
    title: title ?? TITLES[status] ?? 'Error',
    status,
    code,
  };
}

/** Words that must never appear in an auth failure body. */
export const AUTH_LEAK_PATTERN =
  /signature|nonce|timestamp|audience|expired|secret|hmac|mismatch|skew|replay/i;
