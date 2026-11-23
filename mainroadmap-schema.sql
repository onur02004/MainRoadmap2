--
-- PostgreSQL database dump
--

\restrict c8BEY7chtfDXuq8M2LPGdz93IwFiGKiD9yQ1mORIEXmKx6FuOiA9DYrz49MdJIx

-- Dumped from database version 18.7
-- Dumped by pg_dump version 18.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: user_relation_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_relation_type AS ENUM (
    'normal',
    'friends',
    'acquaintance',
    'family',
    'business'
);


--
-- Name: visibility_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.visibility_type AS ENUM (
    'public',
    'friends',
    'custom'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: avatar_designs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avatar_designs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    design_type text NOT NULL,
    name text NOT NULL,
    design_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT avatar_designs_type_check CHECK ((design_type = ANY (ARRAY['pixel'::text, 'blobatar'::text])))
);


--
-- Name: cluster_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cluster_services (
    id integer NOT NULL,
    service_key character varying(50) NOT NULL,
    tag character varying(30) NOT NULL,
    title character varying(100) NOT NULL,
    description text NOT NULL,
    icon character varying(10) DEFAULT '⚡'::character varying,
    route character varying(150) NOT NULL,
    category character varying(30) DEFAULT 'core'::character varying,
    is_active boolean DEFAULT true,
    requires_auth boolean DEFAULT false,
    allowed_roles text[] DEFAULT '{GUEST,USER,ADMIN}'::text[],
    allowed_user_ids text[] DEFAULT '{}'::text[],
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: cluster_services_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.cluster_services_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: cluster_services_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.cluster_services_id_seq OWNED BY public.cluster_services.id;


--
-- Name: custom_themes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_themes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(50) NOT NULL,
    theme_key character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    category character varying(20) DEFAULT 'custom'::character varying,
    has_cli boolean DEFAULT true,
    show_grid boolean DEFAULT true,
    dot_color character varying(20) NOT NULL,
    status_text character varying(100),
    css_variables jsonb DEFAULT '{"--bg-color": "#0a0a0f", "--panel-bg": "#12121c", "--text-main": "#e0e0e0", "--text-bright": "#ffffff", "--border-color": "rgba(255, 255, 255, 0.15)", "--accent-action": "#00ffaa"}'::jsonb NOT NULL,
    bg_image_url text,
    is_public boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: game_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    game_key character varying(100) NOT NULL,
    name character varying(150) NOT NULL,
    short_name character varying(60),
    tagline character varying(255),
    description text,
    instructions text,
    category character varying(50) DEFAULT 'party'::character varying NOT NULL,
    difficulty character varying(30) DEFAULT 'easy'::character varying NOT NULL,
    min_players integer DEFAULT 2 NOT NULL,
    max_players integer DEFAULT 2 NOT NULL,
    player_modes jsonb DEFAULT '["multiplayer"]'::jsonb NOT NULL,
    estimated_duration integer,
    logo_url text,
    cover_image_url text,
    preview_image_url text,
    icon character varying(100),
    accent_color character varying(20) DEFAULT '#8b5cf6'::character varying,
    route character varying(255),
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    rules jsonb DEFAULT '{}'::jsonb NOT NULL,
    config jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT game_catalog_difficulty_check CHECK (((difficulty)::text = ANY ((ARRAY['easy'::character varying, 'medium'::character varying, 'hard'::character varying])::text[]))),
    CONSTRAINT game_catalog_duration_check CHECK (((estimated_duration IS NULL) OR (estimated_duration > 0))),
    CONSTRAINT game_catalog_player_count_check CHECK (((min_players >= 1) AND (max_players >= min_players))),
    CONSTRAINT game_catalog_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'maintenance'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: song_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    song_share_id uuid NOT NULL,
    user_id uuid NOT NULL,
    comment text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    timestamp_seconds integer,
    parent_comment_id uuid
);


--
-- Name: song_ratings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_ratings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    song_share_id uuid NOT NULL,
    user_id uuid NOT NULL,
    rating smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT song_ratings_rating_check CHECK (((rating >= 0) AND (rating <= 100)))
);


--
-- Name: song_recommendation_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_recommendation_cache (
    id smallint NOT NULL,
    tracks jsonb DEFAULT '[]'::jsonb NOT NULL,
    fetched_at timestamp with time zone DEFAULT now() NOT NULL,
    last_error text,
    CONSTRAINT song_recommendation_cache_id_check CHECK ((id = 1))
);


--
-- Name: song_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.song_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    song_name text NOT NULL,
    song_artist text NOT NULL,
    spotify_uri text,
    song_url text,
    song_url_backup text,
    song_cover_url text,
    song_cover_url_backup text,
    song_artist_cover_url text,
    song_artist_cover_url_backup text,
    song_release_date date,
    song_artist_genre text[],
    overall_dominant_color text,
    dominant_colors_points text[],
    visibility public.visibility_type DEFAULT 'public'::public.visibility_type NOT NULL,
    target_users uuid[],
    rating_by_user smallint,
    comment_by_user text,
    recommended_time_by_user character varying(10),
    song_played_by_user boolean DEFAULT false,
    played_or_viewed_by uuid[] DEFAULT '{}'::uuid[],
    reposted_by uuid[] DEFAULT '{}'::uuid[],
    lyrics text,
    time_synced_lyrics jsonb,
    likes_count integer DEFAULT 0 NOT NULL,
    repost_count integer DEFAULT 0 NOT NULL,
    date_added timestamp with time zone DEFAULT now() NOT NULL,
    date_edited timestamp with time zone,
    post_type text DEFAULT 'music'::text NOT NULL,
    lyrics_excerpt text,
    lyrics_start_time numeric,
    lyrics_end_time numeric,
    lyrics_design jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT song_suggestions_lyrics_end_time_check CHECK (((post_type <> 'lyrics'::text) OR ((lyrics_end_time IS NULL) OR (lyrics_end_time >= (0)::numeric)))),
    CONSTRAINT song_suggestions_lyrics_time_check CHECK (((post_type <> 'lyrics'::text) OR ((lyrics_start_time IS NULL) OR (lyrics_start_time >= (0)::numeric)))),
    CONSTRAINT song_suggestions_post_type_check CHECK ((post_type = ANY (ARRAY['music'::text, 'lyrics'::text, 'image'::text, 'gif'::text, 'video'::text]))),
    CONSTRAINT song_suggestions_rating_by_user_check CHECK (((rating_by_user >= 0) AND (rating_by_user <= 100)))
);


--
-- Name: user_spotify_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_spotify_accounts (
    id integer NOT NULL,
    user_id uuid NOT NULL,
    spotify_user_id character varying(255),
    display_name character varying(255),
    email character varying(255),
    access_token text NOT NULL,
    refresh_token text NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_spotify_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_spotify_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_spotify_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_spotify_accounts_id_seq OWNED BY public.user_spotify_accounts.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_name public.citext NOT NULL,
    real_name text,
    relation public.user_relation_type DEFAULT 'normal'::public.user_relation_type NOT NULL,
    relation_verification_date timestamp with time zone,
    role text DEFAULT 'user'::text NOT NULL,
    password_hash text NOT NULL,
    email public.citext,
    tel_nr text,
    location jsonb,
    profile_pic_path text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    join_date timestamp with time zone DEFAULT now() NOT NULL,
    last_online timestamp with time zone,
    last_activity jsonb,
    email_verified boolean DEFAULT false NOT NULL,
    email_confirmed_by_user boolean DEFAULT false,
    avatar_type text DEFAULT 'builtin'::text NOT NULL,
    avatar_data jsonb,
    last_song_id text,
    last_song_name text,
    last_song_artist text,
    last_song_album text,
    last_song_cover text,
    last_song_url text,
    last_song_played_at timestamp with time zone,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text, 'moderator'::text]))),
    CONSTRAINT users_user_name_check CHECK ((user_name OPERATOR(public.~) '^[A-Za-z0-9_]{3,32}$'::public.citext))
);


--
-- Name: cluster_services id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cluster_services ALTER COLUMN id SET DEFAULT nextval('public.cluster_services_id_seq'::regclass);


--
-- Name: user_spotify_accounts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_spotify_accounts ALTER COLUMN id SET DEFAULT nextval('public.user_spotify_accounts_id_seq'::regclass);


--
-- Name: avatar_designs avatar_designs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avatar_designs
    ADD CONSTRAINT avatar_designs_pkey PRIMARY KEY (id);


--
-- Name: cluster_services cluster_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cluster_services
    ADD CONSTRAINT cluster_services_pkey PRIMARY KEY (id);


--
-- Name: cluster_services cluster_services_service_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cluster_services
    ADD CONSTRAINT cluster_services_service_key_key UNIQUE (service_key);


--
-- Name: custom_themes custom_themes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_themes
    ADD CONSTRAINT custom_themes_pkey PRIMARY KEY (id);


--
-- Name: custom_themes custom_themes_theme_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_themes
    ADD CONSTRAINT custom_themes_theme_key_key UNIQUE (theme_key);


--
-- Name: game_catalog game_catalog_game_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_catalog
    ADD CONSTRAINT game_catalog_game_key_key UNIQUE (game_key);


--
-- Name: game_catalog game_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_catalog
    ADD CONSTRAINT game_catalog_pkey PRIMARY KEY (id);


--
-- Name: song_comments song_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_comments
    ADD CONSTRAINT song_comments_pkey PRIMARY KEY (id);


--
-- Name: song_ratings song_ratings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_ratings
    ADD CONSTRAINT song_ratings_pkey PRIMARY KEY (id);


--
-- Name: song_ratings song_ratings_unique_user_share; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_ratings
    ADD CONSTRAINT song_ratings_unique_user_share UNIQUE (song_share_id, user_id);


--
-- Name: song_recommendation_cache song_recommendation_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_recommendation_cache
    ADD CONSTRAINT song_recommendation_cache_pkey PRIMARY KEY (id);


--
-- Name: song_suggestions song_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_suggestions
    ADD CONSTRAINT song_suggestions_pkey PRIMARY KEY (id);


--
-- Name: user_spotify_accounts user_spotify_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_spotify_accounts
    ADD CONSTRAINT user_spotify_accounts_pkey PRIMARY KEY (id);


--
-- Name: user_spotify_accounts user_spotify_accounts_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_spotify_accounts
    ADD CONSTRAINT user_spotify_accounts_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_user_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_user_name_key UNIQUE (user_name);


--
-- Name: idx_avatar_designs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_avatar_designs_user_id ON public.avatar_designs USING btree (user_id);


--
-- Name: idx_game_catalog_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_catalog_active ON public.game_catalog USING btree (is_active);


--
-- Name: idx_game_catalog_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_catalog_category ON public.game_catalog USING btree (category);


--
-- Name: idx_game_catalog_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_catalog_created_at ON public.game_catalog USING btree (created_at DESC);


--
-- Name: idx_game_catalog_sort_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_catalog_sort_order ON public.game_catalog USING btree (sort_order);


--
-- Name: idx_game_catalog_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_catalog_status ON public.game_catalog USING btree (status);


--
-- Name: idx_song_comments_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_comments_created_at ON public.song_comments USING btree (created_at);


--
-- Name: idx_song_comments_song_share_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_comments_song_share_id ON public.song_comments USING btree (song_share_id);


--
-- Name: idx_song_comments_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_comments_user_id ON public.song_comments USING btree (user_id);


--
-- Name: idx_song_ratings_song_share_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_ratings_song_share_id ON public.song_ratings USING btree (song_share_id);


--
-- Name: idx_song_ratings_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_ratings_user_id ON public.song_ratings USING btree (user_id);


--
-- Name: idx_song_suggestions_feed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_suggestions_feed ON public.song_suggestions USING btree (date_added DESC, id DESC);


--
-- Name: idx_song_suggestions_lyrics; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_suggestions_lyrics ON public.song_suggestions USING btree (date_added DESC) WHERE (post_type = 'lyrics'::text);


--
-- Name: idx_song_suggestions_post_type_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_suggestions_post_type_date ON public.song_suggestions USING btree (post_type, date_added DESC);


--
-- Name: idx_song_suggestions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_song_suggestions_user_id ON public.song_suggestions USING btree (user_id);


--
-- Name: idx_user_spotify_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_spotify_user_id ON public.user_spotify_accounts USING btree (user_id);


--
-- Name: avatar_designs avatar_designs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avatar_designs
    ADD CONSTRAINT avatar_designs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: song_comments song_comments_song_share_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_comments
    ADD CONSTRAINT song_comments_song_share_fk FOREIGN KEY (song_share_id) REFERENCES public.song_suggestions(id) ON DELETE CASCADE;


--
-- Name: song_comments song_comments_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_comments
    ADD CONSTRAINT song_comments_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: song_ratings song_ratings_song_share_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_ratings
    ADD CONSTRAINT song_ratings_song_share_fk FOREIGN KEY (song_share_id) REFERENCES public.song_suggestions(id) ON DELETE CASCADE;


--
-- Name: song_ratings song_ratings_user_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_ratings
    ADD CONSTRAINT song_ratings_user_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: song_suggestions song_suggestions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.song_suggestions
    ADD CONSTRAINT song_suggestions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_spotify_accounts user_spotify_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_spotify_accounts
    ADD CONSTRAINT user_spotify_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict c8BEY7chtfDXuq8M2LPGdz93IwFiGKiD9yQ1mORIEXmKx6FuOiA9DYrz49MdJIx

