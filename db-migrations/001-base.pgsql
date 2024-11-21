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

CREATE TABLE public.bewcloud_users (
    id uuid DEFAULT gen_random_uuid(),
    email character varying NOT NULL,
    hashed_password text NOT NULL,
    subscription jsonb NOT NULL,
    status character varying NOT NULL,
    extra jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.bewcloud_users ADD CONSTRAINT bewcloud_users_pkey PRIMARY KEY (id);


CREATE TABLE public.bewcloud_user_sessions (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    expires_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.bewcloud_user_sessions ADD CONSTRAINT bewcloud_user_sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bewcloud_user_sessions ADD CONSTRAINT bewcloud_user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


CREATE TABLE public.bewcloud_verification_codes (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    code character varying NOT NULL,
    verification jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.bewcloud_verification_codes ADD CONSTRAINT bewcloud_verification_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bewcloud_verification_codes ADD CONSTRAINT bewcloud_verification_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


CREATE TABLE public.bewcloud_dashboards (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

CREATE UNIQUE INDEX bewcloud_dashboards_unique_index ON public.bewcloud_dashboards ( user_id );

ALTER TABLE ONLY public.bewcloud_dashboards ADD CONSTRAINT bewcloud_dashboards_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bewcloud_dashboards ADD CONSTRAINT bewcloud_dashboards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


CREATE TABLE public.bewcloud_migrations (
    id uuid DEFAULT gen_random_uuid(),
    name character varying(100) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE ONLY public.bewcloud_migrations ADD CONSTRAINT bewcloud_migrations_pkey PRIMARY KEY (id);
