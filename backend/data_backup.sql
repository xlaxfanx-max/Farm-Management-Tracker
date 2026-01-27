--
-- PostgreSQL database dump
--

\restrict 0FldvnNuceHV7hYMgGH3wecM8jtPCPJup7eT8EQeUXCp7TQOD4zAg4mtNDid1w7

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

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
-- Data for Name: api_company; Type: TABLE DATA; Schema: public; Owner: -
--

SET SESSION AUTHORIZATION DEFAULT;

ALTER TABLE public.api_company DISABLE TRIGGER ALL;

COPY public.api_company (id, uuid, name, legal_name, primary_contact_name, phone, email, address, city, state, zip_code, operator_id, business_license, subscription_tier, subscription_start, subscription_end, max_farms, max_users, is_active, created_at, updated_at, estimated_total_acres, onboarding_completed, onboarding_completed_at, onboarding_step, primary_crop, county, federal_tax_id, notes, pca_license, qac_license, qal_license, state_tax_id, website) FROM stdin;
1	aa4758b6-2723-41cd-beb0-a726bd88c8bb	Finch Farms	Finch Farms LLC				900 Orange Rd.	Ojai	CA	93023			free	\N	\N	3	5	t	2025-12-18 08:07:47.597-07	2025-12-18 17:16:17.258-07	500	t	2025-12-18 08:11:21.165-07	complete	Citrus - Mixed	Ventura							
\.


ALTER TABLE public.api_company ENABLE TRIGGER ALL;

--
-- Data for Name: api_user; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.api_user DISABLE TRIGGER ALL;

COPY public.api_user (id, password, last_login, is_superuser, first_name, last_name, is_staff, is_active, date_joined, email, phone, job_title, applicator_license, license_expiration, pca_license, timezone, last_activity, created_at, updated_at, current_company_id) FROM stdin;
1	pbkdf2_sha256$600000$Rue9f6k5pqHC2yuNxnvu3N$i70YEvndbHy7fds+nxwY8s2sIFXhVhbS5KndwM/uMHk=	\N	t			t	t	2025-12-17 09:58:22.857-07	your@email.com				\N		America/Los_Angeles	2026-01-24 06:22:08.547437-07	2025-12-17 09:58:23.008-07	2025-12-18 17:36:28.603-07	1
2	pbkdf2_sha256$600000$KyphXqdqiF2p10Bxng10SM$X5bVFmuG74vAdP2Samvh9G0BXc0arrGY6k4B6mg9TF4=	\N	f	Michael	Finch	f	t	2026-01-15 15:50:02.58355-07	michael@finchfarmsllc.com				\N		America/Los_Angeles	2026-01-18 19:12:07.476224-07	2026-01-15 15:50:02.778044-07	2026-01-20 06:28:37.255284-07	1
\.


ALTER TABLE public.api_user ENABLE TRIGGER ALL;

--
-- Data for Name: api_auditbinder; Type: TABLE DATA; Schema: public; Owner: -
--

ALTER TABLE public.api_auditbinder DISABLE TRIGGER ALL;

COPY public.api_auditbinder (id, date_range_start, date_range_end, include_visitor_logs, include_cleaning_logs, include_safety_meetings, include_fertilizer_inventory, include_phi_reports, include_harvest_records, farm_ids, pdf_file, file_size, page_count, status, error_message, generation_started, generation_completed, notes, created_at, company_id, generated_by_id) FROM stdin;
