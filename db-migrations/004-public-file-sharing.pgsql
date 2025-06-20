SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

CREATE TABLE public.bewcloud_file_shares (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    file_path text NOT NULL,
    extra jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.bewcloud_file_shares ADD CONSTRAINT bewcloud_file_shares_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bewcloud_file_shares ADD CONSTRAINT bewcloud_file_shares_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);
ALTER TABLE ONLY public.bewcloud_file_shares ADD CONSTRAINT bewcloud_file_shares_user_id_file_path_unique UNIQUE (user_id, file_path);
