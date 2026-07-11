--
-- PostgreSQL database dump
--

\restrict lu5A8HTmKVUo88bERUVFjI2J2lye8QAfbdvL4k1yL3oTBnd6ASrtScie8Lb4dWp

-- Dumped from database version 18.4
-- Dumped by pg_dump version 18.4

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
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

-- *not* creating schema, since initdb creates it


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: allowances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.allowances (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: allowances_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.allowances_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: allowances_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.allowances_id_seq OWNED BY public.allowances.id;


--
-- Name: ambulance_missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ambulance_missions (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ambulance_missions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ambulance_missions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ambulance_missions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ambulance_missions_id_seq OWNED BY public.ambulance_missions.id;


--
-- Name: ambulance_vehicles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ambulance_vehicles (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ambulance_vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ambulance_vehicles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ambulance_vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ambulance_vehicles_id_seq OWNED BY public.ambulance_vehicles.id;


--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id integer NOT NULL,
    patient character varying(200) NOT NULL,
    doctor character varying(200) NOT NULL,
    date date NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: appointments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.appointments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: appointments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.appointments_id_seq OWNED BY public.appointments.id;


--
-- Name: assets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.assets (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: assets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.assets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: assets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.assets_id_seq OWNED BY public.assets.id;


--
-- Name: crm_campaign_targets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_campaign_targets (
    id integer NOT NULL,
    campaign_id integer NOT NULL,
    patient_id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_campaign_targets_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_campaign_targets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_campaign_targets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_campaign_targets_id_seq OWNED BY public.crm_campaign_targets.id;


--
-- Name: crm_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_campaigns (
    id integer NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_campaigns_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_campaigns_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_campaigns_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_campaigns_id_seq OWNED BY public.crm_campaigns.id;


--
-- Name: crm_follow_ups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_follow_ups (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_follow_ups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_follow_ups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_follow_ups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_follow_ups_id_seq OWNED BY public.crm_follow_ups.id;


--
-- Name: crm_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_interactions (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_interactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_interactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_interactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_interactions_id_seq OWNED BY public.crm_interactions.id;


--
-- Name: crm_patient_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.crm_patient_segments (
    id integer NOT NULL,
    patient_id integer NOT NULL,
    segment_code character varying(50) NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: crm_patient_segments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.crm_patient_segments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: crm_patient_segments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.crm_patient_segments_id_seq OWNED BY public.crm_patient_segments.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: doctors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.doctors (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    phone character varying(50) NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: doctors_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.doctors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: doctors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.doctors_id_seq OWNED BY public.doctors.id;


--
-- Name: documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documents (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: documents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: documents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.documents_id_seq OWNED BY public.documents.id;


--
-- Name: dossiers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.dossiers (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: dossiers_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.dossiers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dossiers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.dossiers_id_seq OWNED BY public.dossiers.id;


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    job_title character varying(200),
    status character varying(30) DEFAULT 'active'::character varying,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: employees_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.employees_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: employees_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.employees_id_seq OWNED BY public.employees.id;


--
-- Name: hospital_payment_gateways; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hospital_payment_gateways (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    hospital_id uuid NOT NULL,
    provider_code character varying(50) NOT NULL,
    is_active boolean DEFAULT true,
    is_sandbox boolean DEFAULT true,
    display_order integer DEFAULT 0,
    credentials_encrypted bytea,
    extra_config jsonb DEFAULT '{}'::jsonb,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: hospitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.hospitals (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    name_ar character varying(200) NOT NULL,
    name_en character varying(200) NOT NULL,
    address text,
    phone character varying(50),
    is_active boolean DEFAULT true,
    enabled_pages jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: incoming; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incoming (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: incoming_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incoming_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incoming_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incoming_id_seq OWNED BY public.incoming.id;


--
-- Name: inventory; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: inventory_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.inventory_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: inventory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.inventory_id_seq OWNED BY public.inventory.id;


--
-- Name: invoice_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoice_items (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    invoice_id integer,
    description_ar character varying(300),
    description_en character varying(300),
    quantity numeric(10,2) DEFAULT 1,
    unit_price numeric(14,2) NOT NULL,
    line_total numeric(14,2) NOT NULL
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    patient_id integer,
    status character varying(30) DEFAULT 'unpaid'::character varying,
    total numeric(14,2) DEFAULT 0,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: lab_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lab_tests (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: lab_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.lab_tests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: lab_tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.lab_tests_id_seq OWNED BY public.lab_tests.id;


--
-- Name: medical_leaves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.medical_leaves (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: medical_leaves_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.medical_leaves_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: medical_leaves_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.medical_leaves_id_seq OWNED BY public.medical_leaves.id;


--
-- Name: outgoing; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outgoing (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: outgoing_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.outgoing_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: outgoing_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.outgoing_id_seq OWNED BY public.outgoing.id;


--
-- Name: patients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.patients (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    phone character varying(50) NOT NULL,
    status character varying(30) DEFAULT 'active'::character varying,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: patients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.patients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: patients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.patients_id_seq OWNED BY public.patients.id;


--
-- Name: payment_providers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_providers (
    code character varying(50) NOT NULL,
    name_ar character varying(100) NOT NULL,
    name_en character varying(100) NOT NULL,
    provider_type character varying(20) NOT NULL,
    requires_credentials boolean DEFAULT true
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    hospital_id uuid,
    invoice_id integer,
    patient_id integer,
    provider_code character varying(50),
    amount numeric(14,2) NOT NULL,
    currency character varying(10) DEFAULT 'IQD'::character varying NOT NULL,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    gateway_transaction_id character varying(150),
    reference_note text,
    processed_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pharmacy_orders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pharmacy_orders (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: pharmacy_orders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pharmacy_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pharmacy_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pharmacy_orders_id_seq OWNED BY public.pharmacy_orders.id;


--
-- Name: procurement; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procurement (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: procurement_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.procurement_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: procurement_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.procurement_id_seq OWNED BY public.procurement.id;


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: projects_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.projects_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: projects_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.projects_id_seq OWNED BY public.projects.id;


--
-- Name: promotions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.promotions (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: promotions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.promotions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: promotions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.promotions_id_seq OWNED BY public.promotions.id;


--
-- Name: radiology; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.radiology (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: radiology_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.radiology_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: radiology_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.radiology_id_seq OWNED BY public.radiology.id;


--
-- Name: retired; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retired (
    id integer NOT NULL,
    name character varying(200) NOT NULL,
    job_title character varying(200),
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: retired_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.retired_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: retired_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.retired_id_seq OWNED BY public.retired.id;


--
-- Name: salaries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.salaries (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: salaries_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.salaries_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salaries_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.salaries_id_seq OWNED BY public.salaries.id;


--
-- Name: service_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_prices (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: service_prices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.service_prices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: service_prices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.service_prices_id_seq OWNED BY public.service_prices.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    key character varying(100) NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    hospital_id uuid,
    full_name character varying(200) NOT NULL,
    email character varying(200),
    role character varying(50) DEFAULT 'staff'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: vaccinations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vaccinations (
    id integer NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: vaccinations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.vaccinations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: vaccinations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.vaccinations_id_seq OWNED BY public.vaccinations.id;


--
-- Name: allowances id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowances ALTER COLUMN id SET DEFAULT nextval('public.allowances_id_seq'::regclass);


--
-- Name: ambulance_missions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_missions ALTER COLUMN id SET DEFAULT nextval('public.ambulance_missions_id_seq'::regclass);


--
-- Name: ambulance_vehicles id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_vehicles ALTER COLUMN id SET DEFAULT nextval('public.ambulance_vehicles_id_seq'::regclass);


--
-- Name: appointments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments ALTER COLUMN id SET DEFAULT nextval('public.appointments_id_seq'::regclass);


--
-- Name: assets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets ALTER COLUMN id SET DEFAULT nextval('public.assets_id_seq'::regclass);


--
-- Name: crm_campaign_targets id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_targets ALTER COLUMN id SET DEFAULT nextval('public.crm_campaign_targets_id_seq'::regclass);


--
-- Name: crm_campaigns id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaigns ALTER COLUMN id SET DEFAULT nextval('public.crm_campaigns_id_seq'::regclass);


--
-- Name: crm_follow_ups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_follow_ups ALTER COLUMN id SET DEFAULT nextval('public.crm_follow_ups_id_seq'::regclass);


--
-- Name: crm_interactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_interactions ALTER COLUMN id SET DEFAULT nextval('public.crm_interactions_id_seq'::regclass);


--
-- Name: crm_patient_segments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_patient_segments ALTER COLUMN id SET DEFAULT nextval('public.crm_patient_segments_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: doctors id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors ALTER COLUMN id SET DEFAULT nextval('public.doctors_id_seq'::regclass);


--
-- Name: documents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents ALTER COLUMN id SET DEFAULT nextval('public.documents_id_seq'::regclass);


--
-- Name: dossiers id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dossiers ALTER COLUMN id SET DEFAULT nextval('public.dossiers_id_seq'::regclass);


--
-- Name: employees id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees ALTER COLUMN id SET DEFAULT nextval('public.employees_id_seq'::regclass);


--
-- Name: incoming id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incoming ALTER COLUMN id SET DEFAULT nextval('public.incoming_id_seq'::regclass);


--
-- Name: inventory id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory ALTER COLUMN id SET DEFAULT nextval('public.inventory_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: lab_tests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests ALTER COLUMN id SET DEFAULT nextval('public.lab_tests_id_seq'::regclass);


--
-- Name: medical_leaves id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_leaves ALTER COLUMN id SET DEFAULT nextval('public.medical_leaves_id_seq'::regclass);


--
-- Name: outgoing id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outgoing ALTER COLUMN id SET DEFAULT nextval('public.outgoing_id_seq'::regclass);


--
-- Name: patients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients ALTER COLUMN id SET DEFAULT nextval('public.patients_id_seq'::regclass);


--
-- Name: pharmacy_orders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders ALTER COLUMN id SET DEFAULT nextval('public.pharmacy_orders_id_seq'::regclass);


--
-- Name: procurement id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement ALTER COLUMN id SET DEFAULT nextval('public.procurement_id_seq'::regclass);


--
-- Name: projects id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects ALTER COLUMN id SET DEFAULT nextval('public.projects_id_seq'::regclass);


--
-- Name: promotions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions ALTER COLUMN id SET DEFAULT nextval('public.promotions_id_seq'::regclass);


--
-- Name: radiology id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology ALTER COLUMN id SET DEFAULT nextval('public.radiology_id_seq'::regclass);


--
-- Name: retired id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retired ALTER COLUMN id SET DEFAULT nextval('public.retired_id_seq'::regclass);


--
-- Name: salaries id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salaries ALTER COLUMN id SET DEFAULT nextval('public.salaries_id_seq'::regclass);


--
-- Name: service_prices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_prices ALTER COLUMN id SET DEFAULT nextval('public.service_prices_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: vaccinations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccinations ALTER COLUMN id SET DEFAULT nextval('public.vaccinations_id_seq'::regclass);


--
-- Data for Name: allowances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.allowances (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ambulance_missions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ambulance_missions (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: ambulance_vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ambulance_vehicles (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.appointments (id, patient, doctor, date, status, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: assets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.assets (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_campaign_targets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crm_campaign_targets (id, campaign_id, patient_id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_campaigns; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crm_campaigns (id, status, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_follow_ups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crm_follow_ups (id, patient_id, status, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_interactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crm_interactions (id, patient_id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: crm_patient_segments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.crm_patient_segments (id, patient_id, segment_code, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: doctors; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.doctors (id, name, phone, status, data, created_at, updated_at) FROM stdin;
1	علي	767	active	{"id": 1783756082305, "bio": "", "fee": 25000, "spec": "Internal Medicine", "color": "#1a6bab", "avatar": "ع", "deptId": 1, "gender": "male", "nameEn": "", "rating": 4.5, "patients": 0, "workHours": "9:00 - 15:00", "experience": "", "availableDays": [], "specialization": "باطنية وصدرية"}	2026-07-11 10:48:02.314187+03	2026-07-11 10:48:02.314187+03
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.documents (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: dossiers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.dossiers (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employees (id, name, job_title, status, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: hospital_payment_gateways; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.hospital_payment_gateways (id, hospital_id, provider_code, is_active, is_sandbox, display_order, credentials_encrypted, extra_config, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: hospitals; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.hospitals (id, name_ar, name_en, address, phone, is_active, enabled_pages, created_at, updated_at) FROM stdin;
e0776548-eb57-454a-98dd-ee39e21be868	المنشأة الرئيسية	Main Facility	\N	\N	t	\N	2026-07-10 13:15:40.5715+03	2026-07-10 13:15:40.5715+03
ff1739d7-bbea-4ca6-ac08-ebca1aa45f3e	التعليمي	educational	البصرة	767	t	["patients", "doctors", "departments"]	2026-07-11 10:47:36.638038+03	2026-07-11 10:47:36.638038+03
\.


--
-- Data for Name: incoming; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.incoming (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: inventory; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.inventory (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: invoice_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoice_items (id, invoice_id, description_ar, description_en, quantity, unit_price, line_total) FROM stdin;
\.


--
-- Data for Name: invoices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.invoices (id, patient_id, status, total, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: lab_tests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.lab_tests (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: medical_leaves; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.medical_leaves (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: outgoing; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.outgoing (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.patients (id, name, phone, status, data, created_at, updated_at) FROM stdin;
7	تات	888888	active	{"id": 1783757660075, "age": "99", "color": "#06b6d4", "notes": "", "avatar": "ت", "doctor": "", "gender": "male", "nameEn": "", "allergies": "", "bloodType": "A+", "diagnosis": "", "insurance": "", "lastVisit": "2026-07-11", "patientId": "PT-0001", "hospitalId": "e0776548-eb57-454a-98dd-ee39e21be868", "totalVisits": 0, "chronicDiseases": ""}	2026-07-11 11:14:20.159559+03	2026-07-11 11:14:20.159559+03
8	تتا	8888888	active	{"id": 1783757845661, "age": "99", "color": "#1a6bab", "notes": "", "avatar": "ت", "doctor": "", "gender": "male", "nameEn": "", "allergies": "", "bloodType": "A+", "diagnosis": "", "insurance": "", "lastVisit": "2026-07-11", "patientId": "PT-0001", "hospitalId": "ff1739d7-bbea-4ca6-ac08-ebca1aa45f3e", "totalVisits": 0, "chronicDiseases": ""}	2026-07-11 11:17:25.764643+03	2026-07-11 11:17:25.764643+03
9	تاالاا	999999999	active	{"id": 1783758454542, "age": "7", "color": "#10b981", "notes": "", "avatar": "ت", "doctor": "", "gender": "male", "nameEn": "", "allergies": "", "bloodType": "A+", "diagnosis": "", "insurance": "", "lastVisit": "2026-07-11", "patientId": "PT-0001", "hospitalId": "ff1739d7-bbea-4ca6-ac08-ebca1aa45f3e", "totalVisits": 0, "chronicDiseases": ""}	2026-07-11 11:27:34.637465+03	2026-07-11 11:27:34.637465+03
10	تنن	87777777	active	{"id": 1783758589077, "age": "8", "color": "#10b981", "notes": "", "avatar": "ت", "doctor": "", "gender": "male", "nameEn": "", "allergies": "", "bloodType": "A+", "diagnosis": "", "insurance": "", "lastVisit": "2026-07-11", "patientId": "PT-0001", "totalVisits": 0, "chronicDiseases": ""}	2026-07-11 11:29:49.083842+03	2026-07-11 11:29:49.083842+03
11	nb	6666666	active	{"id": 1783759092842, "age": "8", "color": "#06b6d4", "notes": "", "avatar": "n", "doctor": "", "gender": "male", "nameEn": "", "allergies": "", "bloodType": "A+", "diagnosis": "", "insurance": "", "lastVisit": "2026-07-11", "patientId": "PT-0001", "hospitalId": "e0776548-eb57-454a-98dd-ee39e21be868", "totalVisits": 0, "chronicDiseases": ""}	2026-07-11 11:38:13.064233+03	2026-07-11 11:38:13.064233+03
12	تلتنل	7678	active	{"id": 1783759863957, "age": "8778", "color": "#8b5cf6", "notes": "", "avatar": "ت", "doctor": "", "gender": "male", "nameEn": "", "allergies": "", "bloodType": "A+", "diagnosis": "", "insurance": "", "lastVisit": "2026-07-11", "patientId": "PT-0001", "hospitalId": "e0776548-eb57-454a-98dd-ee39e21be868", "totalVisits": 0, "chronicDiseases": ""}	2026-07-11 11:51:03.966711+03	2026-07-11 11:51:03.966711+03
\.


--
-- Data for Name: payment_providers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_providers (code, name_ar, name_en, provider_type, requires_credentials) FROM stdin;
cash	دفع نقدي	Cash	cash	f
zaincash	زين كاش	ZainCash	local_card	t
fastpay	فاست باي	FastPay	local_card	t
qicard	كي كارد	Qi Card	local_card	t
bank_card	بطاقة مصرفية محلية	Local Bank Card	local_card	t
paypal	باي بال	PayPal	international	t
western_union	ويسترن يونيون	Western Union	international	t
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, hospital_id, invoice_id, patient_id, provider_code, amount, currency, status, gateway_transaction_id, reference_note, processed_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pharmacy_orders; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pharmacy_orders (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: procurement; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.procurement (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: promotions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.promotions (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: radiology; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.radiology (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: retired; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.retired (id, name, job_title, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: salaries; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.salaries (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: service_prices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.service_prices (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (key, value, updated_at) FROM stdin;
multi_hospital_enabled	true	2026-07-10 13:17:53.934117+03
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transactions (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, hospital_id, full_name, email, role, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: vaccinations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vaccinations (id, data, created_at, updated_at) FROM stdin;
\.


--
-- Name: allowances_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.allowances_id_seq', 1, false);


--
-- Name: ambulance_missions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ambulance_missions_id_seq', 1, false);


--
-- Name: ambulance_vehicles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ambulance_vehicles_id_seq', 1, false);


--
-- Name: appointments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.appointments_id_seq', 1, false);


--
-- Name: assets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.assets_id_seq', 1, false);


--
-- Name: crm_campaign_targets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.crm_campaign_targets_id_seq', 1, false);


--
-- Name: crm_campaigns_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.crm_campaigns_id_seq', 1, false);


--
-- Name: crm_follow_ups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.crm_follow_ups_id_seq', 1, false);


--
-- Name: crm_interactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.crm_interactions_id_seq', 1, false);


--
-- Name: crm_patient_segments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.crm_patient_segments_id_seq', 1, false);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.departments_id_seq', 1, false);


--
-- Name: doctors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.doctors_id_seq', 2, true);


--
-- Name: documents_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.documents_id_seq', 1, false);


--
-- Name: dossiers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.dossiers_id_seq', 1, false);


--
-- Name: employees_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.employees_id_seq', 1, false);


--
-- Name: incoming_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.incoming_id_seq', 1, false);


--
-- Name: inventory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.inventory_id_seq', 1, false);


--
-- Name: invoices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.invoices_id_seq', 1, false);


--
-- Name: lab_tests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.lab_tests_id_seq', 1, false);


--
-- Name: medical_leaves_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.medical_leaves_id_seq', 1, false);


--
-- Name: outgoing_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.outgoing_id_seq', 1, false);


--
-- Name: patients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.patients_id_seq', 14, true);


--
-- Name: pharmacy_orders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pharmacy_orders_id_seq', 1, false);


--
-- Name: procurement_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.procurement_id_seq', 1, false);


--
-- Name: projects_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.projects_id_seq', 1, false);


--
-- Name: promotions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.promotions_id_seq', 1, false);


--
-- Name: radiology_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.radiology_id_seq', 1, false);


--
-- Name: retired_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.retired_id_seq', 1, false);


--
-- Name: salaries_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.salaries_id_seq', 1, false);


--
-- Name: service_prices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.service_prices_id_seq', 1, false);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transactions_id_seq', 1, false);


--
-- Name: vaccinations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.vaccinations_id_seq', 1, false);


--
-- Name: allowances allowances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.allowances
    ADD CONSTRAINT allowances_pkey PRIMARY KEY (id);


--
-- Name: ambulance_missions ambulance_missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_missions
    ADD CONSTRAINT ambulance_missions_pkey PRIMARY KEY (id);


--
-- Name: ambulance_vehicles ambulance_vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ambulance_vehicles
    ADD CONSTRAINT ambulance_vehicles_pkey PRIMARY KEY (id);


--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);


--
-- Name: assets assets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);


--
-- Name: crm_campaign_targets crm_campaign_targets_campaign_id_patient_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_targets
    ADD CONSTRAINT crm_campaign_targets_campaign_id_patient_id_key UNIQUE (campaign_id, patient_id);


--
-- Name: crm_campaign_targets crm_campaign_targets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_targets
    ADD CONSTRAINT crm_campaign_targets_pkey PRIMARY KEY (id);


--
-- Name: crm_campaigns crm_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaigns
    ADD CONSTRAINT crm_campaigns_pkey PRIMARY KEY (id);


--
-- Name: crm_follow_ups crm_follow_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_follow_ups
    ADD CONSTRAINT crm_follow_ups_pkey PRIMARY KEY (id);


--
-- Name: crm_interactions crm_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_interactions
    ADD CONSTRAINT crm_interactions_pkey PRIMARY KEY (id);


--
-- Name: crm_patient_segments crm_patient_segments_patient_id_segment_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_patient_segments
    ADD CONSTRAINT crm_patient_segments_patient_id_segment_code_key UNIQUE (patient_id, segment_code);


--
-- Name: crm_patient_segments crm_patient_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_patient_segments
    ADD CONSTRAINT crm_patient_segments_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: doctors doctors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.doctors
    ADD CONSTRAINT doctors_pkey PRIMARY KEY (id);


--
-- Name: documents documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documents
    ADD CONSTRAINT documents_pkey PRIMARY KEY (id);


--
-- Name: dossiers dossiers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.dossiers
    ADD CONSTRAINT dossiers_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: hospital_payment_gateways hospital_payment_gateways_hospital_id_provider_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_payment_gateways
    ADD CONSTRAINT hospital_payment_gateways_hospital_id_provider_code_key UNIQUE (hospital_id, provider_code);


--
-- Name: hospital_payment_gateways hospital_payment_gateways_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_payment_gateways
    ADD CONSTRAINT hospital_payment_gateways_pkey PRIMARY KEY (id);


--
-- Name: hospitals hospitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospitals
    ADD CONSTRAINT hospitals_pkey PRIMARY KEY (id);


--
-- Name: incoming incoming_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incoming
    ADD CONSTRAINT incoming_pkey PRIMARY KEY (id);


--
-- Name: inventory inventory_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory
    ADD CONSTRAINT inventory_pkey PRIMARY KEY (id);


--
-- Name: invoice_items invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: lab_tests lab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lab_tests
    ADD CONSTRAINT lab_tests_pkey PRIMARY KEY (id);


--
-- Name: medical_leaves medical_leaves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.medical_leaves
    ADD CONSTRAINT medical_leaves_pkey PRIMARY KEY (id);


--
-- Name: outgoing outgoing_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outgoing
    ADD CONSTRAINT outgoing_pkey PRIMARY KEY (id);


--
-- Name: patients patients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.patients
    ADD CONSTRAINT patients_pkey PRIMARY KEY (id);


--
-- Name: payment_providers payment_providers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_providers
    ADD CONSTRAINT payment_providers_pkey PRIMARY KEY (code);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: pharmacy_orders pharmacy_orders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pharmacy_orders
    ADD CONSTRAINT pharmacy_orders_pkey PRIMARY KEY (id);


--
-- Name: procurement procurement_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procurement
    ADD CONSTRAINT procurement_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: promotions promotions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.promotions
    ADD CONSTRAINT promotions_pkey PRIMARY KEY (id);


--
-- Name: radiology radiology_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.radiology
    ADD CONSTRAINT radiology_pkey PRIMARY KEY (id);


--
-- Name: retired retired_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retired
    ADD CONSTRAINT retired_pkey PRIMARY KEY (id);


--
-- Name: salaries salaries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.salaries
    ADD CONSTRAINT salaries_pkey PRIMARY KEY (id);


--
-- Name: service_prices service_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_prices
    ADD CONSTRAINT service_prices_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


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
-- Name: vaccinations vaccinations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vaccinations
    ADD CONSTRAINT vaccinations_pkey PRIMARY KEY (id);


--
-- Name: idx_appointments_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_date ON public.appointments USING btree (date);


--
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);


--
-- Name: idx_campaign_targets_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_campaign_targets_campaign ON public.crm_campaign_targets USING btree (campaign_id);


--
-- Name: idx_crm_interactions_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_crm_interactions_patient ON public.crm_interactions USING btree (patient_id);


--
-- Name: idx_doctors_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_phone ON public.doctors USING btree (phone);


--
-- Name: idx_doctors_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_doctors_status ON public.doctors USING btree (status);


--
-- Name: idx_employees_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_status ON public.employees USING btree (status);


--
-- Name: idx_followups_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_status ON public.crm_follow_ups USING btree (status);


--
-- Name: idx_invoices_patient; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_patient ON public.invoices USING btree (patient_id);


--
-- Name: idx_invoices_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_invoices_status ON public.invoices USING btree (status);


--
-- Name: idx_patients_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_phone ON public.patients USING btree (phone);


--
-- Name: idx_patients_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_patients_status ON public.patients USING btree (status);


--
-- Name: idx_payments_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_invoice ON public.payments USING btree (invoice_id);


--
-- Name: idx_payments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_status ON public.payments USING btree (status);


--
-- Name: crm_campaign_targets crm_campaign_targets_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_targets
    ADD CONSTRAINT crm_campaign_targets_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.crm_campaigns(id) ON DELETE CASCADE;


--
-- Name: crm_campaign_targets crm_campaign_targets_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_campaign_targets
    ADD CONSTRAINT crm_campaign_targets_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: crm_follow_ups crm_follow_ups_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_follow_ups
    ADD CONSTRAINT crm_follow_ups_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: crm_interactions crm_interactions_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_interactions
    ADD CONSTRAINT crm_interactions_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: crm_patient_segments crm_patient_segments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.crm_patient_segments
    ADD CONSTRAINT crm_patient_segments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: hospital_payment_gateways hospital_payment_gateways_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_payment_gateways
    ADD CONSTRAINT hospital_payment_gateways_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: hospital_payment_gateways hospital_payment_gateways_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_payment_gateways
    ADD CONSTRAINT hospital_payment_gateways_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE CASCADE;


--
-- Name: hospital_payment_gateways hospital_payment_gateways_provider_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.hospital_payment_gateways
    ADD CONSTRAINT hospital_payment_gateways_provider_code_fkey FOREIGN KEY (provider_code) REFERENCES public.payment_providers(code);


--
-- Name: invoice_items invoice_items_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoice_items
    ADD CONSTRAINT invoice_items_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: invoices invoices_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE CASCADE;


--
-- Name: payments payments_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE SET NULL;


--
-- Name: payments payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE SET NULL;


--
-- Name: payments payments_patient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_patient_id_fkey FOREIGN KEY (patient_id) REFERENCES public.patients(id) ON DELETE SET NULL;


--
-- Name: payments payments_processed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_processed_by_fkey FOREIGN KEY (processed_by) REFERENCES public.users(id);


--
-- Name: payments payments_provider_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_provider_code_fkey FOREIGN KEY (provider_code) REFERENCES public.payment_providers(code);


--
-- Name: users users_hospital_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_hospital_id_fkey FOREIGN KEY (hospital_id) REFERENCES public.hospitals(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict lu5A8HTmKVUo88bERUVFjI2J2lye8QAfbdvL4k1yL3oTBnd6ASrtScie8Lb4dWp

