"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import QRCode from "qrcode";

interface MobileHandoffProps {
  claimId: string;
}

export function MobileHandoff({ claimId }: MobileHandoffProps) {
  const { t } = useTranslation();
  const deepLink = `bilinc://claim/${claimId}`;
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    QRCode.toDataURL(deepLink, {
      width: 200,
      margin: 2,
      color: { dark: "#1a1a2e", light: "#ffffff" },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [deepLink]);

  return (
    <div
      data-testid="mobile-handoff"
      className="bg-bilinc-surface border border-bilinc-border rounded-2xl p-6 text-center space-y-6"
    >
      <div>
        <h3 className="text-lg font-semibold text-bilinc-text mb-2">
          {t("panel:claim.handoff.title")}
        </h3>
        <p className="text-sm text-bilinc-text-secondary max-w-sm mx-auto">
          {t("panel:claim.handoff.description")}
        </p>
      </div>

      {/* QR code */}
      <div className="flex justify-center">
        {qrDataUrl ? (
          <img
            data-testid="handoff-qr-image"
            src={qrDataUrl}
            alt={t("panel:claim.handoff.qrAlt")}
            width={200}
            height={200}
            className="rounded-xl border border-bilinc-border"
          />
        ) : (
          <div
            data-testid="handoff-qr-placeholder"
            className="w-[200px] h-[200px] rounded-xl border border-bilinc-border bg-bilinc-surface-secondary flex items-center justify-center"
          >
            <span className="text-xs text-bilinc-text-tertiary">QR</span>
          </div>
        )}
      </div>

      {/* Deep link */}
      <a
        data-testid="handoff-deep-link"
        href={deepLink}
        className="inline-block px-6 py-3 bg-bilinc-primary text-white font-medium rounded-xl hover:opacity-90 transition"
      >
        {t("panel:claim.handoff.deepLinkLabel")}
      </a>

      {/* Claim ID for reference */}
      <p className="text-xs text-bilinc-text-tertiary">
        {t("panel:claim.handoff.claimIdLabel")}{" "}
        <span data-testid="handoff-claim-id" className="font-mono">{claimId}</span>
      </p>
    </div>
  );
}
