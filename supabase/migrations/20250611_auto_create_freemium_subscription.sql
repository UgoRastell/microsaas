-- Create a function to automatically create a freemium subscription when a new user is created
CREATE OR REPLACE FUNCTION public.auto_create_freemium_subscription() 
RETURNS TRIGGER AS $$
DECLARE
  v_subscription_id text;
  v_current_date timestamp with time zone;
  v_end_date timestamp with time zone;
BEGIN
  -- Generate a unique subscription ID
  v_subscription_id := 'sub_free_' || substr(replace(new.id::text, '-', ''), 1, 16);
  
  -- Get current date
  v_current_date := now();
  
  -- Set end date to one year from now
  v_end_date := v_current_date + interval '1 year';
  
  -- Insert the freemium subscription
  INSERT INTO public.subscriptions (
    id,
    status,
    plan_type,
    start_date,
    current_period_start,
    current_period_end,
    invoice_usage,
    invoice_limit,
    organization_id,
    customer_id,
    stripe_subscription_id,
    metadata,
    created_at,
    user_id
  ) VALUES (
    v_subscription_id,
    'active',
    'freemium',
    v_current_date,
    v_current_date,
    v_end_date,
    0,  -- No invoices used yet
    10, -- Freemium plan limit
    new.id::text, -- Use user ID as org ID for now
    new.id::text, -- Use user ID as customer ID for now
    NULL, -- No Stripe subscription for freemium
    '{"note": "Auto-generated freemium subscription"}'::jsonb,
    v_current_date,
    new.id
  );
  
  RAISE NOTICE 'Created freemium subscription for user %', new.id;
  
  RETURN new;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but don't fail the user creation
  RAISE WARNING 'Failed to create subscription for user %: %', new.id, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to run after profile creation
DROP TRIGGER IF EXISTS auto_create_subscription_trigger ON public.profiles;
CREATE TRIGGER auto_create_subscription_trigger
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_freemium_subscription();

-- Comment explaining the purpose
COMMENT ON FUNCTION public.auto_create_freemium_subscription() IS 'Automatically creates a freemium subscription when a new user profile is created';

-- For existing users without subscriptions, create them now
INSERT INTO public.subscriptions (
  id,
  status,
  plan_type,
  start_date,
  current_period_start,
  current_period_end,
  invoice_usage,
  invoice_limit,
  organization_id,
  customer_id,
  stripe_subscription_id,
  metadata,
  created_at,
  user_id
)
SELECT 
  'sub_free_' || substr(replace(p.id::text, '-', ''), 1, 16),
  'active',
  'freemium',
  now(),
  now(),
  now() + interval '1 year',
  0,
  10,
  p.id::text,
  p.id::text,
  NULL,
  '{"note": "Auto-generated freemium subscription for existing user"}'::jsonb,
  now(),
  p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id
);
