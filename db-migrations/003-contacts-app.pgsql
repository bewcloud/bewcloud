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
-- Name: bewcloud_contacts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_contacts (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    revision text NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    extra jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bewcloud_contacts OWNER TO postgres;


--
-- Name: bewcloud_contacts bewcloud_contacts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_contacts
    ADD CONSTRAINT bewcloud_contacts_pkey PRIMARY KEY (id);


--
-- Name: bewcloud_contacts bewcloud_contacts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_contacts
    ADD CONSTRAINT bewcloud_contacts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


--
-- Name: TABLE bewcloud_contacts; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_contacts TO postgres;
