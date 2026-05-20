-- ============================================================================
-- StoryboardAI — Initial Database Schema
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ─── Users ───────────────────────────────────────────────────────────────────

create table public.users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  plan text not null default 'free'
    check (plan in ('free', 'pro', 'enterprise')),
  stripe_customer_id text unique,
  credits_remaining integer not null default 20,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Projects ────────────────────────────────────────────────────────────────

create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  description text,
  genre text not null default 'other'
    check (genre in (
      'action','comedy','drama','horror','romance',
      'sci-fi','thriller','animation','documentary','other'
    )),
  status text not null default 'draft'
    check (status in ('draft','in_progress','completed','archived')),
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Storyboards ─────────────────────────────────────────────────────────────

create table public.storyboards (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects(id) on delete cascade not null,
  title text not null,
  style text not null default 'cinematic'
    check (style in (
      'realistic','anime','comic','watercolor','pencil_sketch',
      'noir','cinematic','3d_render','pixel_art','custom'
    )),
  scene_count integer not null default 0,
  status text not null default 'idle'
    check (status in ('idle','generating','completed','failed','partial')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Scenes ──────────────────────────────────────────────────────────────────

create table public.scenes (
  id uuid default uuid_generate_v4() primary key,
  storyboard_id uuid references public.storyboards(id) on delete cascade not null,
  order_index integer not null default 0,
  title text not null default '',
  prompt text not null,
  visual_prompt text not null default '',
  description text not null,
  dialogue text,
  action_notes text,
  camera_angle text not null default 'eye_level'
    check (camera_angle in (
      'eye_level','low_angle','high_angle','birds_eye',
      'dutch_angle','over_the_shoulder','pov','worms_eye'
    )),
  shot_type text not null default 'medium'
    check (shot_type in (
      'extreme_wide','wide','medium_wide','medium','medium_close_up',
      'close_up','extreme_close_up','establishing','two_shot','insert','aerial'
    )),
  mood text,
  lighting text,
  location text,
  characters text[] default '{}',
  image_url text,
  thumbnail_url text,
  duration_seconds integer not null default 3,
  transition text not null default 'cut'
    check (transition in ('cut','fade','dissolve','wipe','zoom','match_cut','smash_cut')),
  generation_status text not null default 'pending'
    check (generation_status in ('pending','generating','completed','failed','retrying')),
  retry_count integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Usage Records ───────────────────────────────────────────────────────────

create table public.usage_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  action text not null
    check (action in (
      'scene_generation','scene_regeneration','scene_edit',
      'storyboard_export','batch_generation'
    )),
  credits_used integer not null default 1,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

create index idx_projects_user_id on public.projects(user_id);
create index idx_projects_status on public.projects(status);
create index idx_projects_updated on public.projects(updated_at desc);
create index idx_storyboards_project_id on public.storyboards(project_id);
create index idx_storyboards_status on public.storyboards(status);
create index idx_scenes_storyboard_id on public.scenes(storyboard_id);
create index idx_scenes_order on public.scenes(storyboard_id, order_index);
create index idx_scenes_generation_status on public.scenes(generation_status);
create index idx_usage_user_id on public.usage_records(user_id);
create index idx_usage_created_at on public.usage_records(created_at desc);

-- ─── Triggers ────────────────────────────────────────────────────────────────

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on public.users
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.projects
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.storyboards
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.scenes
  for each row execute function public.handle_updated_at();

-- Auto-create user profile on auth signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Row Level Security ─────────────────────────────────────────────────────

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.storyboards enable row level security;
alter table public.scenes enable row level security;
alter table public.usage_records enable row level security;

-- Users
create policy "Users can read own profile"
  on public.users for select using (auth.uid() = id);
create policy "Users can update own profile"
  on public.users for update using (auth.uid() = id);

-- Projects
create policy "Users CRUD own projects"
  on public.projects for all using (auth.uid() = user_id);

-- Storyboards (through project ownership)
create policy "Users CRUD own storyboards"
  on public.storyboards for all using (
    exists (
      select 1 from public.projects
      where projects.id = storyboards.project_id
        and projects.user_id = auth.uid()
    )
  );

-- Scenes (through storyboard → project ownership)
create policy "Users CRUD own scenes"
  on public.scenes for all using (
    exists (
      select 1 from public.storyboards sb
      join public.projects p on p.id = sb.project_id
      where sb.id = scenes.storyboard_id
        and p.user_id = auth.uid()
    )
  );

-- Usage records
create policy "Users can read own usage"
  on public.usage_records for select using (auth.uid() = user_id);
create policy "Users can insert own usage"
  on public.usage_records for insert with check (auth.uid() = user_id);
