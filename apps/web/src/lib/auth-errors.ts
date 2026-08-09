export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin:
    "Oturum başlatılamadı. Google, Facebook veya X uygulama anahtarlarını kontrol edin.",
  OAuthCallback:
    "Giriş tamamlanamadı. Veritabanı bağlantısını ve migration durumunu kontrol edin.",
  OAuthCreateAccount:
    "Hesabınız oluşturulamadı. Supabase veritabanının aktif olduğundan emin olun.",
  Callback:
    "Giriş sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
  AccessDenied:
    "Giriş reddedildi veya hesapta e-posta bilgisi yok. Farklı bir hesap deneyin.",
  Configuration:
    "Kimlik doğrulama yapılandırması eksik. NEXTAUTH_SECRET, NEXTAUTH_URL ve sağlayıcı anahtarlarını kontrol edin.",
  Verification: "Doğrulama bağlantısının süresi dolmuş veya zaten kullanılmış.",
  CredentialsSignin:
    "E-posta veya şifre hatalı. Bilgilerinizi kontrol edip tekrar deneyin.",
  Default:
    "Giriş yapılamadı. Başka bir yöntem deneyin veya daha sonra tekrar deneyin.",
};

export function getAuthErrorMessage(errorCode: string | null | undefined) {
  if (!errorCode) return null;
  return AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES.Default;
}
