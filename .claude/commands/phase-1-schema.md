# Phase 1 — Supabase Schema + Migrations

## Pre-flight check
Before writing anything, confirm:
1. Supabase project is connected (check .env.local for NEXT_PUBLIC_SUPABASE_URL)
2. No existing tables conflict with the schema below
3. Show me the plan: which SQL files you will create, nothing else

## Your task
Create the complete Supabase database schema as a single migration file at:
  supabase/migrations/001_initial_schema.sql

## Schema to implement

### Table: profiles
```sql
create table profiles (
  id              uuid references auth.users on delete cascade primary key,
  email           text not null,
  full_name       text,
  avatar_url      text,
  onboarding_done boolean default false,
  created_at      timestamptz default now()
);
```

### Table: projects
```sql
create table projects (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references profiles(id) on delete cascade not null,
  name                 text not null,
  product_description  text,
  target_audience      text,
  product_category     text,
  content_types        text[] default '{}',
  posting_frequency    text default 'manual', -- 'daily' or 'manual'
  posting_time         text default 'morning', -- 'morning' | 'afternoon' | 'evening'
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
```

### Table: product_images
```sql
create table product_images (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid references projects(id) on delete cascade not null,
  user_id      uuid references profiles(id) on delete cascade not null,
  url          text not null,
  public_id    text not null,
  created_at   timestamptz default now()
);
```

### Table: credits
```sql
create table credits (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references profiles(id) on delete cascade not null unique,
  balance    integer default 0,
  updated_at timestamptz default now()
);
```

### Table: credit_transactions
```sql
create table credit_transactions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid references profiles(id) on delete cascade not null,
  amount            integer not null, -- positive = top-up, negative = spend
  reason            text not null,    -- 'signup_bonus' | 'purchase' | 'video_generated' | 'refund'
  stripe_payment_id text,
  video_id          uuid,
  created_at        timestamptz default now()
);
```

### Table: videos
```sql
create table videos (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid references projects(id) on delete cascade not null,
  user_id           uuid references profiles(id) on delete cascade not null,
  status            text default 'pending',
  -- pending | generating | processing | uploading | captioning | posting | done | failed
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
```

## RLS policies to implement
Enable RLS on ALL tables. Rule for every table:
- SELECT: auth.uid() = user_id
- INSERT: auth.uid() = user_id
- UPDATE: auth.uid() = user_id
- DELETE: auth.uid() = user_id

Exception: profiles table — users can only select/update their own row (no insert from client, handled by trigger).

## Triggers to implement

### 1. Auto-create profile on signup
```sql
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
```

### 2. Auto-set cloudinary_folder on project insert
```sql
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
```

### 3. Updated_at auto-update for projects and videos
```sql
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
```

## Indexes to create
```sql
create index idx_projects_user_id on projects(user_id);
create index idx_videos_project_id on videos(project_id);
create index idx_videos_user_id on videos(user_id);
create index idx_videos_status on videos(status);
create index idx_credit_transactions_user_id on credit_transactions(user_id);
create index idx_product_images_project_id on product_images(project_id);
```

## After completing this phase
1. Run the migration against the Supabase project
2. Confirm all tables appear in the Supabase dashboard
3. Confirm RLS is enabled on all tables
4. Confirm the signup trigger works by checking profiles + credits tables
5. Update CLAUDE.md Phase 1 checkbox to [x]
6. Do NOT touch any Next.js files in this phase

## Do NOT do in this phase
- No Next.js code
- No API routes
- No UI components
- Just SQL
