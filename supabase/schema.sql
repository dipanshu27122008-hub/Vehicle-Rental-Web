-- ============================================================================
-- Drivora Vehicle Rental - Supabase PostgreSQL Schema
-- Run this script in your Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================================

-- 1. Bookings & KYC Table
CREATE TABLE IF NOT EXISTS public.bookings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_code TEXT UNIQUE NOT NULL,
    vehicle TEXT NOT NULL,
    model_year INTEGER,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    pickup_date DATE NOT NULL,
    return_date DATE NOT NULL,
    days INTEGER NOT NULL,
    daily_price NUMERIC(10, 2) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    customer_type TEXT NOT NULL DEFAULT 'indian',
    government_id_type TEXT,
    document_last4 TEXT,
    country TEXT,
    address TEXT,
    kyc_status TEXT NOT NULL DEFAULT 'Pending Verification',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Vehicle Reviews Table
CREATE TABLE IF NOT EXISTS public.vehicle_reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    reviewer_name TEXT NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Vehicle Inquiries Table
CREATE TABLE IF NOT EXISTS public.vehicle_inquiries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    vehicle_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    question TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Contact Messages Table
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Row Level Security (RLS) Policies for Vercel Serverless API access
-- ============================================================================
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Allow anonymous/service insert & read via Vercel API routes
CREATE POLICY "Allow public insert on bookings"
    ON public.bookings FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public select on bookings"
    ON public.bookings FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert on vehicle_reviews"
    ON public.vehicle_reviews FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public select on vehicle_reviews"
    ON public.vehicle_reviews FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow public insert on vehicle_inquiries"
    ON public.vehicle_inquiries FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow public insert on contact_messages"
    ON public.contact_messages FOR INSERT TO anon, authenticated WITH CHECK (true);
