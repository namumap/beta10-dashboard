// output: 'export' (static export) 모드에서는 미들웨어가 동작하지 않습니다.
// 인증 보호는 src/app/(main)/dashboard/_components/auth-guard.tsx (CSR)에서 처리합니다.

export function middleware() { }

export const config = {
  matcher: [],
};
