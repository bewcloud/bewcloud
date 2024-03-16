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
-- Name: bewcloud_news_feeds; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_news_feeds (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    feed_url text NOT NULL,
    last_crawled_at timestamp with time zone DEFAULT NULL,
    extra jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bewcloud_news_feeds OWNER TO postgres;

CREATE UNIQUE INDEX bewcloud_news_feeds_unique_index ON public.bewcloud_news_feeds ( user_id, feed_url );


--
-- Name: bewcloud_news_feeds bewcloud_news_feeds_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_news_feeds
    ADD CONSTRAINT bewcloud_news_feeds_pkey PRIMARY KEY (id);


--
-- Name: bewcloud_news_feeds bewcloud_news_feeds_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_news_feeds
    ADD CONSTRAINT bewcloud_news_feeds_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


--
-- Name: TABLE bewcloud_news_feeds; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_news_feeds TO postgres;


--
-- Name: bewcloud_news_feed_articles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.bewcloud_news_feed_articles (
    id uuid DEFAULT gen_random_uuid(),
    user_id uuid DEFAULT gen_random_uuid(),
    feed_id uuid DEFAULT gen_random_uuid(),
    article_url text NOT NULL,
    article_title text NOT NULL,
    article_summary text NOT NULL,
    article_date timestamp with time zone NOT NULL,
    is_read boolean DEFAULT FALSE,
    extra jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.bewcloud_news_feed_articles OWNER TO postgres;

CREATE UNIQUE INDEX bewcloud_news_feed_articles_unique_index ON public.bewcloud_news_feed_articles ( user_id, feed_id, article_url );


--
-- Name: bewcloud_news_feed_articles bewcloud_news_feed_articles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_news_feed_articles
    ADD CONSTRAINT bewcloud_news_feed_articles_pkey PRIMARY KEY (id);


--
-- Name: bewcloud_news_feed_articles bewcloud_news_feed_articles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_news_feed_articles
    ADD CONSTRAINT bewcloud_news_feed_articles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.bewcloud_users(id);


--
-- Name: bewcloud_news_feed_articles bewcloud_news_feed_articles_feed_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.bewcloud_news_feed_articles
    ADD CONSTRAINT bewcloud_news_feed_articles_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES public.bewcloud_news_feeds(id);


--
-- Name: TABLE bewcloud_news_feed_articles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.bewcloud_news_feed_articles TO postgres;
