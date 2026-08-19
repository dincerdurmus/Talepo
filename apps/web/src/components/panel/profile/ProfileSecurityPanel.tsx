import type { AccountAuthMethod } from "@/lib/auth/account-auth-method";
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  Phone,
  Shield,
} from "lucide-react";

import { ProfilePasswordForm } from "./ProfilePasswordForm";
import { SignalSection, signalSurface } from "./ProfileSignal";

export function ProfileSecurityPanel({
  authMethod,
  emailVerified,
  hasPhone,
}: {
  authMethod: AccountAuthMethod;
  emailVerified: boolean;
  hasPhone: boolean;
}) {
  const loginSummary =
    authMethod.primaryLabel === "Google"
      ? "Google ile giriş"
      : authMethod.primaryLabel === "Google ve şifre"
        ? "Google ve şifre ile giriş"
        : "E-posta ve şifre ile giriş";

  const statusSummary = [
    loginSummary,
    emailVerified ? "E-posta doğrulandı" : "E-posta doğrulanmadı",
    hasPhone ? "Telefon kayıtlı" : "Telefon eklenmedi",
  ].join(" · ");

  return (
    <div className="space-y-5">
      <SignalSection
        title="Hesap güvenliği"
        description={statusSummary}
      >
        <ul className="space-y-2">
          <SecurityRow
            icon={Shield}
            title="Giriş yöntemi"
            description="Hesabınıza giriş için kullanılan birincil yöntem."
            status={authMethod.primaryLabel}
            tone="neutral"
          />
          <SecurityRow
            icon={Mail}
            title="E-posta doğrulama"
            description="Doğrulanmış e-posta, hesap güvenliği için önerilir."
            status={emailVerified ? "Doğrulandı" : "Doğrulanmadı"}
            tone={emailVerified ? "verified" : "attention"}
          />
          <SecurityRow
            icon={Phone}
            title="Telefon"
            description={
              hasPhone
                ? "Numaranız yalnızca size görünür. OTP doğrulaması henüz etkin değil."
                : "Hesap özeti sekmesinden telefon ekleyebilirsiniz."
            }
            status={hasPhone ? "Kayıtlı" : "Henüz eklenmedi"}
            tone={hasPhone ? "neutral" : "attention"}
          />
        </ul>
      </SignalSection>

      {authMethod.oauthProviders.includes("google") ? (
        <div className={`${signalSurface} p-5 sm:p-6`}>
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-teal-950/[0.08] bg-white text-sm font-bold text-teal-900">
              G
            </div>
            <div>
              <h4 className="text-base font-semibold text-[#0f1f1d]">
                Google hesabı
              </h4>
              <p className="mt-1 text-sm leading-6 text-teal-950/50">
                Google ile giriş yapıyorsunuz. Şifre ve hesap erişimi Google
                üzerinden yönetilir.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <SignalSection
        title="Şifre güvenliği"
        description={
          authMethod.hasPassword
            ? "Güçlü bir parola kullanın ve düzenli aralıklarla güncelleyin."
            : "Bu hesap OAuth ile giriş kullanıyor."
        }
      >
        {authMethod.hasPassword ? (
          <div className="max-w-md">
            <ProfilePasswordForm />
            <p className="mt-3 text-xs text-teal-950/40">
              Bu cihazdaki oturumunuz kapatılacaktır. Diğer açık oturumlar
              geçerli kalabilir.
            </p>
          </div>
        ) : (
          <p className="max-w-xl text-sm leading-6 text-teal-950/55">
            Google hesabınızla giriş yapıyorsunuz. Şifrenizi Google üzerinden
            yönetebilirsiniz.
          </p>
        )}
      </SignalSection>
    </div>
  );
}

function SecurityRow({
  icon: Icon,
  title,
  description,
  status,
  tone,
}: {
  icon: typeof Shield;
  title: string;
  description: string;
  status: string;
  tone: "verified" | "neutral" | "attention";
}) {
  const toneClass =
    tone === "verified"
      ? "text-teal-800"
      : tone === "attention"
        ? "text-amber-700"
        : "text-teal-950/55";

  const StatusIcon =
    tone === "verified"
      ? CheckCircle2
      : tone === "attention"
        ? AlertTriangle
        : null;

  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-teal-950/[0.06] bg-white/70 px-4 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-teal-950/[0.06] bg-teal-950/[0.02]">
          <Icon className="h-4 w-4 text-teal-800/60" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#0f1f1d]">{title}</p>
          <p className="mt-0.5 text-xs leading-5 text-teal-950/45">
            {description}
          </p>
        </div>
      </div>
      <p
        className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold ${toneClass}`}
      >
        {StatusIcon ? <StatusIcon className="h-4 w-4" aria-hidden /> : null}
        {status}
      </p>
    </li>
  );
}
