export interface EmailResult {
  sent: boolean;
  error?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendInvitationEmail({
  to,
  boardName,
  inviterName,
  link,
}: {
  to: string;
  boardName: string;
  inviterName: string;
  link: string;
}): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return {
      sent: false,
      error:
        "Falta configurar RESEND_API_KEY y EMAIL_FROM en .env.local para enviar correos.",
    };
  }

  const safeBoard = escapeHtml(boardName);
  const safeInviter = escapeHtml(inviterName);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `${inviterName} te invitó al tablero "${boardName}"`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 8px">Te invitaron a un tablero</h2>
            <p style="color:#52525b;margin:0 0 16px">
              <strong>${safeInviter}</strong> te invitó a colaborar en el tablero
              <strong>${safeBoard}</strong>.
            </p>
            <a href="${link}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">
              Abrir Kanban
            </a>
            <p style="color:#71717a;font-size:13px;margin-top:20px">
              Inicia sesión o crea una cuenta con el correo <strong>${escapeHtml(to)}</strong>
              para aceptar la invitación desde tus notificaciones.
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { sent: false, error: `Error del proveedor de correo (${res.status}): ${text}` };
    }

    return { sent: true };
  } catch (error) {
    return {
      sent: false,
      error: error instanceof Error ? error.message : "Error inesperado al enviar el correo",
    };
  }
}
