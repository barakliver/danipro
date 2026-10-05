"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { IconCheck, IconCopy } from "@/components/ui/icons";

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // older iOS: fall back to a hidden textarea
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export function CopyButton({ text, label = "העתק", toastText = "הועתק", ...props }: ButtonProps & { text: string; label?: string; toastText?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      {...props}
      disabled={!text.trim() || props.disabled}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          toast.success(toastText);
          setTimeout(() => setDone(false), 1600);
        } else {
          toast.error("לא הצלחנו להעתיק. אפשר לסמן את הטקסט ידנית.");
        }
      }}
    >
      {done ? <IconCheck size={18} /> : <IconCopy size={18} />}
      {label}
    </Button>
  );
}
