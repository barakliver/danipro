// Typed mirror of supabase/migrations. Keep in sync when the schema changes.
// Row types are written out; Insert/Update are derived so that columns with
// database defaults stay optional.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Rel = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type Table<Row, Required extends keyof Row, Relationships extends Rel[] = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

type Timestamps = { created_at: string; updated_at: string };
type Owned = { id: string; workspace_id: string };

export type WorkspaceRow = Timestamps & {
  id: string;
  name: string;
  design_settings: Json;
  onboarded_at: string | null;
};

export type ProfileRow = Timestamps & { id: string; display_name: string | null; person_role: string | null };

export type WorkspaceMemberRow = { workspace_id: string; user_id: string; role: string; created_at: string };

export type WorkspaceInviteRow = {
  id: string;
  workspace_id: string;
  email: string;
  role: string;
  invited_by: string | null;
  accepted_at: string | null;
  created_at: string;
};

export type ContentPillarRow = Owned &
  Timestamps & {
    key: string;
    name: string;
    description: string | null;
    ratio_group: string;
    sort_order: number;
  };

export type BrandBrainEntryRow = Owned &
  Timestamps & {
    section: string;
    title: string | null;
    body: string;
    meta: Json;
    sort_order: number;
    pinned: boolean;
    created_by: string | null;
    deleted_at: string | null;
  };

export type TemplateRow = Owned &
  Timestamps & {
    family: string;
    name: string;
    formats: string[];
    best_use: string | null;
    config: Json;
    is_favorite: boolean;
    usage_count: number;
    last_used_at: string | null;
    archived_at: string | null;
  };

export type TemplateVariantRow = Owned &
  Timestamps & { template_id: string; name: string; config: Json; sort_order: number };

export type GalleryAssetRow = Owned &
  Timestamps & {
    storage_path: string;
    thumb_path: string | null;
    preview_path: string | null;
    media_type: string;
    mime_type: string | null;
    original_filename: string | null;
    width: number | null;
    height: number | null;
    duration_seconds: number | null;
    byte_size: number | null;
    orientation: string | null;
    taken_at: string | null;
    people: string[];
    location_category: string | null;
    mood: string | null;
    suitable_formats: string[];
    notes: string | null;
    worked_well: boolean;
    created_by: string | null;
    deleted_at: string | null;
  };

export type GalleryTagRow = Owned & Timestamps & { name: string; kind: string; is_suggested: boolean };

export type AssetTagRow = { asset_id: string; tag_id: string; workspace_id: string; source: string; created_at: string };

export type IdeaRow = Owned &
  Timestamps & {
    body: string;
    kind: string;
    asset_id: string | null;
    tags: string[];
    status: string;
    created_by: string | null;
    deleted_at: string | null;
  };

export type AudienceEntryRow = Owned &
  Timestamps & {
    original_text: string;
    source_type: string;
    topic: string | null;
    received_on: string | null;
    permission_status: string;
    notes: string | null;
    created_by: string | null;
    deleted_at: string | null;
  };

export type ContentItemRow = Owned &
  Timestamps & {
    format: string;
    pillar_id: string | null;
    status: string;
    topic: string | null;
    hook: string | null;
    body: Json;
    caption: string | null;
    cta: string | null;
    supporting_story: string | null;
    visual_notes: string | null;
    notes: string | null;
    requires_filming: boolean;
    requires_product: boolean;
    requires_barak: boolean;
    requires_couple: boolean;
    product_presence: string;
    prep_minutes: number | null;
    location_category: string | null;
    topic_tags: string[];
    template_id: string | null;
    sounds_like_us: number | null;
    score_breakdown: Json | null;
    source: string;
    source_ref: string | null;
    idea_id: string | null;
    audience_entry_id: string | null;
    parent_id: string | null;
    is_quick: boolean;
    published_at: string | null;
    created_by: string | null;
    deleted_at: string | null;
  };

export type ContentVersionRow = Owned & {
  content_id: string;
  snapshot: Json;
  reason: string;
  created_by: string | null;
  created_at: string;
};

export type ContentCalendarRow = Owned &
  Timestamps & {
    content_id: string;
    scheduled_on: string;
    scheduled_time: string | null;
    plan_day: number | null;
    slot: string;
  };

export type ContentAssetRow = Owned & {
  content_id: string;
  asset_id: string;
  role: string;
  position: number;
  created_at: string;
};

export type GenerationHistoryRow = Owned & {
  content_id: string | null;
  task: string;
  provider: string;
  model: string | null;
  input: Json;
  context_summary: Json;
  output: Json | null;
  score: number | null;
  status: string;
  error: string | null;
  latency_ms: number | null;
  created_by: string | null;
  created_at: string;
};

export type ContentFeedbackRow = Owned & {
  content_id: string | null;
  generation_id: string | null;
  kind: string;
  text_snapshot: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type AnalyticsEntryRow = Owned &
  Timestamps & {
    content_id: string;
    recorded_on: string;
    views: number | null;
    reach: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    story_replies: number | null;
    poll_responses: number | null;
    profile_visits: number | null;
    link_clicks: number | null;
    sales: number | null;
    notes: string | null;
  };

export type HighlightCollectionRow = Owned &
  Timestamps & { key: string; title: string; purpose: string | null; sort_order: number };

export type HighlightItemRow = Owned &
  Timestamps & {
    collection_id: string;
    position: number;
    body: string;
    visual_notes: string | null;
    interaction: string | null;
    content_id: string | null;
    asset_id: string | null;
  };

export type FilmingSessionRow = Owned &
  Timestamps & {
    minutes: number;
    available: string[];
    plan: Json;
    completed_at: string | null;
    created_by: string | null;
  };

export type FilmingSessionItemRow = Owned & {
  session_id: string;
  content_id: string;
  look_number: number;
  position: number;
  done_at: string | null;
  created_at: string;
};

type Fk<N extends string, C extends string, R extends string, O extends boolean = false> = {
  foreignKeyName: N;
  columns: [C];
  isOneToOne: O;
  referencedRelation: R;
  referencedColumns: ["id"];
};
export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      workspaces: Table<WorkspaceRow, "name">;
      profiles: Table<ProfileRow, "id">;
      workspace_members: Table<
        WorkspaceMemberRow,
        "workspace_id" | "user_id",
        [Fk<"workspace_members_workspace_id_fkey", "workspace_id", "workspaces">]
      >;
      workspace_invites: Table<WorkspaceInviteRow, "workspace_id" | "email">;
      content_pillars: Table<ContentPillarRow, "workspace_id" | "key" | "name" | "ratio_group">;
      brand_brain_entries: Table<BrandBrainEntryRow, "workspace_id" | "section" | "body">;
      templates: Table<TemplateRow, "workspace_id" | "family" | "name">;
      template_variants: Table<
        TemplateVariantRow,
        "workspace_id" | "template_id" | "name",
        [Fk<"template_variants_template_id_fkey", "template_id", "templates">]
      >;
      gallery_assets: Table<GalleryAssetRow, "workspace_id" | "storage_path" | "media_type">;
      gallery_tags: Table<GalleryTagRow, "workspace_id" | "name">;
      asset_tags: Table<
        AssetTagRow,
        "asset_id" | "tag_id" | "workspace_id",
        [
          Fk<"asset_tags_asset_id_fkey", "asset_id", "gallery_assets">,
          Fk<"asset_tags_tag_id_fkey", "tag_id", "gallery_tags">,
        ]
      >;
      ideas: Table<IdeaRow, "workspace_id", [Fk<"ideas_asset_id_fkey", "asset_id", "gallery_assets">]>;
      audience_entries: Table<AudienceEntryRow, "workspace_id" | "original_text" | "source_type">;
      content_items: Table<
        ContentItemRow,
        "workspace_id" | "format",
        [
          Fk<"content_items_pillar_id_fkey", "pillar_id", "content_pillars">,
          Fk<"content_items_template_id_fkey", "template_id", "templates">,
          Fk<"content_items_idea_id_fkey", "idea_id", "ideas">,
          Fk<"content_items_audience_entry_id_fkey", "audience_entry_id", "audience_entries">,
          Fk<"content_items_parent_id_fkey", "parent_id", "content_items">,
        ]
      >;
      content_versions: Table<
        ContentVersionRow,
        "workspace_id" | "content_id" | "snapshot",
        [Fk<"content_versions_content_id_fkey", "content_id", "content_items">]
      >;
      content_calendar: Table<
        ContentCalendarRow,
        "workspace_id" | "content_id" | "scheduled_on",
        [Fk<"content_calendar_content_id_fkey", "content_id", "content_items", true>]
      >;
      content_assets: Table<
        ContentAssetRow,
        "workspace_id" | "content_id" | "asset_id",
        [
          Fk<"content_assets_content_id_fkey", "content_id", "content_items">,
          Fk<"content_assets_asset_id_fkey", "asset_id", "gallery_assets">,
        ]
      >;
      generation_history: Table<GenerationHistoryRow, "workspace_id" | "task" | "provider">;
      content_feedback: Table<ContentFeedbackRow, "workspace_id" | "kind">;
      analytics_entries: Table<
        AnalyticsEntryRow,
        "workspace_id" | "content_id",
        [Fk<"analytics_entries_content_id_fkey", "content_id", "content_items">]
      >;
      highlight_collections: Table<HighlightCollectionRow, "workspace_id" | "key" | "title">;
      highlight_items: Table<
        HighlightItemRow,
        "workspace_id" | "collection_id" | "body",
        [
          Fk<"highlight_items_collection_id_fkey", "collection_id", "highlight_collections">,
          Fk<"highlight_items_content_id_fkey", "content_id", "content_items">,
          Fk<"highlight_items_asset_id_fkey", "asset_id", "gallery_assets">,
        ]
      >;
      filming_sessions: Table<FilmingSessionRow, "workspace_id" | "minutes">;
      filming_session_items: Table<
        FilmingSessionItemRow,
        "workspace_id" | "session_id" | "content_id",
        [
          Fk<"filming_session_items_session_id_fkey", "session_id", "filming_sessions">,
          Fk<"filming_session_items_content_id_fkey", "content_id", "content_items">,
        ]
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
