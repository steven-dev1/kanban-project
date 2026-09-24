export type Role = "admin" | "member";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Board {
  id: string;
  title: string;
  description: string | null;
  owner_id: string;
  is_paused: boolean;
  created_at: string;
  updated_at: string;
}

export interface BoardMember {
  id: string;
  board_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface BoardInvitation {
  id: string;
  board_id: string;
  email: string;
  role: Role;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
}

export interface BoardList {
  id: string;
  board_id: string;
  title: string;
  color: string | null;
  position: number;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
}

export interface Card {
  id: string;
  board_id: string;
  list_id: string;
  title: string;
  description: string | null;
  position: number;
  due_date: string | null;
  is_archived: boolean;
  archived_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  board_id: string | null;
  type: "board_invite" | "board_added" | string;
  title: string;
  body: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface CardAssignee {
  user_id: string;
  profile: Profile | null;
}

export interface Attachment {
  id: string;
  card_id: string;
  board_id: string;
  name: string;
  path: string;
  size: number | null;
  mime_type: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CardWithLabels extends Card {
  card_labels: { label_id: string; labels: Label }[];
  card_assignees: CardAssignee[];
  attachments: Attachment[];
}
