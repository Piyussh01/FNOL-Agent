import { cookies, headers } from "next/headers";
import { pickLocale, type Locale } from "./config";
import { getCurrentUser } from "@/lib/auth/magic-link";

// Resolution order: user.preferred_lang → cookie → Accept-Language → default.
export async function currentLocale(): Promise<Locale> {
  const user = await getCurrentUser().catch(() => null);
  if (user?.preferred_lang === "es") return "es";
  if (user?.preferred_lang === "en") return "en";

  const cookieLang = cookies().get("fnol_locale")?.value;
  if (cookieLang) return pickLocale(cookieLang);

  const accept = headers().get("accept-language") ?? "";
  if (/\bes\b/i.test(accept.split(",")[0] ?? "")) return "es";
  return "en";
}
