import { HttpError } from "@/lib/http";

function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export async function registerNeonAccount(input: { name: string; email: string; password: string }) {
  const base = process.env.NEON_AUTH_BASE_URL;
  if (!base) throw new HttpError(500, "Neon Auth is not configured.");
  const response = await fetch(`${base.replace(/\/$/, "")}/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: appOrigin(),
    },
    body: JSON.stringify({
      name: input.name,
      email: input.email,
      password: input.password,
    }),
  });
  if (response.ok) return;
  const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
  const message = body.message || body.error || "";
  if (response.status === 422 || /already|exist/i.test(message)) return;
  throw new HttpError(400, message || "Could not create the sign-in account.");
}
