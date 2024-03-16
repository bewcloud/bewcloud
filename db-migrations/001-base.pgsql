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
-- Name: bewcloud_user_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_user_sessions (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    expires_at timestamp with time zone NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bewcloud_user_sessions OWNER TO postgres;


--
-- Name: bewcloud_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_users (
    id uuid DEFAULT gen_random_uuid(),
    email character varying NOT NULL,
    hashed_password text NOT NULL,
    subscription jsonb NOT NULL,
    status character varying NOT NULL,
    extra jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bewcloud_users OWNER TO postgres;

--
-- Name: bewcloud_verification_codes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_verification_codes (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    code character varying NOT NULL,
    verification jsonb NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bewcloud_verification_codes OWNER TO postgres;


--
-- Name: bewcloud_dashboards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_dashboards (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    data jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bewcloud_dashboards OWNER TO postgres;

CREATE UNIQUE INDEX bewcloud_dashboards_unique_index ON public.bewcloud_dashboards ( user_id );


--
-- Name: bewcloud_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_migrations (
    id uuid DEFAULT gen_random_uuid(),
    name character varying(100) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.bewcloud_migrations OWNER TO postgres;


--
-- Name: bewcloud_user_sessions bewcloud_user_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_user_sessions
    ADD CONSTRAINT bewcloud_user_sessions_pkey PRIMARY KEY (id);
    

--
-- Name: bewcloud_verification_codes bewcloud_verification_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_verification_codes
    ADD CONSTRAINT bewcloud_verification_codes_pkey PRIMARY KEY (id);


--
-- Name: bewcloud_users bewcloud_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_users
    ADD CONSTRAINT bewcloud_users_pkey PRIMARY KEY (id);


--
-- Name: bewcloud_dashboards bewcloud_dashboards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_dashboards
    ADD CONSTRAINT bewcloud_dashboards_pkey PRIMARY KEY (id);


--
-- Name: bewcloud_dashboards bewcloud_dashboards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_dashboards
    ADD CONSTRAINT bewcloud_dashboards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


--
-- Name: bewcloud_migrations bewcloud_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_migrations
    ADD CONSTRAINT bewcloud_migrations_pkey PRIMARY KEY (id);


--
-- Name: bewcloud_user_sessions bewcloud_user_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_user_sessions
    ADD CONSTRAINT bewcloud_user_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


--
-- Name: bewcloud_verification_codes bewcloud_verification_codes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_verification_codes
    ADD CONSTRAINT bewcloud_verification_codes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


--
-- Name: TABLE bewcloud_user_sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_user_sessions TO postgres;


--
-- Name: TABLE bewcloud_users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_users TO postgres;


--
-- Name: TABLE bewcloud_verification_codes; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_verification_codes TO postgres;


--
-- Name: TABLE bewcloud_dashboards; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_dashboards TO postgres;

--
-- Name: TABLE bewcloud_migrations; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_migrations TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES  TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS  TO postgres;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES  TO postgres;
