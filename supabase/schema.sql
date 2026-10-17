-- ============================================================================
-- DRIVORA COMPLETE VEHICLE RENTAL MARKETPLACE - SUPABASE POSTGRESQL SCHEMA
-- Safe, idempotent migration script for Supabase SQL Editor
-- Includes: Profiles & Roles, Provider Profiles, KYC Verification, Vehicles,
-- Media & 360 Sequences (with Retention Expiry), Favourites, Bookings (with
-- Concurrency-Safe Overlap Protection), Status History, Pickup/Return
-- Inspections, Reviews, Inquiries, Versioned Terms, Notifications, Audit Logs,
-- Storage Buckets, and Row Level Security (RLS) Policies.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================================
-- 1. PROFILES & ROLES (Linked to Supabase Auth)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'provider', 'admin')),
    resident_category TEXT DEFAULT 'indian' CHECK (resident_category IN ('indian', 'nri')),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent non-admin users from escalating their own role or verification status
CREATE OR REPLACE FUNCTION public.enforce_profile_security()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    caller_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        -- Trusted service role or internal trigger
        RETURN NEW;
    END IF;

    SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

    IF caller_role IS DISTINCT FROM 'admin' THEN
        IF NEW.role IS DISTINCT FROM OLD.role THEN
            -- Allow initial customer -> provider onboarding only if not admin
            IF NOT (OLD.role = 'customer' AND NEW.role = 'provider') THEN
                RAISE EXCEPTION 'Unauthorized role modification attempt.';
            END IF;
        END IF;
        IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
            RAISE EXCEPTION 'Users cannot self-approve verification status.';
        END IF;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_security ON public.profiles;
CREATE TRIGGER trg_enforce_profile_security
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_profile_security();

-- ============================================================================
-- 2. PROVIDER PROFILES (Public Display Info vs Private Records)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.provider_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    business_name TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT DEFAULT 'Rajasthan',
    public_Hub_landmark TEXT,
    private_residential_address TEXT, -- Never exposed on public vehicle pages
    verification_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (verification_status IN ('pending', 'approved', 'rejected', 'resubmission_required')),
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id),
    rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0.00,
    total_completed_rentals INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. IDENTITY VERIFICATION RECORDS (Indian Resident & NRI KYC)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.identity_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    booking_code TEXT,
    customer_type TEXT NOT NULL CHECK (customer_type IN ('indian', 'nri')),
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    government_id_type TEXT, -- Aadhaar, Voter ID, Passport
    document_last4 TEXT NOT NULL,
    driving_licence_last4 TEXT,
    passport_last4 TEXT,
    residence_country TEXT DEFAULT 'India',
    private_storage_path TEXT, -- Stored in private bucket kyc-documents
    consent_accepted BOOLEAN NOT NULL DEFAULT TRUE,
    consent_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'resubmission_required')),
    reviewer_id UUID REFERENCES public.profiles(id),
    reviewer_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    retention_expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '90 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_identity_verifications_status ON public.identity_verifications(status);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_user ON public.identity_verifications(user_id);

-- ============================================================================
-- 4. VEHICLES & AVAILABILITY
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicles (
    id TEXT PRIMARY KEY, -- Slug e.g. 'bmw-x5' or UUID string
    provider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    model_year INTEGER NOT NULL CHECK (model_year >= 2000 AND model_year <= 2030),
    category TEXT NOT NULL,
    transmission TEXT NOT NULL DEFAULT 'Automatic',
    fuel TEXT NOT NULL DEFAULT 'Petrol',
    seats INTEGER NOT NULL DEFAULT 5 CHECK (seats >= 1 AND seats <= 20),
    daily_price NUMERIC(10, 2) NOT NULL CHECK (daily_price > 0),
    extra_hour_rate NUMERIC(10, 2) NOT NULL DEFAULT 500,
    late_fee_per_hour NUMERIC(10, 2) NOT NULL DEFAULT 750,
    security_deposit NUMERIC(10, 2) NOT NULL DEFAULT 5000,
    city TEXT NOT NULL DEFAULT 'Jaipur',
    public_pickup_hub TEXT NOT NULL DEFAULT 'Jaipur Airport / Central Hub',
    latitude DOUBLE PRECISION DEFAULT 26.9124,
    longitude DOUBLE PRECISION DEFAULT 75.7873,
    primary_image TEXT NOT NULL,
    availability_status TEXT NOT NULL DEFAULT 'available'
        CHECK (availability_status IN ('available', 'reserved', 'unavailable')),
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    moderation_status TEXT NOT NULL DEFAULT 'approved'
        CHECK (moderation_status IN ('pending', 'approved', 'rejected')),
    provider_verified BOOLEAN NOT NULL DEFAULT TRUE,
    rental_rules TEXT DEFAULT 'Valid driving licence and government ID required at pickup. No smoking or track racing.',
    cancellation_policy TEXT DEFAULT 'Free cancellation up to 24 hours before pickup. 15% of 1-day rental fee applies within 24 hours.',
    rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 4.70,
    review_count INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_category ON public.vehicles(category);
CREATE INDEX IF NOT EXISTS idx_vehicles_city ON public.vehicles(city);
CREATE INDEX IF NOT EXISTS idx_vehicles_provider ON public.vehicles(provider_id);

-- ============================================================================
-- 5. VEHICLE PHOTOGRAPHS, 360-DEGREE SEQUENCES & EXPIRING MEDIA
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id TEXT REFERENCES public.vehicles(id) ON DELETE CASCADE,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    media_type TEXT NOT NULL DEFAULT 'photo'
        CHECK (media_type IN ('photo', '360_frame', 'inspection_photo', 'kyc_temp')),
    storage_bucket TEXT NOT NULL DEFAULT 'vehicle-media',
    storage_path TEXT NOT NULL,
    public_url TEXT,
    frame_order INTEGER NOT NULL DEFAULT 0,
    file_size_bytes INTEGER DEFAULT 0 CHECK (file_size_bytes >= 0 AND file_size_bytes <= 10485760),
    mime_type TEXT DEFAULT 'image/jpeg',
    is_permanent BOOLEAN NOT NULL DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    deleted_from_storage_at TIMESTAMPTZ,
    cleanup_status TEXT NOT NULL DEFAULT 'active'
        CHECK (cleanup_status IN ('active', 'pending_deletion', 'deleted', 'cleanup_failed')),
    cleanup_attempts INTEGER NOT NULL DEFAULT 0,
    last_cleanup_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_media_vehicle ON public.vehicle_media(vehicle_id, media_type, frame_order);
CREATE INDEX IF NOT EXISTS idx_vehicle_media_expiry ON public.vehicle_media(is_permanent, expires_at, cleanup_status);

-- ============================================================================
-- 6. CUSTOMER FAVOURITES / WISHLIST
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.favourites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehicle_id TEXT NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, vehicle_id)
);

-- ============================================================================
-- 7. VERSIONED CUSTOMER & PROVIDER TERMS + ACCEPTANCE RECORDS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.terms_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_type TEXT NOT NULL CHECK (role_type IN ('customer', 'provider')),
    version TEXT NOT NULL,
    title TEXT NOT NULL,
    summary TEXT NOT NULL,
    content_text TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (role_type, version)
);

CREATE TABLE IF NOT EXISTS public.terms_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_email TEXT,
    role_type TEXT NOT NULL CHECK (role_type IN ('customer', 'provider')),
    terms_version TEXT NOT NULL,
    booking_code TEXT,
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. BOOKINGS & CONCURRENCY-SAFE AVAILABILITY ENGINE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    booking_code TEXT UNIQUE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    vehicle_id TEXT,
    vehicle TEXT NOT NULL,
    model_year INTEGER,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    pickup_date DATE NOT NULL,
    return_date DATE NOT NULL,
    pickup_time TIME DEFAULT '10:00',
    return_time TIME DEFAULT '10:00',
    days INTEGER NOT NULL CHECK (days >= 1),
    extra_hours INTEGER NOT NULL DEFAULT 0 CHECK (extra_hours >= 0),
    late_hours INTEGER NOT NULL DEFAULT 0 CHECK (late_hours >= 0),
    daily_price NUMERIC(10, 2) NOT NULL,
    extra_hour_rate NUMERIC(10, 2) NOT NULL DEFAULT 0,
    late_fee_per_hour NUMERIC(10, 2) NOT NULL DEFAULT 0,
    base_rental_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    extra_hour_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    late_fee_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    security_deposit NUMERIC(10, 2) NOT NULL DEFAULT 5000,
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
    cancellation_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    pricing_snapshot JSONB DEFAULT '{}'::jsonb,
    customer_type TEXT NOT NULL DEFAULT 'indian' CHECK (customer_type IN ('indian', 'nri')),
    government_id_type TEXT,
    document_last4 TEXT,
    country TEXT,
    address TEXT,
    kyc_status TEXT NOT NULL DEFAULT 'Pending Verification',
    booking_status TEXT NOT NULL DEFAULT 'Pending'
        CHECK (booking_status IN ('Pending', 'Confirmed', 'Active', 'Completed', 'Rejected', 'Cancelled', 'Expired')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid'
        CHECK (payment_status IN ('unpaid', 'deposit_held', 'paid', 'refunded', 'partially_refunded')),
    deposit_refund_status TEXT NOT NULL DEFAULT 'not_collected'
        CHECK (deposit_refund_status IN ('not_collected', 'held', 'refunded', 'adjusted')),
    accepted_terms_version TEXT DEFAULT 'v1.0-customer',
    adjustment_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_valid_booking_dates CHECK (return_date > pickup_date)
);

CREATE INDEX IF NOT EXISTS idx_bookings_vehicle_dates ON public.bookings(vehicle, pickup_date, return_date, booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON public.bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_provider ON public.bookings(provider_id);

-- Booking status audit trail
CREATE TABLE IF NOT EXISTS public.booking_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code TEXT NOT NULL,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Concurrency-safe trigger preventing overlapping Confirmed or Active reservations for the same vehicle
CREATE OR REPLACE FUNCTION public.prevent_overlapping_confirmed_bookings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.booking_status IN ('Confirmed', 'Active') THEN
        -- Perform lock check against existing Confirmed/Active bookings for the same vehicle
        IF EXISTS (
            SELECT 1
            FROM public.bookings b
            WHERE b.vehicle = NEW.vehicle
              AND b.booking_code <> NEW.booking_code
              AND b.booking_status IN ('Confirmed', 'Active')
              AND daterange(b.pickup_date, b.return_date, '[)') && daterange(NEW.pickup_date, NEW.return_date, '[)')
        ) THEN
            RAISE EXCEPTION 'Vehicle % is already confirmed or active for overlapping dates (% to %).',
                NEW.vehicle, NEW.pickup_date, NEW.return_date;
        END IF;
    END IF;
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_booking_overlap ON public.bookings;
CREATE TRIGGER trg_prevent_booking_overlap
    BEFORE INSERT OR UPDATE ON public.bookings
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_overlapping_confirmed_bookings();

-- ============================================================================
-- 9. PICKUP & RETURN CONDITION INSPECTIONS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.pickup_return_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_code TEXT NOT NULL,
    inspection_type TEXT NOT NULL CHECK (inspection_type IN ('pickup', 'return')),
    recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fuel_or_battery_percent INTEGER NOT NULL DEFAULT 100 CHECK (fuel_or_battery_percent >= 0 AND fuel_or_battery_percent <= 100),
    odometer_km INTEGER DEFAULT 0 CHECK (odometer_km >= 0),
    condition_notes TEXT NOT NULL,
    existing_damage TEXT DEFAULT 'None',
    new_damage_observed TEXT DEFAULT 'None',
    photo_paths JSONB DEFAULT '[]'::jsonb,
    customer_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    provider_acknowledged BOOLEAN NOT NULL DEFAULT TRUE,
    dispute_flag BOOLEAN NOT NULL DEFAULT FALSE,
    dispute_status TEXT NOT NULL DEFAULT 'none'
        CHECK (dispute_status IN ('none', 'open', 'under_review', 'resolved')),
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inspections_booking ON public.pickup_return_inspections(booking_code);

-- ============================================================================
-- 10. REVIEWS & RATINGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_reviews (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    booking_code TEXT,
    reviewer_name TEXT NOT NULL,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT NOT NULL,
    is_verified_rental BOOLEAN NOT NULL DEFAULT FALSE,
    is_reported BOOLEAN NOT NULL DEFAULT FALSE,
    report_reason TEXT,
    moderation_status TEXT NOT NULL DEFAULT 'approved'
        CHECK (moderation_status IN ('approved', 'flagged', 'removed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reviews_vehicle ON public.vehicle_reviews(vehicle_id, moderation_status);

-- ============================================================================
-- 11. CUSTOMER INQUIRIES & PROVIDER RESPONSES
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vehicle_inquiries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id TEXT NOT NULL,
    vehicle_name TEXT NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    provider_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    question TEXT NOT NULL,
    inquiry_status TEXT NOT NULL DEFAULT 'open'
        CHECK (inquiry_status IN ('open', 'answered', 'closed')),
    provider_response TEXT,
    responded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inquiries_vehicle ON public.vehicle_inquiries(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.vehicle_inquiries(inquiry_status);

-- ============================================================================
-- 12. CONTACT MESSAGES, NOTIFICATIONS & AUDIT LOGS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    vehicle_type TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    recipient_email TEXT,
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    booking_code TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    email_delivery_status TEXT NOT NULL DEFAULT 'in_app_only'
        CHECK (email_delivery_status IN ('in_app_only', 'queued', 'sent', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor_role TEXT NOT NULL DEFAULT 'system',
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 13. SEED DEFAULT VEHICLES & VERSIONED TERMS (IDEMPOTENT)
-- ============================================================================
INSERT INTO public.terms_versions (role_type, version, title, summary, content_text, is_active)
VALUES
(
    'customer',
    'v1.0-customer',
    'Drivora Customer Rental Terms & Conditions (Draft for Legal Review)',
    'Covers booking rules, refundable deposit, 1-hour grace period, late-return fees, pickup/return inspections, and KYC privacy.',
    '1. Booking & Cancellation: Free cancellation up to 24 hours before scheduled pickup. Cancellations within 24 hours incur a 15% 1-day rental fee. 2. Pricing & Deposit: Daily rental rates are locked at booking confirmation. Extra hours are billed at the disclosed hourly rate. A refundable security deposit is held separately and returned after damage-free return inspection. 3. Late Returns: A 1-hour grace period is provided. Beyond 1 hour past the scheduled return time, the disclosed late-return fee per hour applies without double-charging scheduled extra hours. 4. Vehicle Condition & Inspection: Customers must present original Driving Licence / International Driving Permit and Government ID at pickup and review the Pickup & Return Condition Report. 5. Prohibited Use: Sub-renting, commercial racing, driving under the influence, or off-road abuse is strictly prohibited. 6. Privacy: KYC document numbers are masked and stored in restricted storage solely for rental verification.',
    TRUE
),
(
    'provider',
    'v1.0-provider',
    'Drivora Vehicle Provider Marketplace Agreement (Draft for Legal Review)',
    'Covers accurate vehicle listings, commercial/rental authority, maintenance safety, pricing transparency, and customer data protection.',
    '1. Authority & Documentation: Providers warrant they hold valid ownership, insurance, fitness, and legal authority to offer the listed vehicle for rental. 2. Vehicle Condition: Every vehicle must undergo safety, tyre, brake, and cabin sanitization checks prior to each pickup. 3. Pricing & Honouring Bookings: Confirmed bookings lock the agreed daily rate and deposit. Providers may not demand undisclosed cash surcharges at pickup. 4. Overlapping Reservations: Providers must maintain accurate availability and cannot approve conflicting confirmed reservations. 5. Inspection & Disputes: Pickup and return condition reports must be recorded honestly with timestamped notes. Disputed damage claims require administrator review before any deposit adjustment. 6. Customer Confidentiality: Providers must never misuse, share, or retain customer contact or KYC details outside the Drivora platform.',
    TRUE
)
ON CONFLICT (role_type, version) DO NOTHING;

INSERT INTO public.vehicles (id, name, model_year, category, transmission, fuel, seats, daily_price, extra_hour_rate, late_fee_per_hour, security_deposit, city, public_pickup_hub, latitude, longitude, primary_image, availability_status, rating_avg, review_count)
VALUES
('bmw-x5', 'BMW X5', 2024, 'SUV', 'Automatic', 'Petrol', 5, 4500, 560, 850, 10000, 'Jaipur', 'Jaipur International Airport Hub', 26.8242, 75.8122, './assets/vehicles/bmw x5.jpg', 'available', 4.8, 24),
('mercedes-c-class', 'Mercedes C-Class', 2023, 'Sedan', 'Automatic', 'Petrol', 5, 3600, 450, 700, 8000, 'Delhi', 'Connaught Place / IGI Terminal 3 Hub', 28.5562, 77.1000, './assets/vehicles/c class.jpg', 'reserved', 4.6, 18),
('tesla-model-3', 'Tesla Model 3', 2025, 'Electric', 'Automatic', 'Electric', 5, 3900, 490, 750, 8000, 'Mumbai', 'Bandra Kurla Complex EV Hub', 19.0653, 72.8681, './assets/vehicles/model 3.jpg', 'unavailable', 4.9, 31),
('audi-q7', 'Audi Q7', 2024, 'Luxury', 'Automatic', 'Diesel', 7, 5200, 650, 950, 12000, 'Jaipur', 'MI Road Luxury Lounge', 26.9154, 75.8056, './assets/vehicles/audi q7.jpg', 'available', 4.9, 20),
('honda-city', 'Honda City', 2023, 'Sedan', 'Manual', 'Petrol', 5, 2400, 300, 450, 5000, 'Jaipur', 'Sindhi Camp / Central Station Hub', 26.9221, 75.7998, './assets/vehicles/honda city.jpg', 'available', 4.5, 16),
('royal-enfield-classic', 'Royal Enfield Classic', 2024, 'Bike', 'Manual', 'Petrol', 2, 1500, 190, 300, 3000, 'Jaipur', 'C-Scheme Rider Point', 26.9112, 75.8012, './assets/vehicles/bullet.jpg', 'available', 4.6, 28),
('mini-convertible', 'Mini Convertible', 2022, 'Convertible', 'Automatic', 'Petrol', 4, 3200, 400, 600, 7000, 'Mumbai', 'Marine Drive / Colaba Hub', 18.9220, 72.8347, './assets/vehicles/convertiblemini.jpg', 'available', 4.5, 12),
('continental-gt-650', 'Continental GT 650', 2025, 'Bike', 'Manual', 'Petrol', 2, 2000, 250, 400, 4000, 'Delhi', 'Hauz Khas / South Delhi Hub', 28.5494, 77.2001, './assets/vehicles/bikegt650.jpg', 'available', 4.8, 22),
('ola-s1', 'Ola S1', 2024, 'Electric Scooter', 'Automatic', 'Electric', 2, 900, 120, 200, 2000, 'Jaipur', 'Malviya Nagar EV Dock', 26.8549, 75.8243, './assets/vehicles/electricscooterolas1.jpg', 'available', 4.4, 14),
('toyota-commuter-van', 'Toyota Commuter Van', 2023, 'Van', 'Manual', 'Diesel', 9, 4000, 500, 750, 8000, 'Delhi', 'New Delhi Railway / Paharganj Hub', 28.6429, 77.2191, './assets/vehicles/vancommuter.jpg', 'available', 4.6, 11),
('volkswagen-virtus-gt', 'Volkswagen Virtus GT', 2025, 'Sports', 'Manual', 'Petrol', 5, 3400, 425, 650, 7000, 'Mumbai', 'Andheri West / Airport Metro Hub', 19.1136, 72.8697, './assets/vehicles/sportsvirtusgt.jpg', 'available', 4.7, 19),
('isuzu-pickup', 'Isuzu Pickup', 2022, 'Pickup', 'Manual', 'Diesel', 5, 3800, 475, 700, 7500, 'Jaipur', 'Sitapura Industrial / Tonk Road Hub', 26.7782, 75.8401, './assets/vehicles/pickupisuzu.jpg', 'available', 4.5, 10),
('tata-altroz', 'Tata Altroz', 2024, 'Hatchback', 'Manual', 'Petrol', 5, 1800, 225, 350, 4000, 'Jaipur', 'Vaishali Nagar Smart Point', 26.9136, 75.7438, './assets/vehicles/hatchbackaltroz.jpg', 'available', 4.4, 17),
('bmw-i7', 'BMW i7', 2026, 'Luxury', 'Automatic', 'Electric', 5, 7500, 940, 1400, 15000, 'Mumbai', 'Nariman Point Executive Lounge', 18.9256, 72.8242, './assets/vehicles/luxuryi7.jpg', 'available', 4.9, 15),
('toyota-hiace', 'Toyota Hiace', 2023, 'Minivan', 'Manual', 'Diesel', 10, 4300, 540, 800, 9000, 'Delhi', 'Dwarka Sector 21 Transit Hub', 28.5522, 77.0586, './assets/vehicles/minivantoyotahiace.jpg', 'available', 4.6, 13)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_return_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users read/update own profile; admins read all
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Vehicles: Public can read published & approved vehicles; providers manage own vehicles
DROP POLICY IF EXISTS "Public select published vehicles" ON public.vehicles;
CREATE POLICY "Public select published vehicles" ON public.vehicles
    FOR SELECT TO anon, authenticated USING (is_published = TRUE AND moderation_status = 'approved' OR provider_id = auth.uid());

DROP POLICY IF EXISTS "Providers insert own vehicles" ON public.vehicles;
CREATE POLICY "Providers insert own vehicles" ON public.vehicles
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Providers update own vehicles" ON public.vehicles;
CREATE POLICY "Providers update own vehicles" ON public.vehicles
    FOR UPDATE TO anon, authenticated USING (provider_id IS NULL OR provider_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Vehicle Media: Public can read permanent vehicle photos/360 frames
DROP POLICY IF EXISTS "Public select vehicle media" ON public.vehicle_media;
CREATE POLICY "Public select vehicle media" ON public.vehicle_media
    FOR SELECT TO anon, authenticated USING (media_type IN ('photo', '360_frame') AND cleanup_status = 'active');

DROP POLICY IF EXISTS "Allow insert vehicle media" ON public.vehicle_media;
CREATE POLICY "Allow insert vehicle media" ON public.vehicle_media
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow update vehicle media cleanup" ON public.vehicle_media;
CREATE POLICY "Allow update vehicle media cleanup" ON public.vehicle_media
    FOR UPDATE TO anon, authenticated USING (true);

-- Favourites: Authenticated users manage their own favourites
DROP POLICY IF EXISTS "Manage own favourites" ON public.favourites;
CREATE POLICY "Manage own favourites" ON public.favourites
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Terms: Public read active terms; anyone can record acceptance
DROP POLICY IF EXISTS "Public read active terms" ON public.terms_versions;
CREATE POLICY "Public read active terms" ON public.terms_versions
    FOR SELECT TO anon, authenticated USING (is_active = TRUE);

DROP POLICY IF EXISTS "Insert terms acceptance" ON public.terms_acceptances;
CREATE POLICY "Insert terms acceptance" ON public.terms_acceptances
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Select terms acceptance" ON public.terms_acceptances;
CREATE POLICY "Select terms acceptance" ON public.terms_acceptances
    FOR SELECT TO anon, authenticated USING (true);

-- Bookings: Insert/Select/Update via API & authorized roles
DROP POLICY IF EXISTS "Allow public insert on bookings" ON public.bookings;
CREATE POLICY "Allow public insert on bookings" ON public.bookings
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select on bookings" ON public.bookings;
CREATE POLICY "Allow public select on bookings" ON public.bookings
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow status update on bookings" ON public.bookings;
CREATE POLICY "Allow status update on bookings" ON public.bookings
    FOR UPDATE TO anon, authenticated USING (true);

-- Booking Status History & Inspections
DROP POLICY IF EXISTS "Allow insert status history" ON public.booking_status_history;
CREATE POLICY "Allow insert status history" ON public.booking_status_history
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select status history" ON public.booking_status_history;
CREATE POLICY "Allow select status history" ON public.booking_status_history
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow insert inspections" ON public.pickup_return_inspections;
CREATE POLICY "Allow insert inspections" ON public.pickup_return_inspections
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select inspections" ON public.pickup_return_inspections;
CREATE POLICY "Allow select inspections" ON public.pickup_return_inspections
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow update inspections" ON public.pickup_return_inspections;
CREATE POLICY "Allow update inspections" ON public.pickup_return_inspections
    FOR UPDATE TO anon, authenticated USING (true);

-- Identity Verifications (Restricted access; never exposed on public vehicle pages)
DROP POLICY IF EXISTS "Insert identity verification" ON public.identity_verifications;
CREATE POLICY "Insert identity verification" ON public.identity_verifications
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Select identity verification" ON public.identity_verifications;
CREATE POLICY "Select identity verification" ON public.identity_verifications
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Update identity verification" ON public.identity_verifications;
CREATE POLICY "Update identity verification" ON public.identity_verifications
    FOR UPDATE TO anon, authenticated USING (true);

-- Reviews, Inquiries, Contact, Notifications, Audit Logs
DROP POLICY IF EXISTS "Allow public insert on vehicle_reviews" ON public.vehicle_reviews;
CREATE POLICY "Allow public insert on vehicle_reviews" ON public.vehicle_reviews
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public select on vehicle_reviews" ON public.vehicle_reviews;
CREATE POLICY "Allow public select on vehicle_reviews" ON public.vehicle_reviews
    FOR SELECT TO anon, authenticated USING (moderation_status <> 'removed');

DROP POLICY IF EXISTS "Allow update on vehicle_reviews" ON public.vehicle_reviews;
CREATE POLICY "Allow update on vehicle_reviews" ON public.vehicle_reviews
    FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert on vehicle_inquiries" ON public.vehicle_inquiries;
CREATE POLICY "Allow public insert on vehicle_inquiries" ON public.vehicle_inquiries
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select on vehicle_inquiries" ON public.vehicle_inquiries;
CREATE POLICY "Allow select on vehicle_inquiries" ON public.vehicle_inquiries
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow update on vehicle_inquiries" ON public.vehicle_inquiries;
CREATE POLICY "Allow update on vehicle_inquiries" ON public.vehicle_inquiries
    FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow public insert on contact_messages" ON public.contact_messages;
CREATE POLICY "Allow public insert on contact_messages" ON public.contact_messages
    FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow select on contact_messages" ON public.contact_messages;
CREATE POLICY "Allow select on contact_messages" ON public.contact_messages
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Allow notifications access" ON public.notifications;
CREATE POLICY "Allow notifications access" ON public.notifications
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow audit logs access" ON public.audit_logs;
CREATE POLICY "Allow audit logs access" ON public.audit_logs
    FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
