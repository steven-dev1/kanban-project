import { toDatabaseError } from "@/lib/db-error";
import { sendInvitationEmail } from "@/lib/email";
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

interface InviteBody {
  board_id?: string;
  email?: string;
  role?: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as InviteBody | null;
  const boardId = body?.board_id;
  const email = (body?.email ?? "").trim().toLowerCase();
  const role = body?.role === "admin" ? "admin" : "member";

  if (!boardId || !email) {
    return NextResponse.json({ error: "Faltan el tablero o el correo" }, { status: 400 });
  }

  // Validación de formato y longitud del correo.
  if (email.length > 254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "El correo no es válido" }, { status: 400 });
  }

  // Evita invitaciones pendientes duplicadas para el mismo correo y tablero.
  const { data: existing } = await supabase
    .from("board_invitations")
    .select("id")
    .eq("board_id", boardId)
    .ilike("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Ya hay una invitación pendiente para ese correo" }, { status: 409 });
  }

  // La RLS exige que el usuario sea admin/propietario del tablero.
  const { error } = await supabase.from("board_invitations").insert({
    board_id: boardId,
    email,
    role,
    invited_by: user.id,
  });

  if (error) {
    return NextResponse.json({ error: toDatabaseError(error).message }, { status: 400 });
  }

  const [{ data: board }, { data: profile }] = await Promise.all([
    supabase.from("boards").select("title").eq("id", boardId).maybeSingle(),
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
  ]);

  const link = `${request.nextUrl.origin}/boards`;
  const result = await sendInvitationEmail({
    to: email,
    boardName: board?.title ?? "Tablero",
    inviterName: profile?.full_name || profile?.email || "Un miembro",
    link,
  });

  return NextResponse.json({
    ok: true,
    emailed: result.sent,
    warning: result.sent ? null : (result.error ?? null),
  });
}
