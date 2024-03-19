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
-- Name: bewcloud_calendars; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_calendars (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    revision text NOT NULL,
    name text NOT NULL,
    color text NOT NULL,
    is_visible boolean NOT NULL,
    extra jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bewcloud_calendars OWNER TO postgres;


--
-- Name: bewcloud_calendars bewcloud_calendars_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_calendars
    ADD CONSTRAINT bewcloud_calendars_pkey PRIMARY KEY (id);


--
-- Name: bewcloud_calendars bewcloud_calendars_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_calendars
    ADD CONSTRAINT bewcloud_calendars_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


--
-- Name: TABLE bewcloud_calendars; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_calendars TO postgres;


--
-- Name: bewcloud_calendar_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_calendar_events (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    calendar_id uuid DEFAULT gen_random_uuid(),
    revision text NOT NULL,
    title text NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    is_all_day boolean NOT NULL,
    status VARCHAR NOT NULL,
    extra jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bewcloud_calendar_events OWNER TO postgres;


--
-- Name: bewcloud_calendar_events bewcloud_calendar_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_calendar_events
    ADD CONSTRAINT bewcloud_calendar_events_pkey PRIMARY KEY (id);


--
-- Name: bewcloud_calendar_events bewcloud_calendar_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_calendar_events
    ADD CONSTRAINT bewcloud_calendar_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


--
-- Name: bewcloud_calendar_events bewcloud_calendar_events_calendar_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_calendar_events
    ADD CONSTRAINT bewcloud_calendar_events_calendar_id_fkey FOREIGN KEY (calendar_id) REFERENCES public.bewcloud_calendars(id);


--
-- Name: TABLE bewcloud_calendar_events; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_calendar_events TO postgres;
