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

CREATE TABLE public.bewcloud_authentication_challenges (
    id uuid DEFAULT gen_random_uuid(),
    challenge text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.bewcloud_authentication_challenges ADD CONSTRAINT bewcloud_authentication_challenges_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bewcloud_authentication_challenges ADD CONSTRAINT bewcloud_authentication_challenges_challenge_key UNIQUE (challenge);
