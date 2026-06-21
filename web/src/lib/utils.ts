export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("tr-TR", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export function formatRelativeDate(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "az once";
  if (diffMins < 60) return `${diffMins} dakika once`;
  if (diffHours < 24) return `${diffHours} saat once`;
  if (diffDays < 7) return `${diffDays} gun once`;
  return formatDate(dateString);
}

export function credibilityLabel(level: string): string {
  const labels: Record<string, string> = {
    novice: "Yeni Uye", contributor: "Katilimci",
    trusted: "Guvenilir", expert: "Uzman",
  };
  return labels[level] || level;
}

export function verificationLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Beklemede", verified: "Dogrulanmis",
    disputed: "Tartismali", needs_review: "Inceleme Gerekli", retracted: "Geri Cekilmis",
  };
  return labels[status] || status;
}

export function entityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    business: "Isletme", product: "Urun", brand: "Marka",
  };
  return labels[type] || type;
}

export function factCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    safety: "Guvenlik", health: "Saglik", quality: "Kalite",
    legal: "Hukuki", environmental: "Cevre", abuse: "Istismar",
    labor: "Calisma Haklari", other: "Diger",
  };
  return labels[category] || category;
}

export function claimStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Beklemede", verified: "Dogrulanmis", rejected: "Reddedildi",
    revoked: "Iptal Edildi", expired: "Suresi Doldu",
  };
  return labels[status] || status;
}

export function reviewStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: "Aktif", hidden: "Gizli", removed: "Kaldirildi",
  };
  return labels[status] || status;
}
