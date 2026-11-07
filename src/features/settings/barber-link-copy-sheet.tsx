"use client";

import { Button } from "@/components/common/button";
import { BottomSheet } from "@/components/common/bottom-sheet";
import { writeBarberLinkUrl } from "@/lib/barber-link-copy";

/**
 * In-app confirmation after Share to Barber. The address is plain text (no field, so the
 * keyboard stays closed). "Link copied" is shown only after the clipboard write succeeds.
 */
export function BarberLinkCopySheet({
  name, url, copied, onClose, onCopied,
}: {
  name: string;
  url: string;
  copied: boolean;
  onClose: () => void;
  onCopied: (ok: boolean) => void;
}) {
  const copyAgain = () => {
    const result = writeBarberLinkUrl(url);
    return result.then((ok) => { onCopied(ok); });
  };
  return (
    <BottomSheet
      title={copied ? "Link copied" : "Barber link"}
      subtitle={copied ? name : "Copy this link"}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-2">
          <Button fullWidth variant={copied ? "secondary" : "primary"} onClick={copyAgain}>Copy link</Button>
          <Button fullWidth variant={copied ? "primary" : "secondary"} onClick={onClose}>Done</Button>
        </div>
      }
    >
      <p className="text-[15px] font-medium leading-snug text-ink-2">
        {copied
          ? `The address is on the clipboard. It is only the link, so it can open in the browser. Send it to ${name} for their haircuts, queue and sales.`
          : `The clipboard isn’t available, so nothing was copied. Select the address below and copy it yourself. Send only that address to ${name}.`}
      </p>
      <p className="mt-3.5 select-text break-all rounded-[14px] bg-grey-100 px-3.5 py-3 text-[14px] font-semibold leading-snug tracking-[-0.01em]">{url}</p>
    </BottomSheet>
  );
}
