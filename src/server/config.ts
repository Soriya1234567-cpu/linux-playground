
import "server-only";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),

  // Application
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),

  // Authentication
  AUTH_PROVIDER: z.enum(["local", "firebase", "supabase"]).default("supabase"),
  ALLOW_LOCAL_AUTH: z.enum(["true", "false"]).default("false"),
  ADMIN_EMAILS: z.string().default(""),

  // Supabase Authentication
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().optional(),

  // Firebase Authentication (kept for migration compatibility)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().optional(),

  // Rate limits
  RATE_LIMIT_TERMINAL_PER_MIN: z.coerce.number().int().positive().default(240),
  RATE_LIMIT_API_PER_MIN: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().int().positive().default(20),
});

export type AppConfig = z.infer<typeof schema>;

let cached: AppConfig | null = null;

export function config(): AppConfig {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");

    throw new Error(`Invalid environment configuration: ${issues}`);
  }

  const result = parsed.data;

  if (
    result.AUTH_PROVIDER === "supabase" &&
    (!result.NEXT_PUBLIC_SUPABASE_URL ||
      !result.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  ) {
    throw new Error(
      "Supabase authentication requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  cached = result;
  return cached;
}

export function localAuthEnabled(): boolean {
  const c = config();

  if (c.AUTH_PROVIDER === "local") {
    return c.NODE_ENV !== "production" || c.ALLOW_LOCAL_AUTH === "true";
  }

  return false;
}

export function supabaseConfig() {
  const c = config();

  if (c.AUTH_PROVIDER !== "supabase") return null;

  return {
    url: c.NEXT_PUBLIC_SUPABASE_URL!,
    publishableKey: c.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  };
}

export function firebaseClientConfig() {
  const c = config();

  if (c.AUTH_PROVIDER !== "firebase" || !c.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return null;
  }

  return {
    apiKey: c.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: c.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: c.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: c.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

export function adminEmails(): string[] {
  return config()
    .ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
