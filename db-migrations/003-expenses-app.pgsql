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

CREATE TABLE public.bewcloud_budgets (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    name text NOT NULL,
    month character varying NOT NULL,
    value numeric NOT NULL,
    extra jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.bewcloud_budgets ADD CONSTRAINT bewcloud_budgets_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bewcloud_budgets ADD CONSTRAINT bewcloud_budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);
ALTER TABLE ONLY public.bewcloud_budgets ADD CONSTRAINT bewcloud_budgets_user_id_name_month_unique UNIQUE (user_id, name, month);


CREATE TABLE public.bewcloud_expenses (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    cost numeric NOT NULL,
    description text NOT NULL,
    budget text NOT NULL,
    date character varying NOT NULL,
    is_recurring boolean NOT NULL,
    extra jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ONLY public.bewcloud_expenses ADD CONSTRAINT bewcloud_expenses_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.bewcloud_expenses ADD CONSTRAINT bewcloud_expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);
