-- AI Video Flow Platform — Initial Schema
-- Phase 1: All tables, RLS policies, triggers, and indexes

-- ─────────────────────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────────────────────

create table profiles (
  id              uuid references auth.users on delete cascade primary key,
  email           text not null,
  full_name       text,
  avatar_url      text,
  onboarding_done boolean default false,
  created_at      timestamptz default now()
);

create table projects (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references profiles(id) on delete cascade not null,
  name                 text not null,
  product_description  text,
  target_audience      text,
  product_category     text,
  content_types        text[] default '{}',
  posting_frequency    text default 'manual',
  posting_time         text default 'morning',
  metricool_brand_id   text,
  instagram_connected  boolean default false,
  facebook_connected   boolean default false,
  active               boolean default true,
  autopilot            boolean default false,
  system_prompt        text,
  script_prompts       text[] default '{}',
  cloudinary_folder    text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

create table product_images (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete cascade not null,
  user_id      uuid references profiles(id) on delete cascade not null,
  url          text not null,
  public_id    text not null,
  created_at   timestamptz default now()
);

create table credits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade not null unique,
  balance    integer default 0,
  updated_at timestamptz default now()
);

create table credit_transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references profiles(id) on delete cascade not null,
  amount            integer not null,
  reason            text not null,
  stripe_payment_id text,
  video_id          uuid,
  created_at        timestamptz default now()
);

create table videos (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id) on delete cascade not null,
  user_id           uuid references profiles(id) on delete cascade not null,
  status            text default 'pending',
  content_type      text,
  script_prompt     text,
  fal_image_url     text,
  fal_video_url     text,
  cloudinary_url    text,
  captioned_url     text,
  metricool_post_id text,
  error_message     text,
  credits_used      integer default 30,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table projects enable row level security;
alter table product_images enable row level security;
alter table credits enable row level security;
alter table credit_transactions enable row level security;
alter table videos enable row level security;

-- profiles: select and update own row only (no client insert — trigger handles it)
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

-- projects
create policy "projects_select_own" on projects for select using (auth.uid() = user_id);
create policy "projects_insert_own" on projects for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on projects for update using (auth.uid() = user_id);
create policy "projects_delete_own" on projects for delete using (auth.uid() = user_id);

-- product_images
create policy "product_images_select_own" on product_images for select using (auth.uid() = user_id);
create policy "product_images_insert_own" on product_images for insert with check (auth.uid() = user_id);
create policy "product_images_update_own" on product_images for update using (auth.uid() = user_id);
create policy "product_images_delete_own" on product_images for delete using (auth.uid() = user_id);

-- credits
create policy "credits_select_own" on credits for select using (auth.uid() = user_id);
create policy "credits_update_own" on credits for update using (auth.uid() = user_id);

-- credit_transactions
create policy "credit_transactions_select_own" on credit_transactions for select using (auth.uid() = user_id);
create policy "credit_transactions_insert_own" on credit_transactions for insert with check (auth.uid() = user_id);

-- videos
create policy "videos_select_own" on videos for select using (auth.uid() = user_id);
create policy "videos_insert_own" on videos for insert with check (auth.uid() = user_id);
create policy "videos_update_own" on videos for update using (auth.uid() = user_id);
create policy "videos_delete_own" on videos for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Auto-create profile + credits on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, email)
  values (new.id, new.email);

  insert into credits (user_id, balance)
  values (new.id, 30);

  insert into credit_transactions (user_id, amount, reason)
  values (new.id, 30, 'signup_bonus');

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- 2. Auto-set cloudinary_folder on project insert
create or replace function set_project_cloudinary_folder()
returns trigger as $$
begin
  new.cloudinary_folder := 'catalog/' || new.id::text || '/';
  return new;
end;
$$ language plpgsql;

create trigger set_cloudinary_folder
  before insert on projects
  for each row execute procedure set_project_cloudinary_folder();

-- 3. Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at before update on projects
  for each row execute procedure update_updated_at();

create trigger videos_updated_at before update on videos
  for each row execute procedure update_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────────────────────────────────

create index idx_projects_user_id on projects(user_id);
create index idx_videos_project_id on videos(project_id);
create index idx_videos_user_id on videos(user_id);
create index idx_videos_status on videos(status);
create index idx_credit_transactions_user_id on credit_transactions(user_id);
create index idx_product_images_project_id on product_images(project_id);
