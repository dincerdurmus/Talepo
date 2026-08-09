export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  OAuthSignin:
    "Sosyal giriş başlatılamadı. Lütfen tekrar deneyin veya e-posta ile giriş yapın.",
  OAuthCallback:
    "Giriş tamamlanamadı. Lütfen tekrar deneyin. Sorun sürerse destek ile iletişime geçin.",
  OAuthCreateAccount:
    "Hesabınız oluşturulamadı. Bir süre sonra tekrar deneyin.",
  Callback:
    "Giriş sırasında beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.",
  AccessDenied:
    "Giriş reddedildi veya hesapta e-posta bilgisi yok. Farklı bir hesap deneyin.",
  Configuration:
    "Giriş şu an kullanılamıyor. Lütfen daha sonra tekrar deneyin.",
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
