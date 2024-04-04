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


--
-- Name: bewcloud_file_shares; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_file_shares (
    id uuid DEFAULT gen_random_uuid(),
    owner_user_id uuid DEFAULT gen_random_uuid(),
    owner_parent_path text NOT NULL,
    parent_path text NOT NULL,
    name text NOT NULL,
    type varchar NOT NULL,
    user_ids_with_read_access uuid[] NOT NULL,
    user_ids_with_write_access uuid[] NOT NULL,
    extra jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bewcloud_file_shares OWNER TO postgres;

CREATE UNIQUE INDEX bewcloud_file_shares_unique_index ON public.bewcloud_file_shares ( owner_user_id, owner_parent_path, name, type );


--
-- Name: bewcloud_file_shares bewcloud_file_shares_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_file_shares
    ADD CONSTRAINT bewcloud_file_shares_pkey PRIMARY KEY (id);


--
-- Name: bewcloud_file_shares bewcloud_file_shares_owner_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_file_shares
    ADD CONSTRAINT bewcloud_file_shares_owner_user_id_fkey FOREIGN KEY (owner_user_id) REFERENCES public.bewcloud_users(id);


--
-- Name: TABLE bewcloud_file_shares; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_file_shares TO postgres;
