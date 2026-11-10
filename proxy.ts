import { auth } from "@/lib/auth/server";

export default auth.middleware({ loginUrl: "/login" });

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/products/:path*",
    "/categories/:path*",
    "/inventory/:path*",
    "/low-stock/:path*",
    "/purchase-orders/:path*",
    "/sales-orders/:path*",
    "/stock-transfers/:path*",
    "/customers/:path*",
    "/invoices/:path*",
    "/price-lists/:path*",
    "/suppliers/:path*",
    "/users/:path*",
    "/reports/:path*",
    "/forecasting/:path*",
    "/audit-logs/:path*",
    "/scanner/:path*",
    "/settings/:path*",
    "/orders/:path*",
  ],
};
